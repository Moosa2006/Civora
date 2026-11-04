import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Card } from '../components/ui/Card';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { Alert } from '../components/ui/Alert';
import {
  LightbulbIcon,
  VoteIcon,
  ThumbUpIcon,
  SearchIcon,
  PlusIcon,
  ClockIcon,
  ChatBubbleIcon,
} from '../components/ui/icons';
import type {
  CommunityProposal,
  PublicPoll,
  EngagementAnalytics,
  ProposalCategory,
} from '../types/engagement';

type HubTab = 'PROPOSALS' | 'POLLS' | 'MY_PROPOSALS' | 'MODERATION';

export function EngagementHubPage() {
  const { navigate } = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<HubTab>('PROPOSALS');
  const [analytics, setAnalytics] = useState<EngagementAnalytics | null>(null);

  // Proposals State
  const [proposals, setProposals] = useState<CommunityProposal[]>([]);
  const [categories, setCategories] = useState<ProposalCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'most_supported'>('newest');
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState<string | null>(null);

  // Polls State
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollsError, setPollsError] = useState<string | null>(null);

  // My Proposals State
  const [myProposals, setMyProposals] = useState<CommunityProposal[]>([]);
  const [myProposalsLoading, setMyProposalsLoading] = useState(false);

  // Moderation Queue State
  const [moderationProposals, setModerationProposals] = useState<CommunityProposal[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationStatusFilter, setModerationStatusFilter] = useState<string>('SUBMITTED');

  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL';

  // 1. Fetch Analytics Overview
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/engagement/analytics/overview');
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // 2. Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/categories');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // 3. Fetch Published Proposals
  const fetchProposals = useCallback(async () => {
    setProposalsLoading(true);
    setProposalsError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (sortBy) params.append('sortBy', sortBy);

      const res = await fetch(`/api/engagement/proposals?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProposals(json.data);
      } else {
        setProposalsError(json.error?.message || 'Failed to load proposals.');
      }
    } catch {
      setProposalsError('Network error while loading community proposals.');
    } finally {
      setProposalsLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy]);

  // 4. Fetch Polls
  const fetchPolls = useCallback(async () => {
    setPollsLoading(true);
    setPollsError(null);
    try {
      const res = await fetch('/api/engagement/polls');
      const json = await res.json();
      if (json.success) {
        setPolls(json.data);
      } else {
        setPollsError(json.error?.message || 'Failed to load polls.');
      }
    } catch {
      setPollsError('Network error while loading public polls.');
    } finally {
      setPollsLoading(false);
    }
  }, []);

  // 5. Fetch My Proposals
  const fetchMyProposals = useCallback(async () => {
    if (!isAuthenticated) return;
    setMyProposalsLoading(true);
    try {
      const res = await fetch('/api/engagement/proposals/my');
      const json = await res.json();
      if (json.success) {
        setMyProposals(json.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setMyProposalsLoading(false);
    }
  }, [isAuthenticated]);

  // 6. Fetch Moderation Queue
  const fetchModerationQueue = useCallback(async () => {
    if (!isStaff) return;
    setModerationLoading(true);
    try {
      const params = new URLSearchParams();
      if (moderationStatusFilter) params.append('status', moderationStatusFilter);
      const res = await fetch(`/api/engagement/admin/proposals?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setModerationProposals(json.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setModerationLoading(false);
    }
  }, [isStaff, moderationStatusFilter]);

  // Initial Load
  useEffect(() => {
    fetchAnalytics();
    fetchCategories();
  }, [fetchAnalytics, fetchCategories]);

  // Tab Dependent Load
  useEffect(() => {
    if (activeTab === 'PROPOSALS') {
      fetchProposals();
    } else if (activeTab === 'POLLS') {
      fetchPolls();
    } else if (activeTab === 'MY_PROPOSALS') {
      fetchMyProposals();
    } else if (activeTab === 'MODERATION') {
      fetchModerationQueue();
    }
  }, [activeTab, fetchProposals, fetchPolls, fetchMyProposals, fetchModerationQueue]);

  // Quick Support Toggle Handler
  const handleToggleSupport = async (proposalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(`/api/engagement/proposals/${proposalId}/support`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId
              ? {
                  ...p,
                  hasSupported: json.data.supported,
                  supportCount: json.data.supportCount,
                }
              : p
          )
        );
      }
    } catch {
      // Non-blocking
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'ACCEPTED_FOR_CONSIDERATION':
        return 'info';
      case 'UNDER_REVIEW':
        return 'warning';
      case 'NEEDS_CLARIFICATION':
        return 'warning';
      case 'DECLINED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title="Civic Engagement & Community Voice"
        description="Suggest community initiatives, vote on civic surveys, and help municipal authorities understand neighborhood priorities. Community proposals are constructive ideas for public consideration."
        className="mb-0"
        badge={
          <Badge variant="success" size="md" hasDot>
            Community Voice
          </Badge>
        }
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/engagement/proposals/new')}
              leftIcon={<PlusIcon className="w-4 h-4" />}
            >
              Submit a Proposal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('POLLS')}
              leftIcon={<VoteIcon className="w-4 h-4" />}
            >
              View Active Polls
            </Button>
          </>
        }
      />

      {/* Engagement Analytics Bar */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#0B3D2E] dark:text-[#34D399] block">
              {analytics.publishedProposals}
            </span>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-medium">Published Proposals</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#0B6640] dark:text-[#34D399] block">
              {analytics.totalSupports}
            </span>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-medium">Community Endorsements</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#111827] dark:text-[#F9FAFB] block">
              {analytics.openPolls}
            </span>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-medium">Active Civic Polls</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#065F46] dark:text-[#34D399] block">
              {analytics.officialResponseRate}%
            </span>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-medium">Authority Response Rate</span>
          </Card>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-4 overflow-x-auto pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-active={activeTab === 'PROPOSALS'}
            onClick={() => setActiveTab('PROPOSALS')}
            className={`civora-liquid-tab px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PROPOSALS'
                ? 'font-semibold'
                : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            <LightbulbIcon className="w-4 h-4" /> Community Proposals
          </button>
          <button
            type="button"
            data-active={activeTab === 'POLLS'}
            onClick={() => setActiveTab('POLLS')}
            className={`civora-liquid-tab px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'POLLS'
                ? 'font-semibold'
                : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            <VoteIcon className="w-4 h-4" /> Public Polls
          </button>
          {isAuthenticated && (
            <button
              type="button"
              data-active={activeTab === 'MY_PROPOSALS'}
              onClick={() => setActiveTab('MY_PROPOSALS')}
              className={`civora-liquid-tab px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MY_PROPOSALS'
                  ? 'font-semibold'
                  : 'text-[#4B5563] dark:text-[#D1D5DB]'
              }`}
            >
              My Proposals
            </button>
          )}
          {isStaff && (
            <button
              type="button"
              data-active={activeTab === 'MODERATION'}
              onClick={() => setActiveTab('MODERATION')}
              className={`civora-liquid-tab px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MODERATION'
                  ? 'font-semibold'
                  : 'text-[#4B5563] dark:text-[#D1D5DB]'
              }`}
            >
              Moderation Queue
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: COMMUNITY PROPOSALS */}
      {activeTab === 'PROPOSALS' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#F9FAFB] dark:bg-[#182230] p-4 rounded-xl border border-[#E5E7EB] dark:border-[#374151]">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search proposals by title, tracking ID, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg pl-10 pr-4 py-2 text-sm text-[#111827] dark:text-[#F9FAFB] placeholder-[#9CA3AF] dark:placeholder-[#9CA3AF] focus:outline-none focus:border-[#0B3D2E] dark:focus:border-[#34D399]"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg px-3 py-2 text-sm text-[#111827] dark:text-[#F9FAFB] focus:outline-none focus:border-[#0B3D2E] dark:focus:border-[#34D399]"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg px-3 py-2 text-sm text-[#111827] dark:text-[#F9FAFB] focus:outline-none focus:border-[#0B3D2E] dark:focus:border-[#34D399]"
              >
                <option value="newest">Newest First</option>
                <option value="most_supported">Most Supported</option>
              </select>
            </div>
          </div>

          {proposalsError && (
            <Alert variant="error" title="Error Loading Proposals">
              {proposalsError}
            </Alert>
          )}

          {proposalsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingIndicator label="Loading community proposals..." size="lg" />
            </div>
          ) : proposals.length === 0 ? (
            <EmptyState
              title="No Community Proposals Found"
              description="Be the first citizen to propose a constructive improvement for this category or neighborhood."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/engagement/proposals/new')}
                >
                  Submit a Proposal
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proposals.map((proposal) => (
                <Card
                  key={proposal.id}
                  className="flex flex-col justify-between hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-all cursor-pointer group p-5"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] group-hover:text-[#0B3D2E] dark:group-hover:text-[#34D399] transition-colors line-clamp-2">
                      {proposal.title}
                    </h3>

                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] line-clamp-3 leading-relaxed">
                      {proposal.description}
                    </p>

                    {proposal.locality && (
                      <div className="text-xs text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0B6640] dark:bg-[#34D399]" />
                        {proposal.locality}
                      </div>
                    )}

                    {proposal.officialResponse && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-900 dark:text-emerald-200">
                        <span className="font-semibold block text-[#0B3D2E] dark:text-emerald-300">Official Response</span>
                        <span className="line-clamp-2 mt-0.5">{proposal.officialResponse}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSupport(proposal.id, e)}
                      className={`civora-liquid-btn ${
                        proposal.hasSupported
                          ? 'civora-liquid-btn--primary'
                          : 'civora-liquid-btn--secondary'
                      } gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold`}
                      aria-label="Support this proposal"
                    >
                      <ThumbUpIcon className="w-3.5 h-3.5" />
                      <span>{proposal.supportCount}</span>
                      <span className="hidden sm:inline">Endorse</span>
                    </button>

                    <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                      <span className="flex items-center gap-1">
                        <ChatBubbleIcon className="w-3.5 h-3.5" /> {proposal.commentsCount || 0}
                      </span>
                      <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PUBLIC POLLS */}
      {activeTab === 'POLLS' && (
        <div className="space-y-6">
          {pollsError && (
            <Alert variant="error" title="Error Loading Polls">
              {pollsError}
            </Alert>
          )}

          {pollsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingIndicator label="Loading public civic polls..." size="lg" />
            </div>
          ) : polls.length === 0 ? (
            <EmptyState
              title="No Active Polls"
              description="There are currently no open community surveys. Check back soon or submit a community proposal."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {polls.map((poll) => (
                <Card
                  key={poll.id}
                  className="flex flex-col justify-between p-6 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 shadow-xs transition-all cursor-pointer group"
                  onClick={() => navigate(`/engagement/polls/${poll.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={poll.status === 'OPEN' ? 'success' : 'neutral'}>
                          {poll.status}
                        </Badge>
                        {poll.isAdvisory && (
                          <span className="text-[10px] uppercase font-semibold text-[#6B7280] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-2 py-0.5 rounded">
                            Advisory
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" /> Closes {new Date(poll.endDate).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] group-hover:text-[#0B3D2E] dark:group-hover:text-[#34D399] transition-colors">
                      {poll.question}
                    </h3>

                    {poll.description && (
                      <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] line-clamp-2 leading-relaxed">
                        {poll.description}
                      </p>
                    )}

                    {/* Preview options */}
                    <div className="space-y-1.5 pt-2">
                      {poll.options.slice(0, 3).map((opt) => (
                        <div
                          key={opt.id}
                          className="px-3 py-2 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs text-[#374151] dark:text-[#D1D5DB] flex items-center justify-between"
                        >
                          <span className="truncate">{opt.text}</span>
                          {opt.percentage !== undefined && (
                            <span className="font-semibold text-[#0B6640] dark:text-[#34D399] ml-2">{opt.percentage}%</span>
                          )}
                        </div>
                      ))}
                      {poll.options.length > 3 && (
                        <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] block text-right">
                          +{poll.options.length - 3} more options
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                    <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                      <strong>{poll.totalVotes}</strong> recorded responses
                    </span>
                    <Button
                      variant={poll.hasVoted ? 'outline' : 'primary'}
                      size="sm"
                      className="cursor-pointer"
                    >
                      {poll.hasVoted ? 'View Results' : 'Participate'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY SUBMISSIONS */}
      {activeTab === 'MY_PROPOSALS' && (
        <div className="space-y-6">
          {myProposalsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingIndicator label="Loading your proposals..." size="lg" />
            </div>
          ) : myProposals.length === 0 ? (
            <EmptyState
              title="You Haven't Submitted Any Proposals"
              description="Share an idea for neighborhood parks, waste collection, solar lighting, or traffic safety."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/engagement/proposals/new')}
                >
                  Submit Your First Proposal
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myProposals.map((proposal) => (
                <Card
                  key={proposal.id}
                  className="flex flex-col justify-between p-5 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 shadow-xs cursor-pointer"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399]">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">{proposal.title}</h3>
                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] line-clamp-2">{proposal.description}</p>
                    {proposal.publicExplanation && (
                      <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300">
                        Note: {proposal.publicExplanation}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#374151] text-xs text-[#6B7280] dark:text-[#D1D5DB] flex justify-between">
                    <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                    <span>{proposal.supportCount} endorsements</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MODERATION QUEUE (Staff / Admin) */}
      {activeTab === 'MODERATION' && isStaff && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 bg-[#F9FAFB] dark:bg-[#182230] p-4 rounded-xl border border-[#E5E7EB] dark:border-[#374151]">
            <span className="text-sm font-semibold text-[#374151] dark:text-[#D1D5DB]">Queue Filter:</span>
            <select
              value={moderationStatusFilter}
              onChange={(e) => setModerationStatusFilter(e.target.value)}
              className="bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-[#F9FAFB]"
            >
              <option value="SUBMITTED">Newly Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="NEEDS_CLARIFICATION">Needs Clarification</option>
              <option value="PUBLISHED">Published</option>
              <option value="ACCEPTED_FOR_CONSIDERATION">Accepted for Consideration</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>

          {moderationLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingIndicator label="Loading moderation queue..." size="lg" />
            </div>
          ) : moderationProposals.length === 0 ? (
            <EmptyState
              title="Moderation Queue Clear"
              description={`No proposals currently matching status "${moderationStatusFilter}".`}
            />
          ) : (
            <div className="space-y-4">
              {moderationProposals.map((proposal) => (
                <Card
                  key={proposal.id}
                  className="p-5 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 shadow-xs cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399]">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status}
                      </Badge>
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                        by {proposal.submitter?.name} ({proposal.submitter?.email})
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">{proposal.title}</h4>
                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] line-clamp-1">{proposal.description}</p>
                    {proposal.internalModerationNotes && (
                      <span className="text-[11px] text-[#374151] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151] inline-block mt-1">
                        Internal Memo: {proposal.internalModerationNotes}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="whitespace-nowrap">
                    Review / Action
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
