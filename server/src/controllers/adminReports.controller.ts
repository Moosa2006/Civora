import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getSettingValue } from '../lib/configService.js';
import { Prisma } from '@prisma/client';

/**
 * Escapes CSV values and protects against CSV Formula Injection (CWE-1236).
 * Any cell starting with =, +, -, @, \t, or \r is prefixed with a single quote.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Check for formula injection triggers
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaTriggers.some((t) => str.startsWith(t))) {
    str = `'${str}`;
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function exportAuditLogsCsv(req: Request, res: Response) {
  try {
    const maxRowsSetting = await getSettingValue('audit_export_max_rows');
    const maxRows = Math.min(5000, Math.max(50, parseInt(maxRowsSetting, 10) || 1000));

    const { action, entityType, actorId, startDate, endDate } = req.query;

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

    const events = await prisma.auditEvent.findMany({
      where,
      take: maxRows,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Record audit event for the export operation
    await prisma.auditEvent.create({
      data: {
        action: 'EXPORT_AUDIT_REPORT',
        entityType: 'AUDIT_EXPORT',
        entityId: req.user?.id || '00000000-0000-0000-0000-000000000000',
        actorId: req.user?.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        details: {
          exportedRowCount: events.length,
          filters: { action, entityType, actorId, startDate, endDate },
        },
      },
    });

    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'Action',
      'Entity Type',
      'Entity ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'IP Address',
    ];

    const rows = events.map((e) => [
      sanitizeCsvCell(e.id),
      sanitizeCsvCell(e.createdAt.toISOString()),
      sanitizeCsvCell(e.action),
      sanitizeCsvCell(e.entityType),
      sanitizeCsvCell(e.entityId),
      sanitizeCsvCell(e.actor?.name || 'System / Unattributed'),
      sanitizeCsvCell(e.actor?.email || 'N/A'),
      sanitizeCsvCell(e.actor?.role || 'N/A'),
      sanitizeCsvCell(e.ipAddress || 'N/A'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="civora-audit-log-${dateStr}.csv"`
    );

    return res.status(200).send(csvContent);
  } catch (err: unknown) {
    console.error('[Export Audit CSV Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to generate audit log CSV export.' },
    });
  }
}

export async function exportWorkflowCsv(req: Request, res: Response) {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            assignedComplaints: true,
          },
        },
      },
    });

    const headers = [
      'Department ID',
      'Department Code',
      'Department Name',
      'Total Assigned Complaints',
      'Active Status',
    ];

    const rows = departments.map((d) => [
      sanitizeCsvCell(d.id),
      sanitizeCsvCell(d.code),
      sanitizeCsvCell(d.name),
      sanitizeCsvCell(d._count.assignedComplaints),
      sanitizeCsvCell(d.isActive ? 'Active' : 'Inactive'),
    ]);

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        action: 'EXPORT_WORKFLOW_REPORT',
        entityType: 'WORKFLOW_EXPORT',
        entityId: req.user?.id || '00000000-0000-0000-0000-000000000000',
        actorId: req.user?.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        details: { departmentCount: departments.length },
      },
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="civora-workflow-report-${dateStr}.csv"`
    );

    return res.status(200).send(csvContent);
  } catch (err: unknown) {
    console.error('[Export Workflow CSV Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to generate workflow CSV export.' },
    });
  }
}

export async function exportIncidentsCsv(req: Request, res: Response) {
  try {
    const incidents = await prisma.operationalIncident.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } },
      },
    });

    const headers = [
      'Incident Number',
      'Title',
      'Severity',
      'Subsystem',
      'Status',
      'Reported By',
      'Assigned To',
      'Created At',
      'Resolved At',
      'Resolved By',
      'Resolution Notes',
    ];

    const rows = incidents.map((inc) => [
      sanitizeCsvCell(inc.incidentNumber),
      sanitizeCsvCell(inc.title),
      sanitizeCsvCell(inc.severity),
      sanitizeCsvCell(inc.subsystem),
      sanitizeCsvCell(inc.status),
      sanitizeCsvCell(inc.reportedBy?.name || 'System'),
      sanitizeCsvCell(inc.assignedTo?.name || 'Unassigned'),
      sanitizeCsvCell(inc.createdAt.toISOString()),
      sanitizeCsvCell(inc.resolvedAt?.toISOString() || 'N/A'),
      sanitizeCsvCell(inc.resolvedBy?.name || 'N/A'),
      sanitizeCsvCell(inc.resolutionNotes || ''),
    ]);

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        action: 'EXPORT_INCIDENTS_REPORT',
        entityType: 'INCIDENTS_EXPORT',
        entityId: req.user?.id || '00000000-0000-0000-0000-000000000000',
        actorId: req.user?.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        details: { incidentCount: incidents.length },
      },
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="civora-incidents-report-${dateStr}.csv"`
    );

    return res.status(200).send(csvContent);
  } catch (err: unknown) {
    console.error('[Export Incidents CSV Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to generate incidents CSV export.' },
    });
  }
}
