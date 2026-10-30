import type { Request, Response, NextFunction } from 'express';
import { isMaintenanceModeActive, getMaintenanceMessage } from '../lib/configService.js';
import { UserRole } from '@prisma/client';

export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const isActive = await isMaintenanceModeActive();
    if (!isActive) {
      return next();
    }

    // 1. Administrators retain full access for system operations & recovery
    if (req.user && req.user.role === UserRole.ADMIN) {
      return next();
    }

    // 2. Health and readiness endpoints are preserved for infrastructure monitoring
    const path = req.path.toLowerCase();
    if (path.startsWith('/health') || path === '/health') {
      return next();
    }

    // 3. Authentication endpoints must remain accessible so admins can sign in
    if (
      path === '/auth/login' ||
      path === '/auth/logout' ||
      path === '/auth/me' ||
      path === '/auth/admin-check'
    ) {
      return next();
    }

    // 4. Safe read-only operations (GET, HEAD, OPTIONS) are preserved
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // 5. Non-admin write operations (POST, PUT, PATCH, DELETE) are suspended during maintenance
    const message = await getMaintenanceMessage();
    return res.status(503).json({
      success: false,
      error: {
        code: 'MAINTENANCE_MODE',
        message:
          message ||
          'Civora is currently undergoing scheduled platform maintenance. Write operations are temporarily suspended. Please try again shortly.',
        correlationId: req.correlationId,
      },
    });
  } catch (err) {
    // If maintenance check fails, fail open to avoid catastrophic lock-out but log error
    console.error('[MaintenanceModeMiddleware Error]:', err);
    return next();
  }
}
