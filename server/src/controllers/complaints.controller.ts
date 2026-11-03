import type { Request, Response, NextFunction } from 'express';
import { ComplaintStatus, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueTrackingId } from '../lib/trackingId.js';
import { createComplaintSchema } from '../validation/complaint.validation.js';
import { NotificationService } from '../lib/notificationService.js';
import { SlaEngine } from '../lib/slaEngine.js';
import { ComplaintConsolidationService } from '../lib/complaintConsolidation.js';

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
      locationSource,
      isLocationPublic,
      clientPerceptualHash,
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

    // Idempotency safeguard: Prevent double-creation from rapid repeated button clicks
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const recentDuplicate = await prisma.complaint.findFirst({
      where: {
        citizenId: req.user.id,
        title: title.trim(),
        description: description.trim(),
        categoryId,
        createdAt: { gte: thirtySecondsAgo },
      },
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (recentDuplicate) {
      return res.status(200).json({
        success: true,
        message: 'Your civic issue report has been submitted successfully.',
        data: {
          complaint: recentDuplicate,
          trackingId: recentDuplicate.trackingId,
        },
      });
    }

    // Evaluate multi-factor candidate consolidation in the backend
    const consolidationDecision = await ComplaintConsolidationService.evaluateForConsolidation({
      title,
      description,
      categoryId,
      ward: ward || null,
      locality,
      locationAddress,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      clientPerceptualHash: clientPerceptualHash || null,
      citizenId: req.user.id,
    });

    // Generate unique, collision-resistant tracking ID
    const trackingId = await generateUniqueTrackingId(prisma);

    // Create complaint, link if consolidated, and update counters atomically
    const newComplaint = await prisma.$transaction(async (tx) => {
      let isConsolidated = false;
      let masterComplaint: any = null;

      if (consolidationDecision.shouldConsolidate && consolidationDecision.masterComplaintId) {
        masterComplaint = await tx.complaint.findUnique({
          where: { id: consolidationDecision.masterComplaintId },
          include: {
            category: { select: { code: true, name: true } },
            subordinateComplaints: { select: { citizenId: true } },
          },
        });
        if (masterComplaint) {
          isConsolidated = true;
        }
      }

      const complaint = await tx.complaint.create({
        data: {
          trackingId,
          title,
          description,
          categoryId,
          priority: isConsolidated ? masterComplaint.priority : priority,
          status: ComplaintStatus.SUBMITTED,
          citizenId: req.user!.id,
          locationAddress,
          locality,
          ward: ward || null,
          latitude: latitude !== undefined && latitude !== null ? latitude : null,
          longitude: longitude !== undefined && longitude !== null ? longitude : null,
          locationSource: locationSource || null,
          isLocationPublic: isLocationPublic ?? true,
          // Intelligent Consolidation metadata
          isMaster: !isConsolidated,
          primaryComplaintId: isConsolidated ? masterComplaint.id : null,
          isDuplicate: isConsolidated,
          duplicateConfidence: isConsolidated ? consolidationDecision.confidence : null,
          consolidationReason: isConsolidated ? consolidationDecision.matchReason : null,
          consolidatedAt: isConsolidated ? new Date() : null,
          affectedReportCount: 1,
          distinctReporterCount: 1,
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
          reasonOrRemarks: isConsolidated
            ? `Report registered and automatically linked to master civic issue ${masterComplaint.trackingId}.`
            : 'Complaint submitted by citizen.',
        },
      });

      // If consolidated, link to master, update counters, and escalate priority if warranted
      if (isConsolidated && masterComplaint) {
        await tx.complaintDuplicateLink.create({
          data: {
            primaryComplaintId: masterComplaint.id,
            duplicateComplaintId: complaint.id,
            similarityScore: consolidationDecision.confidence,
            reason: consolidationDecision.matchReason,
            linkedById: req.user!.id,
          },
        });

        // Compute updated distinct reporters
        const existingCitizenIds = new Set<string>();
        if (masterComplaint.citizenId) existingCitizenIds.add(masterComplaint.citizenId);
        for (const sub of masterComplaint.subordinateComplaints) {
          if (sub.citizenId) existingCitizenIds.add(sub.citizenId);
        }
        existingCitizenIds.add(req.user!.id);

        const newAffectedCount = (masterComplaint.affectedReportCount || 1) + 1;
        const newDistinctCount = existingCitizenIds.size;

        // Deterministic Priority Escalation Check
        const priorityResult = ComplaintConsolidationService.calculateEscalatedPriority({
          currentPriority: masterComplaint.priority,
          categoryCode: masterComplaint.category?.code,
          affectedReports: newAffectedCount,
          distinctReporters: newDistinctCount,
        });

        const masterUpdateData: any = {
          affectedReportCount: newAffectedCount,
          distinctReporterCount: newDistinctCount,
        };

        if (priorityResult.escalated) {
          masterUpdateData.priority = priorityResult.newPriority;
          masterUpdateData.priorityEscalatedAt = new Date();
          masterUpdateData.priorityEscalationReason = priorityResult.reason;
        }

        await tx.complaint.update({
          where: { id: masterComplaint.id },
          data: masterUpdateData,
        });

        // Audit trails
        await tx.auditEvent.create({
          data: {
            entityType: 'COMPLAINT',
            entityId: masterComplaint.id,
            action: 'COMPLAINT_CONSOLIDATED',
            actorId: req.user!.id,
            details: {
              subordinateComplaintId: complaint.id,
              subordinateTrackingId: complaint.trackingId,
              similarityScore: consolidationDecision.confidence,
              reason: consolidationDecision.matchReason,
              newAffectedCount,
              newDistinctCount,
            },
          },
        });

        if (priorityResult.escalated) {
          await tx.auditEvent.create({
            data: {
              entityType: 'COMPLAINT',
              entityId: masterComplaint.id,
              action: 'COMPLAINT_PRIORITY_ESCALATED',
              actorId: req.user!.id,
              details: {
                fromPriority: masterComplaint.priority,
                toPriority: priorityResult.newPriority,
                reason: priorityResult.reason,
                affectedReportCount: newAffectedCount,
                distinctReporterCount: newDistinctCount,
              },
            },
          });
        }
      }

      return complaint;
    });

    // Asynchronous notification trigger for citizen (non-fatal)
    try {
      await NotificationService.notifyComplaintSubmitted(newComplaint);
    } catch (notifErr) {
      console.warn('[Notification non-fatal failure]:', notifErr);
    }

    // Auto-bind applicable SLA policy (non-fatal)
    try {
      await SlaEngine.calculateAndAttachSla(prisma, newComplaint.id);
    } catch (slaErr) {
      console.warn('[SLA Engine non-fatal failure]:', slaErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Your civic issue report has been submitted successfully.',
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
    subordinateComplaints: {
      include: {
        citizen: { select: { id: true, name: true, email: true, phone: true } },
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
      },
      orderBy: { createdAt: 'desc' },
    },
    primaryComplaint: {
      select: {
        id: true,
        trackingId: true,
        title: true,
        status: true,
      },
    },
    duplicateLinks: {
      include: {
        linkedBy: { select: { id: true, name: true, role: true } },
      },
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
    primaryComplaint: {
      select: {
        id: true,
        trackingId: true,
        status: true,
        resolutionNotes: true,
        resolvedAt: true,
        verifiedAt: true,
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

    // For staff, include all subordinate evidence and linked report summaries
    const sanitizedSubordinates = isStaff
      ? complaint.subordinateComplaints.map((sub) => ({
          id: sub.id,
          trackingId: sub.trackingId,
          title: sub.title,
          description: sub.description,
          createdAt: sub.createdAt,
          citizen: sub.citizen ? { id: sub.citizen.id, name: sub.citizen.name, email: sub.citizen.email, phone: sub.citizen.phone } : null,
          documents: sub.documents.map((d) => ({
            ...d,
            fileSize: Number(d.fileSize),
            captureLatitude: d.captureLatitude ? Number(d.captureLatitude) : null,
            captureLongitude: d.captureLongitude ? Number(d.captureLongitude) : null,
          })),
        }))
      : [];

    return res.status(200).json({
      success: true,
      data: {
        complaint: {
          ...complaint,
          documents: filteredDocuments,
          progressUpdates,
          subordinateComplaints: isStaff ? sanitizedSubordinates : undefined,
          duplicateLinks: isStaff ? complaint.duplicateLinks : undefined,
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

    // Determine target complaint ID for public progress updates (if linked, check master)
    const effectiveTargetId = complaint.primaryComplaintId || complaint.id;

    // Fetch public progress updates
    const progressAudit = await prisma.auditEvent.findMany({
      where: {
        entityType: 'COMPLAINT',
        entityId: effectiveTargetId,
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

    // Effective workflow status reflects master issue progress if linked
    const effectiveStatus = complaint.primaryComplaint ? complaint.primaryComplaint.status : complaint.status;
    const effectiveResolutionNotes = complaint.primaryComplaint ? complaint.primaryComplaint.resolutionNotes : complaint.resolutionNotes;
    const effectiveResolvedAt = complaint.primaryComplaint ? complaint.primaryComplaint.resolvedAt : complaint.resolvedAt;

    // Return strictly privacy-safe fields: ZERO citizen PII (no name, no email, no phone)
    const publicRecord = {
      id: complaint.id,
      trackingId: complaint.trackingId,
      citizenId: isOwner ? complaint.citizenId : undefined,
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      status: effectiveStatus,
      isConsolidatedReport: Boolean(complaint.primaryComplaintId),
      category: complaint.category,
      assignedDepartment: complaint.assignedDepartment,
      locationAddress: complaint.locationAddress,
      locality: complaint.locality,
      ward: complaint.ward,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      reviewedAt: complaint.reviewedAt,
      assignedAt: complaint.assignedAt,
      resolvedAt: effectiveResolvedAt,
      verifiedAt: complaint.verifiedAt,
      resolutionNotes: effectiveResolutionNotes,
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

