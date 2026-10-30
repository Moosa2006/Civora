import type { ComplaintStatus } from './index';

export type CivicWorkStatus =
  | 'PROPOSED'
  | 'SANCTIONED'
  | 'TENDERING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ComplaintsMetrics {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  verified: number;
  reopened: number;
  rejected: number;
  closed: number;
  resolutionRate: number;
  averageResolutionHours: number | null;
  medianResolutionHours: number | null;
  statusBreakdown: Record<ComplaintStatus, number>;
}

export interface CivicProjectsMetrics {
  total: number;
  active: number;
  completed: number;
  statusBreakdown: Record<CivicWorkStatus, number>;
  averagePhysicalProgress: number | null;
}

export interface TransparencyMetricsData {
  complaints: ComplaintsMetrics;
  civicProjects: CivicProjectsMetrics;
  generatedAt: string;
}

export interface TrendTimelinePoint {
  date: string;
  submitted: number;
  resolved: number;
}

export interface TransparencyTrendsData {
  periodDays: number;
  startDate: string;
  endDate: string;
  timeline: TrendTimelinePoint[];
}

export interface StatusDistributionItem {
  status: ComplaintStatus;
  count: number;
  percentage: number;
}

export interface CategoryDistributionItem {
  categoryId: string;
  code: string;
  name: string;
  count: number;
  percentage: number;
}

export interface PriorityDistributionItem {
  priority: string;
  count: number;
  percentage: number;
}

export interface TransparencyDistributionData {
  totalComplaints: number;
  byStatus: StatusDistributionItem[];
  byCategory: CategoryDistributionItem[];
  byPriority: PriorityDistributionItem[];
}

export interface DepartmentAccountabilityItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  totalAssigned: number;
  activeCount: number;
  resolvedCount: number;
  verifiedCount: number;
  reopenedCount: number;
  resolutionRate: number;
  avgResolutionHours: number | null;
  workloadShare: number;
  contextNote: string;
}

export interface DepartmentAccountabilityData {
  departments: DepartmentAccountabilityItem[];
  context: {
    totalCityComplaints: number;
    fairComparisonGuidance: string;
  };
}

export interface PublicComplaintItem {
  id: string;
  trackingId: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  priority: string;
  locality: string;
  ward?: string | null;
  category: {
    id: string;
    code: string;
    name: string;
  };
  assignedDepartment?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  resolvedAt?: string | null;
  verifiedAt?: string | null;
  updatedAt: string;
}

export interface CivicProjectItem {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  workType: string;
  location: string;
  ward?: string | null;
  estimatedBudget: number;
  sanctionedAmount?: number | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  workStatus: CivicWorkStatus;
  department: {
    id: string;
    code: string;
    name: string;
  };
  contractorName?: string | null;
  physicalProgressPercentage: number;
  latestMilestone?: string | null;
  linkedComplaintsCount: number;
  inspectionsCount: number;
  createdAt: string;
}

export interface CivicProjectDetail extends CivicProjectItem {
  contractor?: {
    id: string;
    name: string;
    registrationNumber?: string | null;
  } | null;
  progressUpdates: Array<{
    id: string;
    updateDate: string;
    physicalProgressPercentage: number;
    financialProgressAmount?: number | null;
    progressNotes: string;
    milestoneReached?: string | null;
  }>;
  inspections: Array<{
    id: string;
    inspectionDate: string;
    outcome: string;
    observations: string;
    measurements?: string | null;
    notes?: string | null;
  }>;
  linkedComplaints: Array<{
    id: string;
    trackingId: string;
    title: string;
    status: ComplaintStatus;
    locality: string;
    categoryName: string;
    linkedNotes?: string | null;
  }>;
}
