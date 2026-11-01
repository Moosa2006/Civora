import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  DocumentVisibility,
  DocumentCategory,
  EvidencePurpose,
  EvidenceReviewStatus,
} from '@prisma/client';

let server: http.Server;
let baseUrl: string;

let targetComplaintTrackingId = 'CIV-2026-G3NFZ';
let targetComplaintId: string;
let emptyComplaintId: string;
let emptyComplaintTrackingId: string;
let confidentialDocId: string;
let confidentialComplaintId: string;
let confidentialTrackingId: string;

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

  // Verify target complaint CIV-2026-G3NFZ exists
  const target = await prisma.complaint.findUnique({
    where: { trackingId: targetComplaintTrackingId },
  });
  assert.ok(target, 'Complaint CIV-2026-G3NFZ must exist in the database');
  targetComplaintId = target.id;

  // Find or safely create a complaint with NO evidence
  let noEvidenceComp = await prisma.complaint.findFirst({
    where: {
      documents: { none: {} },
    },
  });

  if (!noEvidenceComp) {
    const citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    const category = await prisma.complaintCategory.findFirst({ where: { isActive: true } });
    assert.ok(citizen && category, 'Citizen and category must exist');

    noEvidenceComp = await prisma.complaint.create({
      data: {
        trackingId: 'CIV-TEST-NOEVID1',
        title: 'Test Complaint With No Evidence',
        description: 'Synthetic complaint created to verify empty evidence collection handling.',
        citizenId: citizen.id,
        categoryId: category.id,
        priority: 'LOW',
        status: 'SUBMITTED',
      },
    });
  }

  emptyComplaintId = noEvidenceComp.id;
  emptyComplaintTrackingId = noEvidenceComp.trackingId;

  // Find or safely create a complaint with CONFIDENTIAL evidence to test privacy protection
  let confidentialComp = await prisma.complaint.findFirst({
    where: {
      trackingId: { not: targetComplaintTrackingId },
    },
    include: {
      documents: true,
    },
  });

  if (!confidentialComp) {
    const citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    const category = await prisma.complaintCategory.findFirst({ where: { isActive: true } });
    confidentialComp = await prisma.complaint.create({
      data: {
        trackingId: 'CIV-TEST-CONFID1',
        title: 'Test Complaint With Confidential Evidence',
        description: 'Used for privacy access tests.',
        citizenId: citizen!.id,
        categoryId: category!.id,
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
      },
      include: {
        documents: true,
      },
    });
  }

  confidentialComplaintId = confidentialComp.id;
  confidentialTrackingId = confidentialComp.trackingId;

  // Create an INTERNAL_OFFICIAL document on this complaint if not present
  const existingConf = await prisma.document.findFirst({
    where: {
      complaintId: confidentialComplaintId,
      visibility: DocumentVisibility.INTERNAL_OFFICIAL,
    },
  });

  if (existingConf) {
    confidentialDocId = existingConf.id;
  } else {
    const uploader = await prisma.user.findFirst({ where: { role: 'GOVERNMENT_OFFICIAL' } });
    const newDoc = await prisma.document.create({
      data: {
        complaintId: confidentialComplaintId,
        fileName: 'internal_department_assessment.pdf',
        storageKey: `evidence/test/internal_${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        fileSize: BigInt(2048),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        evidencePurpose: EvidencePurpose.ADMINISTRATIVE_REVIEW,
        visibility: DocumentVisibility.INTERNAL_OFFICIAL,
        reviewStatus: EvidenceReviewStatus.PENDING_REVIEW,
        uploaderId: uploader!.id,
      },
    });
    confidentialDocId = newDoc.id;
  }
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Evidence Tracking and Verification Records Integration', () => {
  test('Case 1: Complaint tracking endpoint returns canonical internal id and trackingId', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/track/${targetComplaintTrackingId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data?.complaint, 'Response must include complaint data');

    const { id, trackingId } = json.data.complaint;
    assert.equal(id, targetComplaintId, 'Complaint id must match database UUID');
    assert.equal(trackingId, targetComplaintTrackingId, 'Complaint trackingId must match target');
  });

  test('Case 2: Evidence API resolves complaint by canonical UUID and returns genuine evidence', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/${targetComplaintId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.complaintId, targetComplaintId);
    assert.equal(json.data.trackingId, targetComplaintTrackingId);

    assert.ok(Array.isArray(json.data.evidence), 'Evidence must be an array');
    assert.ok(json.data.evidence.length >= 1, 'Target complaint must have at least 1 evidence record');

    const targetDoc = json.data.evidence.find((d: any) => d.fileName === 'gne_loo.png');
    assert.ok(targetDoc, 'Evidence list must include gne_loo.png');
    assert.equal(targetDoc.reviewStatus, 'PENDING_REVIEW', 'Status must match persisted database record');
    assert.equal(targetDoc.visibility, 'PUBLIC');
    assert.equal(targetDoc.downloadUrl, `/api/evidence/${targetDoc.id}/download`);
    assert.equal(targetDoc.fileUrl, `/api/evidence/${targetDoc.id}/file`);
  });

  test('Case 3: Evidence API resolves complaint by public trackingId and returns identical records', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/${targetComplaintTrackingId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.complaintId, targetComplaintId);
    assert.equal(json.data.trackingId, targetComplaintTrackingId);

    assert.ok(Array.isArray(json.data.evidence));
    assert.ok(json.data.evidence.length >= 1);
  });

  test('Case 4: Public viewers never receive citizen personal identity information (PII)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/${targetComplaintId}`);
    const json = await res.json();

    for (const doc of json.data.evidence) {
      if (doc.uploader?.role === 'CITIZEN') {
        assert.equal(
          doc.uploader.name,
          'Citizen Contributor',
          'Citizen personal name must be masked for public viewers'
        );
        assert.equal(doc.uploader.id, undefined, 'Citizen database ID must not be exposed to public viewers');
      }
    }
  });

  test('Case 5: Valid complaint with NO evidence returns legitimate empty array (not 404 or error)', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/${emptyComplaintId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.complaintId, emptyComplaintId);
    assert.equal(json.data.trackingId, emptyComplaintTrackingId);
    assert.ok(Array.isArray(json.data.evidence));
    assert.equal(json.data.evidence.length, 0, 'Evidence array must be empty');
  });

  test('Case 6: Nonexistent tracking ID returns distinct 404 NOT_FOUND response', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/CIV-9999-NONEXISTENT`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'NOT_FOUND');
    assert.equal(json.error?.message, 'Complaint not found.');
  });

  test('Case 7: Evidence request using string "undefined" returns 404 safely without database error', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/undefined`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'NOT_FOUND');
  });

  test('Case 8: Evidence request using string "null" returns 404 safely', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/complaints/null`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'NOT_FOUND');
  });

  test('Case 9: Public viewers cannot view or download confidential evidence (403 Forbidden)', async () => {
    // 1. In list endpoint, confidential document must not be visible to unauthenticated public
    const listRes = await fetch(`${baseUrl}/api/evidence/complaints/${confidentialComplaintId}`);
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    const hasConfidential = listJson.data.evidence.some((d: any) => d.id === confidentialDocId);
    assert.equal(hasConfidential, false, 'Internal official evidence must not appear in public list');

    // 2. Direct file download/stream attempt must return 403 Forbidden
    const downloadRes = await fetch(`${baseUrl}/api/evidence/${confidentialDocId}/file`);
    assert.equal(downloadRes.status, 403);
    const downloadJson = await downloadRes.json();
    assert.equal(downloadJson.success, false);
    assert.equal(downloadJson.error?.code, 'FORBIDDEN');
  });

  test('Case 10: Evidence belonging to Complaint A is strictly isolated from Complaint B', async () => {
    const resA = await fetch(`${baseUrl}/api/evidence/complaints/${targetComplaintId}`);
    const resB = await fetch(`${baseUrl}/api/evidence/complaints/${emptyComplaintId}`);

    const jsonA = await resA.json();
    const jsonB = await resB.json();

    const idsA = new Set(jsonA.data.evidence.map((d: any) => d.id));
    const idsB = new Set(jsonB.data.evidence.map((d: any) => d.id));

    for (const id of idsA) {
      assert.equal(idsB.has(id), false, 'Evidence from Complaint A must never appear under Complaint B');
    }
  });

  test('Case 11: Quarantined evidence is strictly omitted from public tracking results', async () => {
    // Attach a quarantined document to emptyComplaint
    const uploader = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    const quarantinedDoc = await prisma.document.create({
      data: {
        complaintId: emptyComplaintId,
        fileName: 'malicious_quarantined.png',
        storageKey: `evidence/test/quarantined_${Date.now()}.png`,
        mimeType: 'image/png',
        fileSize: BigInt(1024),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        evidencePurpose: EvidencePurpose.CITIZEN_SUPPORTING,
        visibility: DocumentVisibility.PUBLIC,
        reviewStatus: EvidenceReviewStatus.QUARANTINED,
        isQuarantined: true,
        quarantineReason: 'Security alert: malware signature detected',
        uploaderId: uploader!.id,
      },
    });

    const res = await fetch(`${baseUrl}/api/evidence/complaints/${emptyComplaintId}`);
    const json = await res.json();

    const hasQuarantined = json.data.evidence.some((d: any) => d.id === quarantinedDoc.id);
    assert.equal(hasQuarantined, false, 'Quarantined document must NOT appear in public tracking evidence list');

    // Cleanup synthetic test doc
    await prisma.document.delete({ where: { id: quarantinedDoc.id } });
  });
});
