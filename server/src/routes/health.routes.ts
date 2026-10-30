import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getHealthCheck,
  getReadinessCheck,
  getAdminDiagnostics,
} from '../controllers/health.controller.js';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Public operational health probe (Liveness)
router.get('/', getHealthCheck);

// Public deployment readiness probe (Readiness)
router.get('/ready', getReadinessCheck);

// Protected admin diagnostics probe
router.get('/diagnostics', authenticateUser, requireRoles(UserRole.ADMIN), getAdminDiagnostics);

export default router;

