import { Router } from 'express';
import { UserRole, UserRestrictionType } from '@prisma/client';
import { authenticateUser, optionalAuthenticateUser, requireRoles } from '../middleware/auth.middleware.js';
import { requireNoRestriction } from '../middleware/restriction.middleware.js';
import {
  proposalCreateLimiter,
  commentCreateLimiter,
  pollVoteLimiter,
} from '../lib/rateLimiters.js';
import {
  createProposal,
  getPublicProposals,
  getMyProposals,
  getProposalById,
  toggleProposalSupport,
  getProposalComments,
  createProposalComment,
  getAdminProposalsQueue,
  moderateProposal,
  addOfficialResponse,
} from '../controllers/proposals.controller.js';
import {
  getPublicPolls,
  getPollById,
  submitPollVote,
  createPoll,
  updatePollStatus,
  getEngagementAnalytics,
} from '../controllers/polls.controller.js';

const router = Router();

// ==========================================
// A. Proposals Endpoints
// ==========================================

// 1. Submit proposal (Citizen)
router.post(
  '/proposals',
  authenticateUser,
  proposalCreateLimiter,
  requireNoRestriction(UserRestrictionType.SUBMISSION_RESTRICTED),
  createProposal
);

// 2. Public proposal explorer
router.get('/proposals', optionalAuthenticateUser, getPublicProposals);

// 3. Current user's submitted proposals
router.get('/proposals/my', authenticateUser, getMyProposals);

// 4. Proposal detail by ID
router.get('/proposals/:id', optionalAuthenticateUser, getProposalById);

// 5. Toggle community support
router.post('/proposals/:id/support', authenticateUser, toggleProposalSupport);

// 6. Comments on proposals
router.get('/proposals/:id/comments', optionalAuthenticateUser, getProposalComments);
router.post(
  '/proposals/:id/comments',
  authenticateUser,
  commentCreateLimiter,
  requireNoRestriction(UserRestrictionType.COMMENTING_RESTRICTED),
  createProposalComment
);

// ==========================================
// B. Proposal Moderation Queue (Staff / Admin)
// ==========================================

router.get(
  '/admin/proposals',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getAdminProposalsQueue
);

router.patch(
  '/admin/proposals/:id/status',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  moderateProposal
);

router.post(
  '/admin/proposals/:id/response',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  addOfficialResponse
);

// ==========================================
// C. Public Polls & Voting Endpoints
// ==========================================

// 1. Get public polls
router.get('/polls', optionalAuthenticateUser, getPublicPolls);

// 2. Get poll detail
router.get('/polls/:id', optionalAuthenticateUser, getPollById);

// 3. Submit vote
router.post('/polls/:id/vote', authenticateUser, pollVoteLimiter, submitPollVote);

// 4. Create poll (Admin / Official)
router.post(
  '/admin/polls',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  createPoll
);

// 5. Update poll status (Admin only)
router.patch(
  '/admin/polls/:id/status',
  authenticateUser,
  requireRoles(UserRole.ADMIN),
  updatePollStatus
);

// ==========================================
// D. Engagement Analytics
// ==========================================

router.get('/analytics/overview', getEngagementAnalytics);

export default router;
