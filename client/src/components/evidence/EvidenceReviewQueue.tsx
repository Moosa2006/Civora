import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { FormField } from '../ui/FormField';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import {
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  DownloadIcon,
  EyeIcon,
  CloseIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from '../ui/icons';
import type { EvidenceDocument } from '../../types/evidence';
import { useAuth } from '../../context/useAuth';

export function EvidenceReviewQueue() {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_REVIEW');
  const [purposeFilter, setPurposeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Review modal
  const [reviewingDoc, setReviewingDoc] = useState<EvidenceDocument | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUESTED'>('VERIFIED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resubmissionGuidance, setResubmissionGuidance] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Quarantine modal
  const [quarantiningDoc, setQuarantiningDoc] = useState<EvidenceDocument | null>(null);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState<EvidenceDocument | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let url = `/api/evidence/pending-queue?page=${page}&limit=10`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (purposeFilter !== 'ALL') {
        url += `&purpose=${purposeFilter}`;
      }

      const res = await fetch(url, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to load evidence review queue.');
        return;
      }

      setDocuments(json.data.documents || []);
      if (json.data.pagination) {
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      setErrorMsg('Failed to fetch review queue. Check network connection.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, purposeFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

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
        setReviewError(json.error?.message || 'Failed to commit review decision.');
        return;
      }

      setSuccessMsg(`Evidence "${reviewingDoc.fileName}" reviewed as ${reviewDecision}.`);
      setReviewingDoc(null);
      setReviewNotes('');
      setRejectionReason('');
      setResubmissionGuidance('');
      fetchQueue();
    } catch {
      setReviewError('Network failure occurred.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleQuarantineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarantiningDoc) return;

    if (quarantineReason.trim().length < 5) {
      setQuarantineError('Please specify why this evidence is being quarantined.');
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
        setQuarantineError(json.error?.message || 'Failed to quarantine document.');
        return;
      }

      setSuccessMsg(`Document "${quarantiningDoc.fileName}" quarantined.`);
      setQuarantiningDoc(null);
      setQuarantineReason('');
      fetchQueue();
    } catch {
      setQuarantineError('Network error while quarantining.');
    } finally {
      setQuarantineLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-[#0B6640] dark:text-emerald-400" />
                <CardTitle className="text-xl">Evidence Verification Queue</CardTitle>
              </div>
              <CardDescription className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
                Inspect, authenticate, or reject civic evidence and resolution proofs ({totalCount} items)
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchQueue}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </Button>
          </div>

          {/* Core Principle Notice */}
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangleIcon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Municipal Review Standard: </strong>
              Do not approve resolution proof without verifying that the photograph matches the complaint locality and depicts completed work. Approving resolution evidence updates the audit log and notifies the citizen.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-[#E5E7EB] dark:border-[#374151]">
            <FormField id="queue-status-filter" label="Review Status">
              <Select
                id="queue-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="RESUBMISSION_REQUESTED">Resubmission Requested</option>
              </Select>
            </FormField>

            <FormField id="queue-purpose-filter" label="Evidence Purpose">
              <Select
                id="queue-purpose-filter"
                value={purposeFilter}
                onChange={(e) => {
                  setPurposeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Purposes</option>
                <option value="RESOLUTION_PROOF">Resolution Proofs Only</option>
                <option value="CITIZEN_SUPPORTING">Citizen Supporting Evidence</option>
                <option value="OFFICIAL_PROGRESS">Official Progress Photos</option>
                <option value="ADMINISTRATIVE_REVIEW">Internal Administrative Docs</option>
              </Select>
            </FormField>
          </div>
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

          {loading ? (
            <div className="py-16 text-center text-[#6B7280] dark:text-[#D1D5DB]">
              <RefreshCwIcon className="w-8 h-8 animate-spin text-[#0B3D2E] dark:text-[#34D399] mx-auto mb-2" />
              <p className="text-xs">Fetching evidence inspection queue...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] p-6">
              <CheckCircleIcon className="w-10 h-10 text-[#0B6640] dark:text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">Review Queue Cleared</h4>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
                There are no evidence records matching the current filter criteria awaiting review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => {
                const isImage = doc.mimeType.startsWith('image/');
                const isResolution = doc.evidencePurpose === 'RESOLUTION_PROOF';
                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isResolution
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60'
                        : 'bg-[#F9FAFB] dark:bg-[#182230] border-[#E5E7EB] dark:border-[#374151] hover:border-[#0B3D2E]/30 dark:hover:border-[#34D399]/50'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Media Thumbnail & Complaint Info */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] cursor-pointer flex items-center justify-center relative group"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          {isImage ? (
                            <img
                              src={doc.fileUrl}
                              alt={doc.fileName}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            />
                          ) : (
                            <FileTextIcon className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                          )}
                          <div className="absolute inset-0 bg-[#0B3D2E]/80 dark:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <EyeIcon className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
                              {doc.complaint?.trackingId || 'CIV-000'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#F3F4F6] dark:bg-[#273548] text-[#374151] dark:text-[#D1D5DB] border border-[#E5E7EB] dark:border-[#374151]">
                              {doc.evidencePurpose.replace('_', ' ')}
                            </span>
                            <Badge
                              variant={
                                doc.reviewStatus === 'VERIFIED'
                                  ? 'success'
                                  : doc.reviewStatus === 'REJECTED'
                                  ? 'danger'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {doc.reviewStatus}
                            </Badge>
                          </div>

                          <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">
                            {doc.complaint?.title || doc.fileName}
                          </h4>

                          <p className="text-[#6B7280] dark:text-[#D1D5DB] text-[11px]">
                            File: <strong className="text-[#374151] dark:text-[#D1D5DB]">{doc.fileName}</strong> •{' '}
                            Uploaded by <strong className="text-[#374151] dark:text-[#D1D5DB]">{doc.uploader?.name}</strong> (
                            {doc.uploader?.role}) on {new Date(doc.createdAt).toLocaleString()}
                          </p>

                          {doc.description && (
                            <p className="text-[#374151] dark:text-[#D1D5DB] bg-white dark:bg-[#182230] p-2 rounded border border-[#E5E7EB] dark:border-[#374151] text-[11px]">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.downloadUrl}
                            download={doc.fileName}
                            className="px-2.5 py-1 rounded bg-white dark:bg-[#273548] hover:bg-[#F3F4F6] dark:hover:bg-[#374151] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB] text-xs font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            <DownloadIcon className="w-3.5 h-3.5" /> Download
                          </a>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setReviewingDoc(doc);
                              setReviewDecision('VERIFIED');
                              setReviewNotes('');
                              setRejectionReason('');
                              setResubmissionGuidance('');
                              setReviewError(null);
                            }}
                            className="text-xs"
                          >
                            <ShieldCheckIcon className="w-3.5 h-3.5 mr-1" />
                            Review
                          </Button>

                          {isAdmin && !doc.isQuarantined && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setQuarantiningDoc(doc);
                                setQuarantineReason('');
                                setQuarantineError(null);
                              }}
                              className="text-xs"
                            >
                              Quarantine
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                  <span>
                    Page {page} of {totalPages} ({totalCount} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
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
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">Complaint: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">
                  {reviewingDoc.complaint?.trackingId} — {reviewingDoc.complaint?.title}
                </span>
              </p>
              <p>
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">File: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">{reviewingDoc.fileName}</span>
              </p>
              <p>
                <strong className="text-[#6B7280] dark:text-[#D1D5DB]">Purpose: </strong>
                <span className="text-[#111827] dark:text-[#F9FAFB]">{reviewingDoc.evidencePurpose}</span>
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <FormField id="queue-verification-decision" label="Verification Decision" required>
                <Select
                  id="queue-verification-decision"
                  value={reviewDecision}
                  onChange={(e) =>
                    setReviewDecision(
                      e.target.value as 'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUESTED'
                    )
                  }
                >
                  <option value="VERIFIED">Approve & Verify Evidence</option>
                  <option value="RESUBMISSION_REQUESTED">Request Resubmission (Clearer Photo Needed)</option>
                  <option value="REJECTED">Reject Evidence (Irrelevant / Fake / Unacceptable)</option>
                </Select>
              </FormField>

              {reviewDecision === 'REJECTED' && (
                <FormField id="queue-rejection-reason" label="Rejection Reason (Mandatory)" required>
                  <TextArea
                    id="queue-rejection-reason"
                    rows={3}
                    placeholder="Provide a clear, auditable explanation for rejecting this evidence..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </FormField>
              )}

              {reviewDecision === 'RESUBMISSION_REQUESTED' && (
                <FormField id="queue-resubmission-guidance" label="Resubmission Instructions (Mandatory)" required>
                  <TextArea
                    id="queue-resubmission-guidance"
                    rows={3}
                    placeholder="Describe what specific photographic or documentary evidence is required..."
                    value={resubmissionGuidance}
                    onChange={(e) => setResubmissionGuidance(e.target.value)}
                  />
                </FormField>
              )}

              <FormField id="queue-review-notes" label="Internal Inspection Notes">
                <TextArea
                  id="queue-review-notes"
                  rows={2}
                  placeholder="Internal audit notes..."
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
                  {reviewLoading ? 'Committing...' : 'Commit Decision'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quarantine Modal */}
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

            <form onSubmit={handleQuarantineSubmit} className="space-y-4">
              <FormField id="queue-quarantine-reason" label="Security / Abuse Reason" required>
                <TextArea
                  id="queue-quarantine-reason"
                  rows={3}
                  placeholder="Specify policy violation reason..."
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

      {/* Lightbox Preview */}
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
                  {previewDoc.complaint?.trackingId} • {previewDoc.evidencePurpose}
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
    </div>
  );
}
