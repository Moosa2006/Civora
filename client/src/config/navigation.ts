import type { UserRole } from '../types/auth';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconName?: string;
  roles?: UserRole[] | null; // null or undefined means public / all roles
  placement?: 'primary' | 'secondary' | 'dropdown' | 'action';
  group?: 'citizen' | 'official' | 'admin' | 'contractor' | 'public' | 'operations';
  description?: string;
  badge?: string;
}

export interface NavDropdownGroup {
  id: string;
  label: string;
  iconName?: string;
  roles: UserRole[];
  items: NavItem[];
}

/**
 * Master navigation catalog for Civora.
 * Defines permitted roles, primary bar placement, and grouping.
 */
export const NAVIGATION_CATALOG: NavItem[] = [
  // --- Public & Citizen Shared Destinations ---
  {
    id: 'home',
    label: 'Home',
    path: '/',
    iconName: 'BuildingIcon',
    roles: null,
    placement: 'primary',
    group: 'public',
  },
  {
    id: 'report-issue',
    label: 'Report Issue',
    path: '/report',
    iconName: 'PlusIcon',
    roles: ['CITIZEN'],
    placement: 'primary',
    group: 'citizen',
  },
  {
    id: 'my-complaints',
    label: 'My Complaints',
    path: '/my-complaints',
    iconName: 'FileTextIcon',
    roles: ['CITIZEN'],
    placement: 'primary',
    group: 'citizen',
  },
  {
    id: 'track-complaint',
    label: 'Track',
    path: '/track',
    iconName: 'SearchIcon',
    roles: ['CITIZEN'],
    placement: 'primary',
    group: 'citizen',
  },
  {
    id: 'transparency',
    label: 'Transparency',
    path: '/transparency',
    iconName: 'EyeIcon',
    roles: ['CITIZEN', 'GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'primary',
    group: 'public',
  },
  {
    id: 'civic-map',
    label: 'Civic Map',
    path: '/map',
    iconName: 'MapPinIcon',
    roles: ['CITIZEN', 'GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'primary',
    group: 'public',
  },
  {
    id: 'engagement',
    label: 'Engagement',
    path: '/engagement',
    iconName: 'VoteIcon',
    roles: ['CITIZEN', 'GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'primary',
    group: 'public',
  },

  // --- Public Tenders (Visible to Visitors, Citizens, and Contractors) ---
  {
    id: 'public-tenders',
    label: 'Tenders',
    path: '/tenders',
    iconName: 'FileTextIcon',
    roles: null, // Visible to all, but placed distinctly per role
    placement: 'primary',
    group: 'public',
  },

  // --- Contractor-Specific Portal Links ---
  {
    id: 'contractor-dashboard',
    label: 'Dashboard',
    path: '/contractor',
    iconName: 'ActivityIcon',
    roles: ['CONTRACTOR'],
    placement: 'primary',
    group: 'contractor',
  },
  {
    id: 'contractor-find-tenders',
    label: 'Find Tenders',
    path: '/tenders',
    iconName: 'SearchIcon',
    roles: ['CONTRACTOR'],
    placement: 'primary',
    group: 'contractor',
  },
  {
    id: 'contractor-my-bids',
    label: 'My Bids',
    path: '/contractor?tab=bids',
    iconName: 'FileTextIcon',
    roles: ['CONTRACTOR'],
    placement: 'primary',
    group: 'contractor',
  },
  {
    id: 'contractor-work-orders',
    label: 'Work Orders',
    path: '/contractor?tab=work_orders',
    iconName: 'CheckCircleIcon',
    roles: ['CONTRACTOR'],
    placement: 'primary',
    group: 'contractor',
  },
  {
    id: 'contractor-milestones',
    label: 'Milestones & Progress',
    path: '/contractor?tab=milestones',
    iconName: 'ClockIcon',
    roles: ['CONTRACTOR'],
    placement: 'dropdown',
    group: 'contractor',
  },
  {
    id: 'contractor-work-start',
    label: 'Work-Start Declarations',
    path: '/contractor?tab=work_start',
    iconName: 'CheckIcon',
    roles: ['CONTRACTOR'],
    placement: 'dropdown',
    group: 'contractor',
  },
  {
    id: 'contractor-payments',
    label: 'Payment Ledger',
    path: '/contractor?tab=payments',
    iconName: 'DownloadIcon',
    roles: ['CONTRACTOR'],
    placement: 'dropdown',
    group: 'contractor',
  },
  {
    id: 'contractor-defects',
    label: 'Warranty & Defects',
    path: '/contractor?tab=defects',
    iconName: 'AlertTriangleIcon',
    roles: ['CONTRACTOR'],
    placement: 'dropdown',
    group: 'contractor',
  },

  // --- Official & Admin Operational Links ---
  {
    id: 'official-workspace',
    label: 'Official Dashboard',
    path: '/official/workspace',
    iconName: 'ShieldCheckIcon',
    roles: ['GOVERNMENT_OFFICIAL'],
    placement: 'primary',
    group: 'official',
  },
  {
    id: 'official-complaints',
    label: 'Complaints Queue',
    path: '/admin/complaints',
    iconName: 'FileTextIcon',
    roles: ['GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'primary',
    group: 'official',
  },
  {
    id: 'official-tenders',
    label: 'Tenders & Awards',
    path: '/admin/tenders',
    iconName: 'FileTextIcon',
    roles: ['GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'primary',
    group: 'official',
  },
  {
    id: 'admin-system',
    label: 'System & Health',
    path: '/admin/system',
    iconName: 'ServerIcon',
    roles: ['ADMIN'],
    placement: 'dropdown',
    group: 'admin',
  },
  {
    id: 'admin-moderation',
    label: 'Moderation Queue',
    path: '/admin/moderation',
    iconName: 'ShieldCheckIcon',
    roles: ['ADMIN'],
    placement: 'dropdown',
    group: 'admin',
  },
  {
    id: 'official-sla',
    label: 'SLA Escalations',
    path: '/sla',
    iconName: 'ClockIcon',
    roles: ['GOVERNMENT_OFFICIAL', 'ADMIN'],
    placement: 'dropdown',
    group: 'operations',
  },
];

/**
 * Get primary top-level navigation items for the given authenticated state and role.
 */
export function getRolePrimaryNav(role?: UserRole | null, isAuthenticated?: boolean): NavItem[] {
  if (!isAuthenticated || !role) {
    // Visitor / Public navigation
    return [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'transparency', label: 'Transparency', path: '/transparency' },
      { id: 'public-tenders', label: 'Tenders', path: '/tenders' },
      { id: 'civic-map', label: 'Civic Map', path: '/map' },
      { id: 'track-complaint', label: 'Track Complaint', path: '/track' },
      { id: 'engagement', label: 'Engagement', path: '/engagement' },
    ];
  }

  switch (role) {
    case 'CONTRACTOR':
      return [
        { id: 'contractor-dashboard', label: 'Dashboard', path: '/contractor' },
        { id: 'contractor-find-tenders', label: 'Find Tenders', path: '/tenders' },
        { id: 'contractor-my-bids', label: 'My Bids', path: '/contractor?tab=bids' },
        { id: 'contractor-work-orders', label: 'Work Orders', path: '/contractor?tab=work_orders' },
        { id: 'transparency', label: 'Civic Works', path: '/transparency?tab=projects' },
      ];

    case 'GOVERNMENT_OFFICIAL':
      return [
        { id: 'official-workspace', label: 'Field Operations', path: '/official/workspace' },
        { id: 'official-complaints', label: 'Complaints', path: '/admin/complaints' },
        { id: 'official-tenders', label: 'Tenders & Awards', path: '/admin/tenders' },
        { id: 'transparency', label: 'Transparency', path: '/transparency' },
        { id: 'civic-map', label: 'Civic Map', path: '/map' },
      ];

    case 'ADMIN':
      return [
        { id: 'admin-complaints', label: 'Triage Dashboard', path: '/admin/complaints' },
        { id: 'official-tenders', label: 'Tenders & Awards', path: '/admin/tenders' },
        { id: 'transparency', label: 'Transparency', path: '/transparency' },
        { id: 'civic-map', label: 'Civic Map', path: '/map' },
      ];

    case 'CITIZEN':
    default:
      return [
        { id: 'home', label: 'Home', path: '/' },
        { id: 'report-issue', label: 'Report Issue', path: '/report' },
        { id: 'my-complaints', label: 'My Complaints', path: '/my-complaints' },
        { id: 'track-complaint', label: 'Track', path: '/track' },
        { id: 'transparency', label: 'Transparency', path: '/transparency' },
        { id: 'civic-map', label: 'Civic Map', path: '/map' },
        { id: 'engagement', label: 'Engagement', path: '/engagement' },
      ];
  }
}

/**
 * Get dropdown / secondary items for roles that have grouped menus.
 */
export function getRoleSecondaryNav(role?: UserRole | null, isAuthenticated?: boolean): NavItem[] {
  if (!isAuthenticated || !role) return [];

  switch (role) {
    case 'CONTRACTOR':
      return [
        { id: 'contractor-work-start', label: 'Work-Start Declarations', path: '/contractor?tab=work_start' },
        { id: 'contractor-milestones', label: 'Milestones & Claims', path: '/contractor?tab=milestones' },
        { id: 'contractor-payments', label: 'Payment Ledger', path: '/contractor?tab=payments' },
        { id: 'contractor-defects', label: 'Warranty & Defects', path: '/contractor?tab=defects' },
      ];

    case 'GOVERNMENT_OFFICIAL':
      return [
        { id: 'official-sla', label: 'SLA Escalations', path: '/sla' },
        { id: 'engagement', label: 'Civic Engagement', path: '/engagement' },
        { id: 'public-tenders-view', label: 'Public Tenders Portal', path: '/tenders' },
      ];

    case 'ADMIN':
      return [
        { id: 'admin-system', label: 'Platform & System Health', path: '/admin/system' },
        { id: 'admin-moderation', label: 'Content Moderation', path: '/admin/moderation' },
        { id: 'official-sla', label: 'SLA Management', path: '/sla' },
        { id: 'official-workspace', label: 'Field Operations', path: '/official/workspace' },
        { id: 'engagement', label: 'Civic Engagement', path: '/engagement' },
        { id: 'public-tenders-view', label: 'Public Tenders Portal', path: '/tenders' },
      ];

    default:
      return [];
  }
}

/**
 * Get default home/landing page based on user role.
 */
export function getRoleLandingPage(role?: UserRole | null): string {
  if (!role) return '/';
  switch (role) {
    case 'CONTRACTOR':
      return '/contractor';
    case 'GOVERNMENT_OFFICIAL':
      return '/official/workspace';
    case 'ADMIN':
      return '/admin/complaints';
    case 'CITIZEN':
    default:
      return '/';
  }
}
