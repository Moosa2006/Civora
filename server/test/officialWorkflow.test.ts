import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ComplaintStatus, InspectionOutcome, DocumentCategory, DocumentVisibility } from '@prisma/client';

let server: http.Server;
let baseUrl: string;

let citizenAToken: string;
let citizenBToken: string;
let adminToken: string;
let officialPwdToken: string;
let officialSanToken: string;

let citizenAId: string;
let citizenBId: string;
let adminId: string;
let officialPwdId: string;
let officialSanId: string;

let deptPwdId: string;
let deptSanId: string;
let catPwdId: string;

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

  // Fetch departments
  const pwd = await prisma.department.findUnique({ where: { code: 'PWD' } });
  const san = await prisma.department.findUnique({ where: { code: 'SAN' } });
  assert.ok(pwd && san, 'PWD and SAN departments must exist');
  deptPwdId = pwd.id;
  deptSanId = san.id;

  const cat = await prisma.complaintCategory.findFirst({
    where: { departmentId: deptPwdId, isActive: true },
  });
  assert.ok(cat, 'PWD category must exist');
  catPwdId = cat.id;

  // Login Citizen A (Aarav)
  const resA = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'CivoraDev123!' }),
  });
  const dataA = await resA.json();
  citizenAToken = dataA.data.token;
  citizenAId = dataA.data.user.id;

  // Login Citizen B (Priya)
  const resB = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya.patel@example.com', password: 'CivoraDev123!' }),
  });
  const dataB = await resB.json();
  citizenBToken = dataB.data.token;
  citizenBId = dataB.data.user.id;

  // Login Admin (Meera)
  const resAdmin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.meera@civora.local', password: 'CivoraDev123!' }),
  });
  const dataAdmin = await resAdmin.json();
  adminToken = dataAdmin.data.token;
  adminId = dataAdmin.data.user.id;

  // Login PWD Official (Rajesh Kumar - PWD Department)
  const resOffPwd = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh.kumar@example.com', password: 'CivoraDev123!' }),
  });
  const dataOffPwd = await resOffPwd.json();
  officialPwdToken = dataOffPwd.data.token;
  officialPwdId = dataOffPwd.data.user.id;

  // Login Sanitation Official (Sunita Rao - SAN Department)
  const resOffSan = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sunita.rao@example.com', password: 'CivoraDev123!' }),
  });
  const dataOffSan = await resOffSan.json();
  officialSanToken = dataOffSan.data.token;
  officialSanId = dataOffSan.data.user.id;
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 7: Official Progress Tracking, Inspections, Evidence & Verification', () => {
  let complaintId: string;
  let trackingId: string;

  before(async () => {
    // Create a fresh test complaint lodged by Citizen A
    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: JSON.stringify({
        title: 'Damaged main arterial road with potholes',
        description: 'Large potholes on main avenue creating serious hazards for commuters.',
        categoryId: catPwdId,
        priority: 'HIGH',
        locationAddress: '100ft Ring Road, Junction 4',
        locality: 'Indiranagar',
      }),
    });
    const json = await res.json();
    complaintId = json.data.complaint.id;
    trackingId = json.data.trackingId;
  });

  // 1. Department Assignment & Reassignment
  describe('1. Department Assignment & Reassignment', () => {
    test('GET /api/admin/complaints/unassigned lists complaints needing assignment', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints/unassigned`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.complaints));
    });

    test('PATCH /api/admin/complaints/:id/assign assigns department and advances status to ASSIGNED', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          departmentId: deptPwdId,
          officialId: officialPwdId,
          notes: 'Initial assignment to PWD engineer for structural assessment.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.complaint.status, ComplaintStatus.ASSIGNED);
      assert.equal(json.data.complaint.assignedDepartmentId, deptPwdId);
      assert.equal(json.data.complaint.assignedOfficialId, officialPwdId);
    });

    test('Reassignment to different department records audit event and preserves history', async () => {
      // Reassign to SAN
      const res = await fetch(`${baseUrl}/api/admin/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          departmentId: deptSanId,
          notes: 'Reassigned to Sanitation division for initial debris clearing.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.complaint.assignedDepartmentId, deptSanId);
      assert.ok(json.message.includes('reassigned'));

      // Reassign back to PWD for subsequent tests
      await fetch(`${baseUrl}/api/admin/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          departmentId: deptPwdId,
          officialId: officialPwdId,
          notes: 'Transferred back to PWD for road repairs.',
        }),
      });

      // Verify audit history contains reassignment
      const audits = await prisma.auditEvent.findMany({
        where: { entityType: 'COMPLAINT', entityId: complaintId, action: 'COMPLAINT_REASSIGNED' },
      });
      assert.ok(audits.length >= 1, 'Reassignment audit event must be persisted');
    });

    test('Citizens cannot assign or reassign departments', async () => {
      const res = await fetch(`${baseUrl}/api/admin/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ departmentId: deptSanId }),
      });
      assert.equal(res.status, 403);
    });
  });

  // 2. Official Progress Updates
  describe('2. Official Progress Tracking', () => {
    test('Official from another department is rejected with 403', async () => {
      // Sunita Rao (Sanitation) trying to update PWD complaint
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialSanToken}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized Sanitation Update',
          description: 'Attempting to update another department complaint.',
        }),
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.error.code, 'FORBIDDEN');
    });

    test('Citizen cannot create official progress update', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Citizen attempt',
          description: 'Trying to forge official progress.',
        }),
      });
      assert.equal(res.status, 403);
    });

    test('Authorized PWD official logs progress and auto-advances status to IN_PROGRESS', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          title: 'Road crew dispatched to location',
          description: 'Road repair team #4 deployed with mobile asphalt plant and signage.',
          stage: 'CREW_DISPATCHED',
          visibility: 'PUBLIC',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.newStatus, ComplaintStatus.IN_PROGRESS);
      assert.equal(json.data.progressUpdate.title, 'Road crew dispatched to location');

      // Verify status advanced in DB
      const dbComplaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
      assert.equal(dbComplaint?.status, ComplaintStatus.IN_PROGRESS);
    });

    test('Internal official progress update is hidden from public/citizen', async () => {
      // 1. Post internal note
      await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          title: 'Internal vendor coordination note',
          description: 'Bitumen supply delayed by 2 hours due to rain.',
          stage: 'INTERNAL_LOGISTICS',
          visibility: 'INTERNAL_OFFICIAL',
        }),
      });

      // 2. Fetch as citizen -> internal note must NOT be present
      const resCitizen = await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(resCitizen.status, 200);
      const jsonCitizen = await resCitizen.json();
      const hasInternal = jsonCitizen.data.progressUpdates.some(
        (u: any) => u.visibility === 'INTERNAL_OFFICIAL'
      );
      assert.equal(hasInternal, false, 'Internal progress updates must be hidden from citizens');

      // 3. Fetch as official -> internal note MUST be present
      const resOfficial = await fetch(`${baseUrl}/api/complaints/${complaintId}/progress`, {
        headers: { Authorization: `Bearer ${officialPwdToken}` },
      });
      assert.equal(resOfficial.status, 200);
      const jsonOfficial = await resOfficial.json();
      const foundInternal = jsonOfficial.data.progressUpdates.some(
        (u: any) => u.visibility === 'INTERNAL_OFFICIAL'
      );
      assert.equal(foundInternal, true, 'Staff must see internal progress updates');
    });
  });

  // 3. Site Inspection Records
  describe('3. Site Inspection Workflow', () => {
    test('Citizen cannot record site inspection', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/inspections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          outcome: InspectionOutcome.WORK_REQUIRED,
          observations: 'Citizen inspection attempt',
        }),
      });
      assert.equal(res.status, 403);
    });

    test('Authorized official logs site inspection with measurements and outcome', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/inspections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          outcome: InspectionOutcome.WORK_REQUIRED,
          observations: 'Surface gravel dislodged over an area of 4.5 meters. Sub-base intact.',
          measurements: 'Length: 4.5m, Width: 2.1m, Average Depth: 8cm',
          notes: 'Standard cold-mix asphalt will not suffice; hot-mix patch required.',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.inspection.outcome, InspectionOutcome.WORK_REQUIRED);
      assert.equal(json.data.inspection.inspector.id, officialPwdId);

      // Verify DB persistence
      const dbInspection = await prisma.siteInspection.findFirst({
        where: { complaintId },
      });
      assert.ok(dbInspection);
      assert.equal(dbInspection.outcome, InspectionOutcome.WORK_REQUIRED);
    });

    test('GET /api/complaints/:id/inspections returns inspection history', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/inspections`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.inspections.length >= 1);
      assert.ok(json.data.inspections[0].observations);
    });
  });

  // 4. Evidence Management
  describe('4. Evidence Metadata Registration', () => {
    test('Rejects unsafe path traversal characters in filename', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          fileName: '../../etc/shadow.jpg',
          mimeType: 'image/jpeg',
          fileSize: 102400,
        }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    test('Rejects unsupported media types', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          fileName: 'malicious_script.sh',
          mimeType: 'application/x-sh',
          fileSize: 2048,
        }),
      });
      assert.equal(res.status, 400);
    });

    test('Rejects oversized file metadata (> 10MB)', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          fileName: 'massive_video.mp4',
          mimeType: 'image/jpeg',
          fileSize: 50 * 1024 * 1024, // 50MB
        }),
      });
      assert.equal(res.status, 400);
    });

    test('Official registers valid inspection photo evidence', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          fileName: 'site_patch_completed.jpg',
          mimeType: 'image/jpeg',
          fileSize: 2450000,
          documentCategory: DocumentCategory.PROGRESS_PHOTO,
          visibility: DocumentVisibility.PUBLIC,
          description: 'Photo of completed bituminous patch prior to roller compaction.',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.evidence.fileName, 'site_patch_completed.jpg');
      assert.ok(json.data.evidence.storageKey.startsWith('evidence/complaints/'));
    });

    test('GET /api/complaints/:id/evidence returns evidence records', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/evidence`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.evidence.length >= 1);
    });
  });

  // 5. Resolution Submission & Citizen Verification / Reopening
  describe('5. Resolution Submission, Verification & Reopening', () => {
    test('Citizen cannot submit official resolution', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          resolutionNotes: 'Citizen claiming resolution.',
        }),
      });
      assert.equal(res.status, 403);
    });

    test('Official submits resolution moving complaint to RESOLVED', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialPwdToken}`,
        },
        body: JSON.stringify({
          resolutionNotes: 'Road surface repaved with 50mm Dense Bituminous Macadam. Curing completed and inspected.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.complaint.status, ComplaintStatus.RESOLVED);
      assert.ok(json.data.complaint.resolvedAt);

      // Verify DB persistence
      const dbComplaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
      assert.equal(dbComplaint?.status, ComplaintStatus.RESOLVED);
    });

    test('Another citizen (Citizen B) cannot verify Citizen A resolution', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/verify-resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          confirmationNotes: 'Impersonated verification attempt.',
        }),
      });

      assert.equal(res.status, 403, 'Must return 403 Forbidden for non-owner');
      const json = await res.json();
      assert.equal(json.error.code, 'FORBIDDEN');
    });

    test('Citizen A (owner) verifies resolution -> transitions to VERIFIED', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${complaintId}/verify-resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          confirmationNotes: 'Visited the site, the pothole is completely repaired and level.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.complaint.status, ComplaintStatus.VERIFIED);
      assert.ok(json.data.complaint.verifiedAt);

      // Verify status history has record
      const dbHistory = await prisma.complaintStatusHistory.findFirst({
        where: { complaintId, toStatus: ComplaintStatus.VERIFIED },
      });
      assert.ok(dbHistory);
      assert.equal(dbHistory.changedById, citizenAId);
    });

    test('Citizen A requests reopening with valid mandatory reason -> transitions to REOPENED', async () => {
      // Reopen request requires at least 10 chars explanation
      const resFail = await fetch(`${baseUrl}/api/complaints/${complaintId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ reason: 'Short' }), // < 10 chars
      });
      assert.equal(resFail.status, 400);

      const resSuccess = await fetch(`${baseUrl}/api/complaints/${complaintId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          reason: 'Heavy rain washed away the loose gravel; the depression has reappeared.',
        }),
      });

      assert.equal(resSuccess.status, 200);
      const jsonSuccess = await resSuccess.json();
      assert.equal(jsonSuccess.data.complaint.status, ComplaintStatus.REOPENED);

      // Verify earlier resolutionNotes are preserved
      const dbComplaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
      assert.equal(dbComplaint?.status, ComplaintStatus.REOPENED);
      assert.ok(dbComplaint?.resolutionNotes, 'Prior resolution notes must be preserved upon reopening');
    });

    test('Official workspace GET /api/official/complaints lists department complaints', async () => {
      const res = await fetch(`${baseUrl}/api/official/complaints`, {
        headers: { Authorization: `Bearer ${officialPwdToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data.complaints));
      assert.ok(json.data.pagination);
    });
  });
});
