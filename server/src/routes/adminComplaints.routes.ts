import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getAllComplaints,
  getUnassignedComplaints,
  updateComplaintStatus,
  assignComplaint,
  separateSubordinateComplaint,
} from '../controllers/adminComplaints.controller.js';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';

const router = Router();

// All administrative routes require authentication and staff roles (ADMIN or GOVERNMENT_OFFICIAL)
router.use(authenticateUser);
router.use(requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL));

// List complaints with triage filters (status, category, department, priority, search)
router.get('/', getAllComplaints);

// List complaints awaiting department assignment
router.get('/unassigned', getUnassignedComplaints);

// Update status with lifecycle validation
router.patch('/:id/status', updateComplaintStatus);

// Assign complaint to department and/or official
router.patch('/:id/assign', assignComplaint);

// Unlink / separate incorrectly consolidated subordinate complaint back into an independent issue
router.post('/:id/separate', separateSubordinateComplaint);

export default router;
