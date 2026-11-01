import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ComplaintStatus, EvidenceReviewStatus, EvidencePurpose } from '@prisma/client';

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

// Sample valid file buffers
const validJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0xff,
  0xd9,
]);

const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

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
  const san = await prisma.department.findUnique({ where: { code: 'SAN' } });
  assert.ok(pwd && san, 'PWD and SAN departments must exist in DB');
  deptPwdId = pwd.id;
  deptSanId = san.id;

  const cat = await prisma.complaintCategory.findFirst({
    where: { departmentId: deptPwdId, isActive: true },
  });
  assert.ok(cat, 'PWD complaint category must exist in DB');
  catPwdId = cat.id;

  // Login Citizen A (Aarav Sharma)
  const resA = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'CivoraDev123!' }),
  });
  const dataA = await resA.json();
  citizenAToken = dataA.data.token;
  citizenAId = dataA.data.user.id;

  // Login Citizen B (Priya Patel)
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

  // Login PWD Official (Rajesh Kumar)
  const resOffPwd = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh.kumar@example.com', password: 'CivoraDev123!' }),
  });
  const dataOffPwd = await resOffPwd.json();
  officialPwdToken = dataOffPwd.data.token;
  officialPwdId = dataOffPwd.data.user.id;

  // Login Sanitation Official (Sunita Rao)
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

