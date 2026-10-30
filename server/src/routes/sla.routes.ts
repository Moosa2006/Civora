import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';
import {
  getAllPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  togglePolicyActive,
  getComplaintSla,
  getOverdueComplaints,
  getApproachingDeadlineComplaints,
  updateEstimatedCompletion,
  getEscalations,
  getEscalationById,
  acknowledgeEscalation,
  recordEscalationActionPlan,
  resolveEscalation,
  manualEscalateComplaint,
  getExtensionRequests,
  requestSlaExtension,
  decideSlaExtension,
  runEvaluation,
  getSlaAccountabilityMetrics,
  getPublicSlaTransparency,
} from '../controllers/sla.controller.js';

const slaRouter = Router();

// ==========================================
// PUBLIC TRANSPARENCY
// ==========================================
slaRouter.get('/transparency', getPublicSlaTransparency);
slaRouter.get('/transparency/overview', getPublicSlaTransparency);

// ==========================================
// AUTHENTICATED CITIZEN & STAFF
// ==========================================
slaRouter.get('/complaints/:complaintId', authenticateUser, getComplaintSla);

// ==========================================
// STAFF ONLY (ADMIN & OFFICIAL)
// ==========================================
const staffOnly = [authenticateUser, requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)];
const adminOnly = [authenticateUser, requireRoles(UserRole.ADMIN)];

// Policies
slaRouter.get('/policies', ...staffOnly, getAllPolicies);
slaRouter.get('/policies/:id', ...staffOnly, getPolicyById);
slaRouter.post('/policies', ...adminOnly, createPolicy);
slaRouter.patch('/policies/:id', ...adminOnly, updatePolicy);
slaRouter.patch('/policies/:id/toggle', ...adminOnly, togglePolicyActive);

// Monitoring queues
slaRouter.get('/overdue', ...staffOnly, getOverdueComplaints);
slaRouter.get('/approaching', ...staffOnly, getApproachingDeadlineComplaints);
slaRouter.patch('/complaints/:complaintId/estimated-completion', ...staffOnly, updateEstimatedCompletion);

// Escalations
slaRouter.get('/escalations', ...staffOnly, getEscalations);
slaRouter.get('/escalations/:id', ...staffOnly, getEscalationById);
slaRouter.post('/escalations/:id/acknowledge', ...staffOnly, acknowledgeEscalation);
slaRouter.post('/escalations/:id/action-plan', ...staffOnly, recordEscalationActionPlan);
slaRouter.post('/escalations/:id/resolve', ...staffOnly, resolveEscalation);
slaRouter.post('/complaints/:complaintId/escalate', ...staffOnly, manualEscalateComplaint);

// Extensions
slaRouter.get('/extensions', ...staffOnly, getExtensionRequests);
slaRouter.post('/complaints/:complaintId/extensions', ...staffOnly, requestSlaExtension);
slaRouter.post('/complaints/:complaintId/extension-request', ...staffOnly, requestSlaExtension);
slaRouter.post('/extensions/:requestId/decide', ...staffOnly, decideSlaExtension);
slaRouter.patch('/extensions/:requestId/decision', ...staffOnly, decideSlaExtension);

// Evaluation Runner & Accountability Reports
slaRouter.post('/evaluate', ...adminOnly, runEvaluation);
slaRouter.get('/metrics', ...staffOnly, getSlaAccountabilityMetrics);
slaRouter.get('/accountability', ...staffOnly, getSlaAccountabilityMetrics);

export default slaRouter;
