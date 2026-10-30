import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

function generateIncidentNumber(): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let rand = '';
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  const year = new Date().getFullYear();
  return `INC-${year}-${rand}`;
}

export async function getAdminIncidents(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, severity, subsystem } = req.query;

    const where: Prisma.OperationalIncidentWhereInput = {};

    if (typeof status === 'string' && status.trim().length > 0) {
      where.status = status.trim().toUpperCase();
    }

    if (typeof severity === 'string' && severity.trim().length > 0) {
      where.severity = severity.trim().toUpperCase();
    }

    if (typeof subsystem === 'string' && subsystem.trim().length > 0) {
      where.subsystem = subsystem.trim();
    }

    const [total, incidents] = await Promise.all([
      prisma.operationalIncident.count({ where }),
      prisma.operationalIncident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reportedBy: { select: { id: true, name: true, email: true, role: true } },
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          resolvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        incidents: incidents.map((inc) => ({
          ...inc,
          createdAt: inc.createdAt.toISOString(),
          updatedAt: inc.updatedAt.toISOString(),
          resolvedAt: inc.resolvedAt?.toISOString() || null,
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
    console.error('[Admin Incidents List Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INCIDENTS_FETCH_FAILED',
        message: 'Failed to retrieve operational incident records.',
      },
    });
  }
}

export async function createAdminIncident(req: Request, res: Response) {
  try {
    const { title, description, severity, subsystem, assignedToId } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TITLE', message: 'Title must be at least 3 characters long.' },
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DESCRIPTION', message: 'Description must be at least 5 characters long.' },
      });
    }

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const sev = typeof severity === 'string' && validSeverities.includes(severity.toUpperCase())
      ? severity.toUpperCase()
      : 'MEDIUM';

    const sub = typeof subsystem === 'string' && subsystem.trim().length > 0
      ? subsystem.trim().toUpperCase()
      : 'PLATFORM_GENERAL';

    const incidentNumber = generateIncidentNumber();

    const incident = await prisma.$transaction(async (tx) => {
      const inc = await tx.operationalIncident.create({
        data: {
          incidentNumber,
          title: title.trim(),
          description: description.trim(),
          severity: sev,
          subsystem: sub,
          status: 'OPEN',
          reportedById: req.user?.id,
          assignedToId: assignedToId || null,
        },
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit event
      await tx.auditEvent.create({
        data: {
          action: 'OPERATIONAL_INCIDENT_CREATED',
          entityType: 'OPERATIONAL_INCIDENT',
          entityId: inc.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            incidentNumber: inc.incidentNumber,
            title: inc.title,
            severity: inc.severity,
            subsystem: inc.subsystem,
          },
        },
      });

      return inc;
    });

    return res.status(201).json({
      success: true,
      message: `Incident ${incident.incidentNumber} created successfully.`,
      data: {
        ...incident,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        resolvedAt: null,
      },
    });
  } catch (err: unknown) {
    console.error('[Create Incident Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INCIDENT_CREATE_FAILED',
        message: 'Failed to create operational incident record.',
      },
    });
  }
}

export async function getAdminIncidentById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const incident = await prisma.operationalIncident.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true, email: true, role: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        resolvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: 'Operational incident not found.' },
      });
    }

    return res.json({
      success: true,
      data: {
        ...incident,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() || null,
      },
    });
  } catch (err: unknown) {
    console.error('[Get Incident Detail Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INCIDENT_FETCH_FAILED', message: 'Failed to retrieve incident details.' },
    });
  }
}

export async function updateAdminIncident(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, severity, subsystem, assignedToId, resolutionNotes } = req.body;

    const existing = await prisma.operationalIncident.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: 'Operational incident not found.' },
      });
    }

    const validStatuses = ['OPEN', 'INVESTIGATING', 'MONITORING', 'RESOLVED'];
    if (status && !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        },
      });
    }

    const isResolving = status && status.toUpperCase() === 'RESOLVED';
    const isPreviouslyResolved = existing.status === 'RESOLVED';

    const updated = await prisma.$transaction(async (tx) => {
      const inc = await tx.operationalIncident.update({
        where: { id },
        data: {
          ...(status && { status: status.toUpperCase() }),
          ...(severity && { severity: severity.toUpperCase() }),
          ...(subsystem && { subsystem: subsystem.toUpperCase() }),
          ...(assignedToId !== undefined && { assignedToId }),
          ...(resolutionNotes !== undefined && { resolutionNotes }),
          ...(isResolving && !isPreviouslyResolved && {
            resolvedAt: new Date(),
            resolvedById: req.user?.id,
          }),
          ...(status && status.toUpperCase() !== 'RESOLVED' && {
            resolvedAt: null,
            resolvedById: null,
          }),
        },
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit event
      await tx.auditEvent.create({
        data: {
          action: 'OPERATIONAL_INCIDENT_UPDATED',
          entityType: 'OPERATIONAL_INCIDENT',
          entityId: inc.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            incidentNumber: inc.incidentNumber,
            previousStatus: existing.status,
            newStatus: inc.status,
            resolutionNotes: inc.resolutionNotes,
          },
        },
      });

      return inc;
    });

    return res.json({
      success: true,
      message: `Incident ${updated.incidentNumber} updated successfully.`,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        resolvedAt: updated.resolvedAt?.toISOString() || null,
      },
    });
  } catch (err: unknown) {
    console.error('[Update Incident Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INCIDENT_UPDATE_FAILED', message: 'Failed to update operational incident.' },
    });
  }
}
