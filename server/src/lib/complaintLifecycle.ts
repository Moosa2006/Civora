import { ComplaintStatus } from '@prisma/client';

export const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.SUBMITTED]: [
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.UNDER_REVIEW]: [
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.ASSIGNED]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.IN_PROGRESS]: [
    ComplaintStatus.RESOLVED,
    ComplaintStatus.UNDER_REVIEW,
  ],
  [ComplaintStatus.RESOLVED]: [
    ComplaintStatus.VERIFIED,
    ComplaintStatus.REOPENED,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.VERIFIED]: [
    ComplaintStatus.CLOSED,
    ComplaintStatus.REOPENED,
  ],
  [ComplaintStatus.REOPENED]: [
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
  ],
  [ComplaintStatus.REJECTED]: [
    ComplaintStatus.REOPENED,
  ],
  [ComplaintStatus.CLOSED]: [
    ComplaintStatus.REOPENED,
  ],
};

export function isValidStatusTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  if (from === to) return true; // No-op transition
  const allowedNext = VALID_STATUS_TRANSITIONS[from];
  return !!allowedNext && allowedNext.includes(to);
}
