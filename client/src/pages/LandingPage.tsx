import { useState, useEffect } from 'react';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MetricCard } from '../components/ui/MetricCard';
import { useRouter } from '../router';
import { useTranslation } from '../context/useTranslation';
import {
  FileTextIcon,
  SearchIcon,
  ClockIcon,
  ShieldCheckIcon,
  MapPinIcon,
  BuildingIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '../components/ui/icons';

interface TransparencyMetricsData {
  complaints: {
    total: number;
    open: number;
    resolved: number;
    verified: number;
    closed: number;
    resolutionRate: number;
    averageResolutionHours: number | null;
    medianResolutionHours: number | null;
  };
  civicProjects: {
    total: number;
    active: number;
    completed: number;
  };
}

export function LandingPage() {
  const { navigate } = useRouter();
  const { t, formatNumber } = useTranslation();
  const [quickTrackingId, setQuickTrackingId] = useState('');
  const [metrics, setMetrics] = useState<TransparencyMetricsData | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch('/api/transparency/metrics')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!ignore && json.success && json.data) {
          setMetrics(json.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setMetricsError(true);
        }
      })
      .finally(() => {
        if (!ignore) {
          setMetricsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleQuickTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = quickTrackingId.trim();
    if (cleanId) {
      navigate(`/track?id=${encodeURIComponent(cleanId)}`);
    } else {
      navigate('/track');
    }
  };

  const issueCategories = [
    {
      title: 'Roads & Potholes',
      desc: 'Craters, pavement subsidence, missing manhole covers, and asphalt degradation.',
      icon: <MapPinIcon className="w-5 h-5 text-[#173D32] dark:text-[#7BC4B2]" />,
      dept: 'Public Works & Highways',
    },
    {
      title: 'Garbage & Sanitation',
      desc: 'Overflowing bins, illegal dumping sites, unattended waste accumulation, and drain blockages.',
      icon: <BuildingIcon className="w-5 h-5 text-[#2D6E62] dark:text-[#7BC4B2]" />,
      dept: 'Municipal Sanitation',
    },
    {
      title: 'Streetlights & Electrical',
      desc: 'Dark intersections, non-functioning fixtures, exposed electrical wiring, and power faults.',
      icon: <ClockIcon className="w-5 h-5 text-[#B26A15] dark:text-[#F3B768]" />,
      dept: 'Electrical & Public Lighting',
    },
    {
      title: 'Water Supply & Sewage',
      desc: 'Pipeline bursts, contaminated supply lines, low pressure, and sewage overflows.',
      icon: <ShieldCheckIcon className="w-5 h-5 text-[#1E6B52] dark:text-[#78C7AE]" />,
      dept: 'Water & Sewage Board',
    },
  ];

  const lifecycleSteps = [
    {
      step: '01',
      title: 'Report a Civic Issue',
      actor: 'Citizen',
      desc: 'Submit location, category, description, and photos. An immutable tracking ID is immediately generated without requiring an account.',
      badgeVariant: 'info' as const,
    },
    {
      step: '02',
      title: 'Triage & Department Routing',
      actor: 'Municipal Reviewer',
      desc: 'Reviewers validate the grievance, route it to the designated department, and activate official Service-Level Agreement (SLA) deadlines.',
      badgeVariant: 'warning' as const,
    },
    {
      step: '03',
      title: 'Field Action & Progress',
      actor: 'Department Official',
      desc: 'Assigned field crews inspect on-site conditions, post timestamped milestone updates, and execute physical repair work.',
      badgeVariant: 'default' as const,
    },
    {
      step: '04',
      title: 'Verified Resolution',
      actor: 'Citizen & Public',
      desc: 'Review photographic proof of completed work. Confirm resolution satisfaction or reopen the complaint if the problem persists.',
      badgeVariant: 'success' as const,
    },
  ];

  const totalResolved = metrics
    ? metrics.complaints.resolved + metrics.complaints.verified + metrics.complaints.closed
    : null;

  return (
    <Container size="lg" className="space-y-16 md:space-y-24">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-6 md:pt-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#173D32]/10 text-[#173D32] border border-[#173D32]/30 dark:bg-[#215748]/40 dark:text-[#E8F0EC] dark:border-[#4F9B8B]/40 select-none">
          <span className="w-2 h-2 rounded-full bg-[#173D32] dark:bg-[#7BC4B2]" />
          <span>{t('nav.brand')} &mdash; {t('nav.tagline')}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif-hero font-normal tracking-tight text-[#202522] dark:text-[#F5F2EA] max-w-4xl mx-auto leading-[1.12]">
          {t('home.heroTitle')}
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-[#202522] dark:text-[#E8F0EC] font-medium max-w-2xl mx-auto leading-relaxed">
          {t('home.heroSubtitle')}
        </p>

        {/* Primary CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-2xl mx-auto">
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate('/report')}
            leftIcon={<FileTextIcon className="w-5 h-5" />}
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {t('home.reportCta')}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/track')}
            leftIcon={<SearchIcon className="w-5 h-5 text-[#202522] dark:text-[#F5F2EA]" />}
            className="w-full sm:w-auto"
          >
            {t('home.trackCta')}
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/transparency')}
            leftIcon={<ShieldCheckIcon className="w-5 h-5 text-[#173D32] dark:text-[#7BC4B2]" />}
            className="w-full sm:w-auto"
          >
            {t('home.exploreTransparency')}
          </Button>
        </div>

        <p className="text-xs text-[#54625A] dark:text-[#94A79D] pt-1">
          {t('home.publicCommitmentDesc')}
        </p>

        {/* Quick Tracking Search Bar */}
        <div className="max-w-xl mx-auto pt-4 w-full">
          <form
            onSubmit={handleQuickTrackSubmit}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-white dark:bg-[#16201C] border-2 border-[#C2BAA8] dark:border-[#3D5449] shadow-xs focus-within:border-[#173D32] dark:focus-within:border-[#7BC4B2] transition-colors"
          >
            <div className="pl-3 text-[#54625A] dark:text-[#94A79D]">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={quickTrackingId}
              onChange={(e) => setQuickTrackingId(e.target.value)}
              placeholder="Have a tracking ID? (e.g., CIV-2026-ABCDE)"
              className="w-full min-w-0 bg-transparent border-0 py-2 px-2 text-sm text-[#202522] dark:text-[#F5F2EA] placeholder-[#586860] dark:placeholder-[#94A79D] focus:outline-none font-mono"
              aria-label="Enter Complaint Tracking ID"
            />
            <Button type="submit" variant="primary" size="sm" className="shrink-0">
              Track
            </Button>
          </form>
        </div>
      </section>

      {/* Live Public Accountability & Transparency Metrics */}
      <section aria-labelledby="transparency-metrics-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Badge variant="info" size="sm" className="mb-2">
              Live Governance Data
            </Badge>
            <h2 id="transparency-metrics-heading" className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
              Public Accountability at a Glance
            </h2>
            <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] max-w-xl mt-1">
              Real-time resolution metrics calculated directly from verified municipal actions.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/transparency')}
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
          >
            View Full Transparency Suite
          </Button>
        </div>

        {metricsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 rounded-xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] animate-pulse space-y-3">
                <div className="h-4 w-24 bg-[#ECE7DB] dark:bg-[#1C2823] rounded" />
                <div className="h-8 w-16 bg-[#ECE7DB] dark:bg-[#1C2823] rounded" />
                <div className="h-3 w-32 bg-[#ECE7DB] dark:bg-[#1C2823] rounded" />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('transparency.totalLodged')}
              value={formatNumber(metrics.complaints.total)}
              subtext="Authoritative public records"
              accentColor="blue"
              icon={<FileTextIcon className="w-5 h-5 text-[#173D32] dark:text-[#E8F0EC]" />}
            />
            <MetricCard
              label={t('home.statsResolved')}
              value={formatNumber(totalResolved ?? 0)}
              subtext="Completed with evidence"
              accentColor="emerald"
              icon={<CheckCircleIcon className="w-5 h-5 text-[#185541] dark:text-[#78C7AE]" />}
            />
            <MetricCard
              label="Resolution Compliance"
              value={`${metrics.complaints.resolutionRate}%`}
              subtext="Actionable grievances resolved"
              accentColor="sky"
              icon={<ShieldCheckIcon className="w-5 h-5 text-[#1D584D] dark:text-[#7BC4B2]" />}
            />
            <MetricCard
              label="Civic Works Monitored"
              value={metrics.civicProjects.total}
              subtext={`${metrics.civicProjects.active} active infrastructure works`}
              accentColor="amber"
              icon={<BuildingIcon className="w-5 h-5 text-[#854F0B] dark:text-[#F3B768]" />}
            />
          </div>
        ) : metricsError ? (
          <Card variant="subtle">
            <CardContent className="py-6 text-center space-y-2">
              <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9]">
                Detailed public analytics, department scorecards, and time series are available on the Transparency page.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/transparency')}>
                Open Public Transparency
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 4-Step Lifecycle Explanation */}
      <section className="space-y-8" aria-labelledby="lifecycle-heading">
        <div className="text-center space-y-2">
          <h2 id="lifecycle-heading" className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
            How Civic Resolution Works
          </h2>
          <p className="text-sm sm:text-base text-[#3E4B44] dark:text-[#C5D4C9] max-w-xl mx-auto">
            A structured, transparent municipal workflow connecting citizens, reviewers, and department field teams.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {lifecycleSteps.map((item) => (
            <Card key={item.step} variant="default" className="flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#173D32] dark:text-[#7BC4B2] font-mono tracking-tighter">
                    {item.step}
                  </span>
                  <Badge variant={item.badgeVariant} size="sm">
                    {item.actor}
                  </Badge>
                </div>
                <h3 className="text-base font-heading font-semibold text-[#202522] dark:text-[#F5F2EA]">{item.title}</h3>
                <p className="text-xs sm:text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Common Issue Categories */}
      <section className="space-y-8" aria-labelledby="categories-heading">
        <div className="text-center space-y-2">
          <h2 id="categories-heading" className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
            What Can You Report on Civora?
          </h2>
          <p className="text-sm sm:text-base text-[#3E4B44] dark:text-[#C5D4C9] max-w-xl mx-auto">
            Everyday civic infrastructure challenges routed directly to designated departments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {issueCategories.map((cat) => (
            <Card key={cat.title} variant="interactive" className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#ECE7DB] dark:bg-[#1C2823] flex items-center justify-center shrink-0 border border-[#DED8CB] dark:border-[#283931]">
                  {cat.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-heading font-semibold text-[#202522] dark:text-[#F5F2EA]">{cat.title}</h3>
                  <p className="text-xs sm:text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">{cat.desc}</p>
                  <span className="inline-block text-[11px] font-medium text-[#202522] dark:text-[#F5F2EA] bg-[#ECE7DB]/60 dark:bg-[#1C2823] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded mt-2">
                    Handled by: {cat.dept}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Community Engagement & Civic Proposals Feature Banner */}
      <section className="p-8 sm:p-10 rounded-2xl bg-[#173D32] text-[#F4F0E6] border border-[#112F26] shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F4F0E6]/15 text-[#F4F0E6] border border-[#F4F0E6]/25">
              Civic Engagement Hub
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-white">
              Shape Your Neighborhood Beyond Issue Reporting
            </h2>
            <p className="text-sm sm:text-base text-[#C5D4C9] leading-relaxed">
              Civora empowers communities to actively participate in civic priorities. Submit community improvement proposals, endorse local initiatives, and participate in official public polls.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button
              variant="secondary"
              onClick={() => navigate('/engagement')}
              rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              className="bg-[#F4F0E6] text-[#173D32] hover:bg-white border-transparent"
            >
              Explore Proposals & Polls
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/engagement/proposals/new')}
              className="border-2 border-[#A8BFAE] text-[#F4F0E6] hover:bg-[#112F26] hover:text-white"
            >
              Submit a Proposal
            </Button>
          </div>
        </div>
      </section>

      {/* Public Accountability & Trust Commitments */}
      <section className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-xs space-y-6">
        <div className="max-w-3xl space-y-3">
          <Badge variant="success" size="sm" hasDot>
            Accountability Guarantees
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
            Designed for Open Governance & Public Trust
          </h2>
          <p className="text-sm sm:text-base text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
            Unlike traditional opaque complaint systems, Civora makes the resolution lifecycle visible. Complaints cannot simply disappear into bureaucratic backlogs: every milestone requires auditable action and verified photographic evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#141C18] border border-[#EAE5D9] dark:border-[#283931]">
            <div className="flex items-center gap-2 text-[#202522] dark:text-[#F5F2EA] font-heading font-semibold text-sm">
              <ClockIcon className="w-4 h-4 text-[#173D32] dark:text-[#7BC4B2]" />
              <h4>SLA Turnaround Deadlines</h4>
            </div>
            <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
              Configurable Service-Level Agreements enforce authoritative response and resolution time targets.
            </p>
          </div>
          <div className="space-y-1.5 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#141C18] border border-[#EAE5D9] dark:border-[#283931]">
            <div className="flex items-center gap-2 text-[#202522] dark:text-[#F5F2EA] font-heading font-semibold text-sm">
              <CheckCircleIcon className="w-4 h-4 text-[#185541] dark:text-[#78C7AE]" />
              <h4>Verified Resolution Proof</h4>
            </div>
            <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
              Issues cannot be closed without photographic before-and-after evidence verifiable by citizens.
            </p>
          </div>
          <div className="space-y-1.5 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#141C18] border border-[#EAE5D9] dark:border-[#283931]">
            <div className="flex items-center gap-2 text-[#202522] dark:text-[#F5F2EA] font-heading font-semibold text-sm">
              <AlertTriangleIcon className="w-4 h-4 text-[#854F0B] dark:text-[#F3B768]" />
              <h4>Citizen Reopen Rights</h4>
            </div>
            <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
              If a reported issue persists after resolution, citizens retain the right to reopen the complaint for rework.
            </p>
          </div>
        </div>
      </section>
    </Container>
  );
}
