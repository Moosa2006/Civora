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
      <Card className="border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-xl">Evidence Verification Queue</CardTitle>
              </div>
              <CardDescription className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">
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
          <div className="mt-4 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Municipal Review Standard: </strong>
              Do not approve resolution proof without verifying that the photograph matches the complaint locality and depicts completed work. Approving resolution evidence updates the audit log and notifies the citizen.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-[#DED8CB] dark:border-[#283931]">
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
            <div className="py-16 text-center text-[#54625A] dark:text-[#C5D4C9]">
              <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-xs">Fetching evidence inspection queue...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 p-6">
              <CheckCircleIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#202522] dark:text-[#E8F0EC]">Review Queue Cleared</h4>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">
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
                        ? 'bg-emerald-950/10 border-emerald-800/40 hover:border-emerald-700/60'
                        : 'bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border-[#DED8CB] dark:border-[#283931] hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Media Thumbnail & Complaint Info */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C] cursor-pointer flex items-center justify-center relative group"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          {isImage ? (
                            <img
                              src={doc.fileUrl}
                              alt={doc.fileName}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            />
                          ) : (
                            <FileTextIcon className="w-8 h-8 text-rose-400" />
                          )}
                          <div className="absolute inset-0 bg-[#173D32]/80 dark:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <EyeIcon className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
                              {doc.complaint?.trackingId || 'CIV-000'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#3E4B44] dark:text-[#C5D4C9]">
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

                          <h4 className="text-sm font-semibold text-[#202522] dark:text-[#E8F0EC]">
                            {doc.complaint?.title || doc.fileName}
                          </h4>

                          <p className="text-[#54625A] dark:text-[#C5D4C9] text-[11px]">
                            File: <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">{doc.fileName}</strong> •{' '}
                            Uploaded by <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">{doc.uploader?.name}</strong> (
                            {doc.uploader?.role}) on {new Date(doc.createdAt).toLocaleString()}
                          </p>

                          {doc.description && (
                            <p className="text-[#3E4B44] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-2 rounded border border-[#DED8CB] dark:border-[#283931] text-[11px]">
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
                            className="px-2.5 py-1 rounded bg-[#ECE7DB] dark:bg-[#1D2A25] hover:bg-[#DED8CB] dark:hover:bg-[#283931] text-[#202522] dark:text-[#E8F0EC] text-xs font-medium inline-flex items-center gap-1"
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
                <div className="flex items-center justify-between pt-4 border-t border-[#DED8CB] dark:border-[#283931] text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
          <div className="relative w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-[#202522] dark:text-[#E8F0EC]">
                  Inspect & Verify Evidence
                </h3>
              </div>
              <button
                onClick={() => setReviewingDoc(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {reviewError && <Alert variant="error">{reviewError}</Alert>}

            <div className="bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-xs space-y-1">
              <p>
                <strong className="text-[#54625A] dark:text-[#C5D4C9]">Complaint: </strong>
                <span className="text-[#202522] dark:text-[#E8F0EC]">
                  {reviewingDoc.complaint?.trackingId} — {reviewingDoc.complaint?.title}
                </span>
              </p>
              <p>
                <strong className="text-[#54625A] dark:text-[#C5D4C9]">File: </strong>
                <span className="text-[#202522] dark:text-[#E8F0EC]">{reviewingDoc.fileName}</span>
              </p>
              <p>
                <strong className="text-[#54625A] dark:text-[#C5D4C9]">Purpose: </strong>
                <span className="text-[#202522] dark:text-[#E8F0EC]">{reviewingDoc.evidencePurpose}</span>
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

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
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
          <div className="relative w-full max-w-md bg-white dark:bg-[#16201C] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-semibold text-[#202522] dark:text-[#E8F0EC]">
                  Quarantine Evidence File
                </h3>
              </div>
              <button
                onClick={() => setQuarantiningDoc(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-lg"
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

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
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
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-[#ECE7DB] dark:bg-[#1D2A25] border-b border-[#DED8CB] dark:border-[#283931] flex items-center justify-between">
              <div className="truncate">
                <span className="text-xs font-semibold text-[#202522] dark:text-[#E8F0EC] block truncate">
                  {previewDoc.fileName}
                </span>
                <span className="text-[10px] text-[#54625A] dark:text-[#C5D4C9]">
                  {previewDoc.complaint?.trackingId} • {previewDoc.evidencePurpose}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.downloadUrl}
                  download={previewDoc.fileName}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1"
                >
                  <DownloadIcon className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-lg"
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
