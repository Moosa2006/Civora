import type { Request, Response, NextFunction } from 'express';
import {
  Prisma,
  UserRole,
  ComplaintStatus,
  ComplaintPriority,
  SlaStatus,
  EscalationLevel,
  EscalationStatus,
  EscalationTrigger,
  ExtensionRequestStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { SlaEngine } from '../lib/slaEngine.js';
import { NotificationService } from '../lib/notificationService.js';
import {
  createSlaPolicySchema,
  updateSlaPolicySchema,
  requestExtensionSchema,
  decideExtensionSchema,
  updateEstimatedCompletionSchema,
  acknowledgeEscalationSchema,
  recordActionPlanSchema,
  resolveEscalationSchema,
  manualEscalationSchema,
} from '../validation/sla.validation.js';

// ==========================================
// 1. SLA POLICY MANAGEMENT
// ==========================================

export async function getAllPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const isActiveQuery = typeof req.query.isActive === 'string' ? req.query.isActive : undefined;
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const priority = typeof req.query.priority === 'string' ? (req.query.priority as ComplaintPriority) : undefined;

    const where: Prisma.SlaPolicyWhereInput = {};

    if (isActiveQuery !== undefined) {
      where.isActive = isActiveQuery === 'true';
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (priority && Object.values(ComplaintPriority).includes(priority)) {
      where.priority = priority;
    }

    const policies = await prisma.slaPolicy.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { complaintSlas: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getPolicyById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();

    const policy = await prisma.slaPolicy.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { complaintSlas: true },
        },
      },
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'SLA policy not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (err) {
    return next(err);
  }
}

export async function createPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = createSlaPolicySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid SLA policy data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const data = parseResult.data;

    // If setting as default, ensure no conflict or acknowledge default status
    if (data.isDefault) {
      await prisma.slaPolicy.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.slaPolicy.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId || null,
        priority: data.priority || null,
        responseTargetHours: data.responseTargetHours,
        resolutionTargetHours: data.resolutionTargetHours,
        warningThresholdHours: data.warningThresholdHours,
        escalationThresholdHours: data.escalationThresholdHours,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : new Date(),
        effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : null,
        createdById: req.user!.id,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'SLA policy created successfully.',
      data: policy,
    });
  } catch (err) {
    return next(err);
  }
}

