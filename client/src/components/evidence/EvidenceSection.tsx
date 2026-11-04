import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { FormField } from '../ui/FormField';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import {
  CameraIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  XCircleIcon,
  DownloadIcon,
  EyeIcon,
  CloseIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SearchIcon,
} from '../ui/icons';
import type { EvidenceDocument, EvidencePurpose, EvidenceReviewStatus } from '../../types/evidence';
import { useAuth } from '../../context/useAuth';

interface EvidenceSectionProps {
  complaintId?: string;
  trackingId: string;
  isOwner?: boolean;
  departmentId?: string;
  onEvidenceChange?: () => void;
  onSearchAgain?: () => void;
}

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function EvidenceSection({
  complaintId,
  trackingId,
  isOwner = false,
  departmentId,
  onEvidenceChange,
  onSearchAgain,
}: EvidenceSectionProps) {
  const { user, isAuthenticated } = useAuth();

  const [evidenceList, setEvidenceList] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'not_found' | 'forbidden' | 'error'>('idle');
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter tab
  const [purposeFilter, setPurposeFilter] = useState<string>('ALL');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPurpose, setUploadPurpose] = useState<EvidencePurpose>('CITIZEN_SUPPORTING');
  const [uploadDescription, setUploadDescription] = useState('');
  const [replacedDocId, setReplacedDocId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review modal state (Officials & Admins)
  const [reviewingDoc, setReviewingDoc] = useState<EvidenceDocument | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUESTED'>('VERIFIED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resubmissionGuidance, setResubmissionGuidance] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Quarantine modal state (Admin only)
  const [quarantiningDoc, setQuarantiningDoc] = useState<EvidenceDocument | null>(null);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);

  // Lightbox preview modal
  const [previewDoc, setPreviewDoc] = useState<EvidenceDocument | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isOfficial = user?.role === 'GOVERNMENT_OFFICIAL';
  const isAssignedDept = isOfficial && user?.departmentId === departmentId;
  const canReview = isAdmin || isAssignedDept;
  const canUpload = isAuthenticated && (isOwner || isOfficial || isAdmin);

  const targetId = (complaintId && complaintId !== 'undefined' && complaintId.trim().length > 0)
    ? complaintId.trim()
    : (trackingId && trackingId.trim().length > 0 ? trackingId.trim() : '');

  const fetchEvidence = useCallback(async () => {
    if (!targetId) {
      setFetchStatus('idle');
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchStatus('loading');
    setFetchErrorMessage(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/evidence/complaints/${encodeURIComponent(targetId)}`, {
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);

      if (res.status === 404) {
        setFetchStatus('not_found');
        setFetchErrorMessage(json?.error?.message || 'Complaint record not found in evidence registry.');
        setEvidenceList([]);
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setFetchStatus('forbidden');
        setFetchErrorMessage(
          json?.error?.message || 'Access restricted: you do not have permission to view evidence for this complaint.'
        );
        setEvidenceList([]);
        return;
      }

      if (!res.ok || !json || !json.success) {
        setFetchStatus('error');
        setFetchErrorMessage(json?.error?.message || 'Server error occurred while loading evidence records.');
        setEvidenceList([]);
        return;
      }

      if (!Array.isArray(json.data?.evidence)) {
        setFetchStatus('error');
        setFetchErrorMessage('Received an invalid response format from the evidence server.');
        setEvidenceList([]);
        return;
      }

      setEvidenceList(json.data.evidence);
      setFetchStatus('success');
    } catch {
      setFetchStatus('error');
      setFetchErrorMessage('Network failure: Unable to connect to evidence server. Please check your internet connection.');
      setEvidenceList([]);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // Open upload modal with prefilled replacement target
  const handleOpenResubmitModal = (doc: EvidenceDocument) => {
    setReplacedDocId(doc.id);
    setUploadPurpose(doc.evidencePurpose);
    setUploadDescription(`Replacement evidence for: ${doc.fileName}`);
    setUploadFiles([]);
    setUploadError(null);
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (!e.target.files) return;

    const selected = Array.from(e.target.files);
    if (selected.length + uploadFiles.length > 5) {
      setUploadError('You can upload at most 5 files in a single submission.');
      return;
    }

    const validFiles: File[] = [];
    for (const f of selected) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        setUploadError(`File '${f.name}' has an unsupported extension. Only JPG, PNG, WebP, and PDF are permitted.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(`File '${f.name}' exceeds the 10MB file size limit.`);
        return;
      }
      validFiles.push(f);
    }

    setUploadFiles((prev) => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadError('Please select at least one photograph or document to upload.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      uploadFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('evidencePurpose', uploadPurpose);
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim());
      }
      if (replacedDocId) {
        formData.append('replacedDocumentId', replacedDocId);
      }

      const res = await fetch(`/api/evidence/complaints/${encodeURIComponent(targetId)}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setUploadError(json.error?.message || 'Failed to upload evidence files.');
        return;
      }

      setSuccessMsg(`Successfully uploaded ${uploadFiles.length} evidence file(s). Upload is pending review.`);
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadDescription('');
      setReplacedDocId('');
      fetchEvidence();
      if (onEvidenceChange) onEvidenceChange();
    } catch {
      setUploadError('Network error occurred while uploading. Please retry.');
    } finally {
      setUploading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingDoc) return;

    if (reviewDecision === 'REJECTED' && rejectionReason.trim().length < 5) {
      setReviewError('A detailed reason for rejection is mandatory (at least 5 characters).');
      return;
    }
    if (reviewDecision === 'RESUBMISSION_REQUESTED' && resubmissionGuidance.trim().length < 5) {
      setReviewError('Guidance instructions are mandatory when requesting resubmission.');
      return;
    }

    setReviewLoading(true);
    setReviewError(null);

    try {
      const res = await fetch(`/api/evidence/${reviewingDoc.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          decision: reviewDecision,
          reviewNotes: reviewNotes.trim() || undefined,
          rejectionReason: reviewDecision === 'REJECTED' ? rejectionReason.trim() : undefined,
          resubmissionGuidance: reviewDecision === 'RESUBMISSION_REQUESTED' ? resubmissionGuidance.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setReviewError(json.error?.message || 'Failed to record review decision.');
        return;
      }

      setSuccessMsg(`Evidence marked as ${reviewDecision}.`);
      setReviewingDoc(null);
      setReviewNotes('');
      setRejectionReason('');
      setResubmissionGuidance('');
      fetchEvidence();
      if (onEvidenceChange) onEvidenceChange();
    } catch {
      setReviewError('Failed to submit review decision due to network error.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleQuarantineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarantiningDoc) return;

    if (quarantineReason.trim().length < 5) {
      setQuarantineError('Please provide a specific security/policy reason for quarantining this file.');
      return;
    }

    setQuarantineLoading(true);
    setQuarantineError(null);

    try {
      const res = await fetch(`/api/evidence/${quarantiningDoc.id}/quarantine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reason: quarantineReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setQuarantineError(json.error?.message || 'Failed to quarantine evidence.');
        return;
      }

      setSuccessMsg('Evidence quarantined and restricted from normal display.');
      setQuarantiningDoc(null);
      setQuarantineReason('');
      fetchEvidence();
      if (onEvidenceChange) onEvidenceChange();
    } catch {
      setQuarantineError('Network error while quarantining.');
    } finally {
      setQuarantineLoading(false);
    }
  };

  const filteredEvidence = evidenceList.filter((doc) => {
    if (purposeFilter === 'ALL') return true;
    return doc.evidencePurpose === purposeFilter;
  });

  const getStatusBadge = (status: EvidenceReviewStatus) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            Verified Proof
          </span>
        );
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <ClockIcon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            Pending Review
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E5ECE8] dark:bg-blue-950/80 text-[#0B3D2E] dark:text-blue-300 border border-[#0B3D2E]/20 dark:border-blue-800/60">
            <RefreshCwIcon className="w-3.5 h-3.5 text-[#0B6640] dark:text-blue-400" />
            Under Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <XCircleIcon className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            Rejected
          </span>
        );
      case 'RESUBMISSION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
            <AlertTriangleIcon className="w-3.5 h-3.5 text-orange-700 dark:text-orange-400" />
            Resubmission Needed
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-[#1F2937] text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/60">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-red-700 dark:text-red-500" />
            Quarantined
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPurposeLabel = (purpose: EvidencePurpose) => {
    switch (purpose) {
      case 'CITIZEN_SUPPORTING':
        return 'Citizen Supporting';
      case 'OFFICIAL_PROGRESS':
        return 'Official Progress';
      case 'RESOLUTION_PROOF':
        return 'Resolution Proof';
      case 'ADMINISTRATIVE_REVIEW':
        return 'Administrative Internal';
      default:
        return purpose;
    }
  };

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CameraIcon className="w-5 h-5 text-[#0B6640] dark:text-[#34D399]" />
              <CardTitle className="text-lg">
                Evidence & Verification Records {fetchStatus === 'success' ? `(${evidenceList.length})` : ''}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
              Photographic and documentary evidence verified through official municipal audit • {trackingId}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvidence}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canUpload && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setReplacedDocId('');
                  setUploadPurpose(isOfficial ? 'OFFICIAL_PROGRESS' : 'CITIZEN_SUPPORTING');
                  setUploadDescription('');
                  setUploadFiles([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="text-xs"
              >
                <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
                Upload Evidence
              </Button>
            )}
          </div>
        </div>

        {/* Core Civic Verification Notice Banner */}
        <div className="mt-3 p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] text-xs text-[#374151] dark:text-[#D1D5DB] flex items-start gap-2.5">
          <ShieldCheckIcon className="w-4 h-4 text-[#0B6640] dark:text-[#34D399] shrink-0 mt-0.5" />
          <p>
            <strong className="text-[#111827] dark:text-[#F9FAFB]">Evidence Accountability Standard: </strong>
            Uploading a photograph or document registers it for audit. A file is not considered verified, authentic, or proof of resolution until examined and approved by authorized municipal inspectors.
          </p>
        </div>

        {/* Filter Tabs - Shown when evidence exists */}
        {fetchStatus === 'success' && evidenceList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
            {[
              { id: 'ALL', label: `All (${evidenceList.length})` },
              {
                id: 'CITIZEN_SUPPORTING',
                label: `Citizen (${evidenceList.filter((e) => e.evidencePurpose === 'CITIZEN_SUPPORTING').length})`,
              },
              {
                id: 'OFFICIAL_PROGRESS',
                label: `Official Progress (${evidenceList.filter((e) => e.evidencePurpose === 'OFFICIAL_PROGRESS').length})`,
              },
              {
                id: 'RESOLUTION_PROOF',
                label: `Resolution Proof (${evidenceList.filter((e) => e.evidencePurpose === 'RESOLUTION_PROOF').length})`,
              },
              ...(isAdmin || isOfficial
                ? [
                    {
                      id: 'ADMINISTRATIVE_REVIEW',
                      label: `Internal Docs (${evidenceList.filter((e) => e.evidencePurpose === 'ADMINISTRATIVE_REVIEW').length})`,
                    },
                  ]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-active={purposeFilter === tab.id}
                onClick={() => setPurposeFilter(tab.id)}
                className={`civora-liquid-tab px-3 py-1 rounded-md text-xs font-medium ${
                  purposeFilter === tab.id
                    ? 'font-semibold'
                    : 'text-[#374151] dark:text-[#D1D5DB]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {successMsg && (
          <Alert variant="success">
            {successMsg}
          </Alert>
        )}
        {errorMsg && (
          <Alert variant="error">
            {errorMsg}
          </Alert>
        )}

        {loading || fetchStatus === 'loading' ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#6B7280] dark:text-[#D1D5DB]">
            <RefreshCwIcon className="w-6 h-6 animate-spin text-[#0B3D2E] dark:text-[#34D399] mb-2" />
            <p className="text-xs">Loading secure evidence records...</p>
          </div>
        ) : fetchStatus === 'not_found' ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 p-6 space-y-3">
            <AlertTriangleIcon className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
            <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Complaint Not Found</h4>
            <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] max-w-md mx-auto">
              {fetchErrorMessage || 'The complaint record associated with this identifier could not be located in the verification registry.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {onSearchAgain && (
                <Button variant="primary" size="sm" onClick={onSearchAgain} className="text-xs">
                  <SearchIcon className="w-3.5 h-3.5 mr-1.5" />
                  Search Another Complaint
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchEvidence} className="text-xs">
                <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" />
                Retry Lookup
              </Button>
            </div>
          </div>
        ) : fetchStatus === 'forbidden' ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-6 space-y-2">
            <ShieldCheckIcon className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto" />
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Access Restricted</h4>
            <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] max-w-md mx-auto">
              {fetchErrorMessage || 'You do not have authorization to view private or internal evidence for this complaint.'}
            </p>
          </div>
        ) : fetchStatus === 'error' ? (
          <div className="py-8 text-center rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] p-6 space-y-3">
            <AlertTriangleIcon className="w-9 h-9 text-amber-600 dark:text-amber-500 mx-auto" />
            <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">Unable to Load Evidence</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] max-w-md mx-auto">
              {fetchErrorMessage || 'An unexpected error occurred while loading evidence records.'}
            </p>
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={fetchEvidence} className="text-xs">
                <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] p-6">
            <CameraIcon className="w-10 h-10 text-[#9CA3AF] dark:text-[#9CA3AF] mx-auto mb-2.5" />
            <h4 className="text-sm font-semibold text-[#111827] dark:text-[#D1D5DB]">No Evidence Found</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1 max-w-md mx-auto">
              {purposeFilter === 'ALL'
                ? 'No photographs or supporting documents have been registered for this complaint yet.'
                : `No evidence categorized as ${purposeFilter.replace('_', ' ').toLowerCase()} has been uploaded.`}
            </p>
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadPurpose(
                    purposeFilter !== 'ALL' && purposeFilter !== 'ADMINISTRATIVE_REVIEW'
                      ? (purposeFilter as EvidencePurpose)
                      : isOfficial
                      ? 'OFFICIAL_PROGRESS'
                      : 'CITIZEN_SUPPORTING'
                  );
                  setShowUploadModal(true);
                }}
                className="mt-4 text-xs"
              >
                <PlusIcon className="w-3.5 h-3.5 mr-1" />
                Attach Evidence Now
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvidence.map((doc) => {
              const isImage = doc.mimeType.startsWith('image/');
              return (
                <div
                  key={doc.id}
                  className="rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] overflow-hidden flex flex-col justify-between hover:border-[#0B3D2E]/30 dark:hover:border-[#34D399]/50 transition-all shadow-xs"
                >
                  <div className="p-4 space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white dark:bg-[#273548] text-[#374151] dark:text-[#D1D5DB] border border-[#E5E7EB] dark:border-[#374151]">
                            {getPurposeLabel(doc.evidencePurpose)}
                          </span>
                          {getStatusBadge(doc.reviewStatus)}
                        </div>
                        <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] truncate max-w-[240px]" title={doc.fileName}>
                          {doc.fileName}
                        </h4>
                      </div>

                      <div className="text-right text-[11px] text-[#6B7280] dark:text-[#D1D5DB] shrink-0">
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span className="block text-[10px] text-[#6B7280] dark:text-[#D1D5DB]">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Media preview thumbnail / PDF card */}
                    <div className="relative rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#182230] flex items-center justify-center min-h-[140px] max-h-[180px]">
                      {isImage ? (
                        <div
                          className="w-full h-full cursor-pointer relative group flex items-center justify-center"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <img
                            src={doc.fileUrl}
                            alt={doc.fileName}
                            className="max-h-[180px] w-full object-cover transition-transform group-hover:scale-105 duration-200"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/25 dark:bg-[#182230] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="text-xs bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] px-3 py-1 rounded-full flex items-center gap-1 border border-[#E5E7EB] dark:border-[#374151] shadow-xs">
                              <EyeIcon className="w-3.5 h-3.5" /> Enlarge Preview
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center space-y-2">
                          <FileTextIcon className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
                          <span className="text-xs font-mono font-medium text-[#374151] dark:text-[#D1D5DB] block">
                            PDF Document
                          </span>
                          <span className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB] block">
                            Protected format • Verified MIME type
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Description if provided */}
                    {doc.description && (
                      <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed bg-white dark:bg-[#182230] p-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                        {doc.description}
                      </p>
                    )}

                    {/* Rejection / Resubmission alert */}
                    {doc.reviewStatus === 'REJECTED' && doc.rejectionReason && (
                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                        <strong className="flex items-center gap-1 text-rose-900 dark:text-rose-300">
                          <XCircleIcon className="w-3.5 h-3.5" /> Rejection Explanation:
                        </strong>
                        <p className="leading-relaxed">{doc.rejectionReason}</p>
                      </div>
                    )}

                    {doc.reviewStatus === 'RESUBMISSION_REQUESTED' && (
                      <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-xs text-orange-800 dark:text-orange-200 space-y-2">
                        <div>
                          <strong className="flex items-center gap-1 text-orange-900 dark:text-orange-300">
                            <AlertTriangleIcon className="w-3.5 h-3.5" /> Resubmission Required:
                          </strong>
                          <p className="mt-0.5 leading-relaxed">
                            {doc.resubmissionGuidance || 'Please provide clearer evidence conforming to municipal inspection standards.'}
                          </p>
                        </div>
                        {isOwner && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenResubmitModal(doc)}
                            className="w-full text-xs py-1.5"
                          >
                            <PlusIcon className="w-3.5 h-3.5 mr-1" />
                            Upload Replacement Evidence
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Verified metadata */}
                    {doc.reviewStatus === 'VERIFIED' && doc.reviewedAt && (
                      <div className="text-[11px] text-[#0B6640] dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-[#0B6640] dark:text-emerald-400 shrink-0" />
                        <span>
                          Verified by {doc.reviewedBy?.name || 'Department Inspector'} on{' '}
                          {new Date(doc.reviewedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Quarantined notice */}
                    {doc.isQuarantined && (
                      <div className="p-2.5 rounded-lg bg-red-50 dark:bg-[#1F2937] border border-red-200 dark:border-red-900 text-[11px] text-red-800 dark:text-red-300">
                        <strong>Quarantine Reason: </strong>
                        {doc.quarantineReason || 'Isolated by administrator pending investigation.'}
                      </div>
                    )}

                    {/* Cryptographic SHA-256 Checksum */}
                    {doc.sha256Checksum && (
                      <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#D1D5DB] font-mono">
                        <span className="flex items-center gap-1">
                          <ShieldCheckIcon className="w-3 h-3 text-[#6B7280] dark:text-[#D1D5DB]" />
                          SHA-256:
                        </span>
                        <span className="truncate max-w-[200px]" title={doc.sha256Checksum}>
                          {doc.sha256Checksum.slice(0, 16)}...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 bg-white dark:bg-[#182230] border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] truncate">
                      By: <strong className="text-[#374151] dark:text-[#D1D5DB]">{doc.uploader?.name || 'Citizen'}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <a
                        href={doc.downloadUrl}
                        download={doc.fileName}
                        className="civora-liquid-btn civora-liquid-btn--secondary px-2.5 py-1 rounded-md text-xs font-medium gap-1"
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        Download
                      </a>

                      {canReview && doc.reviewStatus !== 'VERIFIED' && !doc.isQuarantined && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setReviewingDoc(doc);
                            setReviewDecision('VERIFIED');
                            setReviewNotes('');
                            setRejectionReason('');
                            setResubmissionGuidance('');
                            setReviewError(null);
                          }}
                          className="text-xs py-1"
                        >
                          Review
                        </Button>
                      )}

                      {isAdmin && !doc.isQuarantined && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setQuarantiningDoc(doc);
                            setQuarantineReason('');
                            setQuarantineError(null);
                          }}
                          className="text-xs py-1"
                        >
                          Quarantine
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* --- MODAL 1: Upload Evidence Modal --- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div className="flex items-center gap-2">
                <CameraIcon className="w-5 h-5 text-[#0B6640] dark:text-[#34D399]" />
                <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
                  {replacedDocId ? 'Upload Replacement Evidence' : 'Attach Complaint Evidence'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setShowUploadModal(false)}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {uploadError && <Alert variant="error">{uploadError}</Alert>}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Evidence Purpose */}
              <FormField id="evi-upload-purpose" label="Evidence Purpose" required>
                <Select
                  id="evi-upload-purpose"
                  value={uploadPurpose}
                  onChange={(e) => setUploadPurpose(e.target.value as EvidencePurpose)}
                  disabled={!!replacedDocId}
                >
                  <option value="CITIZEN_SUPPORTING">Citizen Supporting Evidence</option>
                  {(isOfficial || isAdmin) && (
                    <>
                      <option value="OFFICIAL_PROGRESS">Official Maintenance / Progress Record</option>
                      <option value="RESOLUTION_PROOF">Resolution Proof (Completion Verification)</option>
                      <option value="ADMINISTRATIVE_REVIEW">Administrative Review Document</option>
                    </>
                  )}
                </Select>
                <p className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] mt-1">
                  {uploadPurpose === 'RESOLUTION_PROOF'
                    ? 'Resolution proof demonstrates completed field repairs. Uploading does not automatically close the complaint.'
                    : uploadPurpose === 'OFFICIAL_PROGRESS'
                    ? 'Documents interim work, site clearance, or equipment deployment.'
                    : 'Provides visual or documentary support for the reported issue.'}
                </p>
              </FormField>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-medium text-[#374151] dark:text-[#D1D5DB] mb-1.5">
                  Select Files (JPG, PNG, WebP, PDF • Max 10MB each)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#D1D5DB] dark:border-[#374151] hover:border-[#0B3D2E] dark:hover:border-[#6EE7B7] rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#F9FAFB] dark:bg-[#182230]"
                >
                  <CameraIcon className="w-8 h-8 text-[#9CA3AF] dark:text-[#9CA3AF] mx-auto mb-2" />
                  <p className="text-xs text-[#374151] dark:text-[#D1D5DB] font-medium">Click to select photos or documents</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">Up to 5 files per submission</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected Files List */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2 bg-[#F9FAFB] dark:bg-[#182230] p-3 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                  <span className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                    Files to upload ({uploadFiles.length}):
                  </span>
                  {uploadFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs text-[#374151] dark:text-[#D1D5DB] bg-white dark:bg-[#273548]/90 px-2.5 py-1.5 rounded border border-[#E5E7EB] dark:border-[#374151]"
                    >
                      <span className="truncate max-w-[280px]">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB] font-mono">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          aria-label="Remove file"
                          onClick={() => handleRemoveFile(idx)}
                          className="civora-liquid-btn civora-liquid-btn--danger p-1 rounded-md"
                        >
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              <FormField id="evi-upload-description" label="Context / Description (Optional)">
                <TextArea
                  id="evi-upload-description"
                  rows={2}
                  placeholder="Provide brief details regarding what these photos or documents illustrate..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={uploading || uploadFiles.length === 0}>
                  {uploading ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4 animate-spin mr-1.5" />
                      Uploading Securely...
                    </>
                  ) : (
                    'Upload Evidence'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Review & Verification Modal (Staff/Admin) --- */}
      {reviewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-[#0B6640] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
                  Inspect & Verify Evidence
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setReviewingDoc(null)}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {reviewError && <Alert variant="error">{reviewError}</Alert>}

            <div className="bg-[#F9FAFB] dark:bg-[#182230] p-3 rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-1">
              <p>
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">File: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">{reviewingDoc.fileName}</span>
              </p>
              <p>
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">Purpose: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">{getPurposeLabel(reviewingDoc.evidencePurpose)}</span>
              </p>
              <p>
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">Uploader: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">{reviewingDoc.uploader?.name} ({reviewingDoc.uploader?.role})</span>
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <FormField id="evi-review-decision" label="Verification Decision" required>
                <Select
                  id="evi-review-decision"
                  value={reviewDecision}
                  onChange={(e) =>
                    setReviewDecision(
                      e.target.value as 'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUESTED'
                    )
                  }
                >
                  <option value="VERIFIED">Approve & Mark as Verified</option>
                  <option value="RESUBMISSION_REQUESTED">Request Resubmission (Clearer Photo / Document)</option>
                  <option value="REJECTED">Reject Evidence (Irrelevant / Fake / Unusable)</option>
                </Select>
              </FormField>

              {reviewDecision === 'REJECTED' && (
                <FormField id="evi-rejection-reason" label="Rejection Reason" required>
                  <TextArea
                    id="evi-rejection-reason"
                    rows={3}
                    placeholder="Explain why this evidence is rejected (e.g., photo does not match location, corrupted scan, irrelevant content)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                    * Rejection reason will be visible to the uploader and logged in the immutable audit trail.
                  </p>
                </FormField>
              )}

              {reviewDecision === 'RESUBMISSION_REQUESTED' && (
                <FormField id="evi-resubmission-guidance" label="Resubmission Instructions" required>
                  <TextArea
                    id="evi-resubmission-guidance"
                    rows={3}
                    placeholder="Specify what additional or clearer information is needed from the citizen or officer..."
                    value={resubmissionGuidance}
                    onChange={(e) => setResubmissionGuidance(e.target.value)}
                  />
                  <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-1">
                    * Instructions will prompt the citizen to attach a replacement file.
                  </p>
                </FormField>
              )}

              <FormField id="evi-review-notes" label="Internal Inspection Notes (Optional)">
                <TextArea
                  id="evi-review-notes"
                  rows={2}
                  placeholder="Internal notes for supervisory staff..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewingDoc(null)}
                  disabled={reviewLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={reviewDecision === 'REJECTED' ? 'danger' : 'primary'}
                  disabled={reviewLoading}
                >
                  {reviewLoading ? 'Recording Decision...' : 'Commit Decision'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Quarantine Modal (Admin Only) --- */}
      {quarantiningDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1F2937] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-red-600 dark:text-red-500" />
                <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
                  Quarantine Evidence File
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setQuarantiningDoc(null)}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {quarantineError && <Alert variant="error">{quarantineError}</Alert>}

            <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
              Quarantining immediately restricts this file from ordinary citizen and official downloads. It will remain isolated for security investigation.
            </p>

            <form onSubmit={handleQuarantineSubmit} className="space-y-4">
              <FormField id="evi-quarantine-reason" label="Security / Abuse Reason" required>
                <TextArea
                  id="evi-quarantine-reason"
                  rows={3}
                  placeholder="Specify policy violation (e.g., suspicious binary signature, abusive content, malicious payload attempt)..."
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuarantiningDoc(null)}
                  disabled={quarantineLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={quarantineLoading}>
                  {quarantineLoading ? 'Quarantining...' : 'Confirm Quarantine'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Lightbox Full Preview Modal --- */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-[#F9FAFB] dark:bg-[#273548] border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
              <div className="truncate">
                <span className="text-xs font-semibold text-[#111827] dark:text-[#F9FAFB] block truncate">
                  {previewDoc.fileName}
                </span>
                <span className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB]">
                  {getPurposeLabel(previewDoc.evidencePurpose)} • {formatBytes(previewDoc.fileSize)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.downloadUrl}
                  download={previewDoc.fileName}
                  className="civora-liquid-btn civora-liquid-btn--primary px-2.5 py-1 rounded-md text-xs font-medium gap-1"
                >
                  <DownloadIcon className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPreviewDoc(null)}
                  className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={previewDoc.fileUrl}
                alt={previewDoc.fileName}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
