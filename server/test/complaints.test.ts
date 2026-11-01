import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ComplaintStatus, UserRole } from '@prisma/client';

let server: http.Server;
let baseUrl: string;

let citizenAToken: string;
let citizenBToken: string;
let adminToken: string;
let officialToken: string;

let citizenAId: string;
let citizenBId: string;
let adminId: string;
let officialId: string;

let categoryId: string;
let departmentId: string;

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

  // Get active category and department from DB
  const category = await prisma.complaintCategory.findFirst({
    where: { isActive: true },
    include: { department: true },
  });
  assert.ok(category, 'Active category must exist in seeded DB');
  categoryId = category.id;
  departmentId = category.departmentId;

  // Login as Citizen A (Aarav)
  const resCitizenA = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aarav.sharma@example.com',
      password: 'CivoraDev123!',
    }),
  });
  const dataCitizenA = await resCitizenA.json();
  citizenAToken = dataCitizenA.data.token;
  citizenAId = dataCitizenA.data.user.id;

  // Login as Citizen B (Priya)
  const resCitizenB = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'priya.patel@example.com',
      password: 'CivoraDev123!',
    }),
  });
  const dataCitizenB = await resCitizenB.json();
  citizenBToken = dataCitizenB.data.token;
  citizenBId = dataCitizenB.data.user.id;

  // Login as Admin (Meera)
  const resAdmin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin.meera@civora.local',
      password: 'CivoraDev123!',
    }),
  });
  const dataAdmin = await resAdmin.json();
  adminToken = dataAdmin.data.token;
  adminId = dataAdmin.data.user.id;

  // Login as Official (Rajesh)
  const resOfficial = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rajesh.kumar@example.com',
      password: 'CivoraDev123!',
    }),
  });
  const dataOfficial = await resOfficial.json();
  officialToken = dataOfficial.data.token;
  officialId = dataOfficial.data.user.id;
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 6: Complaint Management & Tracking Tests', () => {
  let createdComplaintId: string;
  let createdTrackingId: string;

  // 1. Complaint Creation Tests
  describe('1. Complaint Submission', () => {
    test('POST /api/complaints rejects unauthenticated requests', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Damaged road surface',
          description: 'A deep pothole has formed near the bus stop.',
          categoryId,
          locationAddress: '123 Market Road',
          locality: 'Gandhi Chowk',
        }),
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    test('POST /api/complaints allows authenticated citizen to lodge complaint', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Large hazardous pothole near metro gate',
          description: 'Rainwater has accumulated in a 2-foot pothole causing minor two-wheeler accidents.',
          categoryId,
          priority: 'HIGH',
          locationAddress: 'Gate No. 2, Indiranagar Metro Station',
          locality: 'Indiranagar',
          ward: 'Ward 112',
          latitude: 12.9784,
          longitude: 77.6408,
        }),
      });

      assert.equal(res.status, 201, 'Should return 201 Created');
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.trackingId, 'Must return trackingId');
      assert.match(
        body.data.trackingId,
        /^CIV-\d{4}-[A-Z0-9]{5}$/,
        'Tracking ID must match format CIV-YYYY-XXXXX'
      );
      assert.equal(body.data.complaint.status, ComplaintStatus.SUBMITTED);
      assert.equal(body.data.complaint.citizenId, citizenAId);

      createdComplaintId = body.data.complaint.id;
      createdTrackingId = body.data.trackingId;

      // Verify DB persistence and status history
      const dbComplaint = await prisma.complaint.findUnique({
        where: { id: createdComplaintId },
        include: { statusHistory: true },
      });
      assert.ok(dbComplaint, 'Complaint must be saved in database');
      assert.equal(dbComplaint.trackingId, createdTrackingId);
      assert.equal(dbComplaint.statusHistory.length, 1);
      assert.equal(dbComplaint.statusHistory[0].toStatus, ComplaintStatus.SUBMITTED);
      assert.equal(dbComplaint.statusHistory[0].changedById, citizenAId);
    });

    test('POST /api/complaints safely ignores client-supplied privileged fields', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Broken streetlight on 5th main',
          description: 'Streetlight pole #45 has been completely dark for 3 days.',
          categoryId,
          locationAddress: '5th Main, Koramangala',
          locality: 'Koramangala',
          status: 'RESOLVED', // Privileged field attempt
          trackingId: 'CIV-9999-FAKE1', // Privileged field attempt
          citizenId: citizenBId, // Attempting to impersonate Citizen B
          assignedDepartmentId: departmentId, // Privileged field attempt
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      // Server must enforce SUBMITTED status and authenticated user ID
      assert.equal(body.data.complaint.status, ComplaintStatus.SUBMITTED);
      assert.notEqual(body.data.complaint.trackingId, 'CIV-9999-FAKE1');
      assert.equal(body.data.complaint.citizenId, citizenAId);
      assert.equal(body.data.complaint.assignedDepartmentId, null);
    });

    test('POST /api/complaints rejects invalid input data', async () => {
      // 1. Missing required fields
      const res1 = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Bad', // too short (< 5)
        }),
      });
      assert.equal(res1.status, 400);

      // 2. Invalid latitude
      const res2 = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Complaint Title',
          description: 'Valid complaint description with enough length.',
          categoryId,
          locationAddress: 'Valid Location Address',
          locality: 'Central',
          latitude: 195.5, // Invalid > 90
        }),
      });
      assert.equal(res2.status, 400);

      // 3. Non-existent category ID
      const res3 = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Complaint Title',
          description: 'Valid complaint description with enough length.',
          categoryId: '00000000-0000-0000-0000-000000000000',
          locationAddress: 'Valid Location Address',
          locality: 'Central',
        }),
      });
      assert.equal(res3.status, 400);
      const body3 = await res3.json();
      assert.equal(body3.error.code, 'INVALID_CATEGORY');
    });
  });

  // 2. Citizen Complaint Listing & Ownership Tests
  describe('2. Citizen Complaint Retrieval & Ownership Enforcement', () => {
    test('GET /api/complaints/my returns only authenticated user complaints', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/my`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.complaints));
      assert.ok(body.data.pagination);

      // Verify all returned complaints belong to Citizen A
      for (const c of body.data.complaints) {
        assert.equal(c.citizenId, citizenAId, 'All complaints in /my must belong to authenticated citizen');
      }
    });

    test('GET /api/complaints/:id allows owner citizen to view complaint', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.complaint.id, createdComplaintId);
      assert.equal(body.data.complaint.trackingId, createdTrackingId);
      assert.ok(Array.isArray(body.data.complaint.statusHistory));
    });

    test('GET /api/complaints/:id rejects another citizen with 403 Forbidden', async () => {
      // Citizen B trying to view Citizen A's complaint
      const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      assert.equal(res.status, 403, 'Must return 403 Forbidden for non-owner citizen');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('GET /api/complaints/:id allows admin and officials to view', async () => {
      // Admin
      const resAdmin = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(resAdmin.status, 200);

      // Official
      const resOfficial = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}`, {
        headers: { Authorization: `Bearer ${officialToken}` },
      });
      assert.equal(resOfficial.status, 200);
    });

    test('GET /api/complaints/:id returns 404 for non-existent complaint', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/00000000-0000-0000-0000-000000000000`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 404);
    });
  });

  // 3. Privacy-Safe Public Tracking Endpoint
  describe('3. Public Tracking Endpoint', () => {
    test('GET /api/complaints/track/:trackingId returns public safe summary without citizen PII', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/track/${createdTrackingId}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);

      const record = body.data.complaint;
      assert.equal(record.trackingId, createdTrackingId);
      assert.equal(record.status, ComplaintStatus.SUBMITTED);
      assert.ok(record.title);
      assert.ok(record.locality);
      assert.ok(Array.isArray(record.timeline));

      // CRITICAL PRIVACY CHECKS: Absolutely NO citizen PII
      assert.equal(record.citizenId, undefined, 'citizenId must not be exposed');
      assert.equal(record.citizen, undefined, 'citizen object must not be exposed');
      assert.equal(record.email, undefined, 'email must not be exposed');
      assert.equal(record.phone, undefined, 'phone must not be exposed');
      assert.equal(record.passwordHash, undefined, 'passwordHash must never be exposed');
    });

    test('GET /api/complaints/track/:trackingId returns 404 for unknown tracking ID', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/track/CIV-9999-NOTFOUND`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });
  });

  // 4. Admin Management, Assignment & Status Lifecycle
  describe('4. Administrative Complaint Management & Lifecycle', () => {
    test('Administrative endpoints reject unauthorized citizen requests with 403', async () => {
      const resList = await fetch(`${baseUrl}/api/admin/complaints`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(resList.status, 403);

      const resStatus = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ status: ComplaintStatus.RESOLVED }),
      });
      assert.equal(resStatus.status, 403);

      const resAssign = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ departmentId }),
      });
      assert.equal(resAssign.status, 403);
    });

    test('GET /api/admin/complaints allows admin to list and search complaints', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints?search=Indiranagar`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.complaints));
      assert.ok(body.data.pagination);
    });

    test('PATCH /api/admin/complaints/:id/status rejects illegal status transitions', async () => {
      // From SUBMITTED, direct jump to RESOLVED is illegal
      const res = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: ComplaintStatus.RESOLVED }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_TRANSITION');
    });

    test('PATCH /api/admin/complaints/:id/status transitions SUBMITTED -> UNDER_REVIEW', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: ComplaintStatus.UNDER_REVIEW,
          reason: 'Review initiated by municipal officer.',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.complaint.status, ComplaintStatus.UNDER_REVIEW);
      assert.ok(body.data.complaint.reviewedAt);

      // Verify audit history was appended
      const dbComplaint = await prisma.complaint.findUnique({
        where: { id: createdComplaintId },
        include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
      });
      assert.equal(dbComplaint?.statusHistory[0].toStatus, ComplaintStatus.UNDER_REVIEW);
      assert.equal(dbComplaint?.statusHistory[0].changedById, adminId);
    });

    test('PATCH /api/admin/complaints/:id/assign assigns department and advances status to ASSIGNED', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          departmentId,
          officialId,
          notes: 'Assigned to Ward Engineer Rajesh for on-site inspection.',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.complaint.assignedDepartmentId, departmentId);
      assert.equal(body.data.complaint.assignedOfficialId, officialId);
      assert.equal(body.data.complaint.status, ComplaintStatus.ASSIGNED);

      // Verify audit history
      const dbComplaint = await prisma.complaint.findUnique({
        where: { id: createdComplaintId },
        include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
      });
      assert.equal(dbComplaint?.statusHistory[0].toStatus, ComplaintStatus.ASSIGNED);
    });

    test('Official transitions ASSIGNED -> IN_PROGRESS -> RESOLVED with notes', async () => {
      // 1. ASSIGNED -> IN_PROGRESS
      const resProgress = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          status: ComplaintStatus.IN_PROGRESS,
          reason: 'Road repair crew deployed to site with hot-mix asphalt.',
        }),
      });
      assert.equal(resProgress.status, 200);

      // 2. IN_PROGRESS -> RESOLVED
      const resResolved = await fetch(`${baseUrl}/api/admin/complaints/${createdComplaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          status: ComplaintStatus.RESOLVED,
          resolutionNotes: 'Pothole filled and levelled with bituminous road mix. Surface cured.',
        }),
      });
      assert.equal(resResolved.status, 200);
      const bodyResolved = await resResolved.json();
      assert.equal(bodyResolved.data.complaint.status, ComplaintStatus.RESOLVED);
      assert.ok(bodyResolved.data.complaint.resolvedAt);
      assert.equal(
        bodyResolved.data.complaint.resolutionNotes,
        'Pothole filled and levelled with bituminous road mix. Surface cured.'
      );
    });

    test('Status transition to REJECTED strictly requires a rejection reason', async () => {
      // Create a new complaint to test rejection
      const createRes = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          title: 'Duplicate test complaint for rejection',
          description: 'This complaint will be rejected without reason to test validation.',
          categoryId,
          locationAddress: 'Test Location',
          locality: 'Central',
        }),
      });
      const newComplaint = (await createRes.json()).data.complaint;

      // Advance to UNDER_REVIEW
      await fetch(`${baseUrl}/api/admin/complaints/${newComplaint.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: ComplaintStatus.UNDER_REVIEW }),
      });

      // Attempt to reject without reason -> should fail with 400
      const rejectFail = await fetch(`${baseUrl}/api/admin/complaints/${newComplaint.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: ComplaintStatus.REJECTED }),
      });
      assert.equal(rejectFail.status, 400, 'Rejection without reason must fail');

      // Reject with valid reason -> should succeed
      const rejectSuccess = await fetch(`${baseUrl}/api/admin/complaints/${newComplaint.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: ComplaintStatus.REJECTED,
          reason: 'Duplicate complaint of existing reported issue CIV-2026-0001.',
        }),
      });
      assert.equal(rejectSuccess.status, 200);
      const rejectBody = await rejectSuccess.json();
      assert.equal(rejectBody.data.complaint.status, ComplaintStatus.REJECTED);
      assert.equal(
        rejectBody.data.complaint.rejectionReason,
        'Duplicate complaint of existing reported issue CIV-2026-0001.'
      );
    });
  });
});