export async function updatePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = updateSlaPolicySchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid policy data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const existing = await prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'SLA policy not found.' },
      });
    }

    const data = parseResult.data;

    if (data.isDefault) {
      await prisma.slaPolicy.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: Prisma.SlaPolicyUpdateInput = {
      updatedBy: { connect: { id: req.user!.id } },
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.categoryId !== undefined) {
      updateData.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true };
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.responseTargetHours !== undefined) updateData.responseTargetHours = data.responseTargetHours;
    if (data.resolutionTargetHours !== undefined) updateData.resolutionTargetHours = data.resolutionTargetHours;
    if (data.warningThresholdHours !== undefined) updateData.warningThresholdHours = data.warningThresholdHours;
    if (data.escalationThresholdHours !== undefined) updateData.escalationThresholdHours = data.escalationThresholdHours;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.effectiveStartDate !== undefined) updateData.effectiveStartDate = new Date(data.effectiveStartDate);
    if (data.effectiveEndDate !== undefined) {
      updateData.effectiveEndDate = data.effectiveEndDate ? new Date(data.effectiveEndDate) : null;
    }

    const updated = await prisma.slaPolicy.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } } },
    });

    return res.status(200).json({
      success: true,
      message: 'SLA policy updated successfully. Note: Historical complaint deadlines remain preserved.',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function togglePolicyActive(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const policy = await prisma.slaPolicy.findUnique({ where: { id } });

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'SLA policy not found.' },
      });
    }

    const updated = await prisma.slaPolicy.update({
      where: { id },
      data: {
        isActive: !policy.isActive,
        updatedById: req.user!.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Policy ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

// ==========================================
// 2. COMPLAINT SLA & DEADLINES
// ==========================================

export async function getComplaintSla(req: Request, res: Response, next: NextFunction) {
  try {
    const complaintId = String(req.params.complaintId || '').trim();

    // Verify complaint existence
    const complaint = (await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        sla: {
          include: { policy: true },
        },
        escalations: {
          orderBy: { createdAt: 'desc' },
          include: {
            acknowledgedBy: { select: { id: true, name: true, role: true } },
            resolvedBy: { select: { id: true, name: true, role: true } },
            actionLogs: { orderBy: { createdAt: 'desc' } },
          },
        },
        extensionRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedByOfficial: { select: { id: true, name: true } },
            decisionBy: { select: { id: true, name: true } },
          },
        },
      },
    })) as any;

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // Role check: Citizen must be complaint owner
    const isCitizen = req.user?.role === UserRole.CITIZEN;
    if (isCitizen && complaint.citizenId !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this complaint.' },
      });
    }

    // If official, check departmental scope
    const isOfficial = req.user?.role === UserRole.GOVERNMENT_OFFICIAL;
    if (isOfficial && req.user?.departmentId && complaint.assignedDepartmentId && complaint.assignedDepartmentId !== req.user.departmentId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access restricted to assigned municipal department.' },
      });
    }

    // If SLA hasn't been attached yet, attach dynamically
    let sla = complaint.sla;
    if (!sla) {
      sla = (await SlaEngine.calculateAndAttachSla(prisma, complaint.id)) as any;
    }

    // Privacy formatting for citizens: redact confidential internal notes & staff logs
    if (isCitizen) {
      const citizenEscalations = (complaint.escalations || []).map((e: any) => ({
        id: e.id,
        escalationLevel: e.escalationLevel,
        status: e.status,
        isSystemGenerated: e.isSystemGenerated,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
      }));

      return res.status(200).json({
        success: true,
        data: {
          sla: {
            policyName: sla?.policyName,
            clockStartedAt: sla?.clockStartedAt,
            responseDeadline: sla?.currentResponseDeadline,
            resolutionDeadline: sla?.currentResolutionDeadline,
            isOverdue: sla?.isResolutionOverdue || sla?.isResponseOverdue,
            slaStatus: sla?.slaStatus,
            estimatedCompletionDate: sla?.estimatedCompletionDate,
            estimatedCompletionNotes: sla?.estimatedCompletionNotes,
          },
          escalations: citizenEscalations,
          extensionRequests: (complaint.extensionRequests || []).filter((ex: any) => ex.status === 'APPROVED'),
        },
      });
    }

    // Full staff response
    return res.status(200).json({
      success: true,
      data: {
        sla,
        escalations: complaint.escalations,
        extensionRequests: complaint.extensionRequests,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getOverdueComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;

    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const priority = typeof req.query.priority === 'string' ? (req.query.priority as ComplaintPriority) : undefined;
    const complaintId = typeof req.query.complaintId === 'string' ? req.query.complaintId.trim() : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    const where: Prisma.ComplaintWhereInput = {
      status: {
        notIn: [
          ComplaintStatus.RESOLVED,
          ComplaintStatus.VERIFIED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ],
      },
      sla: {
        OR: [{ isResolutionOverdue: true }, { isResponseOverdue: true }],
      },
    };

    if (complaintId) {
      where.id = complaintId;
    } else if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { trackingId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Department boundary enforcement
    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId) {
      where.assignedDepartmentId = req.user.departmentId;
    } else if (departmentId) {
      where.assignedDepartmentId = departmentId;
    }

    if (categoryId) where.categoryId = categoryId;
    if (priority && Object.values(ComplaintPriority).includes(priority)) where.priority = priority;

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        include: {
          category: { select: { id: true, code: true, name: true } },
          assignedDepartment: { select: { id: true, code: true, name: true } },
          assignedOfficial: { select: { id: true, name: true, email: true } },
          sla: true,
          escalations: {
            where: { status: { in: [EscalationStatus.ACTIVE, EscalationStatus.ACKNOWLEDGED] } },
          },
        },
        orderBy: {
          sla: { currentResolutionDeadline: 'asc' },
        },
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

export async function getApproachingDeadlineComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;

    const where: Prisma.ComplaintWhereInput = {
      status: {
        notIn: [
          ComplaintStatus.RESOLVED,
          ComplaintStatus.VERIFIED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ],
      },
      sla: {
        slaStatus: SlaStatus.APPROACHING_DEADLINE,
      },
    };

    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId) {
      where.assignedDepartmentId = req.user.departmentId;
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          assignedDepartment: { select: { id: true, name: true } },
          assignedOfficial: { select: { id: true, name: true } },
          sla: true,
        },
        orderBy: {
          sla: { currentResolutionDeadline: 'asc' },
        },
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

export async function updateEstimatedCompletion(req: Request, res: Response, next: NextFunction) {
  try {
    const complaintId = String(req.params.complaintId || '').trim();
    const parseResult = updateEstimatedCompletionSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid estimated completion date.',
        },
      });
    }

    const complaint = (await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { sla: true },
    })) as any;

    if (!complaint || !complaint.sla) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint or SLA record not found.' },
      });
    }

    // Role and department authorization check
    if (
      req.user?.role === UserRole.GOVERNMENT_OFFICIAL &&
      req.user.departmentId &&
      complaint.assignedDepartmentId !== req.user.departmentId
    ) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update estimate for another department.' },
      });
    }

    const { estimatedCompletionDate, estimatedCompletionNotes } = parseResult.data;

    // Core rule: Updating estimated completion date does NOT change original or current SLA deadline!
    const updatedSla = await prisma.complaintSla.update({
      where: { id: complaint.sla.id },
      data: {
        estimatedCompletionDate: new Date(estimatedCompletionDate),
        estimatedCompletionNotes: estimatedCompletionNotes || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Department estimated completion date recorded. (SLA deadline commitments remain unchanged)',
      data: updatedSla,
    });
  } catch (err) {
    return next(err);
  }
}

