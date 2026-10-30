import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Card } from '../components/ui/Card';
import { Container } from '../components/layout/Container';
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
    <Container size="xl" className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#173D32] via-[#1F4E40] to-[#122B23] text-[#F4F0E6] border border-[#2B5446] p-8 shadow-md">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <LightbulbIcon className="w-3.5 h-3.5" /> Civic Engagement & Community Voice
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F4F0E6] tracking-tight leading-tight">
            Co-Creating Better Neighborhoods
          </h1>
          <p className="mt-3 text-[#C5D4C9] text-sm sm:text-base leading-relaxed">
            Suggest community initiatives, vote on civic surveys, and help municipal authorities understand neighborhood priorities. Community proposals are constructive ideas for public consideration.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/engagement/proposals/new')}
              className="inline-flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <PlusIcon className="w-4 h-4" /> Submit a Proposal
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab('POLLS')}
              className="inline-flex items-center gap-2"
            >
              <VoteIcon className="w-4 h-4" /> View Active Polls
            </Button>
          </div>
        </div>
      </div>

      {/* Engagement Analytics Bar */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-400 block">
              {analytics.publishedProposals}
            </span>
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-medium">Published Proposals</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-400 block">
              {analytics.totalSupports}
            </span>
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-medium">Community Endorsements</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-400 block">
              {analytics.openPolls}
            </span>
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-medium">Active Civic Polls</span>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 block">
              {analytics.officialResponseRate}%
            </span>
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-medium">Authority Response Rate</span>
          </Card>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="border-b border-[#DED8CB] dark:border-[#283931] flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('PROPOSALS')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PROPOSALS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
            }`}
          >
            <LightbulbIcon className="w-4 h-4" /> Community Proposals
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('POLLS')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'POLLS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
            }`}
          >
            <VoteIcon className="w-4 h-4" /> Public Polls
          </button>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setActiveTab('MY_PROPOSALS')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MY_PROPOSALS'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
              }`}
            >
              My Proposals
            </button>
          )}
          {isStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('MODERATION')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MODERATION'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931]">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5D4C9] dark:text-[#54625A]" />
              <input
                type="text"
                placeholder="Search proposals by title, tracking ID, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-lg pl-10 pr-4 py-2 text-sm text-[#202522] dark:text-[#E8F0EC] placeholder-[#C5D4C9] focus:outline-none focus:border-[#173D32] dark:focus:border-[#7BC4B2]"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-lg px-3 py-2 text-sm text-[#202522] dark:text-[#E8F0EC] focus:outline-none focus:border-[#173D32] dark:focus:border-[#7BC4B2]"
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
                className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-lg px-3 py-2 text-sm text-[#202522] dark:text-[#E8F0EC] focus:outline-none focus:border-[#173D32] dark:focus:border-[#7BC4B2]"
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
                  className="flex flex-col justify-between hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 transition-all cursor-pointer group p-5"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA] group-hover:text-[#173D32] dark:group-hover:text-[#7BC4B2] transition-colors line-clamp-2">
                      {proposal.title}
                    </h3>

                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-3 leading-relaxed">
                      {proposal.description}
                    </p>

                    {proposal.locality && (
                      <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#173D32] dark:bg-[#7BC4B2]" />
                        {proposal.locality}
                      </div>
                    )}

                    {proposal.officialResponse && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                        <span className="font-semibold block text-emerald-200">Official Response</span>
                        <span className="line-clamp-2 mt-0.5">{proposal.officialResponse}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#DED8CB] dark:border-[#283931] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSupport(proposal.id, e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        proposal.hasSupported
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#3E4B44] dark:text-[#C5D4C9] hover:bg-[#DED8CB] dark:hover:bg-[#283931] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
                      }`}
                      aria-label="Support this proposal"
                    >
                      <ThumbUpIcon className="w-3.5 h-3.5" />
                      <span>{proposal.supportCount}</span>
                      <span className="hidden sm:inline">Endorse</span>
                    </button>

                    <div className="flex items-center gap-3 text-xs text-[#C5D4C9] dark:text-[#54625A]">
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
                  className="flex flex-col justify-between p-6 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 shadow-xs transition-all cursor-pointer group"
                  onClick={() => navigate(`/engagement/polls/${poll.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={poll.status === 'OPEN' ? 'success' : 'neutral'}>
                          {poll.status}
                        </Badge>
                        {poll.isAdvisory && (
                          <span className="text-[10px] uppercase font-semibold text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded">
                            Advisory
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" /> Closes {new Date(poll.endDate).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] group-hover:text-[#173D32] dark:group-hover:text-[#7BC4B2] transition-colors">
                      {poll.question}
                    </h3>

                    {poll.description && (
                      <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-2 leading-relaxed">
                        {poll.description}
                      </p>
                    )}

                    {/* Preview options */}
                    <div className="space-y-1.5 pt-2">
                      {poll.options.slice(0, 3).map((opt) => (
                        <div
                          key={opt.id}
                          className="px-3 py-2 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] text-xs text-[#3E4B44] dark:text-[#C5D4C9] flex items-center justify-between"
                        >
                          <span className="truncate">{opt.text}</span>
                          {opt.percentage !== undefined && (
                            <span className="font-semibold text-blue-400 ml-2">{opt.percentage}%</span>
                          )}
                        </div>
                      ))}
                      {poll.options.length > 3 && (
                        <span className="text-[11px] text-[#C5D4C9] dark:text-[#54625A] block text-right">
                          +{poll.options.length - 3} more options
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#DED8CB] dark:border-[#283931] flex items-center justify-between">
                    <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
                  className="flex flex-col justify-between p-5 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 shadow-xs cursor-pointer"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">{proposal.title}</h3>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-2">{proposal.description}</p>
                    {proposal.publicExplanation && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        Note: {proposal.publicExplanation}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#DED8CB] dark:border-[#283931] text-xs text-[#54625A] dark:text-[#C5D4C9] flex justify-between">
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
          <div className="flex items-center justify-between gap-4 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931]">
            <span className="text-sm font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">Queue Filter:</span>
            <select
              value={moderationStatusFilter}
              onChange={(e) => setModerationStatusFilter(e.target.value)}
              className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-lg px-3 py-1.5 text-xs text-[#202522] dark:text-[#E8F0EC]"
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
                  className="p-5 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 shadow-xs cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  onClick={() => navigate(`/engagement/proposals/${proposal.id}`)}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {proposal.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
                        {proposal.status}
                      </Badge>
                      <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                        by {proposal.submitter?.name} ({proposal.submitter?.email})
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">{proposal.title}</h4>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-1">{proposal.description}</p>
                    {proposal.internalModerationNotes && (
                      <span className="text-[11px] text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40 inline-block mt-1">
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
