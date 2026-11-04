import type { UserRole } from '../types/auth';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  translationKey?: string;
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

export function normalizeUserRole(rawRole?: string | null): UserRole | null {
  if (!rawRole) return null;
  const upper = rawRole.toUpperCase().trim();
  if (
    upper === 'ADMIN' ||
    upper === 'SYSTEM_ADMINISTRATOR' ||
    upper === 'ADMINISTRATOR' ||
    upper === 'SYSADMIN' ||
    upper === 'SUPER_ADMIN'
  ) {
    return 'ADMIN';
  }
  if (
    upper === 'GOVERNMENT_OFFICIAL' ||
    upper === 'OFFICIAL' ||
    upper === 'GOV_OFFICIAL' ||
    upper === 'DEPARTMENT_ADMINISTRATOR' ||
    upper === 'DEPARTMENT_ADMIN' ||
    upper === 'DEPARTMENT_STAFF' ||
    upper === 'FIELD_OFFICER' ||
    upper === 'STAFF'
  ) {
    return 'GOVERNMENT_OFFICIAL';
  }
  if (upper === 'CONTRACTOR' || upper === 'VENDOR') {
    return 'CONTRACTOR';
  }
  if (upper === 'CITIZEN' || upper === 'RESIDENT' || upper === 'USER') {
    return 'CITIZEN';
  }
  return null;
}

/**
 * Get primary top-level navigation items for the given authenticated state and role.
 */
export function getRolePrimaryNav(role?: UserRole | string | null, isAuthenticated?: boolean): NavItem[] {
  const normalized = normalizeUserRole(role);
  if (!isAuthenticated || !normalized) {
    // Visitor / Public navigation aligned with Homepage standard
    return [
      { id: 'home', label: 'Home', path: '/', iconName: 'BuildingIcon', translationKey: 'nav.home' },
      { id: 'transparency', label: 'Transparency', path: '/transparency', iconName: 'EyeIcon', translationKey: 'nav.transparency' },
      { id: 'public-tenders', label: 'Tenders', path: '/tenders', iconName: 'FileTextIcon', translationKey: 'nav.publicTenders' },
      { id: 'engagement', label: 'Civic Engagement', path: '/engagement', iconName: 'VoteIcon', translationKey: 'nav.civicEngagement' },
      { id: 'about-civora', label: 'About Civora', path: '/#about', iconName: 'InfoIcon', translationKey: 'nav.aboutCivora' },
    ];
  }

  switch (normalized) {
    case 'CONTRACTOR':
      return [
        { id: 'contractor-dashboard', label: 'Dashboard', path: '/contractor', iconName: 'ActivityIcon', translationKey: 'nav.contractorDashboard' },
        { id: 'contractor-find-tenders', label: 'Find Tenders', path: '/tenders', iconName: 'SearchIcon', translationKey: 'nav.findTenders' },
        { id: 'contractor-my-bids', label: 'My Bids', path: '/contractor?tab=bids', iconName: 'FileTextIcon', translationKey: 'nav.myBids' },
        { id: 'contractor-work-orders', label: 'Work Orders', path: '/contractor?tab=work_orders', iconName: 'CheckCircleIcon', translationKey: 'nav.workOrders' },
        { id: 'transparency', label: 'Civic Works', path: '/transparency?tab=projects', iconName: 'EyeIcon', translationKey: 'nav.civicWorks' },
      ];

    case 'GOVERNMENT_OFFICIAL':
      return [
        { id: 'official-workspace', label: 'Field Operations', path: '/official/workspace', iconName: 'ShieldCheckIcon', translationKey: 'nav.fieldOps' },
        { id: 'official-complaints', label: 'Complaints Queue', path: '/admin/complaints', iconName: 'FileTextIcon', translationKey: 'nav.complaintsQueue' },
        { id: 'official-tenders', label: 'Tenders & Awards', path: '/admin/tenders', iconName: 'FileTextIcon', translationKey: 'nav.tendersAndAwards' },
        { id: 'official-sla', label: 'SLA Escalations', path: '/sla', iconName: 'ClockIcon', translationKey: 'nav.slaEscalations' },
        { id: 'transparency', label: 'Transparency', path: '/transparency', iconName: 'EyeIcon', translationKey: 'nav.transparency' },
        { id: 'civic-map', label: 'Civic Map', path: '/map', iconName: 'MapPinIcon', translationKey: 'nav.civicMap' },
      ];

    case 'ADMIN':
      return [
        { id: 'admin-complaints', label: 'Triage Dashboard', path: '/admin/complaints', iconName: 'FileTextIcon', translationKey: 'nav.triageDashboard' },
        { id: 'official-tenders', label: 'Tenders & Awards', path: '/admin/tenders', iconName: 'FileTextIcon', translationKey: 'nav.tendersAndAwards' },
        { id: 'admin-system', label: 'System & Health', path: '/admin/system', iconName: 'ServerIcon', translationKey: 'nav.systemHealth' },
        { id: 'official-sla', label: 'SLA Management', path: '/sla', iconName: 'ClockIcon', translationKey: 'nav.slaManagement' },
        { id: 'transparency', label: 'Transparency', path: '/transparency', iconName: 'EyeIcon', translationKey: 'nav.transparency' },
        { id: 'civic-map', label: 'Civic Map', path: '/map', iconName: 'MapPinIcon', translationKey: 'nav.civicMap' },
      ];

    case 'CITIZEN':
    default:
      return [
        { id: 'home', label: 'Home', path: '/', iconName: 'BuildingIcon', translationKey: 'nav.home' },
        { id: 'report-issue', label: 'Report Issue', path: '/report', iconName: 'PlusIcon', translationKey: 'nav.reportIssue' },
        { id: 'my-complaints', label: 'My Complaints', path: '/my-complaints', iconName: 'FileTextIcon', translationKey: 'nav.myComplaints' },
        { id: 'transparency', label: 'Transparency', path: '/transparency', iconName: 'EyeIcon', translationKey: 'nav.transparency' },
        { id: 'engagement', label: 'Civic Engagement', path: '/engagement', iconName: 'VoteIcon', translationKey: 'nav.civicEngagement' },
      ];
  }
}

