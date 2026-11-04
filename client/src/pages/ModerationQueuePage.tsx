import { useEffect, useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { TextArea } from '../components/ui/TextArea';
import { Alert } from '../components/ui/Alert';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import type {
  ModerationCase,
  ModerationAppeal,
  ModerationActionType,
  ModerationMetrics,
} from '../types/moderation';

export function ModerationQueuePage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL';

  const [activeTab, setActiveTab] = useState<'queue' | 'appeals' | 'metrics'>('queue');
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [metrics, setMetrics] = useState<ModerationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  // Selected case for detail view & action
  const [selectedCase, setSelectedCase] = useState<ModerationCase | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType>('CONTENT_HIDDEN');
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Appeals review
  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null);
  const [appealDecision, setAppealDecision] = useState<'UPHELD' | 'REJECTED'>('UPHELD');
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!isStaff) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (targetTypeFilter && targetTypeFilter !== 'ALL') {
        params.append('targetType', targetTypeFilter);
      }

      const res = await fetch(`/api/moderation/queue?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch queue');
      setCases(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading moderation queue');
    } finally {
      setLoading(false);
    }
  }, [isStaff, statusFilter, targetTypeFilter]);

  const fetchMetrics = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const res = await fetch('/api/moderation/metrics');
      const data = await res.json();
      if (res.ok && data.success) {
        setMetrics(data.data);
      }
    } catch {
      // Continue if metrics fail
    }
  }, [user?.role]);

  useEffect(() => {
    fetchCases();
    fetchMetrics();
  }, [fetchCases, fetchMetrics]);

  const openCaseDetails = async (caseId: string) => {
    setActionSuccess(null);
    setActionReason('');
    setActionNotes('');
    try {
      const res = await fetch(`/api/moderation/cases/${caseId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedCase(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch case detail');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApplyAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (actionReason.trim().length < 5) {
      setError('A mandatory documented reason of at least 5 characters is required.');
      return;
    }

    setActionSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/cases/${selectedCase.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          reason: actionReason.trim(),
          internalNotes: actionNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Action failed');

      setActionSuccess(`Action ${actionType} recorded successfully.`);
      fetchCases();
      fetchMetrics();
      // Re-fetch detail
      openCaseDetails(selectedCase.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReviewAppeal = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal) return;
    if (appealReason.trim().length < 5) {
      setError('A mandatory decision reason (minimum 5 characters) is required.');
      return;
    }

    setAppealSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/appeals/${selectedAppeal.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: appealDecision,
          decisionReason: appealReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Appeal review failed');

      setSelectedAppeal(null);
      setAppealReason('');
      fetchCases();
      if (selectedCase) openCaseDetails(selectedCase.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAppealSubmitting(false);
    }
  };

  if (!isStaff) {
    return (
      <Container size="md" className="py-12">
        <Alert variant="error" title="Access Denied">
          Staff authorization is required to access the Civora moderation queue.
        </Alert>
      </Container>
    );
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title="Content Moderation & Abuse Triage"
        description="Investigate citizen abuse reports, review potential duplicate submissions, and enforce platform standards with auditable reason requirements."
        className="mb-0"
        eyebrow={
          <div className="flex items-center gap-2">
            <Badge variant="info">Staff Oversight</Badge>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Moderation & Trust</span>
          </div>
        }
        actions={
          <div className="flex gap-1.5 bg-[#F3F4F6]/80 dark:bg-[#273548]/80 border border-[#E5E7EB] dark:border-[#374151] rounded-xl p-1">
            <button
              type="button"
              data-active={activeTab === 'queue'}
              onClick={() => setActiveTab('queue')}
              className={`civora-liquid-tab px-4 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === 'queue' ? '' : 'text-[#4B5563] dark:text-[#D1D5DB]'
              }`}
            >
              Review Queue
            </button>
            {user?.role === 'ADMIN' && (
              <button
                type="button"
                data-active={activeTab === 'metrics'}
                onClick={() => setActiveTab('metrics')}
                className={`civora-liquid-tab px-4 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'metrics' ? '' : 'text-[#4B5563] dark:text-[#D1D5DB]'
                }`}
              >
                Metrics & Trends
              </button>
            )}
          </div>
        }
      />

      {error && (
        <Alert variant="error" title="Notice" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Aggregate Metrics Bar (For Admins) */}
      {metrics && activeTab === 'queue' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">Total Abuse Reports</span>
            <div className="text-2xl font-bold text-[#111827] dark:text-[#F9FAFB] mt-1">{metrics.totalReports}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">Open Moderation Cases</span>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{metrics.openCases}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">Actions Enacted</span>
            <div className="text-2xl font-bold text-[#0B6640] dark:text-[#34D399] mt-1">{metrics.actionTakenCases}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">Active Account Restrictions</span>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{metrics.activeRestrictions}</div>
          </Card>
        </div>
      )}

      {/* TAB 1: MODERATION QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <Card className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB]">Status:</span>
              <Select
                value={statusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'ACTION_TAKEN', label: 'Action Taken' },
                  { value: 'RESOLVED_NO_VIOLATION', label: 'Resolved (No Violation)' },
                ]}
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB]">Target Type:</span>
              <Select
                value={targetTypeFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setTargetTypeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Content Types' },
                  { value: 'COMPLAINT', label: 'Complaints' },
                  { value: 'COMPLAINT_MESSAGE', label: 'Messages' },
                  { value: 'PROPOSAL', label: 'Proposals' },
                  { value: 'PROPOSAL_COMMENT', label: 'Comments' },
                  { value: 'POLL', label: 'Polls' },
                  { value: 'DOCUMENT', label: 'Uploaded Evidence' },
                ]}
              />
            </div>

            <Button variant="outline" size="sm" onClick={() => fetchCases()} className="ml-auto">
              Refresh Queue
            </Button>
          </Card>

          {/* Queue List */}
          {loading ? (
            <div className="py-16 flex justify-center">
              <LoadingIndicator label="Loading moderation queue..." />
            </div>
          ) : cases.length === 0 ? (
            <EmptyState
              title="Moderation Queue is Clear"
              description="No active moderation cases match your current filters. Platform integrity rules are satisfied."
            />
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 shadow-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold text-[#374151] dark:text-[#D1D5DB]">
                        {c.caseNumber}
                      </span>
                      <Badge variant={getPriorityBadgeVariant(c.priority)}>
                        {c.priority} Priority
                      </Badge>
                      <Badge variant="neutral">
                        {c.targetType.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                        Score: <span className="font-semibold text-[#374151] dark:text-[#D1D5DB]">{c.riskScore}/100</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                      <span>
                        Reports filed: <strong className="text-[#111827] dark:text-[#F9FAFB]">{c._count?.reports || 0}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>Status: <strong className="text-[#111827] dark:text-[#F9FAFB]">{c.status.replace(/_/g, ' ')}</strong></span>
                      <span>&bull;</span>
                      <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    {c.riskFactors && c.riskFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.riskFactors.map((rf, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] bg-[#F3F4F6] dark:bg-[#273548] text-[#374151] dark:text-[#D1D5DB] border border-[#E5E7EB] dark:border-[#374151]"
                          >
                            {rf.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCaseDetails(c.id)}
                  >
                    Investigate Case
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AGGREGATE METRICS & TRENDS (Admin Only) */}
      {activeTab === 'metrics' && metrics && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Abuse Report Reason Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {metrics.reasonDistribution.map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB]">{item.reason.replace(/_/g, ' ')}</span>
                  <Badge variant="info">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* CASE DETAIL & DECISION MODAL */}
      {selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
                  <span>Case Review: {selectedCase.caseNumber}</span>
                  <Badge variant={getPriorityBadgeVariant(selectedCase.priority)}>
                    {selectedCase.priority}
                  </Badge>
                </h3>
                <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                  Target Content: {selectedCase.targetType.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setSelectedCase(null)}
                className="civora-liquid-btn civora-liquid-btn--ghost px-2.5 py-1 rounded-lg text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {actionSuccess && (
              <Alert variant="success" title="Success">
                {actionSuccess}
              </Alert>
            )}

            {/* Target Content Snapshot */}
            <div className="p-4 bg-[#F9FAFB] dark:bg-[#182230] rounded-xl border border-[#E5E7EB] dark:border-[#374151] space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#374151] dark:text-[#D1D5DB]">
                Target Content Preview
              </span>
              <p className="text-sm text-[#111827] dark:text-[#F9FAFB] italic">
                {selectedCase.targetContent?.snippet || 'Content snapshot unavailable.'}
              </p>
              <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-1">
                <span>Moderation State: <strong>{selectedCase.targetContent?.isModerated ? 'HIDDEN' : 'VISIBLE'}</strong></span>
              </div>
            </div>

            {/* Citizen Abuse Reports */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#374151] dark:text-[#D1D5DB] block">
                Citizen Abuse Reports ({selectedCase.reports?.length || 0})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedCase.reports?.map((r) => (
                  <div key={r.id} className="p-3 bg-[#F9FAFB] dark:bg-[#182230] rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-700 dark:text-rose-300">{r.reason.replace(/_/g, ' ')}</span>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.explanation && <p className="text-[#374151] dark:text-[#D1D5DB]">{r.explanation}</p>}
                    <span className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB] block">
                      Reporter Identity: [Shielded under Platform Privacy Standards]
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Appeals on this Case */}
            {selectedCase.appeals && selectedCase.appeals.length > 0 && (
              <div className="space-y-3 p-4 bg-[#F9FAFB] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] rounded-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0B3D2E] dark:text-[#34D399] block">
                  Citizen Appeals ({selectedCase.appeals.length})
                </span>
                <div className="space-y-2">
                  {selectedCase.appeals.map((a) => (
                    <div key={a.id} className="p-3 bg-white dark:bg-[#182230] rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">Appeal Status: {a.status}</span>
                        <span className="text-[#6B7280] dark:text-[#D1D5DB]">{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[#374151] dark:text-[#D1D5DB]">&ldquo;{a.reason}&rdquo;</p>
                      {a.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAppeal(a)}
                        >
                          Adjudicate Appeal
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision Controls Form */}
            <form onSubmit={handleApplyAction} className="space-y-4 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Execute Moderation Decision</h4>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] dark:text-[#D1D5DB] mb-1.5">
                  Action Type *
                </label>
                <Select
                  value={actionType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setActionType(e.target.value as ModerationActionType)}
                  options={[
                    { value: 'CONTENT_HIDDEN', label: 'Hide Content (Policy Violation)' },
                    { value: 'CONTENT_RESTORED', label: 'Restore Content (Publicly Visible)' },
                    { value: 'WARNING_ISSUED', label: 'Issue Warning to Content Submitter' },
                    { value: 'NO_ACTION', label: 'No Action (Dismiss - No Violation Found)' },
                    { value: 'ACCOUNT_RESTRICTED', label: 'Restrict Submissions / Comments' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] dark:text-[#D1D5DB] mb-1.5">
                  Mandatory Public Reason * (Required for audit and citizen explanation)
                </label>
                <TextArea
                  rows={2}
                  placeholder="Detail the documented policy violation or reason for restoration (min 5 chars)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedCase(null)}>
                  Close
                </Button>
                <Button type="submit" variant="primary" disabled={actionSubmitting}>
                  {actionSubmitting ? 'Recording...' : 'Commit Decision'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPEAL ADJUDICATION MODAL */}
      {selectedAppeal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Adjudicate Citizen Appeal</h3>
            <p className="text-xs text-[#374151] dark:text-[#D1D5DB] italic bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] p-3 rounded-lg">
              &ldquo;{selectedAppeal.reason}&rdquo;
            </p>

            <form onSubmit={handleReviewAppeal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Appeal Outcome
                </label>
                <Select
                  value={appealDecision}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setAppealDecision(e.target.value as any)}
                  options={[
                    { value: 'UPHELD', label: 'Uphold Appeal (Grant appeal & restore content)' },
                    { value: 'REJECTED', label: 'Reject Appeal (Penalty remains in effect)' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Mandatory Review Reason *
                </label>
                <TextArea
                  rows={2}
                  placeholder="Detail the supervisory review finding (min 5 chars)..."
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedAppeal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={appealSubmitting}>
                  Submit Appeal Decision
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  );
}
