import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export function sanitizeAuditDetails(details: unknown): unknown {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sensitiveKeys = [
    'password',
    'passwordHash',
    'token',
    'jwt',
    'cookie',
    'secret',
    'authorization',
  ];

  if (Array.isArray(details)) {
    return details.map((item) => sanitizeAuditDetails(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    const isSensitive = sensitiveKeys.some((s) => k.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeAuditDetails(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export async function getAdminAuditEvents(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const skip = (page - 1) * limit;

    const { action, entityType, actorId, startDate, endDate, search } = req.query;

    const where: Prisma.AuditEventWhereInput = {};

    if (typeof action === 'string' && action.trim().length > 0) {
      where.action = { equals: action.trim() };
    }

    if (typeof entityType === 'string' && entityType.trim().length > 0) {
      where.entityType = { equals: entityType.trim() };
    }

    if (typeof actorId === 'string' && actorId.trim().length > 0) {
      where.actorId = { equals: actorId.trim() };
    }

    if (typeof startDate === 'string' && startDate.trim().length > 0) {
      const parsedStart = new Date(startDate.trim());
      if (!isNaN(parsedStart.getTime())) {
        where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), gte: parsedStart };
      }
    }

    if (typeof endDate === 'string' && endDate.trim().length > 0) {
      const parsedEnd = new Date(endDate.trim());
      if (!isNaN(parsedEnd.getTime())) {
        where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), lte: parsedEnd };
      }
    }

    if (typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { ipAddress: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          createdAt: e.createdAt.toISOString(),
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          actor: e.actor
            ? {
                id: e.actor.id,
                name: e.actor.name,
                email: e.actor.email,
                role: e.actor.role,
              }
            : null,
          details: sanitizeAuditDetails(e.details),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Audit Events Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_FETCH_FAILED',
        message: 'Failed to retrieve administrative audit logs.',
      },
    });
  }
}

export async function getAdminAuditEventById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const event = await prisma.auditEvent.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIT_EVENT_NOT_FOUND',
          message: 'The requested audit record does not exist.',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          createdAt: event.createdAt.toISOString(),
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          actor: event.actor
            ? {
                id: event.actor.id,
                name: event.actor.name,
                email: event.actor.email,
                role: event.actor.role,
              }
            : null,
          details: sanitizeAuditDetails(event.details),
        },
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Audit Detail Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_DETAIL_FAILED',
        message: 'Failed to retrieve audit event details.',
      },
    });
  }
}
