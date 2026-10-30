import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  notificationQuerySchema,
  updatePreferencesSchema,
} from '../validation/notification.validation.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * 1. GET /api/notifications
 * Retrieve paginated notifications for the authenticated user
 */
export async function getUserNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const parseResult = notificationQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid notification query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { page, limit, isRead } = parseResult.data;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId: req.user.id,
    };

    if (isRead !== undefined) {
      whereClause.isRead = isRead;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          unreadCount,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 2. GET /api/notifications/unread-count
 * Ultra-lightweight endpoint for real-time / polling navbar badge
 */
export async function getUnreadNotificationCount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 3. PATCH /api/notifications/:id/read
 * Mark an individual notification as read
 */
export async function markNotificationAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const id = String(req.params.id || '').trim();

    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found.' },
      });
    }

    // Strict ownership verification: cannot mark another user's notification as read
    if (existing.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to modify this notification.',
        },
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: { notification: updated },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 4. POST /api/notifications/mark-all-read
 * Mark all unread notifications for current user as read
 */
export async function markAllNotificationsAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      data: { count: result.count },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 5. GET /api/notifications/preferences
 * Retrieve current user's notification preferences
 */
export async function getUserPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const preferences = await NotificationService.getUserPreferences(req.user.id);

    return res.status(200).json({
      success: true,
      data: { preferences },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 6. PUT /api/notifications/preferences
 * Update current user's notification preferences
 */
export async function updateUserPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const parseResult = updatePreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid preferences payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const data = parseResult.data;

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        ...data,
      },
      update: {
        ...data,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully.',
      data: { preferences },
    });
  } catch (err) {
    return next(err);
  }
}
