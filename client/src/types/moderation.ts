export type ReportTargetType =
  | 'COMPLAINT'
  | 'COMPLAINT_MESSAGE'
  | 'PROPOSAL'
  | 'PROPOSAL_COMMENT'
  | 'POLL'
  | 'DOCUMENT';

export type AbuseReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'PERSONAL_DATA_EXPOSURE'
  | 'IMPERSONATION'
  | 'MALICIOUS_OR_SUSPICIOUS'
  | 'MISINFORMATION'
  | 'OTHER';

export type AbuseReportStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'RESOLVED_ACTION_TAKEN'
  | 'RESOLVED_NO_VIOLATION'
  | 'DISMISSED';

export type ModerationCaseStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ACTION_TAKEN'
  | 'RESOLVED_NO_VIOLATION'
  | 'CLOSED';

export type ModerationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ModerationActionType =
  | 'NO_ACTION'
  | 'WARNING_ISSUED'
  | 'CONTENT_HIDDEN'
  | 'CONTENT_REMOVED'
  | 'CONTENT_RESTORED'
  | 'ACCOUNT_RESTRICTED'
  | 'DUPLICATE_LINKED';

export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'UPHELD' | 'REJECTED';

export type UserRestrictionType =
  | 'SUBMISSION_RESTRICTED'
  | 'COMMENTING_RESTRICTED'
  | 'UPLOAD_RESTRICTED'
  | 'ACCOUNT_SUSPENDED';

export interface DuplicateCandidate {
  id: string;
  trackingId: string;
  title: string;
  categoryName: string;
  status: string;
  locality: string;
  ward: string | null;
  distanceMeters: number | null;
  similarityScore: number;
  matchReason: string;
  createdAt: string;
}

export interface DuplicateCheckResponse {
  potentialDuplicatesFound: boolean;
  candidates: DuplicateCandidate[];
  guidance: string;
}

export interface AbuseReport {
  id: string;
  trackingId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: AbuseReportReason;
  explanation?: string | null;
  status: AbuseReportStatus;
  caseId?: string | null;
  reviewedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  caseId: string;
  moderatorId?: string | null;
  actionType: ModerationActionType;
  reason: string;
  internalNotes?: string | null;
  isAutomated: boolean;
  createdAt: string;
  moderator?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export interface ModerationAppeal {
  id: string;
  caseId: string;
  appellantId: string;
  reason: string;
  status: AppealStatus;
  reviewerId?: string | null;
  decisionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  appellant?: {
    id: string;
    name: string;
  };
  reviewer?: {
    id: string;
    name: string;
  } | null;
}

export interface ModerationCase {
  id: string;
  caseNumber: string;
  targetType: ReportTargetType;
  targetId: string;
  status: ModerationCaseStatus;
  priority: ModerationPriority;
  riskScore: number;
  riskFactors?: string[] | null;
  assignedModeratorId?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    reports: number;
    actions: number;
    appeals: number;
  };
  reports?: AbuseReport[];
  actions?: ModerationAction[];
  appeals?: ModerationAppeal[];
  targetContent?: {
    exists: boolean;
    ownerId?: string | null;
    snippet?: string;
    isModerated?: boolean;
    raw?: any;
  };
}

export interface ModerationMetrics {
  totalReports: number;
  pendingReports: number;
  openCases: number;
  actionTakenCases: number;
  activeRestrictions: number;
  totalDuplicateLinks: number;
  reasonDistribution: Array<{
    reason: AbuseReportReason;
    count: number;
  }>;
}

export interface PlatformRule {
  category: string;
  description: string;
}

export interface PlatformRulesData {
  platform: string;
  version: string;
  lastUpdated: string;
  principles: string[];
  prohibitedContent: PlatformRule[];
  appealsProcess: {
    description: string;
  };
}
