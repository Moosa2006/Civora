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
    <Container size="lg" className="space-y-8">
      {/* Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Badge variant="info">Staff Oversight</Badge>
            <span className="text-xs text-[#C5D4C9] dark:text-[#54625A]">Module 14 Moderation & Trust</span>
          </div>
          <PageHeading
            title="Content Moderation & Abuse Triage"
            description="Investigate citizen abuse reports, review potential duplicate submissions, and enforce platform standards with auditable reason requirements."
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] rounded-xl p-1 self-start">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-[#173D32] text-white shadow-xs'
                : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
            }`}
          >
            Review Queue
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-[#173D32] text-white shadow-xs'
                  : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
              }`}
            >
              Metrics & Trends
            </button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Notice" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Aggregate Metrics Bar (For Admins) */}
      {metrics && activeTab === 'queue' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Total Abuse Reports</span>
            <div className="text-2xl font-bold text-[#202522] dark:text-[#F5F2EA] mt-1">{metrics.totalReports}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Open Moderation Cases</span>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{metrics.openCases}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Actions Enacted</span>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{metrics.actionTakenCases}</div>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Active Account Restrictions</span>
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
              <span className="text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">Status:</span>
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
              <span className="text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">Target Type:</span>
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
                  className="p-5 rounded-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 shadow-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold text-[#3E4B44] dark:text-[#C5D4C9]">
                        {c.caseNumber}
                      </span>
                      <Badge variant={getPriorityBadgeVariant(c.priority)}>
                        {c.priority} Priority
                      </Badge>
                      <Badge variant="neutral">
                        {c.targetType.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-[#C5D4C9] dark:text-[#54625A]">
                        Score: <span className="font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">{c.riskScore}/100</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#54625A] dark:text-[#C5D4C9]">
                      <span>
                        Reports filed: <strong className="text-[#202522] dark:text-[#E8F0EC]">{c._count?.reports || 0}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>Status: <strong className="text-[#202522] dark:text-[#E8F0EC]">{c.status.replace(/_/g, ' ')}</strong></span>
                      <span>&bull;</span>
                      <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    {c.riskFactors && c.riskFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.riskFactors.map((rf, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#3E4B44] dark:text-[#C5D4C9] border border-[#DED8CB] dark:border-[#283931]"
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
            <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Abuse Report Reason Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {metrics.reasonDistribution.map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">{item.reason.replace(/_/g, ' ')}</span>
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
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                  <span>Case Review: {selectedCase.caseNumber}</span>
                  <Badge variant={getPriorityBadgeVariant(selectedCase.priority)}>
                    {selectedCase.priority}
                  </Badge>
                </h3>
                <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  Target Content: {selectedCase.targetType.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA] p-1 rounded-lg cursor-pointer"
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
            <div className="p-4 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 rounded-xl border border-[#DED8CB] dark:border-[#283931] space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9]">
                Target Content Preview
              </span>
              <p className="text-sm text-[#202522] dark:text-[#E8F0EC] italic">
                {selectedCase.targetContent?.snippet || 'Content snapshot unavailable.'}
              </p>
              <div className="flex items-center gap-3 text-xs text-[#54625A] dark:text-[#C5D4C9] pt-1">
                <span>Moderation State: <strong>{selectedCase.targetContent?.isModerated ? 'HIDDEN' : 'VISIBLE'}</strong></span>
              </div>
            </div>

            {/* Citizen Abuse Reports */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] block">
                Citizen Abuse Reports ({selectedCase.reports?.length || 0})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedCase.reports?.map((r) => (
                  <div key={r.id} className="p-3 bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-300">{r.reason.replace(/_/g, ' ')}</span>
                      <span className="text-[#C5D4C9] dark:text-[#54625A]">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.explanation && <p className="text-[#3E4B44] dark:text-[#C5D4C9]">{r.explanation}</p>}
                    <span className="text-[10px] text-[#C5D4C9] dark:text-[#54625A] block">
                      Reporter Identity: [Shielded under Platform Privacy Standards]
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Appeals on this Case */}
            {selectedCase.appeals && selectedCase.appeals.length > 0 && (
              <div className="space-y-3 p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 block">
                  Citizen Appeals ({selectedCase.appeals.length})
                </span>
                <div className="space-y-2">
                  {selectedCase.appeals.map((a) => (
                    <div key={a.id} className="p-3 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">Appeal Status: {a.status}</span>
                        <span className="text-[#C5D4C9] dark:text-[#54625A]">{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[#3E4B44] dark:text-[#C5D4C9]">&ldquo;{a.reason}&rdquo;</p>
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
            <form onSubmit={handleApplyAction} className="space-y-4 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
              <h4 className="text-sm font-bold text-[#202522] dark:text-[#F5F2EA]">Execute Moderation Decision</h4>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] mb-1.5">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] mb-1.5">
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
          <div className="relative w-full max-w-md bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Adjudicate Citizen Appeal</h3>
            <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] italic bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 border border-[#DED8CB] dark:border-[#283931] p-3 rounded-lg">
              &ldquo;{selectedAppeal.reason}&rdquo;
            </p>

            <form onSubmit={handleReviewAppeal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9] mb-1">
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
                <label className="block text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9] mb-1">
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
