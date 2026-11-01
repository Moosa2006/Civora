import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  generateUniqueTenderNumber,
  generateUniqueBidNumber,
  generateUniqueWorkOrderNumber,
  generateUniqueDefectTrackingId,
  isValidUuid,
} from '../src/lib/trackingId.js';

let server: http.Server;
let baseUrl: string;
let contractorCookie: string;
let officialCookie: string;
let adminCookie: string;

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
  adminCookie = await getCookie('admin1@example.test');
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 17.2: Contractor Identifier Collision & UUID Hardening Regression Suite', () => {
  test('1. Unique sequence generator unit tests', async () => {
    // isValidUuid tests
    assert.equal(isValidUuid('not-a-uuid'), false);
    assert.equal(isValidUuid('undefined'), false);
    assert.equal(isValidUuid(null), false);
    assert.equal(isValidUuid(123), false);
    assert.equal(isValidUuid('12345678-1234-1234-1234-123456789abc'), true);

    // Sequence generator tests against live DB
    const tenderNum = await generateUniqueTenderNumber(prisma);
    assert.match(tenderNum, /^TND-\d{4}-\d+/);

    const bidNum = await generateUniqueBidNumber(prisma);
    assert.match(bidNum, /^BID-\d{4}-\d+/);

    const woNum = await generateUniqueWorkOrderNumber(prisma);
    assert.match(woNum, /^WO-\d{4}-\d+/);

    const defectNum = await generateUniqueDefectTrackingId(prisma);
    assert.match(defectNum, /^DEF-\d{4}-\d+/);
  });

  test('2. Non-UUID parameters return 404 cleanly instead of crashing with Prisma P2023', async () => {
    const invalidIds = ['invalid-uuid', 'undefined', '123'];

    for (const badId of invalidIds) {
      // 2.1 Work order by ID
      const woRes = await fetch(`${baseUrl}/api/contractor/work-orders/${badId}`, {
        headers: { Cookie: contractorCookie },
      });
      assert.equal(woRes.status, 404, `GET work-orders/${badId} should return 404`);
      const woJson = await woRes.json();
      assert.equal(woJson.success, false);
      assert.equal(woJson.error.code, 'NOT_FOUND');

      // 2.2 Work order work start
      const startRes = await fetch(`${baseUrl}/api/contractor/work-orders/${badId}/work-start`, {
        method: 'POST',
        headers: { Cookie: contractorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteAddress: '123 Test Road', declaredStartDate: new Date().toISOString() }),
      });
      assert.equal(startRes.status, 404, `POST work-orders/${badId}/work-start should return 404`);

      // 2.3 Work order progress
      const progRes = await fetch(`${baseUrl}/api/contractor/work-orders/${badId}/progress`, {
        method: 'POST',
        headers: { Cookie: contractorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ physicalProgressPercentage: 10, progressNotes: 'Test progress update' }),
      });
      assert.equal(progRes.status, 404, `POST work-orders/${badId}/progress should return 404`);

      // 2.4 Milestone claim
      const claimRes = await fetch(`${baseUrl}/api/contractor/work-orders/${badId}/milestones/${badId}/claim`, {
        method: 'POST',
        headers: { Cookie: contractorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimedNotes: 'Milestone claimed complete', claimedPhysicalPercentage: 100 }),
      });
      assert.equal(claimRes.status, 404, `POST work-orders/${badId}/milestones/${badId}/claim should return 404`);

      // 2.5 Defect rectification
      const defectRes = await fetch(`${baseUrl}/api/contractor/defects/${badId}/rectify`, {
        method: 'POST',
        headers: { Cookie: contractorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rectificationNotes: 'Repaired defective asphalt layer.' }),
      });
      assert.equal(defectRes.status, 404, `POST defects/${badId}/rectify should return 404`);

      // 2.6 Bid by ID
      const bidRes = await fetch(`${baseUrl}/api/contractor/bids/${badId}`, {
        headers: { Cookie: contractorCookie },
      });
      assert.equal(bidRes.status, 404, `GET bids/${badId} should return 404`);

      // 2.7 Tender award with invalid tender ID
      const awardRes = await fetch(`${baseUrl}/api/tenders/${badId}/award`, {
        method: 'POST',
        headers: { Cookie: officialCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningBidId: '00000000-0000-0000-0000-000000000000' }),
      });
      assert.equal(awardRes.status, 404, `POST tenders/${badId}/award should return 404`);

      // 2.8 Official verify work start
      const verifyStartRes = await fetch(`${baseUrl}/api/official/work-orders/${badId}/work-start/verify`, {
        method: 'POST',
        headers: { Cookie: officialCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE', reviewNotes: 'Verified.' }),
      });
      assert.equal(verifyStartRes.status, 404, `POST official/work-orders/${badId}/work-start/verify should return 404`);

      // 2.9 Official review milestone
      const reviewMilestoneRes = await fetch(`${baseUrl}/api/official/work-orders/${badId}/milestones/${badId}/review`, {
        method: 'POST',
        headers: { Cookie: officialCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE', reviewerRemarks: 'Verified.' }),
      });
      assert.equal(reviewMilestoneRes.status, 404, `POST official/work-orders/${badId}/milestones/${badId}/review should return 404`);

      // 2.10 Official record payment
      const paymentRes = await fetch(`${baseUrl}/api/official/work-orders/${badId}/payments`, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50000, paymentReference: `TX-${Date.now()}` }),
      });
      assert.equal(paymentRes.status, 404, `POST official/work-orders/${badId}/payments should return 404`);
    }
  });
});
