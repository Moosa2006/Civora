/**
 * Civora Module 12: Evidence and Document Management Types
 */

export type EvidencePurpose =
  | 'CITIZEN_SUPPORTING'
  | 'OFFICIAL_PROGRESS'
  | 'RESOLUTION_PROOF'
  | 'ADMINISTRATIVE_REVIEW';

export type EvidenceReviewStatus =
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUESTED'
  | 'QUARANTINED';

export interface EvidenceDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentCategory: string;
  evidencePurpose: EvidencePurpose;
  visibility: 'CITIZEN_CONFIDENTIAL' | 'OFFICIAL_INTERNAL' | 'PUBLIC';
  description: string | null;
  sha256Checksum: string | null;
  reviewStatus: EvidenceReviewStatus;
  reviewedAt: string | null;
  reviewedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  rejectionReason?: string | null;
  resubmissionGuidance?: string | null;
  isQuarantined?: boolean;
  quarantineReason?: string | null;
  uploader?: {
    id?: string;
    name: string;
    role: string;
  };
  createdAt: string;
  downloadUrl: string;
  fileUrl: string;
  complaint?: {
    id: string;
    trackingId: string;
    title: string;
    priority?: string;
    status?: string;
    assignedDepartment?: {
      id: string;
      name: string;
    } | null;
  };
  reviewLogs?: EvidenceReviewLog[];
  replacedDocument?: {
    id: string;
    fileName: string;
    reviewStatus: EvidenceReviewStatus;
  } | null;
}

export interface EvidenceReviewLog {
  id: string;
  documentId: string;
  reviewerId: string;
  fromStatus: EvidenceReviewStatus;
  toStatus: EvidenceReviewStatus;
  decisionReason: string;
  guidance: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface EvidenceUploadResponse {
  success: boolean;
  message: string;
  data: {
    complaintId: string;
    trackingId: string;
    count: number;
    evidence: EvidenceDocument[];
  };
}

export interface EvidenceListResponse {
  success: boolean;
  data: {
    complaintId: string;
    trackingId: string;
    evidence: EvidenceDocument[];
  };
}

export interface PendingQueueResponse {
  success: boolean;
  data: {
    documents: EvidenceDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
