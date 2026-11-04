import { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';

export type WorkspaceTab =
  | 'overview'
  | 'bids'
  | 'work_orders'
  | 'work_start'
  | 'milestones'
  | 'payments'
  | 'defects';

export function ContractorWorkspacePage() {
  const { currentPath, navigate } = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();

  // Extract initial active tab from URL query params (e.g. ?tab=bids)
  const getTabFromUrl = (): WorkspaceTab => {
    const searchString = currentPath.includes('?')
      ? currentPath.split('?')[1]
      : typeof window !== 'undefined'
      ? window.location.search.replace(/^\?/, '')
      : '';
    const tab = new URLSearchParams(searchString).get('tab');
    if (tab && ['overview', 'bids', 'work_orders', 'work_start', 'milestones', 'payments', 'defects'].includes(tab)) {
      return tab as WorkspaceTab;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(getTabFromUrl());
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Sync tab state when URL changes
  useEffect(() => {
    const tab = getTabFromUrl();
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [currentPath]);

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    navigate(`/contractor?tab=${tab}`);
  };

  // Modals state
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any | null>(null);
  const [isWorkStartModalOpen, setIsWorkStartModalOpen] = useState(false);
  const [workStartDate, setWorkStartDate] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressWorkPerformed, setProgressWorkPerformed] = useState('');
  const [progressQuantity, setProgressQuantity] = useState('');
  const [progressUnit, setProgressUnit] = useState('meters');
  const [progressMaterials, setProgressMaterials] = useState('');

  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneCompletionDate, setMilestoneCompletionDate] = useState('');
  const [milestoneClaimPercent, setMilestoneClaimPercent] = useState('100');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  const [selectedDefect, setSelectedDefect] = useState<any | null>(null);
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [rectificationNotes, setRectificationNotes] = useState('');

  const fetchAllData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [dashRes, bidsRes, woRes, defRes] = await Promise.all([
        fetch('/api/contractor/dashboard', { headers: { Accept: 'application/json' }, credentials: 'include' }),
        fetch('/api/contractor/bids', { headers: { Accept: 'application/json' }, credentials: 'include' }),
        fetch('/api/contractor/work-orders', { headers: { Accept: 'application/json' }, credentials: 'include' }),
        fetch('/api/contractor/defects', { headers: { Accept: 'application/json' }, credentials: 'include' }),
      ]);

      const [dashJson, bidsJson, woJson, defJson] = await Promise.all([
        dashRes.json(),
        bidsRes.json(),
        woRes.json(),
        defRes.json(),
      ]);

      if (dashRes.ok && dashJson.success) setDashboardData(dashJson.data);
      if (bidsRes.ok && bidsJson.success) setBids(bidsJson.data?.bids || []);
      if (woRes.ok && woJson.success) setWorkOrders(woJson.data?.workOrders || []);
      if (defRes.ok && defJson.success) setDefects(defJson.data?.defects || []);
    } catch {
      setErrorMessage('Failed to load contractor data. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role === 'CONTRACTOR') {
      fetchAllData();
    }
  }, [authLoading, isAuthenticated, user]);

  if (authLoading) {
    return (
      <Container size="lg" className="py-16 text-center">
        <LoadingIndicator label="Checking contractor authentication..." />
      </Container>
    );
  }

  if (!isAuthenticated || user?.role !== 'CONTRACTOR') {
    return (
      <Container size="md" className="py-16">
        <Card className="p-8 text-center border-[#E5E7EB] dark:border-[#374151] space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#0B3D2E]/10 text-[#0B3D2E] dark:bg-[#34D399]/15 dark:text-[#34D399] flex items-center justify-center font-bold text-xl">
            🔒
          </div>
          <h2 className="text-xl font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">Contractor Access Required</h2>
          <p className="text-[#6B7280] dark:text-[#D1D5DB] text-sm max-w-md mx-auto">
            This workspace is reserved for authorized enterprise contractors accredited with Civora. Please sign in with your contractor credentials.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Sign In with Contractor Account
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  const formatCurrency = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return '₹0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Withdraw bid
  const handleWithdrawBid = async (bidId: string) => {
    if (!confirm('Are you sure you want to withdraw this bid? This action cannot be reversed.')) return;
    try {
      const res = await fetch(`/api/contractor/bids/${bidId}/withdraw`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Bid withdrawn successfully.');
        fetchAllData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to withdraw bid.');
      }
    } catch {
      setErrorMessage('Network error while withdrawing bid.');
    }
  };

  // Submit Work Start
  const handleSubmitWorkStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/contractor/work-orders/${selectedWorkOrder.id}/work-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          actualStartDate: workStartDate ? new Date(workStartDate).toISOString() : new Date().toISOString(),
          siteAddress: siteAddress.trim(),
          siteNotes: siteNotes.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Work-start declaration submitted for engineering verification.');
        setIsWorkStartModalOpen(false);
        fetchAllData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to submit work start declaration.');
      }
    } catch {
      setErrorMessage('Network error submitting work-start declaration.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Progress Log
  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/contractor/work-orders/${selectedWorkOrder.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workPerformed: progressWorkPerformed.trim(),
          quantityCompleted: parseFloat(progressQuantity) || 0,
          unitOfMeasurement: progressUnit,
          materialsUsed: progressMaterials.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Physical progress log recorded successfully.');
        setIsProgressModalOpen(false);
        fetchAllData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to record progress log.');
      }
    } catch {
      setErrorMessage('Network error submitting progress log.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Claim Milestone
  const handleClaimMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder || !selectedMilestone) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(
        `/api/contractor/work-orders/${selectedWorkOrder.id}/milestones/${selectedMilestone.id}/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            actualCompletionDate: milestoneCompletionDate ? new Date(milestoneCompletionDate).toISOString() : new Date().toISOString(),
            completionPercentage: parseFloat(milestoneClaimPercent) || 100,
            submissionNotes: milestoneNotes.trim(),
          }),
        }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Milestone completion claimed. Awaiting official verification.');
        setIsMilestoneModalOpen(false);
        fetchAllData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to claim milestone.');
      }
    } catch {
      setErrorMessage('Network error submitting milestone claim.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Rectify Defect
  const handleRectifyDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDefect) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/contractor/defects/${selectedDefect.id}/rectify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rectificationNotes: rectificationNotes.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Defect rectification recorded. Ready for official re-inspection.');
        setIsDefectModalOpen(false);
        fetchAllData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to submit defect rectification.');
      }
    } catch {
      setErrorMessage('Network error submitting rectification.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getBidStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge variant="success">Awarded / Accepted</Badge>;
      case 'SUBMITTED':
        return <Badge variant="info">Submitted</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="warning">Under Review</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Not Selected</Badge>;
      case 'WITHDRAWN':
        return <Badge variant="neutral">Withdrawn</Badge>;
      default:
        return <Badge variant="neutral">{status ? status.replace(/_/g, ' ') : 'Pending'}</Badge>;
    }
  };

  const getMilestoneStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return <Badge variant="success">Verified & Approved</Badge>;
      case 'SUBMITTED':
      case 'SUBMITTED_FOR_REVIEW':
        return <Badge variant="warning">Under Engineer Review</Badge>;
      case 'REJECTED':
      case 'REJECTED_REVISION_REQUIRED':
        return <Badge variant="danger">Correction Required</Badge>;
      default:
        return <Badge variant="neutral">Pending Claim</Badge>;
    }
  };

  const profile = dashboardData?.contractor;
  const metrics = dashboardData?.metrics;

  const openDefectsCount = defects.filter(
    (d) => d.status === 'REPORTED' || d.status === 'INSPECTED' || d.status === 'OPEN'
  ).length;

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Workspace Header */}
      <PageHeading
        title={profile?.name || user?.name || 'Contractor Portal'}
        description={`Registration: ${profile?.licenseNumber || profile?.registrationNumber || 'ACCREDITED'} | License: ${profile?.licenseClass || 'CLASS_A'} | Region: ${profile?.operatingRegion || 'National'}`}
        className="mb-0"
        eyebrow={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E5ECE8] text-[#0B3D2E] border border-[#0B3D2E]/15 dark:bg-[#34D399]/15 dark:text-[#34D399] dark:border-[#34D399]/30 uppercase font-mono">
              {t('roles.contractor')} {t('nav.contractorDashboard')}
            </span>
            {profile?.isVerified && <Badge variant="success">Verified Enterprise</Badge>}
          </div>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/tenders')}>
            {t('nav.findTenders')} →
          </Button>
        }
      />

      {/* Global Alerts */}
      {actionSuccess && (
        <Alert variant="success" title="Action Completed" className="mb-4">
          {actionSuccess}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="error" title="Data Notice" className="mb-4">
          <div className="flex items-center justify-between">
            <span>{errorMessage}</span>
            <Button size="sm" variant="outline" onClick={fetchAllData}>
              Retry Fetch
            </Button>
          </div>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E5E7EB] dark:border-[#374151] overflow-x-auto gap-1.5 pb-2 text-xs sm:text-sm font-medium font-sans">
        {(
          [
            { id: 'overview', label: 'Overview & Metrics' },
            { id: 'bids', label: `My Bids (${bids.length})` },
            { id: 'work_orders', label: `Awarded Work Orders (${workOrders.length})` },
            { id: 'work_start', label: 'Work-Start Declarations' },
            { id: 'milestones', label: 'Milestones & Progress' },
            { id: 'payments', label: 'Payment Ledger' },
            { id: 'defects', label: `Warranty & Defects (${openDefectsCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-active={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`civora-liquid-tab px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === tab.id
                ? 'font-semibold'
                : 'text-[#6B7280] dark:text-[#D1D5DB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingIndicator label="Loading contractor workspace..." />
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151]">
                  <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Available Tenders</span>
                  <p className="text-2xl font-bold font-mono text-[#0B3D2E] dark:text-[#34D399] mt-1">{metrics?.openTendersCount ?? metrics?.openTenders ?? 0}</p>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] block mt-1">Open public procurement</span>
                </Card>
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151]">
                  <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Submitted Bids</span>
                  <p className="text-2xl font-bold font-mono text-[#111827] dark:text-[#F9FAFB] mt-1">{metrics?.activeBidsCount ?? metrics?.activeBids ?? bids.length}</p>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] block mt-1">Competitive proposals</span>
                </Card>
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151]">
                  <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Awarded Contracts</span>
                  <p className="text-2xl font-bold font-mono text-[#1E6B52] dark:text-[#34D399] mt-1">{metrics?.awardedContractsCount ?? metrics?.awardedContracts ?? workOrders.length}</p>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] block mt-1">Active execution orders</span>
                </Card>
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151]">
                  <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Pending Milestones</span>
                  <p className="text-2xl font-bold font-mono text-[#9C6D19] dark:text-[#E8C07D] mt-1">{metrics?.pendingMilestonesCount ?? metrics?.pendingMilestones ?? 0}</p>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] block mt-1">Awaiting verification</span>
                </Card>
              </div>

              {/* Secondary Metric Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Total Disbursements Released</span>
                    <p className="text-xl font-bold font-mono text-[#1E6B52] dark:text-[#34D399] mt-0.5">
                      {formatCurrency(metrics?.totalPaidAmount ?? 0)}
                    </p>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB]">Traceable bank/treasury records</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTabChange('payments')}>
                    View Ledger →
                  </Button>
                </Card>
                <Card className="p-5 border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold">Warranty & Defect Items</span>
                    <p className={`text-xl font-bold font-mono mt-0.5 ${openDefectsCount > 0 ? 'text-[#B94B3B]' : 'text-[#111827] dark:text-[#F9FAFB]'}`}>
                      {openDefectsCount} Open Action{openDefectsCount === 1 ? '' : 's'}
                    </p>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB]">Post-completion liability period</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTabChange('defects')}>
                    Inspect Defects →
                  </Button>
                </Card>
              </div>

              {/* Recent Bids Section */}
              <Card className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                  <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">Recent Submitted Bids</h3>
                  <Button variant="ghost" size="sm" onClick={() => handleTabChange('bids')}>
                    View All Bids ({bids.length}) →
                  </Button>
                </div>
                {bids.length === 0 ? (
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] py-4 text-center">
                    You have not submitted proposals for any civic tenders yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bids.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="p-3.5 bg-[#F9FAFB] dark:bg-[#182230] rounded-xl border border-[#E5E7EB] dark:border-[#374151] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[#0B3D2E] dark:text-[#34D399] font-semibold">{b.tender?.tenderNumber || 'TND'}</span>
                            {getBidStatusBadge(b.status)}
                          </div>
                          <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{b.tender?.title || 'Infrastructure Work'}</span>
                        </div>
                        <div className="sm:text-right">
                          <strong className="text-[#1E6B52] dark:text-[#34D399] font-mono text-sm block">{formatCurrency(b.bidAmount)}</strong>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                            {new Date(b.createdAt || b.submittedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Enterprise Profile Card */}
              <Card className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                  Accredited Enterprise Profile
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-1">Company Legal Name</span>
                    <strong className="text-[#111827] dark:text-[#F9FAFB] text-sm">{profile?.name || user?.name}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-1">License & Registration</span>
                    <strong className="text-[#111827] dark:text-[#F9FAFB] text-sm font-mono">
                      {profile?.licenseNumber || profile?.registrationNumber || 'ACCREDITED'} ({profile?.licenseClass || 'CLASS_A'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-1">Approved Categories</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile?.workCategories?.map((cat: string) => (
                        <span key={cat} className="px-2 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#273548] text-[#111827] dark:text-[#F9FAFB] border border-[#E5E7EB] dark:border-[#374151] font-mono text-[10px]">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-1">Operating Region</span>
                    <strong className="text-[#111827] dark:text-[#F9FAFB] text-sm">{profile?.operatingRegion || 'National'}</strong>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: MY BIDS */}
          {activeTab === 'bids' && (
            <div className="space-y-4">
              {bids.length === 0 ? (
                <EmptyState
                  title="No Bids Submitted"
                  description="You have not submitted proposals for any civic tenders yet. Browse the public procurement portal to find eligible infrastructure works."
                  action={
                    <Button variant="primary" size="sm" onClick={() => navigate('/tenders')}>
                      Browse Open Tenders
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {bids.map((bid) => (
                    <Card key={bid.id} className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#F3F4F6] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151]">
                              {bid.tender?.tenderNumber || 'TND'}
                            </span>
                            {getBidStatusBadge(bid.status)}
                          </div>
                          <h4 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB] mt-1">
                            {bid.tender?.title || 'Tender Proposal'}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold block">Proposed Amount</span>
                          <strong className="text-lg font-bold font-mono text-[#1E6B52] dark:text-[#34D399]">
                            {formatCurrency(bid.bidAmount)}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[#F9FAFB] dark:bg-[#182230] p-3.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                        <div>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Duration</span>
                          <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">{bid.proposedDurationDays} Days</span>
                        </div>
                        <div>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Submitted On</span>
                          <span className="text-[#111827] dark:text-[#F9FAFB]">
                            {new Date(bid.createdAt || bid.submittedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Tender Deadline</span>
                          <span className="text-[#111827] dark:text-[#F9FAFB]">
                            {bid.tender?.submissionDeadline
                              ? new Date(bid.tender.submissionDeadline).toLocaleDateString('en-IN')
                              : 'Closed'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Evaluation Notes</span>
                          <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                            {bid.officialEvaluationNotes || bid.evaluationNotes || 'Pending formal scoring'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/tenders/${bid.tenderId}`)}
                        >
                          View Tender Scope →
                        </Button>
                        {bid.status === 'SUBMITTED' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleWithdrawBid(bid.id)}
                          >
                            Withdraw Bid
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AWARDED WORK ORDERS */}
          {activeTab === 'work_orders' && (
            <div className="space-y-4">
              {workOrders.length === 0 ? (
                <EmptyState
                  title="No Active Work Orders"
                  description="When an official municipal procurement committee awards a tender to your enterprise, the formal contract and execution order will appear here."
                  action={
                    <Button variant="primary" size="sm" onClick={() => navigate('/tenders')}>
                      Browse Available Tenders
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-6">
                  {workOrders.map((wo) => {
                    const rawStatus = wo.executionStatus || wo.status || 'AWARDED';
                    const orderNo = wo.workOrderNumber || wo.orderNumber || 'WO-PENDING';
                    const contractVal = wo.contractAmount || wo.contractValue || 0;
                    const scheduledStart = wo.startDate || wo.scheduledStartDate;
                    const scheduledEnd = wo.expectedCompletionDate || wo.scheduledEndDate;
                    const hasWorkStart = wo.workStartDeclarations && wo.workStartDeclarations.length > 0;

                    return (
                      <Card key={wo.id} className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#E5E7EB] dark:border-[#374151] pb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#F3F4F6] dark:bg-[#273548] px-2.5 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151]">
                                WO #{orderNo}
                              </span>
                              <Badge variant={rawStatus === 'IN_PROGRESS' ? 'success' : 'neutral'}>
                                {rawStatus.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <h4 className="text-lg font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">
                              {wo.civicWork?.title || wo.tender?.title || 'Civic Infrastructure Project'}
                            </h4>
                            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                              Location: {wo.civicWork?.location || wo.tender?.location || 'Municipal jurisdiction'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold block">Sanctioned Contract Value</span>
                            <strong className="text-xl font-bold font-mono text-[#1E6B52] dark:text-[#34D399]">
                              {formatCurrency(contractVal)}
                            </strong>
                          </div>
                        </div>

                        {/* Work Order Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#F9FAFB] dark:bg-[#182230] p-4 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                          <div>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Scheduled Start</span>
                            <strong className="text-[#111827] dark:text-[#F9FAFB]">
                              {scheduledStart ? new Date(scheduledStart).toLocaleDateString('en-IN') : 'Immediate'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Scheduled Completion</span>
                            <strong className="text-[#111827] dark:text-[#F9FAFB]">
                              {scheduledEnd ? new Date(scheduledEnd).toLocaleDateString('en-IN') : 'Per Contract'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Deliverables</span>
                            <strong className="text-[#111827] dark:text-[#F9FAFB]">
                              {wo.milestones?.length || 0} Milestones
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Mobilization Verification</span>
                            <strong className="text-[#1E6B52] dark:text-[#34D399]">
                              {wo.workStartDeclarations?.[0]?.status || 'NOT_DECLARED'}
                            </strong>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {!hasWorkStart && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setIsWorkStartModalOpen(true);
                              }}
                            >
                              Submit Work-Start Declaration
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkOrder(wo);
                              setIsProgressModalOpen(true);
                            }}
                          >
                            Log Daily Execution Progress
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTabChange('milestones')}
                          >
                            View Milestones & Claims →
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WORK-START DECLARATIONS */}
          {activeTab === 'work_start' && (
            <div className="space-y-4">
              <div className="border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">
                  Work-Start Declarations & Engineering Verifications
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                  Formal site mobilization notices submitted prior to commencement of physical construction.
                </p>
              </div>

              {workOrders.every((wo) => !wo.workStartDeclarations?.length) ? (
                <EmptyState
                  title="No Work-Start Declarations Submitted"
                  description="Select an active awarded work order from the Work Orders tab to file your site mobilization notice."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => handleTabChange('work_orders')}>
                      View Work Orders
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {workOrders.flatMap((wo) =>
                    (wo.workStartDeclarations || []).map((ws: any) => {
                      const orderNo = wo.workOrderNumber || wo.orderNumber || 'WO';
                      const sDate = ws.declaredStartDate || ws.actualStartDate || ws.createdAt;
                      const isApproved = ws.status === 'VERIFIED' || ws.status === 'APPROVED';

                      return (
                        <Card key={ws.id} className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-3">
                          <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                            <div>
                              <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399]">
                                WO #{orderNo}
                              </span>
                              <h4 className="text-sm font-bold font-heading text-[#111827] dark:text-[#F9FAFB] mt-0.5">
                                {wo.civicWork?.title || wo.tender?.title || 'Contract Site'}
                              </h4>
                            </div>
                            <Badge variant={isApproved ? 'success' : ws.status === 'REJECTED' ? 'danger' : 'warning'}>
                              {ws.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Mobilization Date</span>
                              <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">
                                {new Date(sDate).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Site Address / Coordinate</span>
                              <span className="text-[#111827] dark:text-[#F9FAFB]">{ws.siteAddress || 'Registered Project Boundary'}</span>
                            </div>
                            <div>
                              <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Declaration Filed</span>
                              <span className="text-[#111827] dark:text-[#F9FAFB]">
                                {new Date(ws.createdAt).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Engineering Review</span>
                              <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                                {ws.reviewNotes || ws.rejectionReason || (isApproved ? 'Verified by municipal engineer' : 'Pending site inspection')}
                              </span>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MILESTONES & PROGRESS */}
          {activeTab === 'milestones' && (
            <div className="space-y-6">
              {workOrders.length === 0 ? (
                <EmptyState
                  title="No Milestones Available"
                  description="Milestones are automatically staged when public tenders are officially awarded to your enterprise."
                  action={
                    <Button variant="primary" size="sm" onClick={() => navigate('/tenders')}>
                      Browse Open Tenders
                    </Button>
                  }
                />
              ) : (
                workOrders.map((wo) => {
                  const orderNo = wo.workOrderNumber || wo.orderNumber || 'WO';
                  return (
                    <Card key={wo.id} className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                      <div className="border-b border-[#E5E7EB] dark:border-[#374151] pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div>
                          <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399]">WO #{orderNo}</span>
                          <h4 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">
                            {wo.civicWork?.title || wo.tender?.title || 'Contract Deliverables'}
                          </h4>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedWorkOrder(wo);
                            setIsProgressModalOpen(true);
                          }}
                        >
                          + Log Physical Progress
                        </Button>
                      </div>

                      {/* Milestones List */}
                      <div className="space-y-3">
                        {(wo.milestones || []).map((m: any) => {
                          const mNum = m.milestoneNumber ?? m.milestoneIndex ?? 1;
                          const mTitle = m.title || m.name || `Milestone ${mNum}`;
                          const isApproved = m.status === 'APPROVED' || m.status === 'COMPLETED';

                          return (
                            <div
                              key={m.id}
                              className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#273548] text-[#111827] dark:text-[#F9FAFB] border border-[#E5E7EB] dark:border-[#374151]">
                                    Stage {mNum}
                                  </span>
                                  {getMilestoneStatusBadge(m.status)}
                                </div>
                                <h5 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{mTitle}</h5>
                                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">{m.description}</p>
                                {m.reviewerRemarks && (
                                  <p className="text-xs text-[#9C6D19] dark:text-[#E8C07D] mt-1">
                                    Engineer remark: {m.reviewerRemarks}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right text-xs">
                                  <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Target Amount</span>
                                  <strong className="text-[#1E6B52] dark:text-[#34D399] text-sm font-mono">
                                    {formatCurrency(m.targetAmount)}
                                  </strong>
                                </div>

                                {!isApproved && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedWorkOrder(wo);
                                      setSelectedMilestone(m);
                                      setIsMilestoneModalOpen(true);
                                    }}
                                  >
                                    {m.status === 'REJECTED' || m.status === 'REJECTED_REVISION_REQUIRED'
                                      ? 'Resubmit Claim'
                                      : 'Claim Milestone'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 6: PAYMENT LEDGER */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">
                  Audited Payment Ledger & Treasury Disbursements
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
                  Payments are officially recorded by authorized municipal finance authorities upon successful engineering milestone verification.
                </p>
              </div>

              {workOrders.flatMap((wo) => wo.financialTransactions || []).length === 0 ? (
                <EmptyState
                  title="No Payment Disbursements Recorded"
                  description="When milestones are approved and authorized payments are executed by the municipal treasury, traceable transaction receipts will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {workOrders.flatMap((wo) =>
                    (wo.financialTransactions || []).map((tx: any) => {
                      const txRef = tx.paymentReference || tx.transactionId || tx.id;
                      const txDesc = tx.remarks || tx.description || 'Milestone Disbursement';
                      const txDate = tx.paymentDate || tx.createdAt;
                      const txStatus = tx.paymentStatus || tx.status || 'PAID';

                      return (
                        <Card key={tx.id} className="p-4 border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono text-[11px] font-semibold text-[#0B3D2E] dark:text-[#34D399]">
                              Ref #{txRef}
                            </span>
                            <h5 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] mt-0.5">
                              {txDesc}
                            </h5>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                              Date: {new Date(txDate).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono tracking-wider text-[#6B7280] dark:text-[#D1D5DB] uppercase font-semibold block">Disbursed Amount</span>
                            <strong className="text-base font-bold font-mono text-[#1E6B52] dark:text-[#34D399]">
                              {formatCurrency(tx.amount)}
                            </strong>
                            <Badge variant="success" className="mt-1">
                              {txStatus}
                            </Badge>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: DEFECTS & WARRANTY */}
          {activeTab === 'defects' && (
            <div className="space-y-4">
              <div className="border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                <h3 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB]">
                  Defect Liability & Warranty Rectification Queue
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
                  Items logged by municipal engineers during the contractual defect liability period requiring contractor rectification.
                </p>
              </div>

              {defects.length === 0 ? (
                <EmptyState
                  title="No Warranty Defects Logged"
                  description="There are currently no open warranty defects or quality non-conformances reported for your projects."
                />
              ) : (
                <div className="space-y-4">
                  {defects.map((defect) => {
                    const isClosed = defect.status === 'CLOSED';
                    const isRectified = defect.status === 'RECTIFIED' || defect.status === 'RECTIFIED_VERIFIED';
                    const workOrderNo = defect.workOrder?.workOrderNumber || defect.workOrder?.orderNumber || 'WO';

                    return (
                      <Card key={defect.id} className="p-6 border-[#E5E7EB] dark:border-[#374151] space-y-4">
                        <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
                          <div>
                            <span className="font-mono text-xs font-semibold text-[#B94B3B]">
                              Tracking #{defect.trackingId || defect.id.slice(0, 8)}
                            </span>
                            <h4 className="text-base font-bold font-heading text-[#111827] dark:text-[#F9FAFB] mt-0.5">
                              {defect.title}
                            </h4>
                            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                              Work Order: #{workOrderNo} | Severity: {defect.severity || 'STANDARD'}
                            </span>
                          </div>
                          <Badge variant={isClosed ? 'success' : isRectified ? 'warning' : 'danger'}>
                            {defect.status}
                          </Badge>
                        </div>

                        <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                          {defect.description}
                        </p>

                        {defect.rectificationNotes && (
                          <div className="p-3.5 bg-[#F9FAFB] dark:bg-[#182230] rounded-xl border border-[#E5E7EB] dark:border-[#374151] text-xs">
                            <strong className="text-[#111827] dark:text-[#F9FAFB] block mb-1">Your Rectification Submission:</strong>
                            <span className="text-[#6B7280] dark:text-[#D1D5DB]">{defect.rectificationNotes}</span>
                          </div>
                        )}

                        {!isClosed && !isRectified && (
                          <div className="pt-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedDefect(defect);
                                setIsDefectModalOpen(true);
                              }}
                            >
                              Submit Rectification Evidence
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Submit Work-Start Declaration */}
      {isWorkStartModalOpen && selectedWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-lg w-full p-6 border-[#E5E7EB] dark:border-[#374151] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold font-heading text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Submit Work-Start Declaration
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              Work Order: #{selectedWorkOrder.workOrderNumber || selectedWorkOrder.orderNumber} &mdash; {selectedWorkOrder.civicWork?.title || selectedWorkOrder.tender?.title}
            </p>
            <form onSubmit={handleSubmitWorkStart} className="space-y-4">
              <FormField label="Actual Site Mobilization Date" required id="ws-date">
                <TextInput
                  id="ws-date"
                  type="date"
                  value={workStartDate}
                  onChange={(e) => setWorkStartDate(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Exact Site Location / Landmark Address" required id="ws-address">
                <TextInput
                  id="ws-address"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="e.g., Highway Pier 14-22, South Arterial Corridor"
                  required
                />
              </FormField>
              <FormField label="Mobilization & Equipment Deployment Notes" id="ws-notes">
                <TextArea
                  id="ws-notes"
                  rows={3}
                  value={siteNotes}
                  onChange={(e) => setSiteNotes(e.target.value)}
                  placeholder="Describe mobilized workforce, safety barricades, machinery deployed on site..."
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button type="button" variant="ghost" onClick={() => setIsWorkStartModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submittingAction}>
                  Submit Declaration
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Log Daily Progress */}
      {isProgressModalOpen && selectedWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-lg w-full p-6 border-[#E5E7EB] dark:border-[#374151] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold font-heading text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Log Daily Execution Progress
            </h3>
            <form onSubmit={handleSubmitProgress} className="space-y-4">
              <FormField label="Work Performed Description" required id="p-desc">
                <TextArea
                  id="p-desc"
                  rows={3}
                  value={progressWorkPerformed}
                  onChange={(e) => setProgressWorkPerformed(e.target.value)}
                  placeholder="Describe excavation, concreting, reinforcement, or paving tasks completed..."
                  required
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Quantity Completed" required id="p-qty">
                  <TextInput
                    id="p-qty"
                    type="number"
                    step="0.1"
                    value={progressQuantity}
                    onChange={(e) => setProgressQuantity(e.target.value)}
                    placeholder="e.g., 150"
                    required
                  />
                </FormField>
                <FormField label="Unit of Measurement" id="p-unit">
                  <Select
                    id="p-unit"
                    value={progressUnit}
                    onChange={(e) => setProgressUnit(e.target.value)}
                    options={[
                      { value: 'sq_meters', label: 'Sq. Meters' },
                      { value: 'meters', label: 'Meters' },
                      { value: 'cubic_meters', label: 'Cubic Meters' },
                      { value: 'metric_tonnes', label: 'Metric Tonnes' },
                      { value: 'units', label: 'Units / Items' },
                    ]}
                  />
                </FormField>
              </div>
              <FormField label="Materials & Consumables Log" id="p-mat">
                <TextInput
                  id="p-mat"
                  value={progressMaterials}
                  onChange={(e) => setProgressMaterials(e.target.value)}
                  placeholder="e.g., 50 bags Grade 53 cement, 2 truckloads aggregate..."
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button type="button" variant="ghost" onClick={() => setIsProgressModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submittingAction}>
                  Save Progress Log
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Claim Milestone */}
      {isMilestoneModalOpen && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-lg w-full p-6 border-[#E5E7EB] dark:border-[#374151] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold font-heading text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Claim Milestone: {selectedMilestone.title || selectedMilestone.name}
            </h3>
            <form onSubmit={handleClaimMilestone} className="space-y-4">
              <FormField label="Actual Completion Date" required id="m-date">
                <TextInput
                  id="m-date"
                  type="date"
                  value={milestoneCompletionDate}
                  onChange={(e) => setMilestoneCompletionDate(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Claimed Completion Percentage" required id="m-pct">
                <TextInput
                  id="m-pct"
                  type="number"
                  min="1"
                  max="100"
                  value={milestoneClaimPercent}
                  onChange={(e) => setMilestoneClaimPercent(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Submission Notes & Evidence Reference" required id="m-notes">
                <TextArea
                  id="m-notes"
                  rows={3}
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                  placeholder="Reference laboratory test reports, visual inspection logs, and physical measurements..."
                  required
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button type="button" variant="ghost" onClick={() => setIsMilestoneModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submittingAction}>
                  Submit Milestone Claim
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Rectify Defect */}
      {isDefectModalOpen && selectedDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-lg w-full p-6 border-[#E5E7EB] dark:border-[#374151] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold font-heading text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Rectify Defect: {selectedDefect.title}
            </h3>
            <form onSubmit={handleRectifyDefect} className="space-y-4">
              <FormField label="Rectification Actions Performed" required id="d-notes">
                <TextArea
                  id="d-notes"
                  rows={4}
                  value={rectificationNotes}
                  onChange={(e) => setRectificationNotes(e.target.value)}
                  placeholder="Detail the repairs completed, replacement materials used, and quality checks passed..."
                  required
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button type="button" variant="ghost" onClick={() => setIsDefectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submittingAction}>
                  Submit for Verification
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Container>
  );
}
