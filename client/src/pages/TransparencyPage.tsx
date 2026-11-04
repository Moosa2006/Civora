import { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { TextInput } from '../components/ui/TextInput';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { MetricCard } from '../components/ui/MetricCard';
import {
  TrendAreaChart,
  DonutChart,
  HorizontalBarChart,
  type DonutSlice,
  type BarListItem,
} from '../components/ui/Charts';
import {
  SearchIcon,
  CloseIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  BuildingIcon,
  RefreshCwIcon,
  MapPinIcon,
} from '../components/ui/icons';
import { useRouter } from '../router';
import { useTranslation } from '../context/useTranslation';
import { getStatusBadgeVariant } from '../utils/status';
import type {
  TransparencyMetricsData,
  TransparencyTrendsData,
  TransparencyDistributionData,
  DepartmentAccountabilityData,
  PublicComplaintItem,
  CivicProjectItem,
  CivicProjectDetail,
} from '../types/transparency';

type TransparencyTab = 'OVERVIEW' | 'COMPLAINTS' | 'DEPARTMENTS' | 'PROJECTS';

function getTabFromUrl(path: string): TransparencyTab {
  const searchString = path.includes('?')
    ? path.split('?')[1]
    : typeof window !== 'undefined'
    ? window.location.search.replace(/^\?/, '')
    : '';
  const tabParam = new URLSearchParams(searchString).get('tab')?.toUpperCase();
  if (tabParam === 'PROJECTS' || tabParam === 'CIVIC_WORKS') return 'PROJECTS';
  if (tabParam === 'COMPLAINTS' || tabParam === 'GRIEVANCES') return 'COMPLAINTS';
  if (tabParam === 'DEPARTMENTS' || tabParam === 'SCORECARDS') return 'DEPARTMENTS';
  return 'OVERVIEW';
}

export function TransparencyPage() {
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TransparencyTab>(() => getTabFromUrl(currentPath));

  // Sync tab state when currentPath changes (e.g. browser back/forward or external links)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(currentPath);
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [currentPath]);

  const handleTabChange = (nextTab: TransparencyTab) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    const targetUrl = nextTab === 'OVERVIEW' ? '/transparency' : `/transparency?tab=${nextTab.toLowerCase()}`;
    navigate(targetUrl);
  };

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Overview Data States
  const [metrics, setMetrics] = useState<TransparencyMetricsData | null>(null);
  const [trends, setTrends] = useState<TransparencyTrendsData | null>(null);
  const [trendsDays, setTrendsDays] = useState<number>(30);
  const [distribution, setDistribution] = useState<TransparencyDistributionData | null>(null);
  const [departments, setDepartments] = useState<DepartmentAccountabilityData | null>(null);

  // Department Search State
  const [departmentSearch, setDepartmentSearch] = useState('');

  // Public Complaints Explorer States
  const [complaints, setComplaints] = useState<PublicComplaintItem[]>([]);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintStatus, setComplaintStatus] = useState('ALL');
  const [complaintPage, setComplaintPage] = useState(1);
  const [complaintTotalPages, setComplaintTotalPages] = useState(1);
  const [complaintTotalCount, setComplaintTotalCount] = useState(0);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);

  // Civic Projects Explorer States
  const [projects, setProjects] = useState<CivicProjectItem[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatus, setProjectStatus] = useState('ALL');
  const [projectPage, setProjectPage] = useState(1);
  const [projectTotalPages, setProjectTotalPages] = useState(1);
  const [projectTotalCount, setProjectTotalCount] = useState(0);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Project Detail Modal
  const [selectedProject, setSelectedProject] = useState<CivicProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 1. Fetch Overview Data
  const fetchOverviewData = useCallback(async (days = 30) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [resMetrics, resTrends, resDist, resDepts] = await Promise.all([
        fetch('/api/transparency/metrics'),
        fetch(`/api/transparency/trends?days=${days}`),
        fetch('/api/transparency/status-distribution'),
        fetch('/api/transparency/departments'),
      ]);

      const [jsonMetrics, jsonTrends, jsonDist, jsonDepts] = await Promise.all([
        resMetrics.json(),
        resTrends.json(),
        resDist.json(),
        resDepts.json(),
      ]);

      if (!jsonMetrics.success || !jsonTrends.success || !jsonDist.success || !jsonDepts.success) {
        throw new Error('Failed to retrieve full transparency metrics dataset.');
      }

      setMetrics(jsonMetrics.data);
      setTrends(jsonTrends.data);
      setDistribution(jsonDist.data);
      setDepartments(jsonDepts.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load transparency dataset.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Public Complaints
  const fetchPublicComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    setComplaintsError(null);
    try {
      let url = `/api/transparency/complaints?page=${complaintPage}&limit=10`;
      if (complaintStatus !== 'ALL') {
        url += `&status=${encodeURIComponent(complaintStatus)}`;
      }
      if (complaintSearch.trim()) {
        url += `&search=${encodeURIComponent(complaintSearch.trim())}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setComplaints(json.data.complaints || []);
        if (json.data.pagination) {
          setComplaintTotalPages(json.data.pagination.totalPages || 1);
          setComplaintTotalCount(json.data.pagination.total || 0);
        }
      } else {
        setComplaintsError(json.error?.message || 'Failed to retrieve public grievances.');
      }
    } catch {
      setComplaintsError('Unable to connect to the transparency server. Please check your network.');
    } finally {
      setComplaintsLoading(false);
    }
  }, [complaintPage, complaintStatus, complaintSearch]);

  // 3. Fetch Civic Projects
  const fetchCivicProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      let url = `/api/projects?page=${projectPage}&limit=10`;
      if (projectStatus !== 'ALL') {
        url += `&status=${encodeURIComponent(projectStatus)}`;
      }
      if (projectSearch.trim()) {
        url += `&search=${encodeURIComponent(projectSearch.trim())}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setProjects(json.data.projects || []);
        if (json.data.pagination) {
          setProjectTotalPages(json.data.pagination.totalPages || 1);
          setProjectTotalCount(json.data.pagination.total || 0);
        }
      } else {
        setProjectsError(json.error?.message || 'Failed to retrieve civic works projects.');
      }
    } catch {
      setProjectsError('Unable to connect to the civic projects server. Please check your network.');
    } finally {
      setProjectsLoading(false);
    }
  }, [projectPage, projectStatus, projectSearch]);

  // 4. Fetch Project Detail
  const fetchProjectDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedProject({ id } as unknown as CivicProjectDetail);
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = await res.json();
      if (res.ok && json.success && json.data?.project) {
        setSelectedProject(json.data.project);
      } else {
        setDetailError(json.error?.message || 'Failed to load project details.');
      }
    } catch {
      setDetailError('Unable to load project details from server. Please try again.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData(trendsDays);
  }, [fetchOverviewData, trendsDays]);

  useEffect(() => {
    if (activeTab === 'COMPLAINTS') {
      fetchPublicComplaints();
    }
  }, [activeTab, fetchPublicComplaints]);

  useEffect(() => {
    if (activeTab === 'PROJECTS') {
      fetchCivicProjects();
    }
  }, [activeTab, fetchCivicProjects]);

  // Prepare Donut Slices for Status Distribution (Editorial Civic Palette)
  const donutSlices: DonutSlice[] = [
    { label: 'Submitted', value: metrics?.complaints.statusBreakdown.SUBMITTED || 0, color: '#38BDF8' },
    { label: 'Under Review', value: metrics?.complaints.statusBreakdown.UNDER_REVIEW || 0, color: '#F59E0B' },
    { label: 'Assigned', value: metrics?.complaints.statusBreakdown.ASSIGNED || 0, color: '#A78BFA' },
    { label: 'In Progress', value: metrics?.complaints.statusBreakdown.IN_PROGRESS || 0, color: '#14B8A6' },
    { label: 'Resolved (Pending Verif.)', value: metrics?.complaints.statusBreakdown.RESOLVED || 0, color: '#10B981' },
    { label: 'Verified', value: metrics?.complaints.statusBreakdown.VERIFIED || 0, color: 'var(--color-chart-brand)' },
    { label: 'Reopened', value: metrics?.complaints.statusBreakdown.REOPENED || 0, color: '#F87171' },
    { label: 'Rejected', value: metrics?.complaints.statusBreakdown.REJECTED || 0, color: '#DC2626' },
    { label: 'Closed', value: metrics?.complaints.statusBreakdown.CLOSED || 0, color: '#9CA3AF' },
  ].filter((s) => s.value > 0);

  // Prepare Category Bar List (Editorial Civic Palette)
  const categoryBars: BarListItem[] = (distribution?.byCategory || []).map((cat, i) => {
    const colors = ['var(--color-chart-brand)', '#14B8A6', '#F59E0B', '#A78BFA', '#10B981', '#F87171'];
    return {
      label: cat.name,
      value: cat.count,
      subLabel: `${cat.percentage}% of all grievances logged`,
      colorHex: colors[i % colors.length],
    };
  });

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRefresh = () => {
    if (activeTab === 'OVERVIEW' || activeTab === 'DEPARTMENTS') {
      fetchOverviewData(trendsDays);
    } else if (activeTab === 'COMPLAINTS') {
      fetchPublicComplaints();
    } else if (activeTab === 'PROJECTS') {
      fetchCivicProjects();
    }
  };

  const filteredDepartments = (departments?.departments || []).filter((dept) => {
    if (!departmentSearch.trim()) return true;
    const term = departmentSearch.toLowerCase().trim();
    return (
      dept.name.toLowerCase().includes(term) ||
      dept.code.toLowerCase().includes(term) ||
      (dept.description && dept.description.toLowerCase().includes(term))
    );
  });

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title={t('transparency.title')}
        description={t('transparency.subtitle')}
        className="mb-0"
        badge={
          <Badge variant="success" size="md" hasDot>
            {t('nav.transparency')}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/map')}
              leftIcon={<MapPinIcon className="w-3.5 h-3.5 text-[#0B3D2E] dark:text-[#34D399]" />}
            >
              {t('nav.civicMap')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              leftIcon={<RefreshCwIcon className="w-3.5 h-3.5" />}
            >
              {t('adminSystem.refreshBtn')}
            </Button>
          </>
        }
      />

      {errorMsg && activeTab === 'OVERVIEW' && (
        <Alert variant="error" title="Data Retrieval Error">
          {errorMsg}
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => fetchOverviewData(trendsDays)}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Transparency Dashboard Sections"
        className="flex items-center gap-2 border-b border-[#E5E7EB] dark:border-[#374151] overflow-x-auto pb-2"
      >
        {[
          { id: 'OVERVIEW', label: 'Overview Analytics' },
          { id: 'COMPLAINTS', label: `Public Grievances (${complaintTotalCount || metrics?.complaints.total || 0})` },
          { id: 'DEPARTMENTS', label: 'Department Scorecards' },
          { id: 'PROJECTS', label: `Civic Works Projects (${projectTotalCount || metrics?.civicProjects.total || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id.toLowerCase()}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id.toLowerCase()}`}
            type="button"
            onClick={() => handleTabChange(tab.id as TransparencyTab)}
            className={`civora-liquid-tab px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap font-sans ${
              activeTab === tab.id
                ? 'font-semibold'
                : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW ANALYTICS */}
      {/* ======================================================== */}
      {activeTab === 'OVERVIEW' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <LoadingIndicator size="lg" label="Computing transparency dataset" />
              <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-3">
                Calculating real metrics from PostgreSQL records...
              </span>
            </div>
          ) : (
            <>
              {/* Primary Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Total Grievances Lodged"
                  value={metrics?.complaints.total ?? 0}
                  subtext="100% cryptographically tracked"
                  accentColor="blue"
                  icon={<FileTextIcon className="w-5 h-5" />}
                />
                <MetricCard
                  label="Municipal Resolution Rate"
                  value={`${metrics?.complaints.resolutionRate ?? 0}%`}
                  subtext={`${metrics?.complaints.resolved ?? 0} resolved + ${metrics?.complaints.verified ?? 0} verified`}
                  accentColor="emerald"
                  badge={<span className="text-xs font-semibold text-[#0B6640] dark:text-emerald-400">Verified</span>}
                  icon={<CheckCircleIcon className="w-5 h-5" />}
                />
                <MetricCard
                  label="Active / Open Workload"
                  value={metrics?.complaints.open ?? 0}
                  subtext={`${metrics?.complaints.inProgress ?? 0} active with field squads`}
                  accentColor="amber"
                  icon={<ClockIcon className="w-5 h-5" />}
                />
                <MetricCard
                  label="Avg Resolution Turnaround"
                  value={
                    metrics?.complaints.averageResolutionHours !== null &&
                    metrics?.complaints.averageResolutionHours !== undefined
                      ? `${metrics.complaints.averageResolutionHours} hrs`
                      : 'Under review'
                  }
                  subtext={
                    metrics?.complaints.medianResolutionHours !== null
                      ? `Median: ${metrics?.complaints.medianResolutionHours} hrs`
                      : 'From lodging to completion'
                  }
                  accentColor="sky"
                  icon={<ShieldCheckIcon className="w-5 h-5" />}
                />
              </div>

              {/* Civic Projects Summary Ribbon */}
              <Card className="border-[#0B3D2E]/25 bg-[#F9FAFB] dark:bg-[#182230]">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0B3D2E]/10 dark:bg-[#34D399]/15 text-[#0B3D2E] dark:text-[#34D399] border border-[#0B3D2E]/20 dark:border-[#34D399]/30">
                      <BuildingIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-[#F9FAFB] block text-sm">
                        Formal Municipal Civic Works Projects
                      </span>
                      <span className="text-[#374151] dark:text-[#D1D5DB]">
                        {metrics?.civicProjects.total ?? 0} formally approved municipal projects •{' '}
                        {metrics?.civicProjects.active ?? 0} active in execution •{' '}
                        {metrics?.civicProjects.averagePhysicalProgress ?? 0}% average completion progress
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('PROJECTS')}
                    className="shrink-0 text-xs cursor-pointer"
                  >
                    Explore Projects →
                  </Button>
                </CardContent>
              </Card>

              {/* Trend Chart Card */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-[#0B3D2E] dark:text-[#34D399]" />
                      Grievance Intake vs. Resolution Velocity
                    </CardTitle>
                    <CardDescription>
                      Daily comparison of community filings vs official completed resolutions
                    </CardDescription>
                  </div>

                  {/* Range Toggle */}
                  <div className="flex items-center gap-1 bg-[#F3F4F6]/80 dark:bg-[#273548]/80 p-1 rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-xs">
                    {[7, 30, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        data-active={trendsDays === days}
                        onClick={() => setTrendsDays(days)}
                        className={`civora-liquid-tab px-2.5 py-1 rounded-md text-xs font-medium ${
                          trendsDays === days
                            ? 'font-semibold'
                            : 'text-[#6B7280] dark:text-[#D1D5DB]'
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent>
                  {trends?.timeline ? (
                    <TrendAreaChart data={trends.timeline} />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                      No trend observations recorded.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Two Column Charts: Status Distribution & Category Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Donut */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Grievance Lifecycle Distribution</CardTitle>
                    <CardDescription>
                      Breakdown of all {metrics?.complaints.total ?? 0} filed grievances by active state
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart slices={donutSlices} centerLabel="Complaints" />
                  </CardContent>
                </Card>

                {/* Category Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Grievances by Civic Category</CardTitle>
                    <CardDescription>
                      Distribution of civic reports across infrastructure and municipal domains
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HorizontalBarChart items={categoryBars} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PUBLIC GRIEVANCES EXPLORER */}
      {/* ======================================================== */}
      {activeTab === 'COMPLAINTS' && (
        <div id="panel-complaints" role="tabpanel" aria-labelledby="tab-complaints" className="space-y-6">
          {/* Privacy Guarantee Alert */}
          <Alert variant="info" title="Citizen Privacy Guaranteed">
            This public ledger displays municipal response data and inspection outcomes. All citizen identities, telephone numbers, email addresses, and private contact details are cryptographically masked and never exposed.
          </Alert>

          {/* Error Banner */}
          {complaintsError && (
            <Alert variant="error" title="Unable to Load Public Grievances">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span>{complaintsError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchPublicComplaints()}
                  className="self-start sm:self-auto text-xs"
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 max-w-md">
              <TextInput
                id="complaint-search"
                placeholder="Search tracking ID, title, locality..."
                value={complaintSearch}
                onChange={(e) => {
                  setComplaintSearch(e.target.value);
                  setComplaintPage(1);
                }}
                leftIcon={<SearchIcon className="w-4 h-4 text-[#6B7280] dark:text-[#D1D5DB]" />}
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                id="complaint-status-filter"
                value={complaintStatus}
                onChange={(e) => {
                  setComplaintStatus(e.target.value);
                  setComplaintPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Lifecycle States' },
                  { value: 'SUBMITTED', label: 'Submitted' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'ASSIGNED', label: 'Assigned' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'RESOLVED', label: 'Resolved (Pending Verif.)' },
                  { value: 'VERIFIED', label: 'Verified by Citizen' },
                  { value: 'REOPENED', label: 'Reopened' },
                  { value: 'CLOSED', label: 'Closed' },
                ]}
              />
            </div>
          </div>

          {/* Grievance Cards List */}
          {complaintsLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <LoadingIndicator size="lg" label="Loading public complaints" />
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No Matching Grievances"
              description={
                complaintSearch || complaintStatus !== 'ALL'
                  ? 'No civic complaints match the selected filter or search terms.'
                  : 'No public grievances have been published to the transparency ledger yet.'
              }
              action={
                complaintSearch || complaintStatus !== 'ALL' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setComplaintSearch('');
                      setComplaintStatus('ALL');
                      setComplaintPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {complaints.map((c) => (
                <Card
                  key={c.id}
                  className="hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors shadow-xs"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#34D399]/15 px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#34D399]/30">
                            {c.trackingId}
                          </span>
                          <Badge variant={getStatusBadgeVariant(c.status)} size="sm" hasDot>
                            {c.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                            • {c.category?.name || 'General Issue'}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">{c.title}</h3>
                        <p className="text-xs text-[#374151] dark:text-[#D1D5DB] line-clamp-2">{c.description}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-1">
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="w-3.5 h-3.5 text-[#185541] dark:text-[#34D399]" />
                            <span>{c.locality} {c.ward ? `• ${c.ward}` : ''}</span>
                          </div>
                          <span>Lodged: {formatDate(c.createdAt)}</span>
                          {c.assignedDepartment && (
                            <span>Department: <strong className="text-[#111827] dark:text-[#F9FAFB]">{c.assignedDepartment.name}</strong></span>
                          )}
                          {c.verifiedAt && (
                            <span className="text-[#185541] dark:text-[#34D399] font-semibold">✓ Citizen Verified: {formatDate(c.verifiedAt)}</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 self-start md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/track?id=${c.trackingId}`)}
                          className="cursor-pointer text-xs"
                        >
                          Track Live
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {complaintTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                    Page {complaintPage} of {complaintTotalPages} ({complaintTotalCount} grievances)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={complaintPage <= 1}
                      onClick={() => setComplaintPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={complaintPage >= complaintTotalPages}
                      onClick={() => setComplaintPage((p) => Math.min(complaintTotalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: DEPARTMENT ACCOUNTABILITY SCORECARDS */}
      {/* ======================================================== */}
      {activeTab === 'DEPARTMENTS' && (
        <div id="panel-departments" role="tabpanel" aria-labelledby="tab-departments" className="space-y-6">
          <Alert variant="info" title="Fair Comparative Evaluation">
            {departments?.context?.fairComparisonGuidance ||
              'Departmental resolution rates and turnaround timelines reflect varying technical complexity and jurisdictional volumes. Volume context should always be considered alongside performance percentages.'}
          </Alert>

          {/* Search filter for departments */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <TextInput
                id="department-search"
                placeholder="Search department name or code..."
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                leftIcon={<SearchIcon className="w-4 h-4 text-[#6B7280] dark:text-[#D1D5DB]" />}
              />
            </div>
            {departments?.departments && (
              <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Showing {filteredDepartments.length} of {departments.departments.length} departments
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <LoadingIndicator size="lg" label="Loading department scorecards" />
            </div>
          ) : errorMsg ? (
            <Alert variant="error" title="Unable to Load Department Scorecards">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span>{errorMsg}</span>
                <Button size="sm" variant="outline" onClick={() => fetchOverviewData(trendsDays)} className="self-start sm:self-auto text-xs">
                  Retry
                </Button>
              </div>
            </Alert>
          ) : filteredDepartments.length === 0 ? (
            <EmptyState
              title="No Departments Found"
              description={departmentSearch ? `No department matches "${departmentSearch}".` : 'No departmental records available.'}
              action={
                departmentSearch ? (
                  <Button variant="outline" size="sm" onClick={() => setDepartmentSearch('')}>
                    Clear Search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDepartments.map((dept) => (
                <Card
                  key={dept.id}
                  className="hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors shadow-xs"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5ECE8] text-[#0B3D2E] dark:bg-[#273548] dark:text-[#34D399] border border-[#0B3D2E]/20 dark:border-[#374151]">
                            {dept.code}
                          </span>
                          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-mono">
                            {dept.workloadShare}% city workload
                          </span>
                        </div>
                        <CardTitle className="text-base">{dept.name}</CardTitle>
                      </div>
                    </div>
                    {dept.description && (
                      <CardDescription className="line-clamp-2">{dept.description}</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Resolution Rate Progress */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#374151] dark:text-[#D1D5DB] font-medium">Departmental Resolution Rate</span>
                        <span className="font-mono font-bold text-[#185541] dark:text-[#34D399]">{dept.resolutionRate}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#F3F4F6] dark:bg-[#273548] rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#374151]">
                        <div
                          className="h-full bg-[#185541] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, dept.resolutionRate)}%` }}
                        />
                      </div>
                    </div>

                    {/* Operational breakdown grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-center">
                      <div>
                        <span className="text-[10px] uppercase text-[#6B7280] dark:text-[#D1D5DB] font-medium block">Total Assigned</span>
                        <span className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] font-mono">{dept.totalAssigned}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-[#854F0B] dark:text-[#F3BA6C] font-medium block">Active Backlog</span>
                        <span className="text-base font-bold text-[#854F0B] dark:text-[#F3BA6C] font-mono">{dept.activeCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-[#185541] dark:text-[#34D399] font-medium block">Resolved</span>
                        <span className="text-base font-bold text-[#185541] dark:text-[#34D399] font-mono">{dept.resolvedCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-1 border-t border-[#E5E7EB] dark:border-[#374151]">
                      <span>
                        Avg Turnaround:{' '}
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">
                          {dept.avgResolutionHours !== null ? `${dept.avgResolutionHours} hrs` : 'N/A'}
                        </strong>
                      </span>
                      <span>
                        Reopened:{' '}
                        <strong className="text-[#854F0B] dark:text-[#F3BA6C]">{dept.reopenedCount}</strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: CIVIC WORKS PROJECTS MONITORING */}
      {/* ======================================================== */}
      {activeTab === 'PROJECTS' && (
        <div id="panel-projects" role="tabpanel" aria-labelledby="tab-projects" className="space-y-6">
          <Alert variant="info" title="Formal Civic Infrastructure Registry">
            Formal civic works projects represent authorized municipal capital repairs and tenders. They are distinct from individual routine maintenance complaints and require formal engineering sanctions.
          </Alert>

          {/* Error Banner */}
          {projectsError && (
            <Alert variant="error" title="Unable to Load Civic Projects">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span>{projectsError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchCivicProjects()}
                  className="self-start sm:self-auto text-xs"
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 max-w-md">
              <TextInput
                id="project-search"
                placeholder="Search project title, work order #, location..."
                value={projectSearch}
                onChange={(e) => {
                  setProjectSearch(e.target.value);
                  setProjectPage(1);
                }}
                leftIcon={<SearchIcon className="w-4 h-4 text-[#6B7280] dark:text-[#D1D5DB]" />}
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                id="project-status-filter"
                value={projectStatus}
                onChange={(e) => {
                  setProjectStatus(e.target.value);
                  setProjectPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Project States' },
                  { value: 'PROPOSED', label: 'Proposed' },
                  { value: 'SANCTIONED', label: 'Sanctioned' },
                  { value: 'TENDERING', label: 'Tendering' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>

          {/* Projects List */}
          {projectsLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <LoadingIndicator size="lg" label="Loading formal civic projects" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              title="No Civic Projects Found"
              description={
                projectSearch || projectStatus !== 'ALL'
                  ? 'No formal capital projects match the current search or status filters.'
                  : 'No formal capital projects have been registered in the system yet.'
              }
              action={
                projectSearch || projectStatus !== 'ALL' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProjectSearch('');
                      setProjectStatus('ALL');
                      setProjectPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  className="hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors shadow-xs"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#0B3D2E] bg-[#E5ECE8] dark:text-[#34D399] dark:bg-[#273548] px-2.5 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
                            {proj.workOrderNumber}
                          </span>
                          <Badge
                            variant={
                              proj.workStatus === 'COMPLETED'
                                ? 'success'
                                : proj.workStatus === 'IN_PROGRESS'
                                ? 'info'
                                : proj.workStatus === 'CANCELLED'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                            hasDot
                          >
                            {proj.workStatus}
                          </Badge>
                          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">• {proj.workType.replace('_', ' ')}</span>
                          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">• {proj.department?.name}</span>
                        </div>

                        <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">{proj.title}</h3>
                        <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">{proj.description}</p>

                        {/* Progress Bar */}
                        <div className="space-y-1 max-w-md pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#6B7280] dark:text-[#D1D5DB]">Physical Progress:</span>
                            <span className="font-mono font-bold text-[#0B6640] dark:text-[#34D399]">
                              {proj.physicalProgressPercentage}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-[#F3F4F6] dark:bg-[#273548] rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#374151]">
                            <div
                              className="h-full bg-[#0B6640] rounded-full transition-all duration-500"
                              style={{ width: `${proj.physicalProgressPercentage}%` }}
                            />
                          </div>
                          {proj.latestMilestone && (
                            <p className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] pt-0.5 italic">
                              Latest Milestone: {proj.latestMilestone}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-2 border-t border-[#E5E7EB] dark:border-[#374151]">
                          <div>
                            Location: <strong className="text-[#111827] dark:text-[#F9FAFB]">{proj.location}</strong>
                          </div>
                          <div>
                            Sanctioned Budget:{' '}
                            <strong className="text-[#111827] dark:text-[#F9FAFB]">
                              {formatCurrency(proj.sanctionedAmount || proj.estimatedBudget)}
                            </strong>
                          </div>
                          <div>
                            Linked Grievances:{' '}
                            <strong className="text-[#111827] dark:text-[#F9FAFB]">{proj.linkedComplaintsCount} issues</strong>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 self-start">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => fetchProjectDetail(proj.id)}
                          className="text-xs cursor-pointer"
                        >
                          View Details & Progress
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {projectTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                    Page {projectPage} of {projectTotalPages} ({projectTotalCount} projects)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={projectPage <= 1}
                      onClick={() => setProjectPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={projectPage >= projectTotalPages}
                      onClick={() => setProjectPage((p) => Math.min(projectTotalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProject(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
        >
          <Card className="max-w-2xl w-full border-[#E5E7EB] dark:border-[#374151] shadow-2xl my-8">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-[#0B3D2E] bg-[#E5ECE8] dark:text-[#34D399] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
                    {selectedProject.workOrderNumber}
                  </span>
                  <Badge variant="info" size="sm">
                    {selectedProject.workStatus}
                  </Badge>
                </div>
                <CardTitle id="project-modal-title" className="text-lg">{selectedProject.title}</CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                aria-label="Close dialog"
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="space-y-6 pt-4 max-h-[70vh] overflow-y-auto">
              {detailLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingIndicator size="md" label="Loading project details" />
                </div>
              ) : detailError ? (
                <Alert variant="error" title="Unable to Load Project Details">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                    <span>{detailError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchProjectDetail(selectedProject.id)}
                      className="self-start sm:self-auto text-xs"
                    >
                      Retry
                    </Button>
                  </div>
                </Alert>
              ) : (
                <>
                  {/* Summary & Budget */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs">
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Department:</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">{selectedProject.department?.name}</strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Sanctioned Budget:</span>
                      <strong className="text-[#185541] dark:text-[#34D399] font-mono">
                        {formatCurrency(selectedProject.sanctionedAmount || selectedProject.estimatedBudget)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Execution Progress:</span>
                      <strong className="text-[#1D584D] dark:text-[#34D399] font-mono">
                        {selectedProject.physicalProgressPercentage}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Contractor:</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">
                        {selectedProject.contractor?.name || 'Municipal Department Direct'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Start Date:</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">{formatDate(selectedProject.actualStartDate || selectedProject.plannedStartDate)}</strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block mb-0.5">Target Completion:</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">{formatDate(selectedProject.plannedEndDate)}</strong>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#D1D5DB]">
                      Scope of Work
                    </h4>
                    <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed bg-[#F9FAFB] dark:bg-[#182230] p-3 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                      {selectedProject.description}
                    </p>
                  </div>

                  {/* Progress Updates Timeline */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-[#1B5E8A] dark:text-[#78B4DD]" />
                      Execution Progress Log ({(selectedProject.progressUpdates || []).length})
                    </h4>

                    {(selectedProject.progressUpdates || []).length === 0 ? (
                      <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] italic">Work order awarded; field progress log pending initial milestone.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedProject.progressUpdates || []).map((u) => (
                          <div
                            key={u.id}
                            className="p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[#6B7280] dark:text-[#D1D5DB] text-[11px]">
                              <span>{formatDate(u.updateDate)}</span>
                              <span className="font-mono font-bold text-[#1B5E8A] dark:text-[#78B4DD]">
                                {u.physicalProgressPercentage}% Completed
                              </span>
                            </div>
                            <p className="text-[#111827] dark:text-[#F9FAFB]">{u.progressNotes}</p>
                            {u.milestoneReached && (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                Milestone: {u.milestoneReached}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linked Grievances */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1.5">
                      <FileTextIcon className="w-3.5 h-3.5 text-[#6A3D9A] dark:text-[#C59BEE]" />
                      Linked Citizen Grievances ({(selectedProject.linkedComplaints || []).length})
                    </h4>

                    {(selectedProject.linkedComplaints || []).length === 0 ? (
                      <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] italic">This capital project was planned through direct municipal infrastructure allocation.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(selectedProject.linkedComplaints || []).map((link) => (
                          <div
                            key={link.id}
                            className="p-2.5 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold text-[#1B5E8A] dark:text-[#78B4DD]">
                                {link.trackingId}
                              </span>
                              <Badge variant={getStatusBadgeVariant(link.status)} size="sm">
                                {link.status}
                              </Badge>
                            </div>
                            <p className="text-[#111827] dark:text-[#F9FAFB] truncate">{link.title}</p>
                            <span className="text-[10px] text-[#6B7280] dark:text-[#D1D5DB] block">{link.locality}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center justify-end pt-4 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProject(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  );
}
