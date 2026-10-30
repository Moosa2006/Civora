import type { BadgeVariant, ComplaintStatus } from '../types';

/**
 * Utility to map complaint lifecycle status to an appropriate badge variant
 */
export function getStatusBadgeVariant(status: ComplaintStatus): BadgeVariant {
  switch (status) {
    case 'SUBMITTED':
      return 'info';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'ASSIGNED':
      return 'default';
    case 'IN_PROGRESS':
      return 'warning';
    case 'RESOLVED':
    case 'VERIFIED':
      return 'success';
    case 'REOPENED':
    case 'REJECTED':
      return 'danger';
    case 'CLOSED':
    default:
      return 'neutral';
  }
}