// ==========================================
// 3. ESCALATION MANAGEMENT
// ==========================================

export async function getEscalations(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;

    const status = typeof req.query.status === 'string' ? (req.query.status as EscalationStatus) : undefined;
    const level = typeof req.query.level === 'string' ? (req.query.level as EscalationLevel) : undefined;

    const where: Prisma.ComplaintEscalationWhereInput = {};

    if (status && Object.values(EscalationStatus).includes(status)) {
      where.status = status;
    }
    if (level && Object.values(EscalationLevel).includes(level)) {
      where.escalationLevel = level;
    }

    // Scope check
    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId) {
      where.complaint = {
        assignedDepartmentId: req.user.departmentId,
      };
    }

    const [total, escalations] = await Promise.all([
      prisma.complaintEscalation.count({ where }),
      prisma.complaintEscalation.findMany({
        where,
        include: {
          complaint: {
            select: {
              id: true,
              trackingId: true,
              title: true,
              status: true,
              priority: true,
              assignedDepartment: { select: { id: true, name: true } },
              assignedOfficial: { select: { id: true, name: true } },
              sla: true,
            },
          },
          acknowledgedBy: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        escalations,
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

export async function getEscalationById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();

    const escalation = (await prisma.complaintEscalation.findUnique({
      where: { id },
      include: {
        complaint: {
          include: {
            category: { select: { id: true, name: true } },
            assignedDepartment: { select: { id: true, name: true } },
            assignedOfficial: { select: { id: true, name: true, email: true } },
            sla: true,
          },
        },
        acknowledgedBy: { select: { id: true, name: true } },
        actionPlanRecordedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
        actionLogs: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })) as any;

    if (!escalation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Escalation record not found.' },
      });
    }

    // Department boundary check
    if (
      req.user?.role === UserRole.GOVERNMENT_OFFICIAL &&
      req.user.departmentId &&
      escalation.complaint?.assignedDepartmentId !== req.user.departmentId
    ) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied outside department jurisdiction.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    return next(err);
  }
}

export async function acknowledgeEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = acknowledgeEscalationSchema.safeParse(req.body);
    const notes = parseResult.success ? parseResult.data.notes : undefined;

    const escalation = (await prisma.complaintEscalation.findUnique({
      where: { id },
      include: { complaint: true },
    })) as any;

    if (!escalation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Escalation not found.' },
      });
    }

    if (escalation.status !== EscalationStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Escalation is already acknowledged or resolved.' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const esc = await tx.complaintEscalation.update({
        where: { id },
        data: {
          status: EscalationStatus.ACKNOWLEDGED,
          acknowledgedById: req.user!.id,
          acknowledgedAt: new Date(),
        },
      });

      await tx.escalationActionLog.create({
        data: {
          escalationId: id,
          actorId: req.user!.id,
          action: 'ACKNOWLEDGED',
          notes: notes || 'Supervisor acknowledged escalation for investigation.',
        },
      });

      return esc;
    });

    return res.status(200).json({
      success: true,
      message: 'Escalation acknowledged successfully.',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function recordEscalationActionPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = recordActionPlanSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid action plan.',
        },
      });
    }

    const escalation = await prisma.complaintEscalation.findUnique({ where: { id } });
    if (!escalation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Escalation not found.' },
      });
    }

    const { actionPlan } = parseResult.data;

    const updated = await prisma.$transaction(async (tx) => {
      const esc = await tx.complaintEscalation.update({
        where: { id },
        data: {
          actionPlan,
          actionPlanRecordedAt: new Date(),
          actionPlanRecordedById: req.user!.id,
          status: EscalationStatus.ACTION_PLANNED,
        },
      });

      await tx.escalationActionLog.create({
        data: {
          escalationId: id,
          actorId: req.user!.id,
          action: 'ACTION_PLAN_RECORDED',
          notes: actionPlan,
        },
      });

      return esc;
    });

    return res.status(200).json({
      success: true,
      message: 'Corrective action plan recorded.',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function resolveEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = resolveEscalationSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Resolution reason required.',
        },
      });
    }

    const escalation = await prisma.complaintEscalation.findUnique({
      where: { id },
      include: { complaint: true },
    });

    if (!escalation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Escalation not found.' },
      });
    }

    const { resolutionReason } = parseResult.data;

    const updated = await prisma.$transaction(async (tx) => {
      const esc = await tx.complaintEscalation.update({
        where: { id },
        data: {
          status: EscalationStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedById: req.user!.id,
          resolutionReason,
        },
      });

      await tx.escalationActionLog.create({
        data: {
          escalationId: id,
          actorId: req.user!.id,
          action: 'ESCALATION_RESOLVED',
          notes: resolutionReason,
        },
      });

      return esc;
    });

    return res.status(200).json({
      success: true,
      message: 'Escalation resolved. Note: Complaint resolution remains distinct and governed by field progress.',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function manualEscalateComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const complaintId = String(req.params.complaintId || '').trim();
    const parseResult = manualEscalationSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid escalation parameters.',
        },
      });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { assignedDepartment: true },
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const { escalationLevel, triggerReason, notes } = parseResult.data;

    const escalation = await prisma.$transaction(async (tx) => {
      const esc = await tx.complaintEscalation.create({
        data: {
          complaintId: complaint.id,
          escalationLevel,
          triggerReason,
          notes,
          status: EscalationStatus.ACTIVE,
          escalatedToDepartmentId: complaint.assignedDepartmentId,
          escalatedById: req.user!.id,
          isSystemGenerated: false,
        },
      });

      await tx.escalationActionLog.create({
        data: {
          escalationId: esc.id,
          actorId: req.user!.id,
          action: 'MANUALLY_ESCALATED',
          notes,
        },
      });

      return esc;
    });

    await NotificationService.notifyEscalationTriggered(complaint, escalation);

    return res.status(201).json({
      success: true,
      message: 'Complaint escalated successfully.',
      data: escalation,
    });
  } catch (err) {
    return next(err);
  }
}

