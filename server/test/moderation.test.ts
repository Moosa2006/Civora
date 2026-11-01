import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  ComplaintStatus,
  ComplaintPriority,
  UserRole,
  ReportTargetType,
  AbuseReportReason,
  ModerationActionType,
  AppealStatus,
  UserRestrictionType,
} from '@prisma/client';

let server: http.Server;
let baseUrl: string;

let citizenAToken: string;
let citizenBToken: string;
let adminToken: string;
let officialToken: string;
let official2Token: string;

let citizenAId: string;
let citizenBId: string;
let adminId: string;
let officialId: string;
let official2Id: string;

let deptPwdId: string;
let catRoadsId: string;

let testComplaint1Id: string;
let testComplaint2Id: string;

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

  const pwd = await prisma.department.findUnique({ where: { code: 'PWD' } });
  assert.ok(pwd, 'PWD department must exist');
  deptPwdId = pwd.id;

  const cat = await prisma.complaintCategory.findFirst({
    where: { departmentId: deptPwdId, isActive: true },
  });
  assert.ok(cat, 'Active category must exist for PWD');
  catRoadsId = cat.id;

  // Login accounts using seeded development credentials
  const login = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CivoraDev123!' }),
    });
    const json = (await res.json()) as any;
    assert.ok(json.success, `Login failed for ${email}`);
    return { token: json.data.token as string, user: json.data.user };
  };

  const a = await login('aarav.sharma@example.com');
  const b = await login('priya.patel@example.com');
  const adm = await login('admin.meera@civora.local');
  const off = await login('rajesh.kumar@example.com');

  citizenAToken = a.token;
  citizenAId = a.user.id;

  citizenBToken = b.token;
  citizenBId = b.user.id;

  adminToken = adm.token;
  adminId = adm.user.id;

  officialToken = off.token;
  officialId = off.user.id;

  // Register second official for separation of duties tests
  const secondOffEmail = `supervisor.${Date.now()}@civora.local`;
  const official2User = await prisma.user.create({
    data: {
      email: secondOffEmail,
      name: 'Supervisor Sharma',
      passwordHash: '$2b$10$wT282n0F0KkXQ9lQvN1W/eK2d7h5G7m8Z7rX6w5v4u3t2s1r0q9p8',
      role: UserRole.GOVERNMENT_OFFICIAL,
      departmentId: deptPwdId,
    },
  });
  official2Id = official2User.id;

  const { signAuthToken } = await import('../src/lib/jwt.js');
  official2Token = signAuthToken({ userId: official2Id, role: UserRole.GOVERNMENT_OFFICIAL });

  // Create baseline test complaints for duplicate & abuse testing
  const c1 = await prisma.complaint.create({
    data: {
      trackingId: `M14-${Date.now().toString().slice(-6)}A`,
      title: 'Deep Hazardous Pothole Near City Market Gate 4',
      description: 'Massive pothole in front of gate 4 causing severe waterlogging and vehicular damage.',
      categoryId: catRoadsId,
      priority: ComplaintPriority.HIGH,
      status: ComplaintStatus.SUBMITTED,
      citizenId: citizenAId,
      locationAddress: 'Market Road Gate 4, Sector 7',
      locality: 'Sector 7 Market',
      ward: 'Ward 14',
      latitude: 28.6139,
      longitude: 77.209,
    },
  });
  testComplaint1Id = c1.id;

  const c2 = await prisma.complaint.create({
    data: {
      trackingId: `M14-${Date.now().toString().slice(-6)}B`,
      title: 'Broken Pavement and Open Cable Trench',
      description: 'Pedestrian pavement is broken with loose cables exposed next to the park bus stop.',
      categoryId: catRoadsId,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.SUBMITTED,
      citizenId: citizenBId,
      locationAddress: 'Park Avenue near Bus Stop',
      locality: 'Green Park',
      ward: 'Ward 10',
      latitude: 28.555,
      longitude: 77.21,
    },
  });
  testComplaint2Id = c2.id;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Module 14: Fraud Prevention, Spam Protection, Content Moderation & Abuse Reporting', () => {
  // -------------------------------------------------------------
  // 1. Rate Limiting & Automation Defenses
  // -------------------------------------------------------------
  describe('1. Rate Limiting and Automation Defenses', () => {
    test('Strict rate limiter allows requests up to max and rejects subsequent with HTTP 429', async () => {
      // First 2 requests should succeed (200)
      const res1 = await fetch(`${baseUrl}/api/moderation/test-rate-limit`);
      assert.equal(res1.status, 200);

      const res2 = await fetch(`${baseUrl}/api/moderation/test-rate-limit`);
      assert.equal(res2.status, 200);

      // 3rd request must trigger 429 RATE_LIMIT_EXCEEDED
      const res3 = await fetch(`${baseUrl}/api/moderation/test-rate-limit`);
      assert.equal(res3.status, 429, 'Expected HTTP 429 Rate Limit Exceeded');

      const body = (await res3.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(body.error.retryAfterSeconds > 0, 'Should include retry indication');
    });
  });

  // -------------------------------------------------------------
  // 2. Duplicate Complaint Detection & Linking
  // -------------------------------------------------------------
  describe('2. Duplicate Complaint Detection & Linking', () => {
    test('Identifies potential duplicate complaint candidates with similarity score and explanation', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/duplicates/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Dangerous Large Pothole City Market Gate 4',
          description: 'Deep hazardous pothole near gate 4 causing waterlogging and risk of accidents.',
          categoryId: catRoadsId,
          locality: 'Sector 7 Market',
          ward: 'Ward 14',
          latitude: 28.614,
          longitude: 77.2091,
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.potentialDuplicatesFound, true);
      assert.ok(body.data.candidates.length > 0, 'Should return candidate match');

      const candidate = body.data.candidates.find((c: any) => c.id === testComplaint1Id);
      assert.ok(candidate, 'Target complaint should be identified as duplicate candidate');
      assert.ok(candidate.similarityScore >= 0.35, 'Similarity score should exceed threshold');
      assert.ok(candidate.matchReason, 'Should provide explainable match reason');
      assert.ok(!candidate.citizenEmail, 'Privacy safeguard: citizen PII must NOT be leaked');
    });

    test('Authorized official links duplicate complaints without deleting original records', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/duplicates/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          primaryComplaintId: testComplaint1Id,
          duplicateComplaintId: testComplaint2Id,
          reason: 'Related civic problem in adjoining municipal jurisdiction.',
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.primaryComplaintId, testComplaint1Id);
      assert.equal(body.data.duplicateComplaintId, testComplaint2Id);

      // Verify both original complaints remain accessible and unchanged
      const [check1, check2] = await Promise.all([
        prisma.complaint.findUnique({ where: { id: testComplaint1Id } }),
        prisma.complaint.findUnique({ where: { id: testComplaint2Id } }),
      ]);
      assert.ok(check1, 'Primary complaint must not be deleted');
      assert.ok(check2, 'Duplicate complaint must not be deleted');
    });

    test('Self-linking a complaint as duplicate of itself is rejected', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/duplicates/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          primaryComplaintId: testComplaint1Id,
          duplicateComplaintId: testComplaint1Id,
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'SELF_LINK_INVALID');
    });
  });

  // -------------------------------------------------------------
  // 3. Abuse Reporting Mechanism
  // -------------------------------------------------------------
  describe('3. Citizen Abuse Reporting', () => {
    let createdReportTrackingId: string;

    test('Citizen submits an abuse report on suspicious content', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          targetType: ReportTargetType.COMPLAINT,
          targetId: testComplaint2Id,
          reason: AbuseReportReason.SPAM,
          explanation: 'Repeated promotional commercial text submitted as a civic complaint.',
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.trackingId.startsWith('REP-'));
      assert.equal(body.data.status, 'PENDING');
      createdReportTrackingId = body.data.trackingId;

      // Verify moderation case was created or associated
      const report = await prisma.abuseReport.findUnique({
        where: { trackingId: createdReportTrackingId },
        include: { case: true },
      });
      assert.ok(report?.case, 'Moderation case must be linked to report');
      assert.ok(report.case.riskScore >= 0, 'Risk triage score must be calculated');
    });

    test('Reporting nonexistent target content returns 404 TARGET_NOT_FOUND', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000099';
      const res = await fetch(`${baseUrl}/api/moderation/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          targetType: ReportTargetType.COMPLAINT,
          targetId: dummyId,
          reason: AbuseReportReason.HARASSMENT,
        }),
      });

      assert.equal(res.status, 404);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'TARGET_NOT_FOUND');
    });

    test('Prevent duplicate spam reporting by the same citizen on the same item', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          targetType: ReportTargetType.COMPLAINT,
          targetId: testComplaint2Id,
          reason: AbuseReportReason.SPAM,
          explanation: 'Second duplicate report attempt within active window.',
        }),
      });

      assert.equal(res.status, 409);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'DUPLICATE_REPORT');
    });
  });

  // -------------------------------------------------------------
  // 4. Moderation Queue & Access Control
  // -------------------------------------------------------------
  describe('4. Moderation Queue & Permissions', () => {
    test('Unauthorized citizen CANNOT access staff moderation queue (403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/queue`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 403);
    });

    test('Authorized municipal official can view paginated moderation queue', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/queue?status=OPEN`, {
        headers: { Authorization: `Bearer ${officialToken}` },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.pagination.total >= 1);
    });

    test('Staff retrieves detailed moderation case with target content context', async () => {
      const openCase = await prisma.moderationCase.findFirst({
        where: { targetId: testComplaint2Id },
      });
      assert.ok(openCase, 'Case must exist');

      const res = await fetch(`${baseUrl}/api/moderation/cases/${openCase.id}`, {
        headers: { Authorization: `Bearer ${officialToken}` },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.id, openCase.id);
      assert.ok(body.data.targetContent.exists, 'Target content snippet must be resolved');
      // Verify reporter privacy is protected: reporter email must not be exposed
      for (const r of body.data.reports) {
        assert.equal(r.reporter?.email, undefined, 'Reporter email must NOT be exposed');
      }
    });
  });

  // -------------------------------------------------------------
  // 5. Consequential Moderation Actions & Reason Requirement
  // -------------------------------------------------------------
  describe('5. Reason-Based Moderation Decisions', () => {
    let modCaseId: string;

    before(async () => {
      const c = await prisma.moderationCase.findFirst({
        where: { targetId: testComplaint2Id },
      });
      assert.ok(c);
      modCaseId = c.id;
    });

    test('Consequential moderation action fails without mandatory reason (minimum 5 chars)', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/cases/${modCaseId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          actionType: ModerationActionType.CONTENT_HIDDEN,
          reason: 'Bad', // Too short (< 5 chars)
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    test('Official hides abusive content with documented reason, setting isModerated flag', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/cases/${modCaseId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          actionType: ModerationActionType.CONTENT_HIDDEN,
          reason: 'Violates platform commercial advertising policies. Hidden pending review.',
          internalNotes: 'First warning noted for this submission.',
        }),
      });

      assert.equal(res.status, 200);

      // Verify target complaint is updated with isModerated flag
      const updatedComplaint = await prisma.complaint.findUnique({
        where: { id: testComplaint2Id },
      });
      assert.equal(updatedComplaint?.isModerated, true);
      assert.ok(updatedComplaint?.moderationReason?.includes('advertising'));

      // Verify ModerationAction was logged
      const actionLog = await prisma.moderationAction.findFirst({
        where: { caseId: modCaseId, actionType: ModerationActionType.CONTENT_HIDDEN },
      });
      assert.ok(actionLog, 'Action log must be created');
      assert.equal(actionLog.moderatorId, officialId);
    });

    test('Official restores content with documented reason, clearing isModerated flag', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/cases/${modCaseId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          actionType: ModerationActionType.CONTENT_RESTORED,
          reason: 'Re-reviewed: Description confirmed as authentic civic hazard with non-promotional intent.',
        }),
      });

      assert.equal(res.status, 200);

      const restoredComplaint = await prisma.complaint.findUnique({
        where: { id: testComplaint2Id },
      });
      assert.equal(restoredComplaint?.isModerated, false);
      assert.equal(restoredComplaint?.moderationReason, null);
    });
  });

  // -------------------------------------------------------------
  // 6. Appeals Workflow & Separation of Duties
  // -------------------------------------------------------------
  describe('6. Appeals Workflow and Separation of Duties', () => {
    let modCaseId: string;
    let appealId: string;

    before(async () => {
      // Re-apply a penalty so there is an active decision to appeal
      const c = await prisma.moderationCase.findFirst({
        where: { targetId: testComplaint2Id },
      });
      assert.ok(c);
      modCaseId = c.id;

      await fetch(`${baseUrl}/api/moderation/cases/${modCaseId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          actionType: ModerationActionType.CONTENT_HIDDEN,
          reason: 'Commercial spam violation confirmed by moderator.',
        }),
      });
    });

    test('Affected citizen submits an appeal against the moderation action', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          caseId: modCaseId,
          reason: 'This report concerns real exposed high-voltage cables at the bus stop and is not commercial spam.',
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'PENDING');
      appealId = body.data.id;
    });

    test('Unrelated citizen CANNOT appeal another citizen’s moderation case (403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          caseId: modCaseId,
          reason: 'Attempting to appeal on behalf of someone else.',
        }),
      });

      assert.equal(res.status, 403);
    });

    test('Separation of Duties: Same official who enacted penalty CANNOT adjudicate appeal', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/appeals/${appealId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`, // Same official who took the action
        },
        body: JSON.stringify({
          decision: 'REJECTED',
          decisionReason: 'I stand by my original penalty.',
        }),
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'SEPARATION_OF_DUTIES_VIOLATION');
    });

    test('Different supervisor reviews and upholds appeal, restoring content', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/appeals/${appealId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${official2Token}`, // Different supervisor
        },
        body: JSON.stringify({
          decision: 'UPHELD',
          decisionReason: 'Verified that the submission is an authentic civic hazard report. Restored to public visibility.',
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'UPHELD');

      // Verify content was automatically restored
      const restored = await prisma.complaint.findUnique({
        where: { id: testComplaint2Id },
      });
      assert.equal(restored?.isModerated, false);
    });
  });

  // -------------------------------------------------------------
  // 7. Account Restrictions & Scope Enforcement
  // -------------------------------------------------------------
  describe('7. Account Restrictions & Action Enforcement', () => {
    let restrictionId: string;

    test('Admin applies temporary SUBMISSION_RESTRICTED to citizen', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/restrictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          userId: citizenBId,
          restrictionType: UserRestrictionType.SUBMISSION_RESTRICTED,
          reason: 'Temporary pause following rapid automated submission burst.',
          durationHours: 24,
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.isActive, true);
      assert.ok(body.data.expiresAt);
      restrictionId = body.data.id;
    });

    test('Restricted citizen is blocked from submitting new complaints (403 USER_RESTRICTED)', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          title: 'Blocked Complaint Attempt During Active Restriction',
          description: 'This complaint should be intercepted by the restriction middleware.',
          categoryId: catRoadsId,
          locationAddress: 'Test Address 123',
          locality: 'Test Locality',
        }),
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'USER_RESTRICTED');
      assert.ok(body.error.message.includes('temporarily restricted'));
    });

    test('Admin lifts restriction, enabling citizen to submit complaints normally again', async () => {
      const liftRes = await fetch(`${baseUrl}/api/moderation/restrictions/${restrictionId}/lift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          liftReason: 'Citizen verified identity and abuse concern resolved.',
        }),
      });

      assert.equal(liftRes.status, 200);

      // Subsequent complaint submission should now succeed
      const submitRes = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          title: 'Restored Citizen Civic Complaint',
          description: 'Valid civic complaint submitted after restriction was lifted successfully.',
          categoryId: catRoadsId,
          locationAddress: 'Test Avenue Sector 5',
          locality: 'Sector 5',
        }),
      });

      assert.equal(submitRes.status, 201);
      const body = (await submitRes.json()) as any;
      assert.equal(body.success, true);
    });
  });

  // -------------------------------------------------------------
  // 8. Public Platform Rules & Admin Metrics
  // -------------------------------------------------------------
  describe('8. Public Platform Rules & Admin Metrics', () => {
    test('Public rules endpoint returns platform rules and protects civic criticism', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/rules`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.principles.some((p: string) => p.includes('Criticism of public authorities')));
      assert.ok(Array.isArray(body.data.prohibitedContent));
    });

    test('Admin retrieves aggregate abuse prevention metrics', async () => {
      const res = await fetch(`${baseUrl}/api/moderation/metrics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.totalReports >= 1);
      assert.ok(body.data.totalDuplicateLinks >= 1);
      assert.ok(Array.isArray(body.data.reasonDistribution));
    });
  });
});
