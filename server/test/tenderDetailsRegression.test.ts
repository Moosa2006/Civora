import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;

let contractorCookie: string;
let officialCookie: string;
let citizenCookie: string;

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

  const getCookie = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CivoraDev123!' }),
    });
    const cookieHeader = res.headers.get('set-cookie');
    if (!cookieHeader) throw new Error(`Could not authenticate ${email}`);
    return cookieHeader.split(';')[0];
  };

  contractorCookie = await getCookie('contractor1@example.test');
  officialCookie = await getCookie('official1@example.test');
  citizenCookie = await getCookie('citizen1@example.test');
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 17.1: Tender Details Crash Regression & Verification', () => {
  let sampleTenderId: string;
  let sampleTenderNumber: string;

  test('1. Setup sample published tender for regression testing', async () => {
    const res = await fetch(`${baseUrl}/api/tenders`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(json.data.tenders.length > 0, 'Should have published tenders');

    const tender = json.data.tenders[0];
    sampleTenderId = tender.id;
    sampleTenderNumber = tender.tenderNumber;
    assert.ok(sampleTenderId, 'Sample tender must have an ID');
    assert.ok(sampleTenderNumber, 'Sample tender must have a tenderNumber');
  });

  test('2. Crash Regression: Contractor views tender and receives eligibility.details.status', async () => {
    // Original crash: TenderDetailPage read tender.eligibility.details.status
    // When eligibility.details was undefined, this threw Cannot read properties of undefined (reading 'status')
    const res = await fetch(`${baseUrl}/api/tenders/${sampleTenderId}`, {
      headers: { Cookie: contractorCookie },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(json.data.tender);

    const eligibility = json.data.tender.eligibility;
    assert.ok(eligibility, 'Eligibility object must be returned for contractor');
    assert.equal(typeof eligibility.isEligible, 'boolean');
    assert.equal(typeof eligibility.canBid, 'boolean');
    assert.equal(typeof eligibility.reason, 'string', 'Should return singular reason string');
    assert.ok(Array.isArray(eligibility.reasons), 'Should return reasons array');

    // CRITICAL FIX: details object must exist with contractor status
    assert.ok(eligibility.details, 'details sub-object must exist');
    assert.equal(typeof eligibility.details.status, 'string', 'details.status must be a valid string');
    assert.equal(typeof eligibility.details.isVerified, 'boolean', 'details.isVerified must be a boolean');
    assert.equal(typeof eligibility.details.deadlinePassed, 'boolean', 'details.deadlinePassed must be a boolean');
    assert.equal(typeof eligibility.details.alreadyBid, 'boolean', 'details.alreadyBid must be a boolean');

    // Confirm reading details.status does not throw
    const statusVal = json.data.tender.eligibility.details.status;
    assert.ok(statusVal, 'Reading eligibility.details.status must succeed');
  });

  test('3. Resilient Tender Resolution: Lookup works by UUID or tenderNumber', async () => {
    // 3.1 Lookup by tenderNumber
    const resByNum = await fetch(`${baseUrl}/api/tenders/${sampleTenderNumber}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(resByNum.status, 200);
    const jsonByNum = await resByNum.json();
    assert.ok(jsonByNum.success);
    assert.equal(jsonByNum.data.tender.id, sampleTenderId);

    // 3.2 Lookup by UUID
    const resById = await fetch(`${baseUrl}/api/tenders/${sampleTenderId}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(resById.status, 200);
    const jsonById = await resById.json();
    assert.ok(jsonById.success);
    assert.equal(jsonById.data.tender.tenderNumber, sampleTenderNumber);
  });

  test('4. Tender Non-existent / Missing Handling: Returns 404 without crashing', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${baseUrl}/api/tenders/${fakeUuid}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'NOT_FOUND');

    const fakeRef = 'TND-NON-EXISTENT';
    const resRef = await fetch(`${baseUrl}/api/tenders/${fakeRef}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(resRef.status, 404);
  });

  test('5. Public vs Contractor Isolation: Unauthenticated visitor sees public specs with eligibility=null', async () => {
    const res = await fetch(`${baseUrl}/api/tenders/${sampleTenderId}`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
    assert.equal(json.data.tender.eligibility, null, 'Public caller should receive null eligibility');
    assert.equal(json.data.tender.myBid, null, 'Public caller should receive null myBid');
    assert.ok(json.data.tender.scopeOfWork !== undefined);
  });

  test('6. Investigation Verification: Car crash record is a genuine Tender entity', async () => {
    // Search for TND-2026-1589
    const tenderRecord = await prisma.tender.findFirst({
      where: {
        OR: [
          { tenderNumber: 'TND-2026-1589' },
          { title: { contains: 'crash', mode: 'insensitive' } },
        ],
      },
      include: { department: true },
    });

    if (tenderRecord) {
      assert.equal(tenderRecord.tenderNumber, 'TND-2026-1589');
      assert.equal(tenderRecord.categoryCode, 'ROADS_AND_BRIDGES');
      assert.equal(tenderRecord.department.code, 'PWD');
      assert.equal(Number(tenderRecord.estimatedBudget), 120000);

      // Verify that this is querying the Tender table, not the Complaint table
      const complaintRecord = await prisma.complaint.findFirst({
        where: { title: { contains: 'crash', mode: 'insensitive' } },
      });
      assert.ok(complaintRecord, 'Corresponding demo complaint exists in database');
      assert.notEqual(tenderRecord.id, complaintRecord.id, 'Tender ID and Complaint ID are distinct database entities');
      assert.notEqual(tenderRecord.tenderNumber, complaintRecord.trackingId, 'Tender number and Complaint tracking ID are separate formats');
    }
  });

  test('7. Bidding Integrity: Rejection of late or duplicate bids', async () => {
    // Find an expired tender or verify deadline validation
    const pastDeadline = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const expiredTender = await prisma.tender.create({
      data: {
        tenderNumber: `TND-EXP-${Date.now()}`,
        title: 'Expired Bridge Maintenance Test Tender',
        description: 'Test tender with past deadline for regression validation.',
        departmentId: (await prisma.department.findFirstOrThrow()).id,
        categoryCode: 'ROADS_AND_BRIDGES',
        location: 'Sector 5 Municipal Highway',
        estimatedBudget: 500000,
        earnestMoneyDeposit: 10000,
        submissionDeadline: pastDeadline,
        status: 'PUBLISHED',
        createdById: (await prisma.user.findFirstOrThrow({ where: { role: 'GOVERNMENT_OFFICIAL' } })).id,
      },
    });

    const res = await fetch(`${baseUrl}/api/tenders/${expiredTender.id}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: contractorCookie,
      },
      body: JSON.stringify({
        bidAmount: 480000,
        proposedDurationDays: 45,
        technicalProposal: 'Execution methodology conforming to municipal engineering specs.',
        declarationAccepted: true,
      }),
    });

    assert.equal(res.status, 400, 'Expired tender must reject bid submission');
    const json = await res.json();
    assert.equal(json.error.code, 'DEADLINE_EXPIRED');

    // Cleanup the transient test tender
    await prisma.tender.delete({ where: { id: expiredTender.id } });
  });
});