// ==========================================
// 4. SLA EXTENSION REQUESTS
// ==========================================

export async function getExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? (req.query.status as ExtensionRequestStatus) : undefined;

    const where: Prisma.SlaExtensionRequestWhereInput = {};
    if (status && Object.values(ExtensionRequestStatus).includes(status)) {
      where.status = status;
    }

    // Department boundary
    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId) {
      where.complaint = {
        assignedDepartmentId: req.user.departmentId,
      };
    }

    const requests = await prisma.slaExtensionRequest.findMany({
      where,
      include: {
        complaint: {
          select: {
            id: true,
            trackingId: true,
            title: true,
            status: true,
            assignedDepartment: { select: { id: true, name: true } },
          },
        },
        requestedByOfficial: {
          select: { id: true, name: true, email: true },
        },
        decisionBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (err) {
    return next(err);
  }
}

export async function requestSlaExtension(req: Request, res: Response, next: NextFunction) {
  try {
    const complaintId = String(req.params.complaintId || '').trim();
    const parseResult = requestExtensionSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid extension request.',
        },
      });
    }

    const complaint = (await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { sla: true },
    })) as any;

    if (!complaint || !complaint.sla) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint or SLA record not found.' },
      });
    }

    const { requestedResolutionDeadline, reason } = parseResult.data;
    const requestedDate = new Date(requestedResolutionDeadline);

    if (requestedDate <= complaint.sla.currentResolutionDeadline) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEADLINE',
          message: 'Requested deadline must be later than the current resolution deadline.',
        },
      });
    }

    // Prevent duplicate pending requests
    const pendingRequest = await prisma.slaExtensionRequest.findFirst({
      where: { complaintId: complaint.id, status: ExtensionRequestStatus.PENDING },
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_REQUEST',
          message: 'An extension request is already pending approval for this complaint.',
        },
      });
    }

    const extensionRequest = await prisma.slaExtensionRequest.create({
      data: {
        complaintId: complaint.id,
        complaintSlaId: complaint.sla.id,
        requestedByOfficialId: req.user!.id,
        previousResolutionDeadline: complaint.sla.currentResolutionDeadline,
        requestedResolutionDeadline: requestedDate,
        reason,
        status: ExtensionRequestStatus.PENDING,
      },
    });

    await NotificationService.notifySlaExtensionRequested(complaint, extensionRequest);

    return res.status(201).json({
      success: true,
      message: 'Extension request submitted for supervisory review.',
      data: extensionRequest,
    });
  } catch (err) {
    return next(err);
  }
}

