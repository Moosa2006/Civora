export interface GeoComplaintMarker {
  id: string;
  trackingId: string;
  title: string;
  status: string;
  priority: string;
  locality: string;
  ward: string | null;
  latitude: number;
  longitude: number;
  isGeneralized: boolean;
  createdAt: string;
  resolvedAt?: string | null;
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
  distanceKm?: number;
}

export interface GeoHotspot {
  name: string;
  groupBy: 'ward' | 'locality';
  totalComplaints: number;
  activeComplaints: number;
  resolvedComplaints: number;
  overdueComplaints: number;
  resolutionRate: number;
  topCategory: string;
  topCategoryCount: number;
  latitude: number | null;
  longitude: number | null;
}

export interface KnownLocality {
  name: string;
  wardNumber: string;
  wardName: string;
  zone: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

export interface OfficialGeoSummary {
  department: { id: string; name: string; code: string } | null;
  totalGrievances: number;
  unassignedCount: number;
  totalOverdue: number;
  urgentActive: number;
  wardBreakdown: Array<{
    ward: string;
    total: number;
    active: number;
    overdue: number;
  }>;
}
