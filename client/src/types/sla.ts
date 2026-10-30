export type SlaStatus =
  | 'ON_TRACK'
  | 'APPROACHING_DEADLINE'
  | 'RESPONSE_OVERDUE'
  | 'RESOLUTION_OVERDUE'
  | 'BOTH_OVERDUE'
  | 'PAUSED'
  | 'RESOLVED_ON_TIME'
  | 'RESOLVED_LATE'
  | 'NO_CONFIGURED_SLA';

export type EscalationLevel = 'LEVEL_1_OFFICIAL' | 'LEVEL_2_SUPERVISOR' | 'LEVEL_3_HEAD_ADMIN';

export type EscalationStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'ACTION_PLANNED' | 'RESOLVED' | 'DISMISSED';

export type EscalationTrigger =
  | 'RESPONSE_DEADLINE_MISSED'
  | 'RESOLUTION_DEADLINE_MISSED'
  | 'APPROACHING_DEADLINE_INACTIVITY'
  | 'MANUAL_SUPERVISOR_ESCALATION'
  | 'REPEATED_CITIZEN_REOPEN';

export type ExtensionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SlaPolicy {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    code: string;
    name: string;
  } | null;
  priority?: string | null;
  responseTargetHours: number;
  resolutionTargetHours: number;
  warningThresholdHours: number;
  escalationThresholdHours: number;
  isActive: boolean;
  isDefault: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count?: {
    complaintSlas: number;
  };
}

export interface ComplaintSla {
  id: string;
  complaintId: string;
  policyId?: string | null;
  policyName: string;
  responseTargetHours: number;
  resolutionTargetHours: number;
  clockStartedAt: string;
  originalResponseDeadline: string;
  originalResolutionDeadline: string;
  currentResponseDeadline: string;
  currentResolutionDeadline: string;
  firstResponseAt?: string | null;
  isResponseOverdue: boolean;
  resolutionAt?: string | null;
  isResolutionOverdue: boolean;
  slaStatus: SlaStatus;
  estimatedCompletionDate?: string | null;
  estimatedCompletionNotes?: string | null;
  policy?: SlaPolicy | null;
}

export interface EscalationActionLog {
  id: string;
  escalationId: string;
  actorId: string;
  actor?: {
    id: string;
    name: string;
    role: string;
  };
  action: string;
  notes?: string | null;
  createdAt: string;
}

export interface ComplaintEscalation {
  id: string;
  complaintId: string;
  complaint?: {
    id: string;
    trackingId: string;
    title: string;
    status: string;
    priority?: string;
    assignedDepartment?: { id: string; name: string } | null;
    assignedOfficial?: { id: string; name: string; email?: string } | null;
    sla?: ComplaintSla | null;
  };
  escalationLevel: EscalationLevel;
  triggerReason: EscalationTrigger;
  status: EscalationStatus;
  notes?: string | null;
  isSystemGenerated: boolean;
  acknowledgedById?: string | null;
  acknowledgedBy?: { id: string; name: string } | null;
  acknowledgedAt?: string | null;
  actionPlan?: string | null;
  actionPlanRecordedById?: string | null;
  actionPlanRecordedAt?: string | null;
  resolvedById?: string | null;
  resolvedBy?: { id: string; name: string } | null;
  resolvedAt?: string | null;
  resolutionReason?: string | null;
  actionLogs?: EscalationActionLog[];
  createdAt: string;
  updatedAt: string;
}

export interface SlaExtensionRequest {
  id: string;
  complaintId: string;
  complaint?: {
    id: string;
    trackingId: string;
    title: string;
    status: string;
    assignedDepartment?: { id: string; name: string } | null;
  };
  complaintSlaId: string;
  requestedByOfficialId: string;
  requestedByOfficial?: {
    id: string;
    name: string;
    email: string;
  };
  previousResolutionDeadline: string;
  requestedResolutionDeadline: string;
  reason: string;
  status: ExtensionRequestStatus;
  decisionById?: string | null;
  decisionBy?: {
    id: string;
    name: string;
  } | null;
  decisionNotes?: string | null;
  decisionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentScorecard {
  id: string;
  code: string;
  name: string;
  totalAssigned: number;
  resolvedOnTime: number;
  resolvedLate: number;
  complianceRate: number;
  activeOverdue: number;
}

export interface SlaAccountabilitySummary {
  totalWithSla: number;
  totalResolved: number;
  resolvedOnTime: number;
  resolvedLate: number;
  complianceRate: number;
  activeOverdue: number;
  approaching: number;
  activeEscalations: number;
}

export interface CitizenSlaView {
  policyName?: string;
  clockStartedAt?: string;
  responseDeadline?: string;
  resolutionDeadline?: string;
  isOverdue?: boolean;
  slaStatus?: SlaStatus;
  estimatedCompletionDate?: string;
  estimatedCompletionNotes?: string;
}
