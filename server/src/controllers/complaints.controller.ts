import type { Request, Response, NextFunction } from 'express';
import { ComplaintStatus, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueTrackingId } from '../lib/trackingId.js';
import { createComplaintSchema } from '../validation/complaint.validation.js';
import { NotificationService } from '../lib/notificationService.js';
import { SlaEngine } from '../lib/slaEngine.js';

export async function createComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required to submit a complaint.',
        },
      });
    }

    const parseResult = createComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid complaint data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const {
      title,
      description,
      categoryId,
      priority,
      locationAddress,
      locality,
      ward,
      latitude,
      longitude,
    } = parseResult.data;

    // Verify category exists and is active
    const category = await prisma.complaintCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, departmentId: true, isActive: true },
    });

    if (!category || !category.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: 'The selected category does not exist or is inactive.',
        },
      });
    }

    // Generate unique, collision-resistant tracking ID
    const trackingId = await generateUniqueTrackingId(prisma);

    // Create complaint and initial status history atomically in a transaction
    const newComplaint = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          trackingId,
          title,
          description,
          categoryId,
          priority,
          status: ComplaintStatus.SUBMITTED,
          citizenId: req.user!.id,
          locationAddress,
          locality,
          ward: ward || null,
          latitude: latitude !== undefined && latitude !== null ? latitude : null,
          longitude: longitude !== undefined && longitude !== null ? longitude : null,
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      // Record initial creation in status history
      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: null,
          toStatus: ComplaintStatus.SUBMITTED,
          changedById: req.user!.id,
          reasonOrRemarks: 'Complaint submitted by citizen.',
        },
      });

      return complaint;
    });

    // Module 9: Asynchronous notification trigger for citizen
    await NotificationService.notifyComplaintSubmitted(newComplaint);

    // Module 11: Auto-bind applicable SLA policy and compute initial targets
    await SlaEngine.calculateAndAttachSla(prisma, newComplaint.id);

    return res.status(201).json({
      success: true,
      message: 'Complaint lodged successfully.',
      data: {
        complaint: newComplaint,
        trackingId: newComplaint.trackingId,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getMyComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status as ComplaintStatus | undefined;
    const categoryIdFilter = req.query.categoryId as string | undefined;

    const whereClause: any = {
      citizenId: req.user.id,
    };

    if (statusFilter && Object.values(ComplaintStatus).includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    if (categoryIdFilter) {
      whereClause.categoryId = categoryIdFilter;
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where: whereClause }),
      prisma.complaint.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          assignedDepartment: {
            select: {
              id: true,
              code: true,
              name: true,
            },
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

const complaintWithDetailsArgs = Prisma.validator<Prisma.ComplaintDefaultArgs>()({
  include: {
    category: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    assignedDepartment: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    assignedOfficial: {
      select: {
        id: true,
        name: true,
      },
    },
    statusHistory: {
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
    documents: {
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        documentCategory: true,
        visibility: true,
        sha256Checksum: true,
        perceptualHash: true,
        capturedAt: true,
        browserCaptureTimestamp: true,
        captureLatitude: true,
        captureLongitude: true,
        captureAccuracy: true,
        isGpsVerified: true,
        createdAt: true,
      },
    },
    inspections: {
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { inspectionDate: 'desc' },
    },
  },
});

type ComplaintWithDetails = Prisma.ComplaintGetPayload<typeof complaintWithDetailsArgs>;

const complaintTrackArgs = Prisma.validator<Prisma.ComplaintDefaultArgs>()({
  include: {
    category: {
      select: {
        code: true,
        name: true,
      },
    },
    assignedDepartment: {
      select: {
        code: true,
        name: true,
      },
    },
    statusHistory: {
      select: {
        fromStatus: true,
        toStatus: true,
        reasonOrRemarks: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    },
    inspections: {
      select: {
        id: true,
        outcome: true,
        observations: true,
        measurements: true,
        inspectionDate: true,
      },
      orderBy: { inspectionDate: 'desc' },
    },
    documents: {
      where: { visibility: 'PUBLIC' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        documentCategory: true,
        sha256Checksum: true,
        perceptualHash: true,
        capturedAt: true,
        browserCaptureTimestamp: true,
        captureLatitude: true,
        captureLongitude: true,
        captureAccuracy: true,
        isGpsVerified: true,
        createdAt: true,
      },
    },
    sla: true,
    escalations: {
      where: {
        status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ACTION_PLANNED'] },
      },
      select: {
        id: true,
        escalationLevel: true,
        status: true,
        createdAt: true,
      },
    },
  },
});

type ComplaintTrackPayload = Prisma.ComplaintGetPayload<typeof complaintTrackArgs>;

export async function getComplaintById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    const id = String(req.params.id || '').trim();

    // Support lookup by UUID or trackingId
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid ? { id } : { trackingId: id };

    const complaint: ComplaintWithDetails | null = await prisma.complaint.findUnique({
      where: whereClause,
      include: complaintWithDetailsArgs.include,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Complaint not found.',
        },
      });
    }

    // Ownership & authorization check
    const isOwner = complaint.citizenId === req.user.id;
    const isStaff = req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this complaint.',
        },
      });
    }

    // Fetch official progress updates from audit trail
    const auditProgress = await prisma.auditEvent.findMany({
      where: {
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        action: 'OFFICIAL_PROGRESS_UPDATE',
      },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const progressUpdates = auditProgress
      .map((rec) => {
        const details = (rec.details as any) || {};
        return {
          id: rec.id,
          title: details.title || 'Official Progress Update',
          description: details.description || '',
          stage: details.stage || 'FIELD_WORK',
          estimatedNextActionDate: details.estimatedNextActionDate || null,
          visibility: details.visibility || 'PUBLIC',
          createdAt: rec.createdAt,
          official: {
            id: rec.actor?.id,
            name: rec.actor?.name || 'Municipal Official',
            role: rec.actor?.role,
            department: details.departmentName,
          },
        };
      })
      .filter((update) => isStaff || update.visibility === 'PUBLIC');

    // Filter documents by visibility for citizens
    const filteredDocuments = complaint.documents
      .filter((doc: ComplaintWithDetails['documents'][number]) => isStaff || doc.visibility === 'PUBLIC')
      .map((doc: ComplaintWithDetails['documents'][number]) => ({
        ...doc,
        fileSize: Number(doc.fileSize),
        captureLatitude: doc.captureLatitude ? Number(doc.captureLatitude) : null,
        captureLongitude: doc.captureLongitude ? Number(doc.captureLongitude) : null,
      }));

    return res.status(200).json({
      success: true,
      data: {
        complaint: {
          ...complaint,
          documents: filteredDocuments,
          progressUpdates,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function trackComplaintByTrackingId(req: Request, res: Response, next: NextFunction) {
  try {
    const trackingId = String(req.params.trackingId || '').trim();

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tracking ID is required.',
        },
      });
    }

    const complaint: ComplaintTrackPayload | null = await prisma.complaint.findUnique({
      where: { trackingId: trackingId.toUpperCase() },
      include: complaintTrackArgs.include,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No civic issue found with this tracking ID. Please check the code and try again.',
        },
      });
    }

    // Fetch public progress updates
    const progressAudit = await prisma.auditEvent.findMany({
      where: {
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        action: 'OFFICIAL_PROGRESS_UPDATE',
      },
      include: {
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const publicProgress = progressAudit
      .map((rec) => {
        const details = (rec.details as any) || {};
        return {
          id: rec.id,
          title: details.title || 'Official Progress Update',
          description: details.description || '',
          stage: details.stage || 'FIELD_WORK',
          estimatedNextActionDate: details.estimatedNextActionDate || null,
          visibility: details.visibility || 'PUBLIC',
          createdAt: rec.createdAt,
          official: {
            name: rec.actor?.name || 'Municipal Official',
            department: details.departmentName,
          },
        };
      })
      .filter((u) => u.visibility === 'PUBLIC');

    const isOwner = req.user && (req.user.id === complaint.citizenId || req.user.role === 'ADMIN');

    // Return strictly privacy-safe fields: ZERO citizen PII (no name, no email, no phone)
    const publicRecord = {
      id: complaint.id,
      trackingId: complaint.trackingId,
      citizenId: isOwner ? complaint.citizenId : undefined,
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      status: complaint.status,
      category: complaint.category,
      assignedDepartment: complaint.assignedDepartment,
      locationAddress: complaint.locationAddress,
      locality: complaint.locality,
      ward: complaint.ward,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      reviewedAt: complaint.reviewedAt,
      assignedAt: complaint.assignedAt,
      resolvedAt: complaint.resolvedAt,
      verifiedAt: complaint.verifiedAt,
      resolutionNotes: complaint.resolutionNotes,
      timeline: complaint.statusHistory,
      progressUpdates: publicProgress,
      inspections: complaint.inspections,
      evidence: complaint.documents.map((d: ComplaintTrackPayload['documents'][number]) => ({
        ...d,
        fileSize: Number(d.fileSize),
        captureLatitude: d.captureLatitude ? Number(d.captureLatitude) : null,
        captureLongitude: d.captureLongitude ? Number(d.captureLongitude) : null,
      })),
      sla: complaint.sla
        ? {
            policyName: complaint.sla.policyName,
            clockStartedAt: complaint.sla.clockStartedAt,
            responseDeadline: complaint.sla.currentResponseDeadline,
            resolutionDeadline: complaint.sla.currentResolutionDeadline,
            isOverdue: complaint.sla.isResolutionOverdue || complaint.sla.isResponseOverdue,
            slaStatus: complaint.sla.slaStatus,
            estimatedCompletionDate: complaint.sla.estimatedCompletionDate,
            estimatedCompletionNotes: complaint.sla.estimatedCompletionNotes,
            isEscalated: complaint.escalations && complaint.escalations.length > 0,
            escalationLevel: complaint.escalations?.[0]?.escalationLevel || null,
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      data: {
        complaint: publicRecord,
      },
    });
  } catch (err) {
    return next(err);
  }
}

