import type { ComplaintStatus } from './index';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ComplaintCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  departmentId?: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface ComplaintStatusHistoryItem {
  id?: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus;
  changedById?: string;
  changedBy?: {
    id: string;
    name: string;
    role: string;
  };
  reasonOrRemarks?: string | null;
  createdAt: string;
}

export interface SiteInspectionItem {
  id: string;
  complaintId: string;
  inspectorId: string;
  inspector?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  inspectionDate: string;
  findings: string;
  measurementsOrReadings?: string | null;
  outcome: string;
  notes?: string | null;
  createdAt: string;
}

export interface OfficialProgressUpdate {
  id: string;
  complaintId: string;
  authorId: string;
  author?: {
    id: string;
    name: string;
    role: string;
  };
  departmentId?: string | null;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
  stageOrEvent: string;
  title: string;
  description: string;
  isInternal: boolean;
  actionDate?: string | null;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  complaintId?: string | null;
  inspectionId?: string | null;
  title: string;
  documentType: string;
  fileUrl: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  isPublic: boolean;
  sha256Checksum?: string | null;
  perceptualHash?: string | null;
  capturedAt?: string | null;
  browserCaptureTimestamp?: string | null;
  captureLatitude?: number | null;
  captureLongitude?: number | null;
  captureAccuracy?: number | null;
  isGpsVerified?: boolean;
  uploadedById?: string | null;
  uploadedBy?: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
}

export interface Complaint {
  id: string;
  trackingId: string;
  title: string;
  description: string;
  categoryId: string;
  category?: {
    id?: string;
    code: string;
    name: string;
  };
  priority: ComplaintPriority;
  status: ComplaintStatus;
  citizenId?: string | null;
  citizen?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  assignedDepartmentId?: string | null;
  assignedDepartment?: {
    id?: string;
    code: string;
    name: string;
  } | null;
  assignedOfficialId?: string | null;
  assignedOfficial?: {
    id?: string;
    name: string;
    email?: string;
  } | null;
  locationAddress: string;
  locality: string;
  ward?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  rejectionReason?: string | null;
  resolutionNotes?: string | null;
  reviewedAt?: string | null;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  verifiedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  aiAnalysisStatus?: string | null;
  aiRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'NEEDS_REVIEW' | null;
  aiRiskScore?: number | null;
  aiFindings?: {
    isConsistent?: boolean;
    relevanceScore?: number;
    visualCategory?: string;
    verificationSummary?: string;
    fraudIndicators?: string[];
    evidenceMatches?: any[];
    duplicateCandidates?: any[];
    exifDiscrepancy?: boolean;
    locationDiscrepancyKm?: number | null;
    timeDeltaHours?: number | null;
    error?: string;
  } | null;
  aiAnalyzedAt?: string | null;
  isDuplicate?: boolean;
  duplicateConfidence?: number | null;
  primaryComplaintId?: string | null;
  statusHistory?: ComplaintStatusHistoryItem[];
  timeline?: ComplaintStatusHistoryItem[];
  inspections?: SiteInspectionItem[];
  progressUpdates?: OfficialProgressUpdate[];
  documents?: EvidenceItem[];
}
