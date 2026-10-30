import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getHealthCheck(_req: Request, res: Response) {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbLatencyMs: number | null = null;

  try {
    // Perform light database ping
    await prisma.$queryRawUnsafe('SELECT 1');
    dbStatus = 'connected';
    dbLatencyMs = Date.now() - startTime;
  } catch (err: unknown) {
    console.error('[Health Check DB Ping Failed]:', err);
    dbStatus = 'error';
  }

  const isDbHealthy = dbStatus === 'connected';

  // Provide both top-level and structured data for compatibility
  return res.status(isDbHealthy ? 200 : 503).json({
    success: isDbHealthy,
    status: isDbHealthy ? 'ok' : 'degraded',
    service: 'civora-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    data: {
      api: 'ok',
      database: dbStatus,
      latencyMs: dbLatencyMs,
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
  });
}

export async function getReadinessCheck(_req: Request, res: Response) {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return res.status(200).json({
      success: true,
      status: 'ready',
      service: 'civora-backend',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'connected',
      },
    });
  } catch (err: unknown) {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      service: 'civora-backend',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'disconnected',
      },
    });
  }
}

export async function getAdminDiagnostics(_req: Request, res: Response) {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbLatencyMs: number | null = null;
  let metrics = {
    complaintsCount: 0,
    usersCount: 0,
    departmentsCount: 0,
    slaPoliciesCount: 0,
    activeEscalationsCount: 0,
    openIncidentsCount: 0,
  };

  try {
    const [
      complaintsCount,
      usersCount,
      departmentsCount,
      slaPoliciesCount,
      activeEscalationsCount,
      openIncidentsCount,
    ] = await Promise.all([
      prisma.complaint.count(),
      prisma.user.count(),
      prisma.department.count(),
      prisma.slaPolicy.count(),
      prisma.complaintEscalation.count({
        where: {
          status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ACTION_PLANNED'] },
        },
      }),
      prisma.operationalIncident.count({
        where: {
          status: { in: ['OPEN', 'INVESTIGATING', 'MONITORING'] },
        },
      }),
    ]);
    dbStatus = 'connected';
    dbLatencyMs = Date.now() - startTime;
    metrics = {
      complaintsCount,
      usersCount,
      departmentsCount,
      slaPoliciesCount,
      activeEscalationsCount,
      openIncidentsCount,
    };
  } catch (err: unknown) {
    console.error('[Admin Diagnostics DB Query Failed]:', err);
    dbStatus = 'error';
  }

  const memory = process.memoryUsage();

  return res.json({
    success: true,
    data: {
      service: 'civora-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      metrics,
    },
  });
}

