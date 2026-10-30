export type ProposalStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'PUBLISHED'
  | 'ACCEPTED_FOR_CONSIDERATION'
  | 'DECLINED'
  | 'ARCHIVED';

export type PollStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'ARCHIVED';

export type PollType = 'SINGLE_CHOICE' | 'MULTI_CHOICE';

export type PollVisibilityRule = 'ALWAYS_VISIBLE' | 'AFTER_VOTE' | 'AFTER_CLOSE';

export interface ProposalCategory {
  id: string;
  code?: string;
  name: string;
}

export interface ProposalSubmitter {
  id?: string;
  name: string;
  role: string;
  email?: string;
}

export interface CommunityProposal {
  id: string;
  trackingId: string;
  title: string;
  description: string;
  problemStatement?: string | null;
  suggestedSolution?: string | null;
  locality?: string | null;
  status: ProposalStatus;
  category: ProposalCategory;
  submitter: ProposalSubmitter;
  supportCount: number;
  hasSupported?: boolean;
  commentsCount?: number;
  publicExplanation?: string | null;
  officialResponse?: string | null;
  officialResponseBy?: ProposalSubmitter | null;
  officialResponseAt?: string | null;
  internalModerationNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalComment {
  id: string;
  content: string;
  author: {
    name: string;
    role: string;
  };
  createdAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  orderIndex: number;
  voteCount?: number;
  percentage?: number;
}

export interface PublicPoll {
  id: string;
  title: string;
  question: string;
  description?: string | null;
  category?: ProposalCategory | null;
  locality?: string | null;
  status: PollStatus;
  pollType: PollType;
  maxSelections: number;
  visibilityRule: PollVisibilityRule;
  startDate: string;
  endDate: string;
  isAdvisory: boolean;
  totalVotes: number;
  participantCount?: number;
  hasVoted?: boolean;
  votedOptionIds?: string[];
  resultsVisible?: boolean;
  options: PollOption[];
  createdAt: string;
}

export interface EngagementAnalytics {
  totalProposals: number;
  publishedProposals: number;
  acceptedProposals: number;
  proposalsWithResponse: number;
  officialResponseRate: number;
  totalSupports: number;
  totalPolls: number;
  openPolls: number;
  totalPollParticipants: number;
  categoryDistribution: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
  }>;
}