/**
 * Get dropdown / secondary items for roles that have grouped menus.
 */
export function getRoleSecondaryNav(role?: UserRole | string | null, isAuthenticated?: boolean): NavItem[] {
  const normalized = normalizeUserRole(role);
  if (!isAuthenticated || !normalized) {
    return [
      { id: 'civic-map', label: 'Civic Map', path: '/map', iconName: 'MapPinIcon', translationKey: 'nav.civicMap' },
      { id: 'track-complaint', label: 'Track Complaint', path: '/track', iconName: 'SearchIcon', translationKey: 'nav.trackComplaint' },
    ];
  }

  switch (normalized) {
    case 'CONTRACTOR':
      return [
        { id: 'contractor-work-start', label: 'Work-Start Declarations', path: '/contractor?tab=work_start', iconName: 'CheckIcon', translationKey: 'nav.workStart' },
        { id: 'contractor-milestones', label: 'Milestones & Claims', path: '/contractor?tab=milestones', iconName: 'ClockIcon', translationKey: 'nav.milestones' },
        { id: 'contractor-payments', label: 'Payment Ledger', path: '/contractor?tab=payments', iconName: 'DownloadIcon', translationKey: 'nav.paymentLedger' },
        { id: 'contractor-defects', label: 'Warranty & Defects', path: '/contractor?tab=defects', iconName: 'AlertTriangleIcon', translationKey: 'nav.warrantyDefects' },
      ];

    case 'GOVERNMENT_OFFICIAL':
      return [
        { id: 'engagement', label: 'Civic Engagement', path: '/engagement', iconName: 'VoteIcon', translationKey: 'nav.civicEngagement' },
        { id: 'public-tenders-view', label: 'Public Tenders Portal', path: '/tenders', iconName: 'FileTextIcon', translationKey: 'nav.publicTendersPortal' },
      ];

    case 'ADMIN':
      return [
        { id: 'admin-moderation', label: 'Content Moderation', path: '/admin/moderation', iconName: 'ShieldCheckIcon', translationKey: 'nav.moderation' },
        { id: 'official-workspace', label: 'Field Operations', path: '/official/workspace', iconName: 'ShieldCheckIcon', translationKey: 'nav.fieldOps' },
        { id: 'engagement', label: 'Civic Engagement', path: '/engagement', iconName: 'VoteIcon', translationKey: 'nav.civicEngagement' },
        { id: 'public-tenders-view', label: 'Public Tenders Portal', path: '/tenders', iconName: 'FileTextIcon', translationKey: 'nav.publicTendersPortal' },
      ];

    case 'CITIZEN':
      return [
        { id: 'public-tenders-view', label: 'Public Tenders', path: '/tenders', iconName: 'FileTextIcon', translationKey: 'nav.publicTenders' },
        { id: 'civic-map', label: 'Civic Map', path: '/map', iconName: 'MapPinIcon', translationKey: 'nav.civicMap' },
        { id: 'track-complaint', label: 'Track Complaint', path: '/track', iconName: 'SearchIcon', translationKey: 'nav.trackComplaint' },
      ];

    default:
      return [];
  }
}

/**
 * Get default home/landing page based on user role.
 */
export function getRoleLandingPage(role?: UserRole | string | null): string {
  const normalized = normalizeUserRole(role);
  if (!normalized) return '/';
  switch (normalized) {
    case 'CONTRACTOR':
      return '/contractor';
    case 'GOVERNMENT_OFFICIAL':
      return '/official/workspace';
    case 'ADMIN':
      return '/admin/complaints';
    case 'CITIZEN':
    default:
      return '/my-complaints';
  }
}
