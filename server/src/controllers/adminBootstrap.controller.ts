import type { Request, Response, NextFunction } from 'express';
import {
  checkAdminExists,
  isBootstrapConfigured,
  verifySetupSecret,
  provisionInitialAdmin,
} from '../services/adminBootstrap.service.js';
import { bootstrapAdminSchema } from '../validation/auth.validation.js';

/**
 * POST /api/auth/bootstrap-admin
 * Secure one-time production administrator provisioning endpoint.
 */
export async function postBootstrapAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Check if bootstrap is enabled on this server (ADMIN_SETUP_SECRET configured with >= 32 chars)
    if (!isBootstrapConfigured()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BOOTSTRAP_DISABLED',
          message:
            'Administrator bootstrap is not configured or has been permanently disabled on this server.',
        },
      });
    }

    // 2. Extract and verify setup secret FIRST (prevents unauthenticated information discovery)
    const headerSecret = req.headers['x-admin-setup-secret'];
    const bodySecret = typeof req.body?.setupSecret === 'string' ? req.body.setupSecret : undefined;
    const candidateSecret = typeof headerSecret === 'string' ? headerSecret : bodySecret;

    if (!verifySetupSecret(candidateSecret)) {
      console.warn(
        `[Civora Admin Bootstrap] Unauthorized setup attempt from IP ${req.ip || 'unknown'}`
      );
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SETUP_SECRET',
          message: 'Invalid or missing administrator setup secret.',
        },
      });
    }

    // 3. Check if an administrator already exists in database (Durable permanent lock)
    const adminExists = await checkAdminExists();
    if (adminExists) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'BOOTSTRAP_ALREADY_COMPLETED',
          message:
            'An administrator account already exists. The bootstrap mechanism is permanently disabled.',
        },
      });
    }

    // 4. Validate request payload
    const parseResult = bootstrapAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid administrator registration payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { email, password, name, phone } = parseResult.data;

    // 5. Execute provisioning
    const result = await provisionInitialAdmin({
      email,
      password,
      name,
      phone,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });

    return res.status(201).json({
      success: true,
      message:
        'Production administrator account provisioned successfully. You can now log in via /api/auth/login.',
      data: {
        user: result.user,
      },
    });
  } catch (err: any) {
    if (err?.message === 'BOOTSTRAP_IN_PROGRESS') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'BOOTSTRAP_IN_PROGRESS',
          message: 'Administrator bootstrap is currently in progress. Please wait a moment.',
        },
      });
    }

    if (err?.message === 'ADMIN_ALREADY_EXISTS') {
      return res.status(410).json({
        success: false,
        error: {
          code: 'BOOTSTRAP_ALREADY_COMPLETED',
          message:
            'An administrator account already exists. The bootstrap mechanism is permanently disabled.',
        },
      });
    }

    if (err?.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    return next(err);
  }
}

/**
 * GET /api/auth/bootstrap-admin/status
 * Diagnostic check to verify whether administrator bootstrap is ready or completed.
 * Requires valid x-admin-setup-secret header to prevent information leakage.
 */
export async function getBootstrapStatus(req: Request, res: Response) {
  const headerSecret = req.headers['x-admin-setup-secret'];
  const candidateSecret = typeof headerSecret === 'string' ? headerSecret : undefined;

  if (!verifySetupSecret(candidateSecret)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SETUP_SECRET',
        message: 'Valid x-admin-setup-secret header is required to inspect bootstrap status.',
      },
    });
  }

  const configured = isBootstrapConfigured();
  const adminExists = await checkAdminExists();

  return res.status(200).json({
    success: true,
    data: {
      bootstrapConfigured: configured,
      adminExists,
      status: adminExists
        ? 'PERMANENTLY_DISABLED_ADMIN_EXISTS'
        : configured
        ? 'READY_FOR_INITIALIZATION'
        : 'DISABLED_MISSING_SECRET',
    },
  });
}
