import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';
import { getAdminDashboardOverview } from '../controllers/adminDashboard.controller.js';
import {
  getAdminConfig,
  updateAdminConfig,
  getAdminConfigHistory,
} from '../controllers/adminConfig.controller.js';
import {
  getAdminAuditEvents,
  getAdminAuditEventById,
} from '../controllers/adminAudit.controller.js';
import {
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  createAdminOfficial,
  getContractorApplications,
  approveContractorApplication,
  rejectContractorApplication,
} from '../controllers/adminUsers.controller.js';
import {
  getAdminIncidents,
  createAdminIncident,
  getAdminIncidentById,
  updateAdminIncident,
} from '../controllers/adminIncidents.controller.js';
import {
  exportAuditLogsCsv,
  exportWorkflowCsv,
  exportIncidentsCsv,
} from '../controllers/adminReports.controller.js';

const router = Router();

// All administrative endpoints require valid ADMIN authentication
router.use(authenticateUser, requireRoles(UserRole.ADMIN));

// 1. Dashboard Overview Metrics
router.get('/dashboard/overview', getAdminDashboardOverview);

// 2. Platform Configuration Management
router.get('/config', getAdminConfig);
router.put('/config/:key', updateAdminConfig);
router.get('/config/history', getAdminConfigHistory);

// 3. Administrative Audit Logs & Reporting
router.get('/audit', getAdminAuditEvents);
router.get('/audit/:id', getAdminAuditEventById);

// 4. User and Role Administration & Official Onboarding
router.get('/users', getAdminUsers);
router.post('/officials', createAdminOfficial);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);

// 5. Contractor Onboarding & Application Review
router.get('/contractor-applications', getContractorApplications);
router.post('/contractors/:id/approve', approveContractorApplication);
router.post('/contractors/:id/reject', rejectContractorApplication);


// 5. Operational Incident Management
router.get('/incidents', getAdminIncidents);
router.post('/incidents', createAdminIncident);
router.get('/incidents/:id', getAdminIncidentById);
router.patch('/incidents/:id', updateAdminIncident);

// 6. Reports & CSV Exports
router.get('/reports/audit-export', exportAuditLogsCsv);
router.get('/reports/workflow-export', exportWorkflowCsv);
router.get('/reports/incidents-export', exportIncidentsCsv);

export default router;
