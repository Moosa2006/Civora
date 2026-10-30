import type { Request, Response, NextFunction } from 'express';
import { UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createMessageSchema } from '../validation/notification.validation.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * Helper to resolve complaint by UUID or trackingId
 */
async function resolveComplaint(idOrTrackingId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrTrackingId);
  const whereClause: Prisma.ComplaintWhereUniqueInput = isUuid
    ? { id: idOrTrackingId }
    : { trackingId: idOrTrackingId.toUpperCase() };

  return prisma.complaint.findUnique({
    where: whereClause,
    include: {
      category: { select: { id: true, name: true } },
      assignedDepartment: { select: { id: true, name: true, code: true } },
      assignedOfficial: { select: { id: true, name: true } },
    },
  });
}

/**
 * 1. GET /api/complaints/:id/messages
 * Retrieve communication thread for an authorized complaint
 */
export async function getComplaintMessages(req: Request, res: Response, next: NextFunction) {
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

    const isCitizen = req.user.role === UserRole.CITIZEN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;
    const isAdmin = req.user.role === UserRole.ADMIN;

    // Access control checks
    if (isCitizen) {
      if (complaint.citizenId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to view messages for complaints lodged by other citizens.',
          },
        });
      }
    } else if (isOfficial) {
      const belongsToDepartment =
        req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssignedOfficial = req.user.id === complaint.assignedOfficialId;

      if (!belongsToDepartment && !isAssignedOfficial) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to view messages for complaints outside your department scope.',
          },
        });
      }
    }

    // Citizens cannot see internal official notes; Officials and Admins see all
    const messageWhere: any = {
      complaintId: complaint.id,
    };
    if (isCitizen) {
      messageWhere.isInternal = false;
    }

    const messages = await prisma.complaintMessage.findMany({
      where: messageWhere,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Mark unread messages sent by other parties as read
    await prisma.complaintMessage.updateMany({
      where: {
        complaintId: complaint.id,
        senderId: { not: req.user.id },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.id,
        trackingId: complaint.trackingId,
        title: complaint.title,
        messages,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 2. POST /api/complaints/:id/messages
 * Post a new message to the complaint-linked communication thread
 */
export async function sendComplaintMessage(req: Request, res: Response, next: NextFunction) {
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

    const isCitizen = req.user.role === UserRole.CITIZEN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;
    const isAdmin = req.user.role === UserRole.ADMIN;

    // Access control checks
    if (isCitizen) {
      if (complaint.citizenId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You cannot post messages to complaints lodged by another citizen.',
          },
        });
      }
    } else if (isOfficial) {
      const belongsToDepartment =
        req.user.departmentId && req.user.departmentId === complaint.assignedDepartmentId;
      const isAssignedOfficial = req.user.id === complaint.assignedOfficialId;

      if (!belongsToDepartment && !isAssignedOfficial) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to message on complaints outside your assigned department.',
          },
        });
      }
    }

    const parseResult = createMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid message input.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { message, isInternal } = parseResult.data;
    // Citizens cannot create internal official-only notes
    const enforcedInternal = isCitizen ? false : isInternal;

    const newMessage = await prisma.complaintMessage.create({
      data: {
        complaintId: complaint.id,
        senderId: req.user.id,
        message,
        isInternal: enforcedInternal,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Notify the other party if not internal
    if (!enforcedInternal) {
      await NotificationService.notifyMessageReceived(
        complaint,
        {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role,
        },
        message
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: { message: newMessage },
    });
  } catch (err) {
    return next(err);
  }
}
