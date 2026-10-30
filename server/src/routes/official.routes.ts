import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getOfficialWorkspaceComplaints } from '../controllers/officialWorkflow.controller.js';
import {
  verifyWorkStart,
  reviewMilestone,
  recordPaymentTransaction,
  reportDefect,
  verifyDefect,
  listContractors,
  verifyContractor,
} from '../controllers/contractor.controller.js';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Official workspace routes require authentication and official or admin role
router.use(authenticateUser);
router.use(requireRoles(UserRole.GOVERNMENT_OFFICIAL, UserRole.ADMIN));

// List complaints assigned to the official or their department
router.get('/complaints', getOfficialWorkspaceComplaints);

// Work order execution & engineering verification
router.post('/work-orders/:id/work-start/verify', verifyWorkStart);
router.post('/work-orders/:id/milestones/:milestoneId/review', reviewMilestone);
router.post('/work-orders/:id/payments', recordPaymentTransaction);
router.post('/work-orders/:id/defects', reportDefect);
router.post('/defects/:id/verify', verifyDefect);

// Contractor directory & verification
router.get('/contractors', listContractors);
router.post('/contractors/:id/verify', verifyContractor);

export default router;
