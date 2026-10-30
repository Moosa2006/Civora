import type { Request, Response, NextFunction } from 'express';
import { ComplaintStatus, ComplaintPriority, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { isValidStatusTransition } from '../lib/complaintLifecycle.js';
import {
  updateComplaintStatusSchema,
  assignComplaintSchema,
} from '../validation/complaint.validation.js';
import { NotificationService } from '../lib/notificationService.js';
import { SlaEngine } from '../lib/slaEngine.js';

export async function getAllComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const status = req.query.status as ComplaintStatus | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const priority = req.query.priority as ComplaintPriority | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const whereClause: any = {};

    if (status && Object.values(ComplaintStatus).includes(status)) {
      whereClause.status = status;
    }

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (departmentId) {
      whereClause.assignedDepartmentId = departmentId;
    }

    if (priority && Object.values(ComplaintPriority).includes(priority)) {
      whereClause.priority = priority;
    }

    if (search) {
      whereClause.OR = [
        { trackingId: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { locality: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If official belongs to a specific department, optionally prioritize their queue
    if (req.user?.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId && !departmentId) {
      // Allow viewing all, but can filter when explicitly requested
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
          assignedOfficial: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          citizen: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
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

export async function updateComplaintStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = updateComplaintStatusSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid status update parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { status: targetStatus, reason, resolutionNotes } = parseResult.data;

    // Resolve complaint
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid ? { id } : { trackingId: id };
    const complaint = await prisma.complaint.findUnique({
      where: whereClause,
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

    // Validate lifecycle transition
    if (!isValidStatusTransition(complaint.status, targetStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Illegal status transition from '${complaint.status}' to '${targetStatus}'.`,
        },
      });
    }

    const now = new Date();
    const updateData: any = {
      status: targetStatus,
    };

    if (targetStatus === ComplaintStatus.UNDER_REVIEW && !complaint.reviewedAt) {
      updateData.reviewedAt = now;
    } else if (targetStatus === ComplaintStatus.RESOLVED) {
      updateData.resolvedAt = now;
      if (resolutionNotes) {
        updateData.resolutionNotes = resolutionNotes;
      }
    } else if (targetStatus === ComplaintStatus.VERIFIED) {
      updateData.verifiedAt = now;
    } else if (targetStatus === ComplaintStatus.CLOSED) {
      updateData.closedAt = now;
    } else if (targetStatus === ComplaintStatus.REJECTED) {
      updateData.rejectionReason = reason;
      if (!complaint.reviewedAt) {
        updateData.reviewedAt = now;
      }
    }

    // Execute atomic update and status history logging
    const updatedComplaint = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: updateData,
        include: {
          category: {
            select: { id: true, code: true, name: true },
          },
          assignedDepartment: {
            select: { id: true, code: true, name: true },
          },
          assignedOfficial: {
            select: { id: true, name: true },
          },
        },
      });

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: targetStatus,
          changedById: req.user!.id,
          reasonOrRemarks: reason || resolutionNotes || `Status updated to ${targetStatus}`,
        },
      });

      return updated;
    });

    // Module 9: Asynchronous notification trigger for citizen
    await NotificationService.notifyComplaintStatusChanged(
      updatedComplaint,
      reason || resolutionNotes
    );

    // Module 11: Re-evaluate SLA state (e.g. mark on-time/late resolution, record response time)
    await SlaEngine.evaluateComplaintSla(prisma, updatedComplaint.id);

    return res.status(200).json({
      success: true,
      message: `Complaint status successfully updated to ${targetStatus}.`,
      data: {
        complaint: updatedComplaint,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function assignComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    const parseResult = assignComplaintSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid assignment parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { departmentId, officialId, notes } = parseResult.data;

    // Resolve complaint
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid ? { id } : { trackingId: id };
    const complaint = await prisma.complaint.findUnique({
      where: whereClause,
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

    // Verify department if provided
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, isActive: true },
      });

      if (!dept || !dept.isActive) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPARTMENT',
            message: 'Specified department does not exist or is inactive.',
          },
        });
      }
    }

    // Verify official if provided
    if (officialId) {
      const official = await prisma.user.findUnique({
        where: { id: officialId },
        select: { id: true, role: true, departmentId: true },
      });

      if (!official || official.role !== UserRole.GOVERNMENT_OFFICIAL) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OFFICIAL',
            message: 'Specified user is not an active government official.',
          },
        });
      }
    }

    const now = new Date();
    const updateData: any = {
      assignedAt: now,
    };

    if (departmentId !== undefined) {
      updateData.assignedDepartmentId = departmentId;
    }

    if (officialId !== undefined) {
      updateData.assignedOfficialId = officialId;
    }

    // Auto-advance status to ASSIGNED if currently in SUBMITTED, UNDER_REVIEW, or REOPENED
    let transitionToAssigned = false;
    if (
      complaint.status === ComplaintStatus.SUBMITTED ||
      complaint.status === ComplaintStatus.UNDER_REVIEW ||
      complaint.status === ComplaintStatus.REOPENED
    ) {
      updateData.status = ComplaintStatus.ASSIGNED;
      if (!complaint.reviewedAt) {
        updateData.reviewedAt = now;
      }
      transitionToAssigned = true;
    }

    const isReassignment = !!complaint.assignedDepartmentId && complaint.assignedDepartmentId !== departmentId;

    const updatedComplaint = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: updateData,
        include: {
          category: {
            select: { id: true, code: true, name: true },
          },
          assignedDepartment: {
            select: { id: true, code: true, name: true },
          },
          assignedOfficial: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const auditRemarks = notes ||
        (isReassignment
          ? `Reassigned to ${updated.assignedDepartment?.name || 'department'} by ${req.user!.name}`
          : `Assigned to ${updated.assignedDepartment?.name || 'department'} by ${req.user!.name}`);

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: transitionToAssigned ? ComplaintStatus.ASSIGNED : complaint.status,
          changedById: req.user!.id,
          reasonOrRemarks: auditRemarks,
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: isReassignment ? 'COMPLAINT_REASSIGNED' : 'COMPLAINT_ASSIGNED',
          actorId: req.user!.id,
          details: {
            previousDepartmentId: complaint.assignedDepartmentId,
            newDepartmentId: departmentId,
            officialId,
            notes,
            isReassignment,
          },
        },
      });

      return updated;
    });

    // Module 9: Asynchronous notification trigger for official & citizen
    await NotificationService.notifyComplaintAssigned(
      updatedComplaint,
      updatedComplaint.assignedDepartment?.name,
      updatedComplaint.assignedOfficial?.name
    );

    return res.status(200).json({
      success: true,
      message: isReassignment
        ? 'Complaint successfully reassigned to new department.'
        : 'Complaint successfully assigned.',
      data: {
        complaint: updatedComplaint,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getUnassignedComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ComplaintWhereInput = {
      OR: [
        { assignedDepartmentId: null },
        { status: ComplaintStatus.SUBMITTED },
        { status: ComplaintStatus.UNDER_REVIEW },
      ],
    };

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where: whereClause }),
      prisma.complaint.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, code: true, name: true } },
          citizen: { select: { id: true, name: true, email: true, phone: true } },
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

