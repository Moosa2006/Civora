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
  ClockIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  FileTextIcon,
  BuildingIcon,
  CloseIcon,
  RefreshCwIcon,
  PlusIcon,
} from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useRouter } from '../router';
import type {
  SlaPolicy,
  ComplaintEscalation,
  SlaExtensionRequest,
  DepartmentScorecard,
  SlaAccountabilitySummary,
} from '../types/sla';

type TabType = 'ESCALATIONS' | 'POLICIES' | 'EXTENSIONS' | 'SCORECARD';

export function SlaManagementPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('ESCALATIONS');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [escalations, setEscalations] = useState<ComplaintEscalation[]>([]);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<SlaExtensionRequest[]>([]);
  const [scorecardSummary, setScorecardSummary] = useState<SlaAccountabilitySummary | null>(null);
  const [departmentScorecards, setDepartmentScorecards] = useState<DepartmentScorecard[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Filter states
  const [escalationStatusFilter, setEscalationStatusFilter] = useState<string>('ALL');
  const [escalationLevelFilter, setEscalationLevelFilter] = useState<string>('ALL');
  const [extensionStatusFilter, setExtensionStatusFilter] = useState<string>('PENDING');

  // Modal states
  const [evaluating, setEvaluating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal: Acknowledge
  const [ackModalEscalation, setAckModalEscalation] = useState<ComplaintEscalation | null>(null);
  const [ackNotes, setAckNotes] = useState('');

  // Modal: Action Plan
  const [planModalEscalation, setPlanModalEscalation] = useState<ComplaintEscalation | null>(null);
  const [actionPlanText, setActionPlanText] = useState('');

  // Modal: Resolve Escalation
  const [resolveModalEscalation, setResolveModalEscalation] = useState<ComplaintEscalation | null>(null);
  const [resolutionReasonText, setResolutionReasonText] = useState('');

  // Modal: Create SLA Policy
  const [showCreatePolicyModal, setShowCreatePolicyModal] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [newPolicyCategory, setNewPolicyCategory] = useState('');
  const [newPolicyPriority, setNewPolicyPriority] = useState('');
  const [newPolicyResponseHours, setNewPolicyResponseHours] = useState('24');
  const [newPolicyResolutionHours, setNewPolicyResolutionHours] = useState('72');
  const [newPolicyWarningHours, setNewPolicyWarningHours] = useState('12');
  const [newPolicyEscalationHours, setNewPolicyEscalationHours] = useState('24');
  const [newPolicyIsDefault, setNewPolicyIsDefault] = useState(false);

  // Modal: Review Extension Request
  const [reviewModalRequest, setReviewModalRequest] = useState<SlaExtensionRequest | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Permission check
  const isAuthorizedStaff =
    isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL');
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // Fetch categories for policy dropdown
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/complaints/categories');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data);
        }
      } catch {
        // Soft fail
      }
    }
    fetchCategories();
  }, []);

  // Main data loader
  const loadData = useCallback(async () => {
    if (!isAuthorizedStaff) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (activeTab === 'ESCALATIONS') {
        const params = new URLSearchParams();
        if (escalationStatusFilter !== 'ALL') params.append('status', escalationStatusFilter);
        if (escalationLevelFilter !== 'ALL') params.append('level', escalationLevelFilter);

        const res = await fetch(`/api/sla/escalations?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setEscalations(json.data.escalations || []);
        } else {
          setErrorMsg(json.error?.message || 'Failed to fetch escalations.');
        }
      } else if (activeTab === 'POLICIES') {
        const res = await fetch('/api/sla/policies');
        const json = await res.json();
        if (json.success) {
          setPolicies(json.data.policies || []);
        } else {
          setErrorMsg(json.error?.message || 'Failed to fetch SLA policies.');
        }
      } else if (activeTab === 'EXTENSIONS') {
        const params = new URLSearchParams();
        if (extensionStatusFilter !== 'ALL') params.append('status', extensionStatusFilter);

        const res = await fetch(`/api/sla/extensions?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setExtensionRequests(json.data || []);
        } else {
          setErrorMsg(json.error?.message || 'Failed to fetch extension requests.');
        }
      } else if (activeTab === 'SCORECARD') {
        const res = await fetch('/api/sla/metrics');
        const json = await res.json();
        if (json.success) {
          setScorecardSummary(json.data.summary);
          setDepartmentScorecards(json.data.departmentScorecards || []);
        } else {
          setErrorMsg(json.error?.message || 'Failed to fetch SLA metrics.');
        }
      }
    } catch {
      setErrorMsg('Network error connecting to SLA service.');
    } finally {
      setLoading(false);
    }
  }, [
    isAuthorizedStaff,
    activeTab,
    escalationStatusFilter,
    escalationLevelFilter,
    extensionStatusFilter,
  ]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  // Acknowledge Escalation Handler
  const handleAcknowledge = async () => {
    if (!ackModalEscalation) return;
    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/sla/escalations/${ackModalEscalation.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: ackNotes }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg('Escalation acknowledged successfully.');
        setAckModalEscalation(null);
        setAckNotes('');
        loadData();
      } else {
        setModalError(json.error?.message || 'Failed to acknowledge escalation.');
      }
    } catch {
      setModalError('Network error acknowledging escalation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Record Action Plan Handler
  const handleRecordActionPlan = async () => {
    if (!planModalEscalation) return;
    if (!actionPlanText.trim()) {
      setModalError('Please describe the corrective action plan.');
      return;
    }
    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/sla/escalations/${planModalEscalation.id}/action-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionPlan: actionPlanText.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg('Corrective action plan recorded.');
        setPlanModalEscalation(null);
        setActionPlanText('');
        loadData();
      } else {
        setModalError(json.error?.message || 'Failed to record action plan.');
      }
    } catch {
      setModalError('Network error recording action plan.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve Escalation Handler
  const handleResolveEscalation = async () => {
    if (!resolveModalEscalation) return;
    if (!resolutionReasonText.trim()) {
      setModalError('Please specify the escalation resolution reason.');
      return;
    }
    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/sla/escalations/${resolveModalEscalation.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionReason: resolutionReasonText.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg('Escalation resolved. Note: Complaint resolution remains distinct.');
        setResolveModalEscalation(null);
        setResolutionReasonText('');
        loadData();
      } else {
        setModalError(json.error?.message || 'Failed to resolve escalation.');
      }
    } catch {
      setModalError('Network error resolving escalation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Policy Handler (Admin only)
  const handleCreatePolicy = async () => {
    if (!newPolicyName.trim()) {
      setModalError('Policy name is required.');
      return;
    }
    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/sla/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPolicyName.trim(),
          description: newPolicyDesc.trim() || undefined,
          categoryId: newPolicyCategory || undefined,
          priority: newPolicyPriority || undefined,
          responseTargetHours: parseInt(newPolicyResponseHours, 10),
          resolutionTargetHours: parseInt(newPolicyResolutionHours, 10),
          warningThresholdHours: parseInt(newPolicyWarningHours, 10),
          escalationThresholdHours: parseInt(newPolicyEscalationHours, 10),
          isDefault: newPolicyIsDefault,
          isActive: true,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg('SLA policy created successfully.');
        setShowCreatePolicyModal(false);
        setNewPolicyName('');
        setNewPolicyDesc('');
        loadData();
      } else {
        setModalError(json.error?.message || 'Failed to create policy.');
      }
    } catch {
      setModalError('Network error creating policy.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Policy Status Handler (Admin only)
  const handleTogglePolicy = async (id: string) => {
    try {
      const res = await fetch(`/api/sla/policies/${id}/toggle`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.message);
        loadData();
      } else {
        setErrorMsg(json.error?.message || 'Failed to toggle policy status.');
      }
    } catch {
      setErrorMsg('Network error updating policy.');
    }
  };

  // Extension Decision Handler
  const handleDecideExtension = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!reviewModalRequest) return;
    if (decision === 'REJECTED' && !decisionNotes.trim()) {
      setModalError('Mandatory justification notes required when rejecting an extension request.');
      return;
    }
    setActionLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/sla/extensions/${reviewModalRequest.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decisionNotes: decisionNotes.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg(json.message);
        setReviewModalRequest(null);
        setDecisionNotes('');
        loadData();
      } else {
        setModalError(json.error?.message || 'Failed to process extension decision.');
      }
    } catch {
      setModalError('Network error deciding extension.');
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Trigger for SlaEngine Evaluation
  const handleTriggerEvaluation = async () => {
    setEvaluating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/sla/evaluate', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(
          `SLA evaluation complete: Evaluated ${json.data.evaluated} active cases. Approaching: ${json.data.approaching}, Overdue: ${json.data.overdue}, Escalated: ${json.data.escalated}.`
        );
        loadData();
      } else {
        setErrorMsg(json.error?.message || 'Failed to run SLA evaluation.');
      }
    } catch {
      setErrorMsg('Network error running evaluation engine.');
    } finally {
      setEvaluating(false);
    }
  };

  if (authLoading) {
    return (
      <Container size="lg" className="py-12">
        <LoadingIndicator label="Authenticating user permissions..." />
      </Container>
    );
  }

  if (!isAuthorizedStaff) {
    return (
      <Container size="md" className="py-16">
        <Card className="text-center p-8 border-rose-500/30">
          <AlertTriangleIcon className="w-12 h-12 text-[#9C3B2D] dark:text-[#F39182] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#202522] dark:text-[#F5F2EA] mb-2">Restricted Access</h2>
          <p className="text-[#54625A] dark:text-[#C5D4C9] mb-6">
            The Service-Level Agreement and Escalation Management workspace is strictly reserved for
            authorized municipal department staff and administrators.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Log In as Staff Official
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" className="py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-6">
        <div>
          <PageHeading
            title="Service-Level Agreements & Accountability"
            description="Monitor complaint commitments, enforce overdue case resolution, and oversee department escalations."
          />
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerEvaluation}
              isLoading={evaluating}
              className="flex items-center gap-2 border-[#DED8CB] dark:border-[#283931] hover:border-blue-500"
            >
              <RefreshCwIcon className="w-4 h-4" />
              Evaluate Deadlines Now
            </Button>
          )}
          {isAdmin && activeTab === 'POLICIES' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setModalError(null);
                setShowCreatePolicyModal(true);
              }}
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Create SLA Policy
            </Button>
          )}
        </div>
      </div>

      {/* Global Notifications */}
      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#DED8CB] dark:border-[#283931] gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ESCALATIONS')}
          className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ESCALATIONS'
              ? 'border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#ECE7DB] dark:bg-[#1D2A25]'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB]/50 dark:hover:bg-[#1D2A25]/50'
          }`}
        >
          <AlertTriangleIcon className="w-4 h-4" />
          Overdue & Escalations Queue
        </button>

        <button
          onClick={() => setActiveTab('POLICIES')}
          className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'POLICIES'
              ? 'border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#ECE7DB] dark:bg-[#1D2A25]'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB]/50 dark:hover:bg-[#1D2A25]/50'
          }`}
        >
          <ShieldCheckIcon className="w-4 h-4" />
          SLA Policy Configuration
        </button>

        <button
          onClick={() => setActiveTab('EXTENSIONS')}
          className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'EXTENSIONS'
              ? 'border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#ECE7DB] dark:bg-[#1D2A25]'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB]/50 dark:hover:bg-[#1D2A25]/50'
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          Extension Requests
        </button>

        <button
          onClick={() => setActiveTab('SCORECARD')}
          className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'SCORECARD'
              ? 'border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#ECE7DB] dark:bg-[#1D2A25]'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB]/50 dark:hover:bg-[#1D2A25]/50'
          }`}
        >
          <BuildingIcon className="w-4 h-4" />
          Department Scorecard
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12">
          <LoadingIndicator label="Fetching SLA accountability data..." />
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: OVERDUE & ESCALATIONS QUEUE                             */}
      {/* ============================================================== */}
      {!loading && activeTab === 'ESCALATIONS' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931]">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="w-48">
                <Select
                  value={escalationStatusFilter}
                  onChange={(e) => setEscalationStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Escalation Statuses</option>
                  <option value="ACTIVE">Active (Needs Action)</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="ACTION_PLANNED">Action Planned</option>
                  <option value="RESOLVED">Resolved</option>
                </Select>
              </div>

              <div className="w-48">
                <Select
                  value={escalationLevelFilter}
                  onChange={(e) => setEscalationLevelFilter(e.target.value)}
                >
                  <option value="ALL">All Escalation Levels</option>
                  <option value="LEVEL_1_OFFICIAL">Level 1 - Case Official</option>
                  <option value="LEVEL_2_SUPERVISOR">Level 2 - Supervisor</option>
                  <option value="LEVEL_3_HEAD_ADMIN">Level 3 - Head / Admin</option>
                </Select>
              </div>
            </div>

            <div className="text-sm text-[#54625A] dark:text-[#C5D4C9] font-medium">
              Showing {escalations.length} escalated complaint{escalations.length === 1 ? '' : 's'}
            </div>
          </div>

          {escalations.length === 0 ? (
            <EmptyState
              title="No Escalated Complaints in Queue"
              description="Great news! All complaints are currently operating within assigned targets or have cleared supervisory review."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {escalations.map((esc) => {
                const complaint = esc.complaint;
                const sla = complaint?.sla;
                const isOverdue = sla?.isResolutionOverdue || sla?.isResponseOverdue;

                return (
                  <Card
                    key={esc.id}
                    className={`border transition-all ${
                      esc.status === 'ACTIVE'
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : esc.status === 'ACKNOWLEDGED'
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C]'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">
                              {complaint?.trackingId || 'NO-TRACKING'}
                            </span>

                            <Badge
                              variant={
                                esc.escalationLevel === 'LEVEL_3_HEAD_ADMIN'
                                  ? 'danger'
                                  : esc.escalationLevel === 'LEVEL_2_SUPERVISOR'
                                    ? 'warning'
                                    : 'info'
                              }
                            >
                              {esc.escalationLevel.replace(/_/g, ' ')}
                            </Badge>

                            <Badge
                              variant={
                                esc.status === 'ACTIVE'
                                  ? 'danger'
                                  : esc.status === 'RESOLVED'
                                    ? 'success'
                                    : 'warning'
                              }
                            >
                              {esc.status}
                            </Badge>

                            {isOverdue && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/50">
                                Overdue Case
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-[#202522] dark:text-[#F5F2EA]">
                            {complaint?.title || 'Untitled Complaint'}
                          </h3>

                          <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>
                              Department:{' '}
                              <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">
                                {complaint?.assignedDepartment?.name || 'Unassigned'}
                              </strong>
                            </span>
                            <span>
                              Official:{' '}
                              <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">
                                {complaint?.assignedOfficial?.name || 'Unassigned'}
                              </strong>
                            </span>
                            <span>
                              Trigger:{' '}
                              <span className="text-amber-300 font-medium">
                                {esc.triggerReason.replace(/_/g, ' ')}
                              </span>
                            </span>
                            <span>
                              Escalated:{' '}
                              <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                                {new Date(esc.createdAt).toLocaleDateString()}
                              </span>
                            </span>
                          </div>

                          {/* Notes / Action Plan snippet */}
                          {esc.actionPlan && (
                            <div className="mt-2 text-xs bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-2.5 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-[#3E4B44] dark:text-[#C5D4C9]">
                              <span className="font-semibold text-blue-400 block mb-0.5">
                                Current Corrective Action Plan:
                              </span>
                              {esc.actionPlan}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                          {esc.status === 'ACTIVE' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setModalError(null);
                                setAckNotes('');
                                setAckModalEscalation(esc);
                              }}
                            >
                              Acknowledge
                            </Button>
                          )}

                          {esc.status !== 'RESOLVED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setModalError(null);
                                setActionPlanText(esc.actionPlan || '');
                                setPlanModalEscalation(esc);
                              }}
                            >
                              Action Plan
                            </Button>
                          )}

                          {esc.status !== 'RESOLVED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setModalError(null);
                                setResolutionReasonText('');
                                setResolveModalEscalation(esc);
                              }}
                            >
                              Resolve Escalation
                            </Button>
                          )}

                          {esc.status === 'RESOLVED' && (
                            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircleIcon className="w-4 h-4" />
                              Escalation Resolved
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SLA POLICY CONFIGURATION                                */}
      {/* ============================================================== */}
      {!loading && activeTab === 'POLICIES' && (
        <div className="space-y-6">
          <div className="bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931] text-xs text-[#54625A] dark:text-[#C5D4C9] space-y-1">
            <span className="font-semibold text-[#202522] dark:text-[#E8F0EC] block text-sm mb-1">
              Deterministic Policy Precedence:
            </span>
            <p>1. Active policy matching both Category + Priority.</p>
            <p>2. Active policy matching Category with general priority.</p>
            <p>3. Active policy matching Priority with general category.</p>
            <p>4. Platform Default Policy (fallback).</p>
            <p className="text-amber-400 pt-1">
              Editing or deactivating a policy never rewrites existing complaint deadlines; historical
              commitments are permanently preserved in complaint snapshots.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {policies.map((pol) => (
              <Card
                key={pol.id}
                className={`border transition-all flex flex-col justify-between ${
                  pol.isActive
                    ? pol.isDefault
                      ? 'border-blue-500/40 bg-blue-950/10'
                      : 'border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/70 dark:bg-[#1D2A25]/70'
                    : 'border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 opacity-75'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base text-[#202522] dark:text-[#F5F2EA]">{pol.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {pol.isDefault && <Badge variant="info">Default</Badge>}
                      <Badge variant={pol.isActive ? 'success' : 'neutral'}>
                        {pol.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  {pol.description && (
                    <CardDescription className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-2">
                      {pol.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="text-xs space-y-1 text-[#3E4B44] dark:text-[#C5D4C9]">
                    <div className="flex justify-between py-1 border-b border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Category:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">{pol.category?.name || 'All Categories'}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Priority:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">{pol.priority || 'All Priorities'}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Response Target:</span>
                      <strong className="text-blue-300">{pol.responseTargetHours} Hours ({Math.round(pol.responseTargetHours / 24 * 10) / 10}d)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Resolution Target:</span>
                      <strong className="text-emerald-300">{pol.resolutionTargetHours} Hours ({Math.round(pol.resolutionTargetHours / 24 * 10) / 10}d)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Warning Threshold:</span>
                      <strong className="text-amber-300">{pol.warningThresholdHours}h before</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Escalation Threshold:</span>
                      <strong className="text-red-300">{pol.escalationThresholdHours}h after breach</strong>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-2 flex items-center justify-between border-t border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[11px] text-[#C5D4C9] dark:text-[#54625A]">
                        Used by {pol._count?.complaintSlas ?? 0} case(s)
                      </span>
                      <Button
                        variant={pol.isActive ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => handleTogglePolicy(pol.id)}
                        className="text-xs h-7 px-2"
                      >
                        {pol.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: EXTENSION REQUESTS                                      */}
      {/* ============================================================== */}
      {!loading && activeTab === 'EXTENSIONS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931]">
            <div className="w-56">
              <Select
                value={extensionStatusFilter}
                onChange={(e) => setExtensionStatusFilter(e.target.value)}
              >
                <option value="ALL">All Requests</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </div>
            <div className="text-sm text-[#54625A] dark:text-[#C5D4C9] font-medium">
              Showing {extensionRequests.length} extension request{extensionRequests.length === 1 ? '' : 's'}
            </div>
          </div>

          {extensionRequests.length === 0 ? (
            <EmptyState
              title="No Extension Requests Found"
              description="No deadline adjustments have been requested matching the current filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {extensionRequests.map((req) => (
                <Card
                  key={req.id}
                  className={`border transition-all ${
                    req.status === 'PENDING'
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : req.status === 'APPROVED'
                        ? 'border-emerald-500/30 bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60'
                        : 'border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">
                            {req.complaint?.trackingId || 'CASE'}
                          </span>
                          <Badge
                            variant={
                              req.status === 'PENDING'
                                ? 'warning'
                                : req.status === 'APPROVED'
                                  ? 'success'
                                  : 'danger'
                            }
                          >
                            {req.status}
                          </Badge>
                        </div>

                        <h4 className="text-base font-semibold text-[#202522] dark:text-[#F5F2EA]">
                          {req.complaint?.title}
                        </h4>

                        <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Requested by:{' '}
                            <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">
                              {req.requestedByOfficial?.name}
                            </strong>
                          </span>
                          <span>
                            Department:{' '}
                            <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">
                              {req.complaint?.assignedDepartment?.name || 'General'}
                            </strong>
                          </span>
                          <span>
                            Original Deadline:{' '}
                            <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">
                              {new Date(req.previousResolutionDeadline).toLocaleDateString()}
                            </strong>
                          </span>
                          <span>
                            Requested Target:{' '}
                            <strong className="text-blue-400">
                              {new Date(req.requestedResolutionDeadline).toLocaleDateString()}
                            </strong>
                          </span>
                        </div>

                        <div className="mt-2 text-xs bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-[#3E4B44] dark:text-[#C5D4C9]">
                          <span className="font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">
                            Justification / Circumstances:
                          </span>
                          {req.reason}
                        </div>

                        {req.decisionNotes && (
                          <div className="mt-1 text-xs text-[#54625A] dark:text-[#C5D4C9]">
                            <strong>Supervisor Notes:</strong> {req.decisionNotes} (Decided by{' '}
                            {req.decisionBy?.name || 'Authority'})
                          </div>
                        )}
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setModalError(null);
                              setDecisionNotes('');
                              setReviewModalRequest(req);
                            }}
                          >
                            Review Extension
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DEPARTMENT ACCOUNTABILITY SCORECARD                     */}
      {/* ============================================================== */}
      {!loading && activeTab === 'SCORECARD' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          {scorecardSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-blue-500/30 bg-[#E8F1F8]/40 dark:bg-blue-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs font-semibold text-[#1B5E8A] dark:text-[#78B4DD] uppercase tracking-wide">
                    SLA Compliance Rate
                  </div>
                  <div className="text-3xl font-bold text-[#1B5E8A] dark:text-[#78B4DD] mt-1">
                    {scorecardSummary.complianceRate}%
                  </div>
                  <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">
                    {scorecardSummary.resolvedOnTime} of {scorecardSummary.totalResolved} resolved on target
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-[#FBEBE8]/40 dark:bg-red-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs font-semibold text-[#9C3B2D] dark:text-[#F39182] uppercase tracking-wide">
                    Active Overdue Cases
                  </div>
                  <div className="text-3xl font-bold text-[#9C3B2D] dark:text-[#F39182] mt-1">
                    {scorecardSummary.activeOverdue}
                  </div>
                  <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">Exceeding response or resolution SLA</div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/30 bg-[#FEF6E9]/40 dark:bg-amber-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs font-semibold text-[#854F0B] dark:text-[#F3B768] uppercase tracking-wide">
                    Approaching Deadline
                  </div>
                  <div className="text-3xl font-bold text-[#854F0B] dark:text-[#F3B768] mt-1">
                    {scorecardSummary.approaching}
                  </div>
                  <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">Within policy warning threshold</div>
                </CardContent>
              </Card>

              <Card className="border-purple-500/30 bg-[#F4ECFA]/40 dark:bg-purple-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs font-semibold text-[#6A3D9A] dark:text-[#C59BEE] uppercase tracking-wide">
                    Active Escalations
                  </div>
                  <div className="text-3xl font-bold text-[#6A3D9A] dark:text-[#C59BEE] mt-1">
                    {scorecardSummary.activeEscalations}
                  </div>
                  <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">Under supervisory investigation</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Department breakdown table */}
          <Card className="border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 overflow-hidden">
            <CardHeader className="border-b border-[#DED8CB] dark:border-[#283931]">
              <CardTitle className="text-lg text-[#202522] dark:text-[#F5F2EA]">Department SLA Performance Scorecard</CardTitle>
              <CardDescription>
                Auditable metrics on resolution compliance and active overdue workload by municipal department.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#3E4B44] dark:text-[#C5D4C9]">
                <thead className="bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 text-xs uppercase text-[#54625A] dark:text-[#C5D4C9] border-b border-[#DED8CB] dark:border-[#283931]">
                  <tr>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Total Assigned</th>
                    <th className="py-3 px-4 text-center">Resolved On Target</th>
                    <th className="py-3 px-4 text-center">Resolved Late</th>
                    <th className="py-3 px-4 text-center">Compliance %</th>
                    <th className="py-3 px-4 text-center">Active Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED8CB] dark:divide-[#283931]">
                  {departmentScorecards.map((dept) => (
                    <tr key={dept.id} className="hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                        <BuildingIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        {dept.name} ({dept.code})
                      </td>
                      <td className="py-3.5 px-4 text-center">{dept.totalAssigned}</td>
                      <td className="py-3.5 px-4 text-center text-emerald-400 font-semibold">
                        {dept.resolvedOnTime}
                      </td>
                      <td className="py-3.5 px-4 text-center text-amber-400">{dept.resolvedLate}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            dept.complianceRate >= 80
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                              : dept.complianceRate >= 50
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-700/50'
                                : 'bg-red-950/60 text-red-300 border border-red-700/50'
                          }`}
                        >
                          {dept.complianceRate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {dept.activeOverdue > 0 ? (
                          <span className="font-bold text-red-400">{dept.activeOverdue}</span>
                        ) : (
                          <span className="text-[#C5D4C9] dark:text-[#54625A]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ACKNOWLEDGE ESCALATION                                  */}
      {/* ============================================================== */}
      {ackModalEscalation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-[#854F0B] dark:text-[#F3B768]" />
                Acknowledge Escalation
              </h3>
              <button
                onClick={() => setAckModalEscalation(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && <Alert variant="error">{modalError}</Alert>}

            <div className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] space-y-1">
              <p>
                <strong>Complaint:</strong> {ackModalEscalation.complaint?.title}
              </p>
              <p>
                <strong>Level:</strong> {ackModalEscalation.escalationLevel.replace(/_/g, ' ')}
              </p>
            </div>

            <FormField id="ack-notes" label="Supervisor Acknowledgment Notes (Optional)">
              <TextArea
                id="ack-notes"
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                placeholder="E.g., Reviewing root cause with assigned official to deploy heavy machinery."
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAckModalEscalation(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAcknowledge}
                isLoading={actionLoading}
              >
                Confirm Acknowledgment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RECORD ACTION PLAN                                      */}
      {/* ============================================================== */}
      {planModalEscalation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                <FileTextIcon className="w-5 h-5 text-[#1B5E8A] dark:text-[#78B4DD]" />
                Record Corrective Action Plan
              </h3>
              <button
                onClick={() => setPlanModalEscalation(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && <Alert variant="error">{modalError}</Alert>}

            <FormField id="plan-text" label="Action Plan & Recovery Strategy" required>
              <TextArea
                id="plan-text"
                value={actionPlanText}
                onChange={(e) => setActionPlanText(e.target.value)}
                placeholder="Detail corrective actions, contractor reassignments, or resource allocations..."
                rows={4}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setPlanModalEscalation(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRecordActionPlan}
                isLoading={actionLoading}
              >
                Save Action Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RESOLVE ESCALATION                                      */}
      {/* ============================================================== */}
      {resolveModalEscalation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-[#185541] dark:text-[#78C7AE]" />
                Resolve Supervisory Escalation
              </h3>
              <button
                onClick={() => setResolveModalEscalation(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && <Alert variant="error">{modalError}</Alert>}

            <div className="text-xs text-amber-300 bg-amber-950/40 p-3 rounded-lg border border-amber-800/60">
              <strong>Core Rule:</strong> Resolving an escalation closes the supervisory intervention
              queue. It does <em>not</em> mark the underlying complaint resolved, which remains governed by
              actual on-the-ground inspection and resolution verification.
            </div>

            <FormField id="resolve-reason" label="Mandatory Escalation Resolution Reason" required>
              <TextArea
                id="resolve-reason"
                value={resolutionReasonText}
                onChange={(e) => setResolutionReasonText(e.target.value)}
                placeholder="Explain how root cause was unblocked or why normal case workflow has resumed..."
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setResolveModalEscalation(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleResolveEscalation}
                isLoading={actionLoading}
              >
                Confirm Escalation Closure
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE SLA POLICY (Admin)                               */}
      {/* ============================================================== */}
      {showCreatePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-[#1B5E8A] dark:text-[#78B4DD]" />
                Configure Service-Level Commitment Policy
              </h3>
              <button
                onClick={() => setShowCreatePolicyModal(false)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && <Alert variant="error">{modalError}</Alert>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField id="pol-name" label="Policy Name" required>
                  <TextInput
                    id="pol-name"
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    placeholder="E.g., Emergency Hazardous Road Repair"
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField id="pol-desc" label="Description">
                  <TextInput
                    id="pol-desc"
                    value={newPolicyDesc}
                    onChange={(e) => setNewPolicyDesc(e.target.value)}
                    placeholder="Scope, statutory reference, and citizen commitment details"
                  />
                </FormField>
              </div>

              <div>
                <FormField id="pol-category" label="Category Scope (Optional)">
                  <Select
                    value={newPolicyCategory}
                    onChange={(e) => setNewPolicyCategory(e.target.value)}
                  >
                    <option value="">Any Category (General)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div>
                <FormField id="pol-priority" label="Priority Scope (Optional)">
                  <Select
                    value={newPolicyPriority}
                    onChange={(e) => setNewPolicyPriority(e.target.value)}
                  >
                    <option value="">Any Priority</option>
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Priority</option>
                  </Select>
                </FormField>
              </div>

              <div>
                <FormField id="pol-resp" label="Response Target (Hours)" required>
                  <TextInput
                    id="pol-resp"
                    type="number"
                    min="1"
                    value={newPolicyResponseHours}
                    onChange={(e) => setNewPolicyResponseHours(e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField id="pol-res" label="Resolution Target (Hours)" required>
                  <TextInput
                    id="pol-res"
                    type="number"
                    min="1"
                    value={newPolicyResolutionHours}
                    onChange={(e) => setNewPolicyResolutionHours(e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField id="pol-warn" label="Warning Threshold (Hours Before)" required>
                  <TextInput
                    id="pol-warn"
                    type="number"
                    min="1"
                    value={newPolicyWarningHours}
                    onChange={(e) => setNewPolicyWarningHours(e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField id="pol-esc" label="Escalation Threshold (Hours After)" required>
                  <TextInput
                    id="pol-esc"
                    type="number"
                    min="1"
                    value={newPolicyEscalationHours}
                    onChange={(e) => setNewPolicyEscalationHours(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pol-default"
                  checked={newPolicyIsDefault}
                  onChange={(e) => setNewPolicyIsDefault(e.target.checked)}
                  className="rounded border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB] dark:bg-[#1D2A25] text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="pol-default" className="text-sm font-medium text-[#3E4B44] dark:text-[#C5D4C9]">
                  Set as platform-wide fallback default policy
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
              <Button
                variant="outline"
                onClick={() => setShowCreatePolicyModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreatePolicy}
                isLoading={actionLoading}
              >
                Create Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: REVIEW EXTENSION REQUEST                                */}
      {/* ============================================================== */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-[#1B5E8A] dark:text-[#78B4DD]" />
                Review SLA Extension Request
              </h3>
              <button
                onClick={() => setReviewModalRequest(null)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && <Alert variant="error">{modalError}</Alert>}

            {/* Separation of Duties Rule Check */}
            {reviewModalRequest.requestedByOfficialId === user?.id && !isAdmin && (
              <div className="text-xs text-amber-300 bg-amber-950/50 p-3 rounded-lg border border-amber-800/80">
                <strong>Separation of Duties Notice:</strong> You submitted this extension request.
                Department accountability rules prohibit officials from approving their own deadline
                extensions. A supervisor or administrator must make this decision.
              </div>
            )}

            <div className="text-xs space-y-1.5 text-[#3E4B44] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
              <div>
                <strong>Complaint:</strong> {reviewModalRequest.complaint?.title}
              </div>
              <div>
                <strong>Current Deadline:</strong>{' '}
                {new Date(reviewModalRequest.previousResolutionDeadline).toLocaleString()}
              </div>
              <div>
                <strong>Requested Deadline:</strong>{' '}
                <span className="text-blue-400 font-semibold">
                  {new Date(reviewModalRequest.requestedResolutionDeadline).toLocaleString()}
                </span>
              </div>
              <div className="pt-1">
                <strong>Justification:</strong> {reviewModalRequest.reason}
              </div>
            </div>

            <FormField id="ext-notes" label="Decision Justification Notes">
              <TextArea
                id="ext-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Reason for granting or rejecting this deadline extension (mandatory for rejections)..."
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setReviewModalRequest(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDecideExtension('REJECTED')}
                isLoading={actionLoading}
                disabled={reviewModalRequest.requestedByOfficialId === user?.id && !isAdmin}
              >
                Reject Request
              </Button>
              <Button
                variant="primary"
                onClick={() => handleDecideExtension('APPROVED')}
                isLoading={actionLoading}
                disabled={reviewModalRequest.requestedByOfficialId === user?.id && !isAdmin}
              >
                Approve Extension
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
