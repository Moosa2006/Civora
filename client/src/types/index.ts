/**
 * Shared frontend types for Civora UI
 */

export type AppRoute =
  | '/'
  | '/map'
  | '/explore'
  | '/transparency'
  | '/engagement'
  | '/engagement/proposals/new'
  | '/report'
  | '/track'
  | '/my-complaints'
  | '/admin/complaints'
  | '/official/workspace'
  | '/notifications'
  | '/settings/notifications'
  | '/sla'
  | '/admin/moderation'
  | '/rules'
  | '/login'
  | '/register'
  | '/not-found';

export * from './sla';
export * from './evidence';
export * from './geo';
export * from './moderation';
export type { SupportedLocale, LocaleMetadata } from '../i18n';
export type { TextSizeOption, AccessibilityPreferences } from '../context/AccessibilityContext';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'REOPENED'
  | 'REJECTED'
  | 'CLOSED';

export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface CivicCategory {
  id: string;
  name: string;
  description: string;
  department: string;
  iconName?: string;
}

export interface ComplaintPreview {
  trackingId: string;
  title: string;
  category: string;
  locality: string;
  status: ComplaintStatus;
  submittedAt: string;
  updatedAt: string;
}
