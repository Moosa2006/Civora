import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  UserRole,
  ComplaintPriority,
  ComplaintStatus,
  SlaStatus,
  EscalationLevel,
  EscalationStatus,
  EscalationTrigger,
  ExtensionRequestStatus,
} from '@prisma/client';
import { SlaEngine } from '../src/lib/slaEngine.js';

let server: http.Server;
let baseUrl: string;

let citizenToken: string;
let citizenId: string;
let officialToken: string;
let officialId: string;
let adminToken: string;
let adminId: string;

let testDeptId: string;
let testCategoryId: string;
let testPolicyId: string;
let testComplaintId: string;
let testTrackingId: string;
let testEscalationId: string;
let testExtensionRequestId: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  // Login Citizen
  const resCitizen = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'CivoraDev123!' }),
  });
  const dataCitizen = await resCitizen.json();
  citizenToken = dataCitizen.data.token;
  citizenId = dataCitizen.data.user.id;

  // Login Official
  const resOfficial = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh.kumar@example.com', password: 'CivoraDev123!' }),
  });
  const dataOfficial = await resOfficial.json();
  officialToken = dataOfficial.data.token;
  officialId = dataOfficial.data.user.id;
  testDeptId = dataOfficial.data.user.departmentId;

  // Login Admin
  const resAdmin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.meera@civora.local', password: 'CivoraDev123!' }),
  });
  const dataAdmin = await resAdmin.json();
  adminToken = dataAdmin.data.token;
  adminId = dataAdmin.data.user.id;

  // Get a category
  const category = await prisma.complaintCategory.findFirst({
    where: { isActive: true },
  });
  testCategoryId = category!.id;
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 11: Service-Level Agreements (SLAs) & Escalation Tests', () => {
  // ==========================================
  // 1. SLA POLICY MANAGEMENT & PRECEDENCE
  // ==========================================
  describe('1. SLA Policy Management & Precedence', () => {
    test('Citizen cannot create an SLA policy (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/sla/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Citizen Policy',
          responseTargetHours: 12,
          resolutionTargetHours: 48,
          warningThresholdHours: 6,
          escalationThresholdHours: 12,
        }),
      });

      assert.equal(res.status, 403);
    });

    test('Official cannot create an SLA policy (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/sla/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Official Policy',
          responseTargetHours: 12,
          resolutionTargetHours: 48,
          warningThresholdHours: 6,
          escalationThresholdHours: 12,
        }),
      });

      assert.equal(res.status, 403);
    });

    test('Admin successfully creates a category-specific SLA policy', async () => {
      const res = await fetch(`${baseUrl}/api/sla/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `Test Road Safety SLA ${Date.now()}`,
          description: 'Automated test policy for urgent road hazards',
          categoryId: testCategoryId,
          priority: ComplaintPriority.HIGH,
          responseTargetHours: 6,
          resolutionTargetHours: 36,
          warningThresholdHours: 6,
          escalationThresholdHours: 12,
          isDefault: false,
          isActive: true,
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.id);
      assert.equal(json.data.responseTargetHours, 6);
      assert.equal(json.data.resolutionTargetHours, 36);
      testPolicyId = json.data.id;
    });

    test('Deterministic policy selection matches exact category and priority', async () => {
      const selected = await SlaEngine.selectPolicyForComplaint(prisma, testCategoryId, ComplaintPriority.HIGH);
      assert.ok(selected, 'Should find matching policy');
      assert.equal(selected.id, testPolicyId);
      assert.equal(selected.priority, ComplaintPriority.HIGH);
    });

    test('Policy selection falls back to default when no exact match exists', async () => {
      const otherCategory = '00000000-0000-0000-0000-000000000000';
      const selected = await SlaEngine.selectPolicyForComplaint(prisma, otherCategory, ComplaintPriority.LOW);
      assert.ok(selected, 'Should fall back to default policy');
      assert.equal(selected.isDefault, true);
    });

    test('Admin can toggle policy active state', async () => {
      const res = await fetch(`${baseUrl}/api/sla/policies/${testPolicyId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      // Re-enable policy for subsequent tests
      await fetch(`${baseUrl}/api/sla/policies/${testPolicyId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    });
  });

  // ==========================================
  // 2. COMPLAINT CREATION & SLA ATTACHMENT
  // ==========================================
  describe('2. Complaint Creation & SLA Clock Initialization', () => {
    test('Citizen creates a complaint and SLA commitment is automatically attached', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          title: 'Dangerous Pothole on Market Main Street',
          description: 'A 2-foot deep sinkhole has developed near the market junction threatening scooter drivers.',
          categoryId: testCategoryId,
          priority: ComplaintPriority.HIGH,
          locationAddress: 'Market Main Street, Block B',
          locality: 'Central Market',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.complaint.id);
      testComplaintId = json.data.complaint.id;
      testTrackingId = json.data.complaint.trackingId;

      // Verify ComplaintSla snapshot was recorded
      const slaRecord = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });

      assert.ok(slaRecord, 'ComplaintSla record must exist');
      assert.equal(slaRecord.policyId, testPolicyId);
      assert.equal(slaRecord.responseTargetHours, 6);
      assert.equal(slaRecord.resolutionTargetHours, 36);
      assert.equal(slaRecord.slaStatus, SlaStatus.ON_TRACK);
      assert.ok(slaRecord.originalResolutionDeadline > slaRecord.clockStartedAt);
    });

    test('Original deadline is preserved as an immutable baseline', async () => {
      const sla = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });

      assert.equal(
        sla!.originalResolutionDeadline.toISOString(),
        sla!.currentResolutionDeadline.toISOString(),
        'Original and current resolution deadlines must match initially'
      );
    });
  });

  // ==========================================
  // 3. OVERDUE DETECTION & WARNING ENGINE
  // ==========================================
  describe('3. Overdue Detection & SlaEngine Warnings', () => {
    test('Evaluates complaint as APPROACHING_DEADLINE within warning window', async () => {
      // Artificially move currentResolutionDeadline to 3 hours from now (warning threshold is 6h)
      const nearFuture = new Date(Date.now() + 3 * 3600000);
      await prisma.complaintSla.update({
        where: { complaintId: testComplaintId },
        data: { currentResolutionDeadline: nearFuture },
      });

      const evaluated = await SlaEngine.evaluateComplaintSla(prisma, testComplaintId);
      assert.ok(evaluated);
      assert.equal(evaluated.slaStatus, SlaStatus.APPROACHING_DEADLINE);

      const slaRecord = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });
      assert.ok(slaRecord?.warningSentAt, 'warningSentAt timestamp should be set');
    });

    test('Idempotent repeated evaluation does not overwrite warningSentAt or duplicate notifications', async () => {
      const firstSla = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });
      const firstWarningTime = firstSla!.warningSentAt!.getTime();

      // Run evaluation again
      await SlaEngine.evaluateComplaintSla(prisma, testComplaintId);

      const secondSla = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });
      assert.equal(secondSla!.warningSentAt!.getTime(), firstWarningTime, 'warningSentAt must remain unchanged');
    });

    test('Evaluates complaint as RESOLUTION_OVERDUE when past deadline', async () => {
      // Artificially backdate resolution deadline to past
      const pastDeadline = new Date(Date.now() - 2 * 3600000);
      await prisma.complaintSla.update({
        where: { complaintId: testComplaintId },
        data: { currentResolutionDeadline: pastDeadline },
      });

      const evaluated = await SlaEngine.evaluateComplaintSla(prisma, testComplaintId);
      assert.ok(evaluated);
      assert.equal(evaluated.isResolutionOverdue, true);
      assert.equal(evaluated.slaStatus, SlaStatus.RESOLUTION_OVERDUE);
    });

    test('GET /api/sla/overdue lists the overdue complaint within scope', async () => {
      const res = await fetch(`${baseUrl}/api/sla/overdue?complaintId=${testComplaintId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.complaints));
      const found = json.data.complaints.some((c: any) => c.id === testComplaintId);
      assert.ok(found, 'Overdue complaint should be listed in overdue queue');
    });
  });

  // ==========================================
  // 4. ESCALATION MANAGEMENT WORKFLOW
  // ==========================================
  describe('4. Escalation Management & Supervisory Accountability', () => {
    test('Supervisor manually escalates overdue complaint to LEVEL_2_SUPERVISOR', async () => {
      const res = await fetch(`${baseUrl}/api/sla/complaints/${testComplaintId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          escalationLevel: EscalationLevel.LEVEL_2_SUPERVISOR,
          triggerReason: EscalationTrigger.RESOLUTION_DEADLINE_MISSED,
          notes: 'Sinkhole causing high traffic risk; immediate contractor intervention needed.',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.id);
      assert.equal(json.data.escalationLevel, EscalationLevel.LEVEL_2_SUPERVISOR);
      assert.equal(json.data.status, EscalationStatus.ACTIVE);
      testEscalationId = json.data.id;
    });

    test('Supervisor acknowledges the escalation with notes', async () => {
      const res = await fetch(`${baseUrl}/api/sla/escalations/${testEscalationId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          notes: 'Supervisor Meera acknowledged case for priority excavation.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, EscalationStatus.ACKNOWLEDGED);

      // Verify action log created
      const logs = await prisma.escalationActionLog.findMany({
        where: { escalationId: testEscalationId },
      });
      assert.ok(logs.some((l) => l.action === 'ACKNOWLEDGED'));
    });

    test('Supervisor records a formal corrective action plan', async () => {
      const res = await fetch(`${baseUrl}/api/sla/escalations/${testEscalationId}/action-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          actionPlan: 'Deploying municipal backhoe and 10 cubic yards of rapid-setting asphalt mix.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, EscalationStatus.ACTION_PLANNED);
      assert.ok(json.data.actionPlan.includes('backhoe'));
    });

    test('Supervisor resolves the escalation with mandatory resolution reason', async () => {
      const res = await fetch(`${baseUrl}/api/sla/escalations/${testEscalationId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          resolutionReason: 'Remediation crew dispatched and trenching completed.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, EscalationStatus.RESOLVED);

      // Verify core rule: Complaint itself is NOT automatically marked RESOLVED
      const complaint = await prisma.complaint.findUnique({
        where: { id: testComplaintId },
      });
      assert.notEqual(complaint?.status, ComplaintStatus.RESOLVED, 'Complaint status must remain unchanged by escalation closure');
    });
  });

  // ==========================================
  // 5. SLA EXTENSION & SEPARATION OF DUTIES
  // ==========================================
  describe('5. SLA Extension Workflow & Separation of Duties', () => {
    test('Official submits an SLA extension request', async () => {
      const requestedDate = new Date(Date.now() + 48 * 3600000); // 48h from now

      const res = await fetch(`${baseUrl}/api/sla/complaints/${testComplaintId}/extension-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          requestedResolutionDeadline: requestedDate.toISOString(),
          reason: 'Severe rainstorm halted asphalt curing. Requires dry conditions.',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.id);
      assert.equal(json.data.status, ExtensionRequestStatus.PENDING);
      testExtensionRequestId = json.data.id;
    });

    test('Separation of Duties: Requesting official CANNOT approve their own request', async () => {
      const res = await fetch(`${baseUrl}/api/sla/extensions/${testExtensionRequestId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          decisionNotes: 'Self-approval attempt',
        }),
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.error.code, 'SEPARATION_OF_DUTIES');
    });

    test('Administrator approves extension, updating current deadline while preserving original', async () => {
      const extBefore = await prisma.slaExtensionRequest.findUnique({
        where: { id: testExtensionRequestId },
      });

      const res = await fetch(`${baseUrl}/api/sla/extensions/${testExtensionRequestId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          decisionNotes: 'Approved due to adverse weather delays.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, ExtensionRequestStatus.APPROVED);

      // Verify complaint current deadline is updated, but original is preserved
      const slaAfter = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });

      assert.equal(
        slaAfter!.currentResolutionDeadline.toISOString(),
        extBefore!.requestedResolutionDeadline.toISOString(),
        'Current deadline must be updated to approved extension date'
      );
      assert.notEqual(
        slaAfter!.originalResolutionDeadline.toISOString(),
        slaAfter!.currentResolutionDeadline.toISOString(),
        'Original resolution deadline must be preserved for audit history'
      );
    });
  });

  // ==========================================
  // 6. CITIZEN VISIBILITY & PRIVACY ENFORCEMENT
  // ==========================================
  describe('6. Citizen Visibility & Privacy Protection', () => {
    test('Citizen tracking endpoint returns privacy-safe SLA details and redacts internal logs', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/track/${testTrackingId}`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.complaint.sla, 'Complaint SLA must be visible');
      assert.ok(json.data.complaint.sla.policyName);
      assert.ok(json.data.complaint.sla.responseDeadline);
      assert.ok(json.data.complaint.sla.resolutionDeadline);

      // Public escalation visibility
      assert.ok(json.data.complaint.sla.isEscalated !== undefined);
    });

    test('Official records estimated completion date without changing SLA commitments', async () => {
      const newEstimate = new Date(Date.now() + 72 * 3600000);

      const res = await fetch(`${baseUrl}/api/sla/complaints/${testComplaintId}/estimated-completion`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          estimatedCompletionDate: newEstimate.toISOString(),
          estimatedCompletionNotes: 'Work crew scheduled for Saturday completion.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.estimatedCompletionDate);

      // Verify that current SLA resolution deadline remains distinct and unaltered
      const sla = await prisma.complaintSla.findUnique({
        where: { complaintId: testComplaintId },
      });
      assert.notEqual(
        sla!.currentResolutionDeadline.toISOString(),
        new Date(newEstimate).toISOString(),
        'Estimated completion date must not overwrite official SLA resolution deadline'
      );
    });
  });

  // ==========================================
  // 7. ACCOUNTABILITY METRICS & PUBLIC TRANSPARENCY
  // ==========================================
  describe('7. Department Accountability Metrics & Public Transparency', () => {
    test('GET /api/sla/metrics returns platform SLA compliance and department scorecards', async () => {
      const res = await fetch(`${baseUrl}/api/sla/metrics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.summary);
      assert.ok(typeof json.data.summary.complianceRate === 'number');
      assert.ok(typeof json.data.summary.totalWithSla === 'number');
      assert.ok(Array.isArray(json.data.departmentScorecards));

      // Each department has auditable stats
      for (const dept of json.data.departmentScorecards) {
        assert.ok(dept.id);
        assert.ok(dept.name);
        assert.ok(typeof dept.complianceRate === 'number');
        assert.ok(typeof dept.activeOverdue === 'number');
      }
    });

    test('GET /api/sla/transparency returns public aggregate SLA statistics without private records', async () => {
      const res = await fetch(`${baseUrl}/api/sla/transparency`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(typeof json.data.overallComplianceRate === 'number');
      assert.ok(typeof json.data.totalActiveOverdue === 'number');
      assert.ok(Array.isArray(json.data.categories));
    });

    test('POST /api/sla/evaluate executes background evaluation job successfully', async () => {
      const res = await fetch(`${baseUrl}/api/sla/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(typeof json.data.evaluatedCount === 'number');
      assert.ok(typeof json.data.breachesDetected === 'number');
    });
  });
});
