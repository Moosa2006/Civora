import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UserRole, UserRestrictionType } from '@prisma/client';
import {
  uploadEvidence,
  getComplaintEvidence,
  getEvidenceDetails,
  downloadEvidenceFile,
  reviewEvidence,
  quarantineEvidence,
  getPendingReviewQueue,
} from '../controllers/evidence.controller.js';
import {
  authenticateUser,
  optionalAuthenticateUser,
  requireRoles,
} from '../middleware/auth.middleware.js';
import { uploadEvidenceFiles } from '../middleware/upload.middleware.js';
import { requireNoRestriction } from '../middleware/restriction.middleware.js';

const router = Router();

// Rate limiter for evidence uploads (prevent storage spam and DoS)
const evidenceUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: process.env.NODE_ENV === 'test' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many evidence file uploads. Please wait before uploading more files.',
    },
  },
});

/**
 * 1. Upload evidence to a specific complaint (citizens, assigned officials, admins)
 * POST /api/evidence/complaints/:complaintId/upload
 */
router.post(
  '/complaints/:complaintId/upload',
  authenticateUser,
  evidenceUploadLimiter,
  requireNoRestriction(UserRestrictionType.UPLOAD_RESTRICTED),
  uploadEvidenceFiles,
  uploadEvidence
);

/**
 * 2. Get all visible evidence for a complaint
 * GET /api/evidence/complaints/:complaintId
 */
router.get(
  '/complaints/:complaintId',
  optionalAuthenticateUser,
  getComplaintEvidence
);

/**
 * 3. Pending evidence review queue (Officials and Admins)
 * GET /api/evidence/pending-queue
 */
router.get(
  '/pending-queue',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getPendingReviewQueue
);

/**
 * 4. Retrieve evidence metadata and review history
 * GET /api/evidence/:id
 */
router.get('/:id', optionalAuthenticateUser, getEvidenceDetails);

/**
 * 5. Secure file streaming / inline rendering (access controlled)
 * GET /api/evidence/:id/file
 */
router.get('/:id/file', optionalAuthenticateUser, downloadEvidenceFile);

/**
 * 6. Secure file download as attachment (access controlled)
 * GET /api/evidence/:id/download
 */
router.get('/:id/download', optionalAuthenticateUser, downloadEvidenceFile);

/**
 * 7. Evidence verification & review decisions (approve, reject, request resubmission)
 * POST /api/evidence/:id/review
 */
router.post(
  '/:id/review',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  reviewEvidence
);

/**
 * 8. Quarantine suspicious or abusive evidence (Admin only)
 * POST /api/evidence/:id/quarantine
 */
router.post(
  '/:id/quarantine',
  authenticateUser,
  requireRoles(UserRole.ADMIN),
  quarantineEvidence
);

export default router;
