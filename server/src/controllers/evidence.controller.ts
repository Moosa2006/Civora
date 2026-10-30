import type { Request, Response, NextFunction } from 'express';
import {
  DocumentVisibility,
  DocumentCategory,
  EvidencePurpose,
  EvidenceReviewStatus,
  UserRole,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { StorageService } from '../lib/storageService.js';
import { NotificationService } from '../lib/notificationService.js';
import {
  uploadEvidenceMetadataSchema,
  reviewEvidenceSchema,
  quarantineEvidenceSchema,
  evidenceQuerySchema,
} from '../validation/evidence.validation.js';

function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Resolves a complaint by UUID or trackingId
 */
async function resolveComplaint(idOrTrackingId: string) {
  if (!idOrTrackingId || typeof idOrTrackingId !== 'string') {
    return null;
  }
  const cleanId = idOrTrackingId.trim();
  if (!cleanId || cleanId.toLowerCase() === 'undefined' || cleanId.toLowerCase() === 'null') {
    return null;
  }
  const isUuid = isValidUuid(cleanId);
  const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid
    ? { id: cleanId }
    : { trackingId: cleanId.toUpperCase() };

  return prisma.complaint.findUnique({
    where: whereClause,
    include: {
      assignedDepartment: true,
      assignedOfficial: true,
      citizen: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * 1. POST /api/evidence/complaints/:complaintId/upload
 * Securely uploads single or multiple evidence files to a complaint
 */
export async function uploadEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to upload evidence.' },
      });
    }

    const complaintIdParam = String(req.params.complaintId || '').trim();
    const complaint = await resolveComplaint(complaintIdParam);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // Role and Scope Authorization
    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;
    const isOwner = complaint.citizenId === req.user.id;

    if (!isAdmin && !isOfficial && !isOwner) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to attach evidence to this complaint.',
        },
      });
    }

    // Official department check
    if (isOfficial && !isAdmin) {
      const belongsToDept = req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssigned = req.user.id === complaint.assignedOfficialId;
      if (!belongsToDept && !isAssigned) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Officials can only upload evidence to complaints in their assigned department.',
          },
        });
      }
    }

    // Verify files were received
    const rawFiles: Express.Multer.File[] = [];
    if (req.file) {
      rawFiles.push(req.file);
    } else if (req.files && Array.isArray(req.files)) {
      rawFiles.push(...req.files);
    }

    if (rawFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES_UPLOADED', message: 'Please select at least one valid file to upload.' },
      });
    }

    // Validate metadata body
    const metaParse = uploadEvidenceMetadataSchema.safeParse(req.body);
    if (!metaParse.success) {
      const issue = metaParse.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid evidence metadata.',
          details: metaParse.error.flatten().fieldErrors,
        },
      });
    }

    let {
      evidencePurpose,
      documentCategory,
      visibility,
      description,
      siteInspectionId,
      replacedDocumentId,
    } = metaParse.data;

    // Citizens can ONLY upload CITIZEN_SUPPORTING evidence and it must be PUBLIC
    if (isOwner && !isOfficial && !isAdmin) {
      evidencePurpose = EvidencePurpose.CITIZEN_SUPPORTING;
      visibility = DocumentVisibility.PUBLIC;
    }

    // If replacement requested, verify previous document exists and belongs to this complaint
    let previousDoc = null;
    if (replacedDocumentId) {
      if (!isValidUuid(replacedDocumentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REPLACEMENT_ID',
            message: 'Referenced document to replace was not found on this complaint.',
          },
        });
      }
      previousDoc = await prisma.document.findFirst({
        where: { id: replacedDocumentId, complaintId: complaint.id },
      });
      if (!previousDoc) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REPLACEMENT_ID',
            message: 'Referenced document to replace was not found on this complaint.',
          },
        });
      }
    }

    // Process each file buffer securely
    const createdDocuments: any[] = [];

    for (const file of rawFiles) {
      // 1. Validate magic bytes and write to private disk storage
      let storeResult;
      try {
        storeResult = await StorageService.saveFile(
          file.buffer,
          file.originalname,
          complaint.id,
          file.mimetype
        );
      } catch (storageErr: any) {
        if (
          storageErr?.message?.includes('File signature mismatch') ||
          storageErr?.message?.includes('Unsupported file')
        ) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_FILE_SIGNATURE',
              message: storageErr.message,
            },
          });
        }
        throw storageErr;
      }

      // 2. Persist record in database atomically
      const doc = await prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            fileName: storeResult.sanitizedFileName,
            storageKey: storeResult.storageKey,
            mimeType: storeResult.mimeType,
            fileSize: BigInt(storeResult.fileSize),
            documentCategory,
            evidencePurpose,
            visibility,
            description: description || null,
            sha256Checksum: storeResult.sha256Checksum,
            reviewStatus: EvidenceReviewStatus.PENDING_REVIEW,
            uploaderId: req.user!.id,
            complaintId: complaint.id,
            siteInspectionId: siteInspectionId || null,
            replacedDocumentId: replacedDocumentId || null,
          },
          include: {
            uploader: {
              select: { id: true, name: true, role: true },
            },
          },
        });

        // 3. Create initial review log
        await tx.evidenceReviewLog.create({
          data: {
            documentId: created.id,
            reviewerId: req.user!.id,
            fromStatus: null,
            toStatus: EvidenceReviewStatus.PENDING_REVIEW,
            decisionReason: replacedDocumentId
              ? `Replacement evidence uploaded referencing document ${previousDoc?.fileName}`
              : 'Initial evidence upload submitted for verification.',
          },
        });

        // 4. Log audit event
        await tx.auditEvent.create({
          data: {
            entityType: 'COMPLAINT',
            entityId: complaint.id,
            action: 'EVIDENCE_UPLOADED',
            actorId: req.user!.id,
            details: {
              documentId: created.id,
              fileName: created.fileName,
              evidencePurpose: created.evidencePurpose,
              fileSize: Number(created.fileSize),
              sha256Checksum: created.sha256Checksum,
              uploaderName: req.user!.name,
              isReplacement: Boolean(replacedDocumentId),
            },
          },
        });

        return created;
      });

      // 5. Dispatch notification
      await NotificationService.notifyEvidenceUploaded(
        complaint,
        doc,
        req.user.role,
        req.user.name
      );

      createdDocuments.push({
        ...doc,
        fileSize: Number(doc.fileSize),
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded ${createdDocuments.length} evidence file(s).`,
      data: {
        complaintId: complaint.id,
        trackingId: complaint.trackingId,
        count: createdDocuments.length,
        evidence: createdDocuments,
        documents: createdDocuments,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 2. GET /api/evidence/complaints/:complaintId
 * Lists all evidence files attached to a complaint with role-based filtering
 */
export async function getComplaintEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    const complaintIdParam = String(req.params.complaintId || '').trim();
    const complaint = await resolveComplaint(complaintIdParam);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);
    const isOwner = req.user && complaint.citizenId === req.user.id;

    const whereClause: Prisma.DocumentWhereInput = {
      complaintId: complaint.id,
    };

    if (isStaff) {
      // Staff see all non-quarantined evidence (or quarantined if admin)
      if (req.user?.role !== UserRole.ADMIN) {
        whereClause.isQuarantined = false;
      }
    } else if (isOwner) {
      // Owner sees all their own evidence + public non-quarantined evidence
      whereClause.isQuarantined = false;
      whereClause.OR = [
        { uploaderId: req.user!.id },
        { visibility: DocumentVisibility.PUBLIC },
      ];
    } else {
      // Public viewers see only PUBLIC and non-quarantined evidence with its true review status
      whereClause.visibility = DocumentVisibility.PUBLIC;
      whereClause.isQuarantined = false;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: { id: true, name: true, role: true },
        },
        reviewedBy: {
          select: { id: true, name: true, role: true },
        },
        reviewLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: Number(doc.fileSize),
      documentCategory: doc.documentCategory,
      evidencePurpose: doc.evidencePurpose,
      visibility: doc.visibility,
      description: doc.description,
      sha256Checksum: doc.sha256Checksum,
      reviewStatus: doc.reviewStatus,
      reviewedAt: doc.reviewedAt,
      reviewedBy: isStaff || isOwner ? doc.reviewedBy : undefined,
      rejectionReason: isStaff || isOwner ? doc.rejectionReason : undefined,
      resubmissionGuidance: isStaff || isOwner ? doc.resubmissionGuidance : undefined,
      isQuarantined: isStaff ? doc.isQuarantined : undefined,
      uploader: {
        id: isStaff ? doc.uploader?.id : undefined,
        name: isStaff || isOwner
          ? (doc.uploader?.name || 'Citizen Contributor')
          : (doc.uploader?.role === 'CITIZEN' ? 'Citizen Contributor' : (doc.uploader?.name || 'Municipal Official')),
        role: doc.uploader?.role || 'CITIZEN',
      },
      createdAt: doc.createdAt,
      downloadUrl: `/api/evidence/${doc.id}/download`,
      fileUrl: `/api/evidence/${doc.id}/file`,
    }));

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.id,
        trackingId: complaint.trackingId,
        evidence: sanitized,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 3. GET /api/evidence/:id
 * Retrieves detailed evidence metadata
 */
export async function getEvidenceDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();

    if (!isValidUuid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        complaint: {
          select: {
            id: true,
            trackingId: true,
            title: true,
            citizenId: true,
            assignedDepartmentId: true,
          },
        },
        uploader: {
          select: { id: true, name: true, role: true },
        },
        reviewedBy: {
          select: { id: true, name: true, role: true },
        },
        reviewLogs: {
          include: {
            reviewer: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        replacedDocument: {
          select: { id: true, fileName: true, reviewStatus: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    // Permission check
    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);
    const isOwner = req.user && document.complaint?.citizenId === req.user.id;

    if (!isStaff && !isOwner && document.visibility !== DocumentVisibility.PUBLIC) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view this document.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        document: {
          ...document,
          fileSize: Number(document.fileSize),
          downloadUrl: `/api/evidence/${document.id}/download`,
          fileUrl: `/api/evidence/${document.id}/file`,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 4. GET /api/evidence/:id/file or /api/evidence/:id/download
 * Streams the physical evidence file with access-controlled authorization
 */
export async function downloadEvidenceFile(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();

    if (!isValidUuid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document record not found.' },
      });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        complaint: {
          select: {
            id: true,
            trackingId: true,
            citizenId: true,
            assignedDepartmentId: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document record not found.' },
      });
    }

    // Quarantine check: quarantined files can ONLY be downloaded by ADMIN
    if (document.isQuarantined && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EVIDENCE_QUARANTINED',
          message: 'This file has been quarantined by administrators and cannot be downloaded.',
        },
      });
    }

    // Access control
    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);
    const isOwner = req.user && document.complaint?.citizenId === req.user.id;
    const isUploader = req.user && document.uploaderId === req.user.id;

    if (!isStaff && !isOwner && !isUploader) {
      if (document.visibility !== DocumentVisibility.PUBLIC) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view or download this evidence file.',
          },
        });
      }
    }

    // Check physical file existence
    if (!StorageService.fileExists(document.storageKey)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND_ON_DISK',
          message: 'The physical file could not be located on the storage system.',
        },
      });
    }

    // Determine disposition: force attachment if dangerous or PDF; inline for images
    const isInlineImage = document.mimeType.startsWith('image/');
    const dispositionType = isInlineImage ? 'inline' : 'attachment';

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', String(document.fileSize));
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(document.fileName)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = StorageService.getFileStream(document.storageKey);
    stream.on('error', (err) => {
      console.error('[Download Stream Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_ERROR', message: 'Failed to stream evidence file.' },
        });
      }
    });

    stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

/**
 * 5. POST /api/evidence/:id/review
 * Authoritative evidence review (Approve, Reject, or Request Resubmission)
 */
export async function reviewEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to review evidence.' },
      });
    }

    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only municipal officials and administrators can review evidence.',
        },
      });
    }

    const id = String(req.params.id || '').trim();

    if (!isValidUuid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        complaint: {
          select: {
            id: true,
            trackingId: true,
            title: true,
            assignedDepartmentId: true,
            citizenId: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    // Department boundary check for officials
    if (isOfficial && !isAdmin) {
      if (req.user.departmentId !== document.complaint?.assignedDepartmentId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You cannot review evidence assigned to another municipal department.',
          },
        });
      }
    }

    const parseResult = reviewEvidenceSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid review parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { decision, reviewNotes, rejectionReason, resubmissionGuidance } = parseResult.data;
    const targetStatus = decision as EvidenceReviewStatus;
    const fromStatus = document.reviewStatus;

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update document review fields
      const doc = await tx.document.update({
        where: { id: document.id },
        data: {
          reviewStatus: targetStatus,
          reviewedById: req.user!.id,
          reviewedAt: now,
          reviewNotes: reviewNotes || null,
          rejectionReason: decision === 'REJECTED' ? rejectionReason : null,
          resubmissionGuidance: decision === 'RESUBMISSION_REQUESTED' ? resubmissionGuidance : null,
        },
        include: {
          reviewedBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // 2. Append immutable review log
      await tx.evidenceReviewLog.create({
        data: {
          documentId: document.id,
          reviewerId: req.user!.id,
          fromStatus,
          toStatus: targetStatus,
          decisionReason: decision === 'REJECTED' ? rejectionReason : reviewNotes || 'Evidence verified',
          guidance: decision === 'RESUBMISSION_REQUESTED' ? resubmissionGuidance : null,
          createdAt: now,
        },
      });

      // 3. Log AuditEvent
      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: document.complaint?.id || document.id,
          action: 'EVIDENCE_REVIEWED',
          actorId: req.user!.id,
          details: {
            documentId: document.id,
            fileName: document.fileName,
            fromStatus,
            toStatus: targetStatus,
            decision,
            reviewerName: req.user!.name,
            reason: decision === 'REJECTED' ? rejectionReason : reviewNotes,
          },
        },
      });

      return doc;
    });

    // 4. Dispatch notification to uploader
    if (document.complaint) {
      await NotificationService.notifyEvidenceReviewed(
        document.complaint,
        document,
        decision,
        decision === 'REJECTED' ? rejectionReason : resubmissionGuidance
      );
    }

    return res.status(200).json({
      success: true,
      message: `Evidence marked as ${targetStatus}.`,
      data: {
        document: {
          ...updated,
          fileSize: Number(updated.fileSize),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 6. POST /api/evidence/:id/quarantine
 * Administrators can quarantine suspicious or abusive uploads
 */
export async function quarantineEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only administrators can quarantine evidence files.' },
      });
    }

    const id = String(req.params.id || '').trim();

    if (!isValidUuid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { complaint: true },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evidence document not found.' },
      });
    }

    const parseResult = quarantineEvidenceSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid quarantine parameters.',
        },
      });
    }

    const { reason } = parseResult.data;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: {
          isQuarantined: true,
          quarantineReason: reason,
          reviewStatus: EvidenceReviewStatus.QUARANTINED,
          reviewedById: req.user!.id,
          reviewedAt: now,
        },
      });

      await tx.evidenceReviewLog.create({
        data: {
          documentId: document.id,
          reviewerId: req.user!.id,
          fromStatus: document.reviewStatus,
          toStatus: EvidenceReviewStatus.QUARANTINED,
          decisionReason: `Quarantined by administrator: ${reason}`,
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: document.complaint?.id || document.id,
          action: 'EVIDENCE_QUARANTINED',
          actorId: req.user!.id,
          details: {
            documentId: document.id,
            fileName: document.fileName,
            reason,
            adminName: req.user!.name,
          },
        },
      });

      return doc;
    });

    return res.status(200).json({
      success: true,
      message: 'Evidence document quarantined successfully.',
      data: {
        document: {
          ...updated,
          fileSize: Number(updated.fileSize),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 7. GET /api/evidence/pending-queue
 * Administrator and Reviewer queue for unverified evidence
 */
export async function getPendingReviewQueue(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Review queue is restricted to municipal staff.' },
      });
    }

    const parseResult = evidenceQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.' },
      });
    }

    const { page, limit, purpose, status, category, complaintId } = parseResult.data;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.DocumentWhereInput = {
      isQuarantined: false,
    };

    if (status) {
      whereClause.reviewStatus = status;
    } else {
      whereClause.reviewStatus = {
        in: [EvidenceReviewStatus.PENDING_REVIEW, EvidenceReviewStatus.UNDER_REVIEW],
      };
    }

    if (purpose) {
      whereClause.evidencePurpose = purpose;
    }

    if (category) {
      whereClause.documentCategory = category;
    }

    if (complaintId) {
      whereClause.complaintId = complaintId;
    }

    // Scoping for officials
    if (isOfficial && !isAdmin && req.user.departmentId) {
      whereClause.complaint = {
        assignedDepartmentId: req.user.departmentId,
      };
    }

    const [total, documents] = await Promise.all([
      prisma.document.count({ where: whereClause }),
      prisma.document.findMany({
        where: whereClause,
        include: {
          complaint: {
            select: {
              id: true,
              trackingId: true,
              title: true,
              priority: true,
              status: true,
              assignedDepartment: {
                select: { id: true, name: true },
              },
            },
          },
          uploader: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const sanitized = documents.map((doc) => ({
      ...doc,
      fileSize: Number(doc.fileSize),
      downloadUrl: `/api/evidence/${doc.id}/download`,
      fileUrl: `/api/evidence/${doc.id}/file`,
    }));

    return res.status(200).json({
      success: true,
      data: {
        documents: sanitized,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