export async function decideSlaExtension(req: Request, res: Response, next: NextFunction) {
  try {
    const requestId = String(req.params.requestId || '').trim();
    const parseResult = decideExtensionSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid decision parameters.',
        },
      });
    }

    const extensionRequest = (await prisma.slaExtensionRequest.findUnique({
      where: { id: requestId },
      include: {
        complaint: {
          include: { sla: true },
        },
      },
    })) as any;

    if (!extensionRequest) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Extension request not found.' },
      });
    }

    if (extensionRequest.status !== ExtensionRequestStatus.PENDING) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Extension request has already been decided.' },
      });
    }

    // Separation of Duties Rule: Requesting official cannot approve their own request!
    if (extensionRequest.requestedByOfficialId === req.user!.id && req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SEPARATION_OF_DUTIES',
          message: 'Officials cannot approve their own SLA extension requests. Supervisory review required.',
        },
      });
    }

    const { decision, decisionNotes } = parseResult.data;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const dec = await tx.slaExtensionRequest.update({
        where: { id: requestId },
        data: {
          status: decision as ExtensionRequestStatus,
          decisionById: req.user!.id,
          decisionNotes: decisionNotes || null,
          decisionAt: now,
        },
      });

      if (decision === 'APPROVED') {
        // Update currentResolutionDeadline while keeping originalResolutionDeadline intact!
        await tx.complaintSla.update({
          where: { id: extensionRequest.complaintSlaId },
          data: {
            currentResolutionDeadline: extensionRequest.requestedResolutionDeadline,
            isResolutionOverdue: false, // Reset overdue flag under approved adjustment
            slaStatus: SlaStatus.ON_TRACK,
          },
        });
      }

      return dec;
    });

    await NotificationService.notifySlaExtensionDecided(
      extensionRequest.complaint,
      decision,
      decision === 'APPROVED' ? extensionRequest.requestedResolutionDeadline : undefined
    );

    return res.status(200).json({
      success: true,
      message: `Extension request ${decision.toLowerCase()} successfully. Original SLA targets preserved in audit history.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

// ==========================================
// 5. ENGINE RUNNER & ACCOUNTABILITY ANALYTICS
// ==========================================

export async function runEvaluation(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await SlaEngine.evaluateAllActiveComplaints(prisma);

    return res.status(200).json({
      success: true,
      message: 'SLA evaluation completed across all active complaints.',
      data: summary,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getSlaAccountabilityMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const departmentId = req.query.departmentId as string | undefined;

    // Filter by department if official
    let targetDeptId = departmentId;
    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const complaintWhere: Prisma.ComplaintWhereInput = {};
    if (targetDeptId) {
      complaintWhere.assignedDepartmentId = targetDeptId;
    }

    // Query metrics
    const [totalWithSla, resolvedOnTime, resolvedLate, activeOverdue, approaching, escalationsCount, departments] =
      await Promise.all([
        prisma.complaintSla.count({
          where: {
            slaStatus: { not: SlaStatus.NO_SLA },
            complaint: complaintWhere,
          },
        }),
        prisma.complaintSla.count({
          where: {
            slaStatus: SlaStatus.RESOLVED_ON_TIME,
            complaint: complaintWhere,
          },
        }),
        prisma.complaintSla.count({
          where: {
            slaStatus: SlaStatus.RESOLVED_LATE,
            complaint: complaintWhere,
          },
        }),
        prisma.complaintSla.count({
          where: {
            OR: [{ isResolutionOverdue: true }, { isResponseOverdue: true }],
            complaint: {
              ...complaintWhere,
              status: { notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.VERIFIED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] },
            },
          },
        }),
        prisma.complaintSla.count({
          where: {
            slaStatus: SlaStatus.APPROACHING_DEADLINE,
            complaint: complaintWhere,
          },
        }),
        prisma.complaintEscalation.count({
          where: {
            status: { in: [EscalationStatus.ACTIVE, EscalationStatus.ACKNOWLEDGED, EscalationStatus.ACTION_PLANNED] },
            complaint: complaintWhere,
          },
        }),
        prisma.department.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            assignedComplaints: {
              select: {
                sla: {
                  select: { slaStatus: true, isResolutionOverdue: true },
                },
              },
            },
          },
        }),
      ]);

    const totalResolved = resolvedOnTime + resolvedLate;
    const complianceRate = totalResolved > 0 ? Math.round((resolvedOnTime / totalResolved) * 100) : 100;

    const departmentScorecards = departments.map((d) => {
      let deptOnTime = 0;
      let deptLate = 0;
      let deptActiveOverdue = 0;

      for (const comp of d.assignedComplaints) {
        if (comp.sla) {
          if (comp.sla.slaStatus === SlaStatus.RESOLVED_ON_TIME) deptOnTime++;
          if (comp.sla.slaStatus === SlaStatus.RESOLVED_LATE) deptLate++;
          if (comp.sla.isResolutionOverdue) deptActiveOverdue++;
        }
      }

      const deptTotalResolved = deptOnTime + deptLate;
      const deptRate = deptTotalResolved > 0 ? Math.round((deptOnTime / deptTotalResolved) * 100) : 100;

      return {
        id: d.id,
        code: d.code,
        name: d.name,
        totalAssigned: d.assignedComplaints.length,
        resolvedOnTime: deptOnTime,
        resolvedLate: deptLate,
        complianceRate: deptRate,
        activeOverdue: deptActiveOverdue,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalWithSla,
          totalResolved,
          resolvedOnTime,
          resolvedLate,
          complianceRate,
          activeOverdue,
          approaching,
          activeEscalations: escalationsCount,
        },
        departmentScorecards,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getPublicSlaTransparency(req: Request, res: Response, next: NextFunction) {
  try {
    const [resolvedOnTime, resolvedLate, totalActiveOverdue, categoryDistribution] = await Promise.all([
      prisma.complaintSla.count({ where: { slaStatus: SlaStatus.RESOLVED_ON_TIME } }),
      prisma.complaintSla.count({ where: { slaStatus: SlaStatus.RESOLVED_LATE } }),
      prisma.complaintSla.count({
        where: {
          isResolutionOverdue: true,
          complaint: {
            status: { notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.VERIFIED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] },
          },
        },
      }),
      prisma.complaintCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          complaints: {
            select: {
              sla: {
                select: { slaStatus: true },
              },
            },
          },
        },
      }),
    ]);

    const totalResolved = resolvedOnTime + resolvedLate;
    const overallComplianceRate = totalResolved > 0 ? Math.round((resolvedOnTime / totalResolved) * 100) : 100;

    const categories = categoryDistribution.map((cat) => {
      let onTime = 0;
      let late = 0;
      for (const comp of cat.complaints) {
        if (comp.sla?.slaStatus === SlaStatus.RESOLVED_ON_TIME) onTime++;
        if (comp.sla?.slaStatus === SlaStatus.RESOLVED_LATE) late++;
      }
      const total = onTime + late;
      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        complianceRate: total > 0 ? Math.round((onTime / total) * 100) : 100,
        resolvedCount: total,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        overallComplianceRate,
        resolvedOnTime,
        resolvedLate,
        totalActiveOverdue,
        categories,
      },
    });
  } catch (err) {
    return next(err);
  }
}
