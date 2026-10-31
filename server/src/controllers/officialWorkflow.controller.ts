import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import {
  ComplaintStatus,
  UserRole,
  DocumentVisibility,
  DocumentCategory,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { isValidStatusTransition } from '../lib/complaintLifecycle.js';
import {
  progressUpdateSchema,
  inspectionSchema,
  evidenceMetadataSchema,
  submitResolutionSchema,
  verifyResolutionSchema,
  reopenComplaintSchema,
} from '../validation/officialWorkflow.validation.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * Helper to resolve complaint by ID or trackingId and verify actor permissions
 */
async function resolveComplaint(idOrTrackingId: string) {
  if (!idOrTrackingId || typeof idOrTrackingId !== 'string') {
    return null;
  }
  const cleanId = idOrTrackingId.trim();
  if (!cleanId || cleanId.toLowerCase() === 'undefined' || cleanId.toLowerCase() === 'null') {
    return null;
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid
    ? { id: cleanId }
    : { trackingId: cleanId.toUpperCase() };

  return prisma.complaint.findUnique({
    where: whereClause,
    include: {
      category: true,
      assignedDepartment: true,
      assignedOfficial: true,
      citizen: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * 1. POST /api/complaints/:id/progress
 * Record official progress update (Department officials & Admins)
 */
export async function createProgressUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // Role verification
    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Citizens cannot create official progress records.',
        },
      });
    }

    // Department boundary check for officials
    if (isOfficial) {
      const belongsToDepartment =
        req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssignedOfficial = req.user.id === complaint.assignedOfficialId;

      if (!belongsToDepartment && !isAssignedOfficial) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to update complaints outside your assigned department.',
          },
        });
      }
    }

    const parseResult = progressUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid progress update data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { title, description, stage, estimatedNextActionDate, visibility } = parseResult.data;

    // Auto-advance status from ASSIGNED to IN_PROGRESS if applicable
    let statusAdvanced = false;
    let oldStatus = complaint.status;
    let targetStatus = complaint.status;

    if (complaint.status === ComplaintStatus.ASSIGNED) {
      targetStatus = ComplaintStatus.IN_PROGRESS;
      statusAdvanced = true;
    }

    const now = new Date();
    const progressEvent = await prisma.$transaction(async (tx) => {
      // 1. Log AuditEvent representing the official progress record
      const audit = await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'OFFICIAL_PROGRESS_UPDATE',
          actorId: req.user!.id,
          details: {
            title,
            description,
            stage: stage || 'FIELD_WORK',
            estimatedNextActionDate: estimatedNextActionDate ? new Date(estimatedNextActionDate).toISOString() : null,
            visibility: visibility || DocumentVisibility.PUBLIC,
            departmentId: complaint.assignedDepartmentId,
            departmentName: complaint.assignedDepartment?.name || 'Municipal Works',
            officialName: req.user!.name,
          },
        },
        include: {
          actor: {
            select: { id: true, name: true, role: true, department: true },
          },
        },
      });

      // 2. If advancing to IN_PROGRESS, record in status history and complaint
      if (statusAdvanced) {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: {
            status: targetStatus,
            updatedAt: now,
          },
        });

        await tx.complaintStatusHistory.create({
          data: {
            complaintId: complaint.id,
            fromStatus: oldStatus,
            toStatus: targetStatus,
            changedById: req.user!.id,
            reasonOrRemarks: `Progress update logged: "${title}" - Work commenced.`,
          },
        });
      } else {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: { updatedAt: now },
        });
      }

      return audit;
    });

    // Module 9: If progress update is public, notify citizen
    if ((visibility || DocumentVisibility.PUBLIC) === DocumentVisibility.PUBLIC) {
      await NotificationService.notifyProgressUpdate(complaint, title, stage || 'FIELD_WORK');
    }

    return res.status(201).json({
      success: true,
      message: 'Official progress update recorded successfully.',
      data: {
        progressUpdate: {
          id: progressEvent.id,
          complaintId: complaint.id,
          title,
          description,
          stage: stage || 'FIELD_WORK',
          estimatedNextActionDate: estimatedNextActionDate || null,
          visibility: visibility || DocumentVisibility.PUBLIC,
          createdAt: progressEvent.createdAt,
          official: {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role,
            department: complaint.assignedDepartment?.name || null,
          },
        },
        newStatus: targetStatus,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 2. GET /api/complaints/:id/progress
 * Retrieve progress history for a complaint
 */
export async function getProgressUpdates(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // Determine viewer permission: staff sees all, others see only PUBLIC
    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    const auditRecords = await prisma.auditEvent.findMany({
      where: {
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        action: 'OFFICIAL_PROGRESS_UPDATE',
      },
      include: {
        actor: {
          select: { id: true, name: true, role: true, department: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const progressUpdates = auditRecords
      .map((record) => {
        const details = (record.details as any) || {};
        return {
          id: record.id,
          complaintId: complaint.id,
          title: details.title || 'Official Progress Update',
          description: details.description || '',
          stage: details.stage || 'GENERAL_UPDATE',
          estimatedNextActionDate: details.estimatedNextActionDate || null,
          visibility: details.visibility || DocumentVisibility.PUBLIC,
          createdAt: record.createdAt,
          official: {
            id: record.actor?.id,
            name: record.actor?.name || 'Municipal Official',
            role: record.actor?.role,
            department: details.departmentName || record.actor?.department?.name,
          },
        };
      })
      .filter((update) => {
        if (isStaff) return true;
        return update.visibility === DocumentVisibility.PUBLIC;
      });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.id,
        trackingId: complaint.trackingId,
        progressUpdates,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 3. POST /api/complaints/:id/inspections
 * Record site inspection findings (Officials & Admins)
 */
export async function createInspection(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Citizens cannot record official site inspections.',
        },
      });
    }

    // Official department check
    if (isOfficial) {
      const belongsToDepartment =
        req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssignedOfficial = req.user.id === complaint.assignedOfficialId;

      if (!belongsToDepartment && !isAssignedOfficial) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to inspect complaints assigned to another department.',
          },
        });
      }
    }

    const parseResult = inspectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid inspection data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { outcome, observations, measurements, notes, inspectionDate } = parseResult.data;

    const inspection = await prisma.$transaction(async (tx) => {
      const rec = await tx.siteInspection.create({
        data: {
          complaintId: complaint.id,
          inspectorId: req.user!.id,
          outcome,
          observations,
          measurements: measurements || null,
          notes: notes || null,
          inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
        },
        include: {
          inspector: {
            select: { id: true, name: true, role: true, department: true },
          },
        },
      });

      // Log audit event
      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'INSPECTION_RECORDED',
          actorId: req.user!.id,
          details: {
            inspectionId: rec.id,
            outcome,
            observationsSummary: observations.substring(0, 150),
          },
        },
      });

      // Advance status to IN_PROGRESS if currently ASSIGNED
      if (complaint.status === ComplaintStatus.ASSIGNED) {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: { status: ComplaintStatus.IN_PROGRESS },
        });

        await tx.complaintStatusHistory.create({
          data: {
            complaintId: complaint.id,
            fromStatus: ComplaintStatus.ASSIGNED,
            toStatus: ComplaintStatus.IN_PROGRESS,
            changedById: req.user!.id,
            reasonOrRemarks: `On-site inspection completed with outcome: ${outcome}.`,
          },
        });
      }

      return rec;
    });

    return res.status(201).json({
      success: true,
      message: 'Site inspection recorded successfully.',
      data: {
        inspection,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 4. GET /api/complaints/:id/inspections
 * List inspection records for a complaint
 */
export async function getInspections(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    const inspections = await prisma.siteInspection.findMany({
      where: { complaintId: complaint.id },
      include: {
        inspector: {
          select: { id: true, name: true, role: true, department: true },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            documentCategory: true,
            visibility: true,
            createdAt: true,
          },
        },
      },
      orderBy: { inspectionDate: 'desc' },
    });

    // Sanitize internal notes for non-staff viewers
    const sanitized = inspections.map((insp) => ({
      ...insp,
      notes: isStaff ? insp.notes : undefined,
      documents: insp.documents
        .filter((d) => (isStaff ? true : d.visibility === DocumentVisibility.PUBLIC))
        .map((d) => ({ ...d, fileSize: Number(d.fileSize) })),
    }));

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.id,
        trackingId: complaint.trackingId,
        inspections: sanitized,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 5. POST /api/complaints/:id/evidence
 * Register verified evidence metadata (Citizen owner, Officials, Admins)
 */
export async function registerEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isOwner = complaint.citizenId === req.user.id;
    const isStaff = req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to attach evidence to this complaint.',
        },
      });
    }

    const parseResult = evidenceMetadataSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid evidence metadata.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const {
      fileName,
      mimeType,
      fileSize,
      documentCategory,
      visibility,
      description,
      siteInspectionId,
    } = parseResult.data;

    // Citizens may only register PUBLIC evidence
    const enforcedVisibility = isStaff ? visibility : DocumentVisibility.PUBLIC;

    // Validate inspection link if provided
    if (siteInspectionId) {
      const inspectionExists = await prisma.siteInspection.findFirst({
        where: { id: siteInspectionId, complaintId: complaint.id },
      });
      if (!inspectionExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INSPECTION_REF',
            message: 'Referenced site inspection does not exist for this complaint.',
          },
        });
      }
    }

    // Safe, non-traversable server storage key
    const fileExt = fileName.split('.').pop() || 'dat';
    const storageKey = `evidence/complaints/${complaint.id}/${crypto.randomUUID()}.${fileExt}`;

    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          fileName,
          storageKey,
          mimeType,
          fileSize: BigInt(fileSize),
          documentCategory: documentCategory || DocumentCategory.COMPLAINT_EVIDENCE,
          uploaderId: req.user!.id,
          visibility: enforcedVisibility,
          description: description || null,
          complaintId: complaint.id,
          siteInspectionId: siteInspectionId || null,
        },
        include: {
          uploader: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'EVIDENCE_ATTACHED',
          actorId: req.user!.id,
          details: {
            documentId: doc.id,
            fileName: doc.fileName,
            category: doc.documentCategory,
            visibility: doc.visibility,
          },
        },
      });

      return doc;
    });

    return res.status(201).json({
      success: true,
      message: 'Evidence metadata registered successfully.',
      data: {
        evidence: {
          ...document,
          fileSize: Number(document.fileSize),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 6. GET /api/complaints/:id/evidence
 * Retrieve authorized evidence records for a complaint
 */
export async function getEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    const whereClause: Prisma.DocumentWhereInput = {
      complaintId: complaint.id,
    };

    if (!isStaff) {
      whereClause.visibility = DocumentVisibility.PUBLIC;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = documents.map((doc) => ({
      ...doc,
      fileSize: Number(doc.fileSize),
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
 * 7. POST /api/complaints/:id/resolution
 * Official submits resolution for citizen verification (Officials & Admins)
 */
export async function submitResolution(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Citizens cannot submit official municipal resolutions.',
        },
      });
    }

    // Official department check
    if (isOfficial) {
      const belongsToDepartment =
        req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssignedOfficial = req.user.id === complaint.assignedOfficialId;

      if (!belongsToDepartment && !isAssignedOfficial) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to resolve complaints assigned to another department.',
          },
        });
      }
    }

    // State machine check
    if (!isValidStatusTransition(complaint.status, ComplaintStatus.RESOLVED)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot transition complaint from '${complaint.status}' to 'RESOLVED'.`,
        },
      });
    }

    const parseResult = submitResolutionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid resolution parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { resolutionNotes } = parseResult.data;
    const now = new Date();

    const updatedComplaint = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          status: ComplaintStatus.RESOLVED,
          resolvedAt: now,
          resolutionNotes,
          updatedAt: now,
        },
        include: {
          category: true,
          assignedDepartment: true,
          assignedOfficial: true,
        },
      });

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: ComplaintStatus.RESOLVED,
          changedById: req.user!.id,
          reasonOrRemarks: resolutionNotes,
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'RESOLUTION_SUBMITTED',
          actorId: req.user!.id,
          details: {
            resolutionNotes,
            resolvedAt: now.toISOString(),
            officialName: req.user!.name,
          },
        },
      });

      return updated;
    });

    // Module 9: Notify citizen that resolution is awaiting verification
    await NotificationService.notifyResolutionSubmitted(complaint, req.user!.name);

    return res.status(200).json({
      success: true,
      message: 'Resolution submitted successfully and is now awaiting citizen verification.',
      data: {
        complaint: updatedComplaint,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 8. POST /api/complaints/:id/verify-resolution
 * Citizen confirms satisfactory resolution
 */
export async function verifyResolution(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // STRICT CITIZEN OWNERSHIP CHECK
    if (complaint.citizenId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the citizen who lodged this complaint can verify its resolution.',
        },
      });
    }

    // Check status is RESOLVED
    if (complaint.status !== ComplaintStatus.RESOLVED) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot verify resolution when complaint status is '${complaint.status}'. Complaint must be in 'RESOLVED' state.`,
        },
      });
    }

    const parseResult = verifyResolutionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid confirmation input.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { confirmationNotes } = parseResult.data;
    const now = new Date();

    const verifiedComplaint = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          status: ComplaintStatus.VERIFIED,
          verifiedAt: now,
          updatedAt: now,
        },
        include: {
          category: true,
          assignedDepartment: true,
        },
      });

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: ComplaintStatus.RESOLVED,
          toStatus: ComplaintStatus.VERIFIED,
          changedById: req.user!.id,
          reasonOrRemarks: confirmationNotes || 'Citizen verified satisfactory resolution.',
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'RESOLUTION_CONFIRMED',
          actorId: req.user!.id,
          details: {
            confirmationNotes: confirmationNotes || null,
            verifiedAt: now.toISOString(),
          },
        },
      });

      return updated;
    });

    // Module 9: Notify assigned official / department that resolution was verified
    await NotificationService.notifyResolutionVerified(complaint);

    return res.status(200).json({
      success: true,
      message: 'Resolution verified successfully. Thank you for confirming public accountability.',
      data: {
        complaint: verifiedComplaint,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 9. POST /api/complaints/:id/reopen
 * Citizen disputes resolution and requests reopening (requires explanation)
 */
export async function reopenComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();
    const complaint = await resolveComplaint(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // STRICT CITIZEN OWNERSHIP CHECK
    if (complaint.citizenId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the citizen who lodged this complaint can request reopening.',
        },
      });
    }

    // Status check: can reopen from RESOLVED, VERIFIED, or CLOSED
    if (
      complaint.status !== ComplaintStatus.RESOLVED &&
      complaint.status !== ComplaintStatus.VERIFIED &&
      complaint.status !== ComplaintStatus.CLOSED
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot request reopening for complaint currently in '${complaint.status}' status.`,
        },
      });
    }

    const parseResult = reopenComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'A detailed reopening reason is required.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { reason } = parseResult.data;
    const now = new Date();

    const reopenedComplaint = await prisma.$transaction(async (tx) => {
      // Preserve earlier resolutionNotes and resolvedAt; status changes to REOPENED
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          status: ComplaintStatus.REOPENED,
          updatedAt: now,
        },
        include: {
          category: true,
          assignedDepartment: true,
        },
      });

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: ComplaintStatus.REOPENED,
          changedById: req.user!.id,
          reasonOrRemarks: `Reopening requested by citizen: ${reason}`,
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'COMPLAINT_REOPENED',
          actorId: req.user!.id,
          details: {
            reason,
            priorStatus: complaint.status,
            reopenedAt: now.toISOString(),
          },
        },
      });

      return updated;
    });

    // Module 9: Notify assigned official / department that complaint was reopened
    await NotificationService.notifyComplaintReopened(complaint, reason);

    return res.status(200).json({
      success: true,
      message: 'Complaint successfully reopened for departmental reinvestigation.',
      data: {
        complaint: reopenedComplaint,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 10. GET /api/official/complaints
 * Workspace queue for government officials
 */
export async function getOfficialWorkspaceComplaints(req: Request, res: Response, next: NextFunction) {
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
        error: { code: 'FORBIDDEN', message: 'Official access required.' },
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const status = req.query.status as ComplaintStatus | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const whereClause: Prisma.ComplaintWhereInput = {
      isMaster: true,
    };

    // Scope to official's department or assignments
    if (isOfficial) {
      whereClause.OR = [
        { assignedDepartmentId: req.user.departmentId || undefined },
        { assignedOfficialId: req.user.id },
      ];
    }

    if (status && Object.values(ComplaintStatus).includes(status)) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { trackingId: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { locality: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where: whereClause }),
      prisma.complaint.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, code: true, name: true } },
          assignedDepartment: { select: { id: true, code: true, name: true } },
          assignedOfficial: { select: { id: true, name: true, email: true } },
          citizen: { select: { id: true, name: true, email: true, phone: true } },
          subordinateComplaints: {
            select: {
              id: true,
              trackingId: true,
              title: true,
              createdAt: true,
            },
          },
          inspections: {
            take: 1,
            orderBy: { inspectionDate: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        complaints,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
