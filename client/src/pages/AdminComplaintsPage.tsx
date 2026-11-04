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
import { SearchIcon, CloseIcon } from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { useRouter } from '../router';
import { getStatusBadgeVariant } from '../utils/status';
import type { Complaint, Department } from '../types/complaint';
import { EvidenceReviewQueue } from '../components/evidence/EvidenceReviewQueue';

export function AdminComplaintsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  // Top level tab
  const [mainTab, setMainTab] = useState<'COMPLAINTS' | 'EVIDENCE'>('COMPLAINTS');

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected complaint for modal action
  const [activeModal, setActiveModal] = useState<'STATUS' | 'ASSIGN' | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Modal form states
  const [newStatus, setNewStatus] = useState<string>('UNDER_REVIEW');
  const [statusReason, setStatusReason] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Helper to get authenticated headers
  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('civora_token') : null;
    const headers: Record<string, string> = { ...extra };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch departments for assignment dropdown
  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await fetch('/api/meta/departments', {
          headers: getAuthHeaders({ Accept: 'application/json' }),
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDepartments(json.data);
        }
      } catch {
        // Silently catch
      }
    }
    loadDepartments();
  }, []);

  const fetchAdminComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let url = `/api/admin/complaints?page=${page}&limit=10`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to load administrative complaints queue.');
        return;
      }

      setComplaints(json.data.complaints || []);
      if (json.data.pagination) {
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      setErrorMsg('Failed to connect to administrative server. Please check network connection.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL')) {
      fetchAdminComplaints();
    }
  }, [isAuthenticated, user?.role, fetchAdminComplaints]);

  // Handle status update
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (newStatus === 'REJECTED' && !statusReason.trim()) {
      setErrorMsg('A specific reason is strictly required when rejecting a complaint.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/complaints/${selectedComplaint.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim() || undefined,
          resolutionNotes: resolutionNotes.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to update complaint status.');
        return;
      }

      setSuccessMsg(`Status updated to ${newStatus} for complaint ${selectedComplaint.trackingId}.`);
      setActiveModal(null);
      setSelectedComplaint(null);
      setStatusReason('');
      setResolutionNotes('');
      fetchAdminComplaints();
    } catch {
      setErrorMsg('An unexpected error occurred while updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle department assignment
  const handleAssignDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!selectedDeptId) {
      setErrorMsg('Please select a department.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/complaints/${selectedComplaint.id}/assign`, {
        method: 'PATCH',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          departmentId: selectedDeptId,
          notes: statusReason.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to assign department.');
        return;
      }

      setSuccessMsg(`Complaint ${selectedComplaint.trackingId} successfully assigned.`);
      setActiveModal(null);
      setSelectedComplaint(null);
      setStatusReason('');
      fetchAdminComplaints();
    } catch {
      setErrorMsg('An unexpected error occurred while assigning department.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle separating a consolidated report back into an independent complaint
  const handleSeparateReport = async (subordinateId: string, trackingId: string) => {
    const reason = window.prompt(
      `Enter reason to unlink report ${trackingId} from master issue:`,
      'Distinct physical defect or separate location confirmed by reviewer.'
    );
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/complaints/${subordinateId}/separate`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to separate report.');
        return;
      }

      setSuccessMsg(`Report ${trackingId} successfully separated into an independent master issue.`);
      fetchAdminComplaints();
    } catch {
      setErrorMsg('Network error while attempting to separate report.');
    } finally {
      setActionLoading(false);
    }
  };

  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL';

  if (!authLoading && (!isAuthenticated || !isStaff)) {
    return (
      <Container size="md" className="py-12 space-y-6">
        <Card className="border-[#E5E7EB] dark:border-[#374151]">
          <CardHeader>
            <CardTitle className="text-[#B94B3B] font-heading">Access Denied</CardTitle>
            <CardDescription>
              Administrative privilege required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB]">
              Only authorized Municipal Reviewers and System Administrators may access complaint triage, status management, and departmental assignment workflows.
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title={t('nav.triageDashboard')}
        description={`Logged as ${user?.name} (${user?.role}) • ${totalCount} grievances`}
        className="mb-0"
        badge={
          <Badge variant="warning" size="md">
            {t('roles.admin')}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => (mainTab === 'COMPLAINTS' ? fetchAdminComplaints() : undefined)}
          >
            {t('adminSystem.refreshBtn')}
          </Button>
        }
      />

      {/* View Switcher Tabs */}
      <div className="flex border-b border-[#E5E7EB] dark:border-[#374151] gap-2 pb-2">
        <button
          type="button"
          data-active={mainTab === 'COMPLAINTS'}
          onClick={() => setMainTab('COMPLAINTS')}
          className={`civora-liquid-tab py-2 px-4 rounded-lg text-sm font-medium ${
            mainTab === 'COMPLAINTS'
              ? 'font-semibold'
              : 'text-[#6B7280] dark:text-[#D1D5DB]'
          }`}
        >
          Complaints & Triage Queue
        </button>
        <button
          type="button"
          data-active={mainTab === 'EVIDENCE'}
          onClick={() => setMainTab('EVIDENCE')}
          className={`civora-liquid-tab py-2 px-4 rounded-lg text-sm font-medium ${
            mainTab === 'EVIDENCE'
              ? 'font-semibold'
              : 'text-[#6B7280] dark:text-[#D1D5DB]'
          }`}
        >
          Evidence & Resolution Review
        </button>
      </div>

      {mainTab === 'EVIDENCE' ? (
        <EvidenceReviewQueue />
      ) : (
        <>
          {successMsg && (
            <Alert variant="success" title="Success">
              {successMsg}
            </Alert>
          )}

          {errorMsg && (
            <Alert variant="error" title="Action Error">
              {errorMsg}
            </Alert>
          )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 max-w-md">
          <TextInput
            id="admin-search"
            placeholder="Search tracking ID, title, locality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon className="w-4 h-4 text-[#6B7280] dark:text-[#D1D5DB]" />}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map(
            (status) => (
              <button
                key={status}
                type="button"
                data-active={statusFilter === status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`civora-liquid-tab px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  statusFilter === status
                    ? 'font-semibold'
                    : 'text-[#6B7280] dark:text-[#D1D5DB]'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <LoadingIndicator size="lg" label="Loading queue" />
          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-3">Loading grievances queue...</span>
        </div>
      ) : errorMsg ? (
        <div className="py-8 space-y-4">
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold mb-1">Administrative Queue Error</p>
            <p className="text-xs mb-3">{errorMsg}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAdminComplaints()}
              className="cursor-pointer text-xs"
            >
              Retry Loading Queue
            </Button>
          </div>
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No Grievances Found"
          description="There are currently no complaints matching the selected status and search criteria."
        />
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <Card key={c.id} className="border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] dark:hover:border-[#3E564A] transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#F3F4F6] dark:bg-[#273548] px-2.5 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151]">
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
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                        • {c.category?.name || 'Category'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">{c.title}</h3>
                    <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">{c.description}</p>

                    {c.aiFindings?.verificationSummary && (
                      <div className="p-2.5 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-1">
                        <div className="flex items-center justify-between text-[#0B3D2E] dark:text-[#34D399] font-semibold text-[11px]">
                          <span>AI Integrity Findings</span>
                          {c.aiFindings.fraudIndicators && c.aiFindings.fraudIndicators.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-mono">
                              Flags: {c.aiFindings.fraudIndicators.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-[#374151] dark:text-[#D1D5DB] text-[11px] leading-relaxed">
                          {c.aiFindings.verificationSummary}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-2 border-t border-[#E5E7EB] dark:border-[#374151]">
                      <div>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Location:</strong> {c.locationAddress} ({c.locality})
                        {c.ward && <span className="block text-[11px] text-[#0B3D2E] dark:text-[#34D399] font-medium">Ward: {c.ward}</span>}
                      </div>
                      <div>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Citizen:</strong>{' '}
                        {c.citizen ? `${c.citizen.name} (${c.citizen.phone || c.citizen.email})` : 'Anonymous / Verified Citizen'}
                      </div>
                      <div>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Assigned Dept:</strong>{' '}
                        {c.assignedDepartment?.name || 'Unassigned'}
                      </div>
                      <div>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Lodged:</strong>{' '}
                        {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedComplaint(c);
                        setNewStatus(
                          c.status === 'SUBMITTED'
                            ? 'UNDER_REVIEW'
                            : c.status === 'UNDER_REVIEW'
                            ? 'IN_PROGRESS'
                            : c.status === 'ASSIGNED'
                            ? 'IN_PROGRESS'
                            : c.status === 'IN_PROGRESS'
                            ? 'RESOLVED'
                            : 'UNDER_REVIEW'
                        );
                        setActiveModal('STATUS');
                      }}
                      className="text-xs"
                    >
                      Update Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedComplaint(c);
                        setSelectedDeptId(c.assignedDepartmentId || (departments[0]?.id || ''));
                        setActiveModal('ASSIGN');
                      }}
                      className="text-xs"
                    >
                      Assign Dept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/track?id=${c.trackingId}`)}
                      className="text-xs"
                    >
                      Public View
                    </Button>
                    {c.isDuplicate && (
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => handleSeparateReport(c.id, c.trackingId)}
                        className="text-xs"
                        disabled={actionLoading}
                      >
                        Separate Report
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs">
              <span className="text-[#6B7280] dark:text-[#D1D5DB]">
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
    </>
  )}

      {/* Status Update Modal */}
      {activeModal === 'STATUS' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#E5E7EB] dark:border-[#374151] shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div>
                <CardTitle className="font-heading">Update Complaint Status</CardTitle>
                <CardDescription>
                  Tracking ID: {selectedComplaint.trackingId} (Current: {selectedComplaint.status})
                </CardDescription>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setActiveModal(null)}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <FormField id="modal-status" label="Target Status" required>
                  <Select
                    id="modal-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    options={[
                      { value: 'UNDER_REVIEW', label: 'UNDER_REVIEW — Review initiated' },
                      { value: 'ASSIGNED', label: 'ASSIGNED — Dispatched to department' },
                      { value: 'IN_PROGRESS', label: 'IN_PROGRESS — Field crew working' },
                      { value: 'RESOLVED', label: 'RESOLVED — Issue addressed' },
                      { value: 'REJECTED', label: 'REJECTED — Invalid / duplicate filing' },
                    ]}
                  />
                </FormField>

                {newStatus === 'REJECTED' && (
                  <FormField
                    id="modal-rejection-reason"
                    label="Rejection Reason"
                    required
                    helperText="Mandatory explanation sent to citizen"
                  >
                    <TextArea
                      id="modal-rejection-reason"
                      placeholder="e.g. Duplicate complaint of already resolved issue #..."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      required
                    />
                  </FormField>
                )}

                {newStatus === 'RESOLVED' && (
                  <FormField
                    id="modal-resolution-notes"
                    label="Resolution Notes"
                    helperText="Detail actions taken to resolve the issue"
                  >
                    <TextArea
                      id="modal-resolution-notes"
                      placeholder="e.g. Road surface levelled and bitumen layer repaved..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                  </FormField>
                )}

                {newStatus !== 'REJECTED' && newStatus !== 'RESOLVED' && (
                  <FormField id="modal-remarks" label="Remarks / Audit Note (Optional)">
                    <TextInput
                      id="modal-remarks"
                      placeholder="e.g. Inspection scheduled for tomorrow morning"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                    />
                  </FormField>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB] dark:border-[#374151]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveModal(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving...' : 'Confirm Update'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assign Department Modal */}
      {activeModal === 'ASSIGN' && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#E5E7EB] dark:border-[#374151] shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div>
                <CardTitle className="font-heading">Assign Municipal Department</CardTitle>
                <CardDescription>
                  Tracking ID: {selectedComplaint.trackingId}
                </CardDescription>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setActiveModal(null)}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignDepartment} className="space-y-4">
                <FormField id="modal-dept" label="Select Responsible Department" required>
                  <Select
                    id="modal-dept"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    options={departments.map((d) => ({
                      value: d.id,
                      label: `${d.name} (${d.code})`,
                    }))}
                  />
                </FormField>

                <FormField id="modal-assign-notes" label="Assignment Instructions (Optional)">
                  <TextInput
                    id="modal-assign-notes"
                    placeholder="e.g. Dispatched to Ward 112 electrical maintenance squad"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                  />
                </FormField>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB] dark:border-[#374151]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveModal(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  );
}
