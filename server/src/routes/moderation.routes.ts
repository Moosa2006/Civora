import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  submitAbuseReport,
  checkDuplicateComplaint,
  getModerationQueue,
  getModerationCaseDetails,
  applyModerationAction,
  submitAppeal,
  reviewAppeal,
  applyUserRestriction,
  liftUserRestriction,
  linkDuplicateComplaints,
  getModerationMetrics,
  getPlatformRules,
} from '../controllers/moderation.controller.js';
import {
  authenticateUser,
  optionalAuthenticateUser,
  requireRoles,
} from '../middleware/auth.middleware.js';
import {
  abuseReportLimiter,
  testStrictRateLimiter,
} from '../lib/rateLimiters.js';

const router = Router();

/**
 * Public platform content standards and moderation policy
 * GET /api/moderation/rules
 */
router.get('/rules', getPlatformRules);

/**
 * Duplicate check endpoint (Pre-submission advisory)
 * POST /api/moderation/duplicates/check
 */
router.post('/duplicates/check', optionalAuthenticateUser, checkDuplicateComplaint);

/**
 * Submit an abuse report
 * POST /api/moderation/reports
 */
router.post(
  '/reports',
  optionalAuthenticateUser,
  abuseReportLimiter,
  submitAbuseReport
);

/**
 * Moderation queue for municipal officials and administrators
 * GET /api/moderation/queue
 */
router.get(
  '/queue',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getModerationQueue
);

/**
 * Moderation case details
 * GET /api/moderation/cases/:id
 */
router.get(
  '/cases/:id',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getModerationCaseDetails
);

/**
 * Execute reason-based moderation action
 * POST /api/moderation/cases/:id/action
 */
router.post(
  '/cases/:id/action',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  applyModerationAction
);

/**
 * Citizen appeal submission
 * POST /api/moderation/appeals
 */
router.post('/appeals', authenticateUser, submitAppeal);

/**
 * Supervisory appeal review (Separation of duties)
 * POST /api/moderation/appeals/:id/review
 */
router.post(
  '/appeals/:id/review',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  reviewAppeal
);

/**
 * User restrictions (Administrator only)
 * POST /api/moderation/restrictions
 * POST /api/moderation/restrictions/:id/lift
 */
router.post(
  '/restrictions',
  authenticateUser,
  requireRoles(UserRole.ADMIN),
  applyUserRestriction
);

router.post(
  '/restrictions/:id/lift',
  authenticateUser,
  requireRoles(UserRole.ADMIN),
  liftUserRestriction
);

/**
 * Link duplicate complaints
 * POST /api/moderation/duplicates/link
 */
router.post(
  '/duplicates/link',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  linkDuplicateComplaints
);

/**
 * Aggregate metrics (Administrator only)
 * GET /api/moderation/metrics
 */
router.get(
  '/metrics',
  authenticateUser,
  requireRoles(UserRole.ADMIN),
  getModerationMetrics
);

/**
 * Dedicated test endpoint to verify strict rate limiting behavior (429 & headers)
 * GET /api/moderation/test-rate-limit
 */
router.get('/test-rate-limit', testStrictRateLimiter, (_req, res) => {
  return res.status(200).json({ success: true, message: 'Rate limit check passed.' });
});

export default router;
