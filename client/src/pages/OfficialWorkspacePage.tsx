import { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import {
  CloseIcon,
  ClockIcon,
  FileTextIcon,
  CameraIcon,
  CheckCircleIcon,
  MapPinIcon,
  BuildingIcon,
  ChatBubbleIcon,
} from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { useRouter } from '../router';
import { getStatusBadgeVariant } from '../utils/status';
import type { Complaint } from '../types/complaint';
import { ComplaintMessageThread } from '../components/complaints/ComplaintMessageThread';
import { EvidenceSection } from '../components/evidence/EvidenceSection';

type ActionModalType = 'PROGRESS' | 'INSPECTION' | 'EVIDENCE' | 'RESOLUTION' | 'MESSAGE' | null;

export function OfficialWorkspacePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [activeModal, setActiveModal] = useState<ActionModalType>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state: Progress Update
  const [progressTitle, setProgressTitle] = useState('');
  const [progressDescription, setProgressDescription] = useState('');
  const [progressStage, setProgressStage] = useState('INSPECTION_SCHEDULED');
  const [progressIsInternal, setProgressIsInternal] = useState(false);
  const [progressActionDate, setProgressActionDate] = useState('');

  // Form state: Site Inspection
  const [inspFindings, setInspFindings] = useState('');
  const [inspMeasurements, setInspMeasurements] = useState('');
  const [inspOutcome, setInspOutcome] = useState('ISSUE_VERIFIED');
  const [inspNotes, setInspNotes] = useState('');

  // Form state: Resolution Submission
  const [resolutionSummary, setResolutionSummary] = useState('');

  // Helper to attach authorization headers for cross-device & cross-origin compatibility
  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('civora_token') : null;
    const headers: Record<string, string> = { ...extra };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const fetchOfficialComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let url = `/api/official/complaints?page=${page}&limit=10`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to load official complaints queue.');
        return;
      }

      setComplaints(json.data.complaints || []);
      if (json.data.pagination) {
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      setErrorMsg('Failed to connect to official municipal service.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'GOVERNMENT_OFFICIAL' || user?.role === 'ADMIN')) {
      fetchOfficialComplaints();
    }
  }, [isAuthenticated, user?.role, fetchOfficialComplaints]);

  const resetForms = () => {
    setActiveModal(null);
    setSelectedComplaint(null);
    setModalError(null);
    setProgressTitle('');
    setProgressDescription('');
    setProgressStage('INSPECTION_SCHEDULED');
    setProgressIsInternal(false);
    setProgressActionDate('');
    setInspFindings('');
    setInspMeasurements('');
    setInspOutcome('ISSUE_VERIFIED');
    setInspNotes('');
    setResolutionSummary('');
  };

  // Submit Progress Update
  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!progressTitle.trim() || !progressDescription.trim()) {
      setModalError('Title and description are required.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}/progress`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          title: progressTitle.trim(),
          description: progressDescription.trim(),
          stageOrEvent: progressStage,
          isInternal: progressIsInternal,
          actionDate: progressActionDate ? new Date(progressActionDate).toISOString() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error?.message || 'Failed to record progress update.');
        return;
      }

      setSuccessMsg(`Progress update logged for complaint ${selectedComplaint.trackingId}.`);
      resetForms();
      fetchOfficialComplaints();
    } catch {
      setModalError('Network error while logging progress.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Site Inspection
  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!inspFindings.trim()) {
      setModalError('Inspection findings are required.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}/inspections`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          findings: inspFindings.trim(),
          measurementsOrReadings: inspMeasurements.trim() || undefined,
          outcome: inspOutcome,
          notes: inspNotes.trim() || undefined,
          inspectionDate: new Date().toISOString(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error?.message || 'Failed to record inspection.');
        return;
      }

      setSuccessMsg(`Inspection recorded for complaint ${selectedComplaint.trackingId}.`);
      resetForms();
      fetchOfficialComplaints();
    } catch {
      setModalError('Network error while recording inspection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Official Resolution
  const handleResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!resolutionSummary.trim()) {
      setModalError('A comprehensive resolution summary is required.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}/resolution`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          resolutionNotes: resolutionSummary.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error?.message || 'Failed to submit resolution.');
        return;
      }

      setSuccessMsg(`Resolution submitted for complaint ${selectedComplaint.trackingId}. Awaiting citizen verification.`);
      resetForms();
      fetchOfficialComplaints();
    } catch {
      setModalError('Network error while submitting resolution.');
    } finally {
      setActionLoading(false);
    }
  };

  const isOfficial = user?.role === 'GOVERNMENT_OFFICIAL' || user?.role === 'ADMIN';

  if (!authLoading && (!isAuthenticated || !isOfficial)) {
    return (
      <Container size="md" className="py-12 space-y-6">
        <Card className="border-[#DED8CB] dark:border-[#283931]">
          <CardHeader>
            <CardTitle className="text-[#9C6D19] dark:text-[#E8C07D]">Official Access Restricted</CardTitle>
            <CardDescription>Government Official credentials required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#4A5750] dark:text-[#A8BFAE]">
              Only authorized government officials and municipal administrators can access field progress tracking, inspection records, and resolution management.
            </p>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Sign In with Official Account
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const deptLabel = user?.department?.name || 'Assigned Municipal Department';

  return (
    <Container size="lg" className="space-y-8">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeading
          title={t('nav.fieldOps')}
          description={`Logged as ${user?.name} • ${deptLabel} • ${totalCount} grievances`}
          badge={
            <Badge variant="warning" size="md">
              {t('roles.official')}
            </Badge>
          }
        />
        <Button
          variant="outline"
          onClick={() => fetchOfficialComplaints()}
          className="shrink-0 text-xs"
        >
          {t('adminSystem.refreshBtn')}
        </Button>
      </div>

      {successMsg && (
        <Alert variant="success" title="Action Completed">
          {successMsg}
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="error" title="Workspace Error">
          {errorMsg}
        </Alert>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#DED8CB] dark:border-[#283931]">
        {['ALL', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'VERIFIED'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === status
                ? 'bg-[#173D32] text-[#F4F0E6] font-semibold shadow-xs'
                : 'text-[#4A5750] dark:text-[#A8BFAE] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB] dark:hover:bg-[#1D2A25]'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <LoadingIndicator size="lg" label="Loading department queue" />
          <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-3">Retrieving assigned departmental complaints...</span>
        </div>
      ) : errorMsg ? (
        <div className="py-8 space-y-4">
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold mb-1">Departmental Queue Error</p>
            <p className="text-xs mb-3">{errorMsg}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOfficialComplaints()}
              className="cursor-pointer text-xs"
            >
              Retry Loading Queue
            </Button>
          </div>
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No Department Complaints"
          description={`There are currently no civic complaints matching filter "${statusFilter}" assigned to ${deptLabel}.`}
        />
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <Card
              key={c.id}
              className={`border-[#DED8CB] dark:border-[#283931] hover:border-[#C2BAA8] dark:hover:border-[#3E564A] transition-colors ${
                c.status === 'REOPENED' ? 'border-[#9C6D19]/50' : ''
              }`}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] px-2.5 py-0.5 rounded border border-[#DED8CB] dark:border-[#283931]">
                        {c.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(c.status)} size="sm" hasDot>
                        {c.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {c.priority} Priority
                      </Badge>
                      {c.affectedReportCount && c.affectedReportCount > 1 && (
                        <Badge variant="info" size="sm">
                          Consolidated ({c.affectedReportCount} reports &bull; {c.distinctReporterCount || 1} citizens)
                        </Badge>
                      )}
                      {c.isDuplicate && (
                        <Badge variant="warning" size="sm">
                          Subordinate Report
                        </Badge>
                      )}
                      {c.aiRiskLevel === 'HIGH' && (
                        <Badge variant="danger" size="sm">
                          AI Risk: High ({c.aiRiskScore || 75}/100)
                        </Badge>
                      )}
                      {c.aiRiskLevel === 'NEEDS_REVIEW' && (
                        <Badge variant="warning" size="sm">
                          AI Flag: Needs Review
                        </Badge>
                      )}
                      {c.aiRiskLevel === 'LOW' && c.aiAnalysisStatus === 'COMPLETED' && (
                        <Badge variant="success" size="sm">
                          AI Verified
                        </Badge>
                      )}
                      {(c as any).sla && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-medium border ${
                            (c as any).sla.isResolutionOverdue || (c as any).sla.slaStatus === 'RESOLUTION_OVERDUE'
                              ? 'bg-[#B94B3B]/10 text-[#9C3B2D] dark:text-[#F39182] border-[#9C3B2D]/30'
                              : (c as any).sla.slaStatus === 'APPROACHING_DEADLINE'
                                ? 'bg-[#FEF6E9] text-[#854F0B] dark:text-[#F3B768] border-[#854F0B]/30'
                                : 'bg-[#173D32]/10 text-[#173D32] dark:text-[#7BC4B2] border-[#173D32]/30'
                          }`}
                        >
                          Target:{' '}
                          {new Date((c as any).sla.currentResolutionDeadline).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">• {c.category?.name || 'Category'}</span>
                    </div>

                    <h3 className="text-base font-bold font-heading text-[#202522] dark:text-[#F5F2EA]">{c.title}</h3>
                    <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">{c.description}</p>

                    {c.aiFindings?.verificationSummary && (
                      <div className="p-2.5 rounded-lg bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 border border-[#DED8CB] dark:border-[#283931] text-xs space-y-1">
                        <div className="flex items-center justify-between text-[#173D32] dark:text-[#7BC4B2] font-semibold text-[11px]">
                          <span>AI Integrity Findings</span>
                          {c.aiFindings.fraudIndicators && c.aiFindings.fraudIndicators.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-mono">
                              Flags: {c.aiFindings.fraudIndicators.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-[#3E4B44] dark:text-[#C5D4C9] text-[11px] leading-relaxed">
                          {c.aiFindings.verificationSummary}
                        </p>
                      </div>
                    )}

                    {c.status === 'REOPENED' && (
                      <div className="p-2.5 rounded-lg bg-[#FEF6E9] dark:bg-[#1D2A25] border border-[#854F0B]/40 text-xs text-[#854F0B] dark:text-[#F3B768]">
                        ⚠️ Reopened by citizen — requires re-inspection or additional remediation.
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#54625A] dark:text-[#C5D4C9] pt-2 border-t border-[#DED8CB] dark:border-[#283931]">
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-[#173D32] dark:text-[#7BC4B2] shrink-0" />
                        <span>
                          <strong className="text-[#202522] dark:text-[#F5F2EA]">Location:</strong> {c.locationAddress} ({c.locality})
                          {c.ward && <span className="block text-[11px] text-[#173D32] dark:text-[#7BC4B2] font-medium">Ward: {c.ward}</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BuildingIcon className="w-3.5 h-3.5 text-[#854F0B] dark:text-[#F3B768] shrink-0" />
                        <span>
                          <strong className="text-[#202522] dark:text-[#F5F2EA]">Department:</strong> {c.assignedDepartment?.name || deptLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Official Action Controls */}
                  <div className="flex flex-col sm:flex-row md:flex-col flex-wrap gap-2 shrink-0">
                    {c.status !== 'REJECTED' && c.status !== 'CLOSED' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedComplaint(c);
                            setActiveModal('PROGRESS');
                          }}
                          leftIcon={<ClockIcon className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Log Progress
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedComplaint(c);
                            setActiveModal('INSPECTION');
                          }}
                          leftIcon={<FileTextIcon className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Log Inspection
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedComplaint(c);
                            setActiveModal('EVIDENCE');
                          }}
                          leftIcon={<CameraIcon className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Add Evidence
                        </Button>

                        {c.status !== 'RESOLVED' && c.status !== 'VERIFIED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedComplaint(c);
                              setActiveModal('RESOLUTION');
                            }}
                            leftIcon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                            className="text-xs bg-[#1E6B52] hover:bg-[#17523F]"
                          >
                            Submit Resolution
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedComplaint(c);
                        setActiveModal('MESSAGE');
                      }}
                      className="text-xs"
                    >
                      <ChatBubbleIcon className="w-3.5 h-3.5 mr-1" />
                      Messages
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/track?id=${c.trackingId}`)}
                      className="text-xs"
                    >
                      View Live Tracker
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/sla')}
                      className="text-xs"
                    >
                      SLA & Escalations
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#DED8CB] dark:border-[#283931] text-xs">
              <span className="text-[#54625A] dark:text-[#C5D4C9]">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Log Progress Update */}
      {activeModal === 'PROGRESS' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#DED8CB] dark:border-[#283931] shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <CardTitle className="font-heading">Log Official Progress Update</CardTitle>
                <CardDescription>Tracking ID: {selectedComplaint.trackingId}</CardDescription>
              </div>
              <button type="button" onClick={resetForms} className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1">
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              {modalError && <Alert variant="error" title="Validation Error">{modalError}</Alert>}
              <form onSubmit={handleProgressSubmit} className="space-y-4 mt-2">
                <FormField id="prog-stage" label="Progress Stage / Milestone" required>
                  <Select
                    id="prog-stage"
                    value={progressStage}
                    onChange={(e) => setProgressStage(e.target.value)}
                    options={[
                      { value: 'INSPECTION_SCHEDULED', label: 'INSPECTION_SCHEDULED — Site inspection planned' },
                      { value: 'INSPECTED', label: 'INSPECTED — Field inspection conducted' },
                      { value: 'WORK_SCHEDULED', label: 'WORK_SCHEDULED — Maintenance squad scheduled' },
                      { value: 'WORK_STARTED', label: 'WORK_STARTED — Active on-site repairs ongoing' },
                      { value: 'WORK_COMPLETED', label: 'WORK_COMPLETED — Physical work finalized' },
                      { value: 'FOLLOW_UP_REQUIRED', label: 'FOLLOW_UP_REQUIRED — Additional crew dispatched' },
                    ]}
                  />
                </FormField>

                <FormField id="prog-title" label="Update Title" required>
                  <TextInput
                    id="prog-title"
                    placeholder="e.g. Bitumen levelling commenced by Ward crew"
                    value={progressTitle}
                    onChange={(e) => setProgressTitle(e.target.value)}
                    required
                  />
                </FormField>

                <FormField id="prog-desc" label="Detailed Progress Description" required>
                  <TextArea
                    id="prog-desc"
                    placeholder="Provide detailed breakdown of activities executed on site..."
                    value={progressDescription}
                    onChange={(e) => setProgressDescription(e.target.value)}
                    required
                  />
                </FormField>

                <FormField id="prog-target-date" label="Next Action / Target Date (Optional)">
                  <input
                    type="date"
                    id="prog-target-date"
                    value={progressActionDate}
                    onChange={(e) => setProgressActionDate(e.target.value)}
                    className="w-full rounded-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] text-xs text-[#202522] dark:text-[#E8F0EC] p-2.5 focus:border-[#173D32] focus:outline-none"
                  />
                </FormField>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="prog-internal"
                    checked={progressIsInternal}
                    onChange={(e) => setProgressIsInternal(e.target.checked)}
                    className="rounded border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C] text-[#173D32] focus:ring-[#173D32]"
                  />
                  <label htmlFor="prog-internal" className="text-xs text-[#4A5750] dark:text-[#A8BFAE]">
                    Mark as Internal Department Memo (hidden from citizen public view)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DED8CB] dark:border-[#283931]">
                  <Button type="button" variant="ghost" onClick={resetForms} disabled={actionLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Record Progress'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Log Site Inspection */}
      {activeModal === 'INSPECTION' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#DED8CB] dark:border-[#283931] shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <CardTitle className="font-heading">Log Site Inspection Findings</CardTitle>
                <CardDescription>Tracking ID: {selectedComplaint.trackingId}</CardDescription>
              </div>
              <button type="button" onClick={resetForms} className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1">
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              {modalError && <Alert variant="error" title="Validation Error">{modalError}</Alert>}
              <form onSubmit={handleInspectionSubmit} className="space-y-4 mt-2">
                <FormField id="insp-outcome" label="Inspection Outcome" required>
                  <Select
                    id="insp-outcome"
                    value={inspOutcome}
                    onChange={(e) => setInspOutcome(e.target.value)}
                    options={[
                      { value: 'ISSUE_VERIFIED', label: 'ISSUE_VERIFIED — Defect confirmed on-site' },
                      { value: 'REPAIR_SCHEDULED', label: 'REPAIR_SCHEDULED — Work allocated to maintenance squad' },
                      { value: 'REPAIR_COMPLETED', label: 'REPAIR_COMPLETED — Satisfactory remediation verified' },
                      { value: 'NO_DEFECT_FOUND', label: 'NO_DEFECT_FOUND — Physical verification clear' },
                    ]}
                  />
                </FormField>

                <FormField id="insp-findings" label="Inspection Findings & Observations" required>
                  <TextArea
                    id="insp-findings"
                    placeholder="Describe specific observations, damage dimensions, severity..."
                    value={inspFindings}
                    onChange={(e) => setInspFindings(e.target.value)}
                    required
                  />
                </FormField>

                <FormField id="insp-measurements" label="Measurements / Readings (Optional)">
                  <TextInput
                    id="insp-measurements"
                    placeholder="e.g. Pothole diameter 1.8m, depth 15cm; water pressure 1.2 bar"
                    value={inspMeasurements}
                    onChange={(e) => setInspMeasurements(e.target.value)}
                  />
                </FormField>

                <FormField id="insp-notes" label="Inspector Recommendation Notes (Optional)">
                  <TextInput
                    id="insp-notes"
                    placeholder="e.g. Recommended asphalt patching within 48 hours"
                    value={inspNotes}
                    onChange={(e) => setInspNotes(e.target.value)}
                  />
                </FormField>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DED8CB] dark:border-[#283931]">
                  <Button type="button" variant="ghost" onClick={resetForms} disabled={actionLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={actionLoading}>
                    {actionLoading ? 'Recording...' : 'Save Inspection'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Register & Manage Evidence */}
      {activeModal === 'EVIDENCE' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[92vh] overflow-y-auto bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl shadow-2xl p-6 relative">
            <button
              type="button"
              onClick={resetForms}
              className="absolute top-4 right-4 text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-lg"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <span className="text-xs font-mono font-bold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] px-2.5 py-0.5 rounded border border-[#DED8CB] dark:border-[#283931]">
                {selectedComplaint.trackingId}
              </span>
              <h3 className="text-base font-bold font-heading text-[#202522] dark:text-[#E8F0EC] mt-1">{selectedComplaint.title}</h3>
            </div>
            <EvidenceSection
              complaintId={selectedComplaint.id}
              trackingId={selectedComplaint.trackingId}
              isOwner={false}
              departmentId={selectedComplaint.assignedDepartmentId || undefined}
              onEvidenceChange={fetchOfficialComplaints}
            />
          </div>
        </div>
      )}

      {/* Modal: Submit Official Resolution */}
      {activeModal === 'RESOLUTION' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#DED8CB] dark:border-[#283931] shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <CardTitle className="text-[#1E6B52] dark:text-[#52B79A] font-heading">Submit Official Resolution</CardTitle>
                <CardDescription>Tracking ID: {selectedComplaint.trackingId}</CardDescription>
              </div>
              <button type="button" onClick={resetForms} className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1">
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              {modalError && <Alert variant="error" title="Validation Error">{modalError}</Alert>}
              <form onSubmit={handleResolutionSubmit} className="space-y-4 mt-2">
                <Alert variant="info" title="Citizen Verification Workflow">
                  Submitting this resolution will transition the complaint to <strong>RESOLVED</strong> and prompt the citizen reporter to verify whether the work meets community satisfaction.
                </Alert>

                <FormField
                  id="res-summary"
                  label="Official Resolution Summary"
                  required
                  helperText="Summarize all physical work completed, materials used, and final test results."
                >
                  <TextArea
                    id="res-summary"
                    placeholder="e.g. Road surface levelled with 150mm wet mix macadam and 40mm bitumen overlay. Drainage clearance confirmed."
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    required
                  />
                </FormField>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DED8CB] dark:border-[#283931]">
                  <Button type="button" variant="ghost" onClick={resetForms} disabled={actionLoading}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={actionLoading || !resolutionSummary.trim()}
                    className="bg-[#1E6B52] hover:bg-[#17523F]"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Resolution'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Citizen-Official Communication */}
      {activeModal === 'MESSAGE' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-2xl w-full flex flex-col max-h-[90vh]">
            <ComplaintMessageThread
              complaintId={selectedComplaint.id}
              trackingId={selectedComplaint.trackingId}
              className="flex-1"
            />
            <div className="mt-3 text-right">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedComplaint(null);
                }}
              >
                Close Thread
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