describe('Module 12: Document & Evidence Management, Secure File Uploads & Resolution Proof', () => {
  let complaintId: string;
  let trackingId: string;
  let uploadedEvidenceId: string;

  before(async () => {
    // Citizen A lodges a test complaint
    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: JSON.stringify({
        title: 'Deep crater on Main Road causing traffic accidents',
        categoryId: catPwdId,
        priority: 'HIGH',
        locality: 'Indiranagar 100ft Road',
        locationAddress: 'Near Metro Station Pillar 42',
        description: 'Large crater spanning 2 meters causing safety hazard.',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    complaintId = json.data.complaint.id;
    trackingId = json.data.trackingId;

    // Admin assigns to PWD department and sets IN_PROGRESS
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        assignedDepartmentId: deptPwdId,
        assignedOfficialId: officialPwdId,
        status: ComplaintStatus.IN_PROGRESS,
      },
    });
  });

  // --- SECTION 1: Upload Security & Magic Byte Validation ---

  test('1. Citizen A successfully uploads a valid JPEG photo as CITIZEN_SUPPORTING evidence', async () => {
    const formData = new FormData();
    const file = new File([validJpegBuffer], 'road_damage.jpg', { type: 'image/jpeg' });
    formData.append('files', file);
    formData.append('evidencePurpose', 'CITIZEN_SUPPORTING');
    formData.append('description', 'Photographic evidence of road crater.');

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.count, 1);
    assert.equal(json.data.evidence[0].evidencePurpose, 'CITIZEN_SUPPORTING');
    assert.equal(json.data.evidence[0].reviewStatus, 'PENDING_REVIEW');
    assert.ok(json.data.evidence[0].sha256Checksum, 'SHA-256 checksum must be computed');
    uploadedEvidenceId = json.data.evidence[0].id;
  });

  test('2. Uploading a valid PDF document succeeds', async () => {
    const formData = new FormData();
    const file = new File([validPdfBuffer], 'inspection_sheet.pdf', { type: 'application/pdf' });
    formData.append('files', file);
    formData.append('evidencePurpose', 'CITIZEN_SUPPORTING');

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.evidence[0].mimeType, 'application/pdf');
  });

  test('3. Rejects spoofed MIME type (text file disguised as image/jpeg)', async () => {
    const formData = new FormData();
    // Plain text content disguised with .jpg filename and image/jpeg header
    const fakeFile = new File(['Fake malicious executable script disguised as jpg'], 'exploit.jpg', {
      type: 'image/jpeg',
    });
    formData.append('files', fakeFile);
    formData.append('evidencePurpose', 'CITIZEN_SUPPORTING');

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_FILE_SIGNATURE');
  });

  test('4. Rejects unsupported file extension (.exe or .txt)', async () => {
    const formData = new FormData();
    const badFile = new File(['some content'], 'payload.exe', { type: 'application/octet-stream' });
    formData.append('files', badFile);

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
  });

  test('5. Rejects oversized file (> 10MB)', async () => {
    const formData = new FormData();
    // Allocate buffer larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 0x00);
    const oversizedFile = new File([largeBuffer], 'giant_video.jpg', { type: 'image/jpeg' });
    formData.append('files', oversizedFile);

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 413);
    assert.equal(json.error.code, 'FILE_TOO_LARGE');
  });

  // --- SECTION 2: Role Authorization & Scope Boundaries ---

  test('6. Citizen B cannot upload evidence to Citizen A complaint (403 Forbidden)', async () => {
    const formData = new FormData();
    const file = new File([validJpegBuffer], 'stranger_upload.jpg', { type: 'image/jpeg' });
    formData.append('files', file);

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenBToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });

  test('7. Sanitation Official cannot upload evidence to PWD complaint (403 Forbidden)', async () => {
    const formData = new FormData();
    const file = new File([validJpegBuffer], 'san_interfering.jpg', { type: 'image/jpeg' });
    formData.append('files', file);

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officialSanToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });

  test('8. Assigned PWD Official can upload OFFICIAL_PROGRESS evidence', async () => {
    const formData = new FormData();
    const file = new File([validPngBuffer], 'pwd_excavation_progress.png', { type: 'image/png' });
    formData.append('files', file);
    formData.append('evidencePurpose', 'OFFICIAL_PROGRESS');
    formData.append('description', 'Initial excavation and rubble removal underway.');

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officialPwdToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.evidence[0].evidencePurpose, 'OFFICIAL_PROGRESS');
    assert.equal(json.data.evidence[0].reviewStatus, 'PENDING_REVIEW');
  });

  // --- SECTION 3: Resolution Proof & Separation from Complaint Resolution ---

  test('9. Official uploads RESOLUTION_PROOF; complaint does NOT automatically mark as closed or verified', async () => {
    const formData = new FormData();
    const file = new File([validJpegBuffer], 'repaved_road_completed.jpg', { type: 'image/jpeg' });
    formData.append('files', file);
    formData.append('evidencePurpose', 'RESOLUTION_PROOF');
    formData.append('description', 'Repaving completed with asphalt overlay.');

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officialPwdToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.data.evidence[0].evidencePurpose, 'RESOLUTION_PROOF');
    assert.equal(json.data.evidence[0].reviewStatus, 'PENDING_REVIEW');

    // Verify complaint status in DB remains IN_PROGRESS (did not jump to RESOLVED or VERIFIED)
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    assert.equal(complaint?.status, ComplaintStatus.IN_PROGRESS);
  });

  // --- SECTION 4: Review Queue & Verification Decisions ---

  test('10. Citizen cannot access staff pending review queue (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/pending-queue`, {
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });

  test('11. Official can view pending review queue', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/pending-queue`, {
      headers: {
        Authorization: `Bearer ${officialPwdToken}`,
      },
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.documents));
    assert.ok(json.data.documents.length >= 1);
  });

  test('12. Rejection decision fails if mandatory rejectionReason is missing (400)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: 'REJECTED',
        // Missing rejectionReason
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  test('13. Admin rejects evidence with mandatory reason; logs immutable audit and review decision', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: 'REJECTED',
        rejectionReason: 'Photograph blurry and does not show street landmark clearly.',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.document.reviewStatus, 'REJECTED');
    assert.equal(json.data.document.rejectionReason, 'Photograph blurry and does not show street landmark clearly.');

    // Verify EvidenceReviewLog created in database
    const reviewLog = await prisma.evidenceReviewLog.findFirst({
      where: { documentId: uploadedEvidenceId },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(reviewLog);
    assert.equal(reviewLog?.toStatus, EvidenceReviewStatus.REJECTED);
  });

  test('14. Resubmission request decision requires resubmission guidance (400 if missing)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: 'RESUBMISSION_REQUESTED',
        // Missing guidance
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  test('15. Admin verifies evidence with VERIFIED decision', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: 'VERIFIED',
        reviewNotes: 'Reviewed in site inspection visit. Road damage matches report.',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.document.reviewStatus, 'VERIFIED');
  });

  // --- SECTION 5: Secure File Streaming & Download Headers ---

  test('16. Secure file streaming returns nosniff and correct content type headers', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/file`, {
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    const arrayBuffer = await res.arrayBuffer();
    assert.ok(arrayBuffer.byteLength > 0);
  });

  test('17. Secure file download returns attachment disposition', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/download`, {
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-disposition')?.includes('filename="'));
  });

  // --- SECTION 6: Admin Quarantine Workflow ---

  test('18. Non-admin cannot quarantine evidence (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/quarantine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officialPwdToken}`,
      },
      body: JSON.stringify({
        reason: 'Suspicious upload content',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });

  test('19. Admin quarantines evidence file with mandatory reason', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/quarantine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Reported as abusive image payload violating municipal upload policy.',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.document.isQuarantined, true);
    assert.equal(json.data.document.reviewStatus, 'QUARANTINED');
  });

  test('20. Quarantined evidence is blocked from normal citizen file streaming', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${uploadedEvidenceId}/file`, {
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'EVIDENCE_QUARANTINED');
  });
});
