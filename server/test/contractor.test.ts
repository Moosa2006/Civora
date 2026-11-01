import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;

let citizenCookie: string;
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

  // Login helper to grab auth cookie
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

  citizenCookie = await getCookie('citizen1@example.test');
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

describe('Module 17: Contractor Portal, Tendering & Work Execution Suite', () => {
  let createdTenderId: string;
  let testBidId: string;
  let awardedWorkOrderId: string;
  let milestone1Id: string;
  let defectId: string;

  test('1. Contractor Access & Role Separation', async () => {
    // 1.1 Unauthenticated access to contractor dashboard is rejected
    const unauthRes = await fetch(`${baseUrl}/api/contractor/dashboard`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 1.2 Citizen cannot access contractor dashboard
    const citizenRes = await fetch(`${baseUrl}/api/contractor/dashboard`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(citizenRes.status, 403, 'Citizen must be forbidden from contractor workspace (403)');

    // 1.3 Contractor can access their own dashboard
    const contractorRes = await fetch(`${baseUrl}/api/contractor/dashboard`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(contractorRes.status, 200, 'Contractor should access dashboard (200)');
    const dashBody = await contractorRes.json();
    assert.equal(dashBody.success, true);
    assert.ok(dashBody.data.contractor);
    assert.equal(dashBody.data.contractor.name, 'Apex Urban Infrastructure Ltd');
    assert.ok(dashBody.data.metrics);

    // 1.4 Contractor cannot access admin complaints triage
    const adminTriageRes = await fetch(`${baseUrl}/api/admin/complaints`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(adminTriageRes.status, 403, 'Contractor cannot access admin endpoints (403)');
  });

  test('2. Tender Creation & Publication (Official / Admin only)', async () => {
    // 2.1 Contractor cannot create a draft tender
    const contractorCreateRes = await fetch(`${baseUrl}/api/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        tenderNumber: `TND-TEST-${Date.now()}`,
        title: 'Unauthorized Tender Creation Attempt',
        description: 'Should fail',
        category: 'ROADS_AND_BRIDGES',
        scopeOfWork: 'Test scope',
        technicalCriteria: 'Test criteria',
        estimatedBudget: 1000000,
        submissionDeadline: new Date(Date.now() + 86400000 * 7).toISOString(),
        expectedDurationDays: 60,
      }),
    });
    assert.equal(contractorCreateRes.status, 403, 'Contractor cannot create tender (403)');

    // 2.2 Official creates draft tender
    const tNum = `TND-AUTO-${Date.now()}`;
    const officialCreateRes = await fetch(`${baseUrl}/api/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
      body: JSON.stringify({
        tenderNumber: tNum,
        title: 'Highway Overpass Structural Rehabilitation',
        description: 'Structural repairs and seismic retrofitting of arterial overpass.',
        category: 'ROADS_AND_BRIDGES',
        scopeOfWork: 'Full deck resurfacing, bearing replacement, and stormwater drainage installation.',
        technicalCriteria: 'Contractor must possess Class A certification and certified hydraulic jacks.',
        estimatedBudget: 4500000,
        earnestMoneyDeposit: 90000,
        minLicenseClass: 'A',
        submissionDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
        expectedDurationDays: 120,
      }),
    });
    assert.equal(officialCreateRes.status, 201, 'Official should create draft tender (201)');
    const createBody = await officialCreateRes.json();
    assert.equal(createBody.success, true);
    assert.equal(createBody.data.tender.status, 'DRAFT');
    createdTenderId = createBody.data.tender.id;

    // 2.3 Publish tender
    const publishRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/publish`, {
      method: 'POST',
      headers: { Cookie: officialCookie },
    });
    assert.equal(publishRes.status, 200, 'Official should publish tender (200)');
    const pubBody = await publishRes.json();
    assert.equal(pubBody.data.tender.status, 'PUBLISHED');
  });

  test('3. Public Tender Discovery & Server-Side Eligibility', async () => {
    // 3.1 Public can view published tender
    const pubViewRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}`);
    if (pubViewRes.status !== 200) {
      console.log('PUB VIEW ERROR:', pubViewRes.status, await pubViewRes.text());
    }
    assert.equal(pubViewRes.status, 200);
    const pubViewBody = await pubViewRes.json();
    assert.equal(pubViewBody.data.tender.tenderNumber.startsWith('TND-AUTO-'), true);

    // 3.2 Contractor views tender with server-side eligibility check
    const eligRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(eligRes.status, 200);
    const eligBody = await eligRes.json();
    assert.ok(eligBody.data.tender.eligibility, 'Should include server calculated eligibility');
    assert.equal(eligBody.data.tender.eligibility.isEligible, true);
    assert.equal(eligBody.data.tender.eligibility.canBid, true);
  });

  test('4. Contractor Bidding & Integrity Constraints', async () => {
    // 4.1 Citizen cannot submit a bid
    const citizenBidRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: citizenCookie },
      body: JSON.stringify({
        bidAmount: 4200000,
        proposedDurationDays: 110,
        technicalProposal: 'Citizen proposal attempting to bid illegally.',
      }),
    });
    assert.equal(citizenBidRes.status, 403, 'Citizen bidding must be rejected (403)');

    // 4.2 Negative or zero bid amount is rejected
    const invalidBidRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        bidAmount: -500,
        proposedDurationDays: 100,
        technicalProposal: 'Negative bid testing validation rejection.',
      }),
    });
    assert.equal(invalidBidRes.status, 400, 'Negative bid amount must return 400 Bad Request');

    // 4.3 Valid contractor bid submission
    const validBidRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        bidAmount: 4150000,
        proposedDurationDays: 105,
        technicalProposal:
          'Apex Urban will deploy 3 hydraulic jacks, dual mobile asphalt plants, and ISO 9001 certified engineering inspection.',
      }),
    });
    if (validBidRes.status !== 201) {
      const errText = await validBidRes.text();
      console.log('VALID BID ERROR:', validBidRes.status, errText);
    }
    assert.equal(validBidRes.status, 201, 'Valid contractor bid must return 201 Created');
    const bidBody = await validBidRes.json();
    assert.equal(bidBody.success, true);
    assert.equal(bidBody.data.bid.status, 'SUBMITTED');
    assert.equal(Number(bidBody.data.bid.bidAmount), 4150000);
    testBidId = bidBody.data.bid.id;

    // 4.4 Duplicate bid attempt on same tender is rejected
    const dupBidRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        bidAmount: 4100000,
        proposedDurationDays: 100,
        technicalProposal: 'Duplicate bid attempt.',
      }),
    });
    assert.equal(dupBidRes.status, 409, 'Duplicate bid must return 409 Conflict');

    // 4.5 Contractor sees bid in their personal bids list
    const myBidsRes = await fetch(`${baseUrl}/api/contractor/bids`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(myBidsRes.status, 200);
    const myBidsBody = await myBidsRes.json();
    const found = myBidsBody.data.bids.find((b: any) => b.id === testBidId);
    assert.ok(found, 'Submitted bid must be present in contractor bids list');
  });

  test('5. Official Bid Evaluation & Atomic Contract Award', async () => {
    // 5.1 Contractor cannot evaluate or award their own bid
    const selfAwardRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        winningBidId: testBidId,
        awardJustification: 'Self awarding',
      }),
    });
    assert.equal(selfAwardRes.status, 403, 'Contractor cannot award tenders (403)');

    // 5.2 Official inspects bids submitted for the tender
    const officialBidsRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids`, {
      headers: { Cookie: officialCookie },
    });
    assert.equal(officialBidsRes.status, 200);
    const officialBidsBody = await officialBidsRes.json();
    assert.equal(officialBidsBody.data.bids.length >= 1, true);

    // 5.3 Official evaluates bid
    const evalRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/bids/${testBidId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        evaluationNotes: 'Technical proposal compliant with seismic specifications.',
      }),
    });
    assert.equal(evalRes.status, 200);
    const evalBody = await evalRes.json();
    assert.equal(evalBody.data.bid.status, 'UNDER_REVIEW');

    // 5.4 Official awards tender (Atomic transaction generating WorkOrder and Milestones)
    const awardRes = await fetch(`${baseUrl}/api/tenders/${createdTenderId}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
      body: JSON.stringify({
        winningBidId: testBidId,
        awardJustification: 'Lowest responsive and accredited bidder with comprehensive equipment plan.',
      }),
    });
    assert.equal(awardRes.status, 200, 'Award must succeed with 200');
    const awardBody = await awardRes.json();
    assert.equal(awardBody.success, true);
    assert.equal(awardBody.data.tender.status, 'AWARDED');
    assert.ok(awardBody.data.workOrder, 'Award must atomically generate a WorkOrder');
    awardedWorkOrderId = awardBody.data.workOrder.id;

    // Verify 3 milestones were atomically created
    const dbMilestones = await prisma.contractMilestone.findMany({
      where: { workOrderId: awardedWorkOrderId },
      orderBy: { milestoneNumber: 'asc' },
    });
    assert.equal(dbMilestones.length, 3, 'Must create 3 execution milestones');
    milestone1Id = dbMilestones[0].id;
  });

  test('6. Work Execution: Work-Start Declaration & Site Verification', async () => {
    // 6.1 Citizen cannot submit work start
    const citizenWsRes = await fetch(`${baseUrl}/api/contractor/work-orders/${awardedWorkOrderId}/work-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: citizenCookie },
      body: JSON.stringify({
        actualStartDate: new Date().toISOString(),
        siteAddress: 'Illegal submission',
      }),
    });
    assert.equal(citizenWsRes.status, 403);

    // 6.2 Contractor submits valid work-start declaration
    const contractorWsRes = await fetch(
      `${baseUrl}/api/contractor/work-orders/${awardedWorkOrderId}/work-start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
        body: JSON.stringify({
          actualStartDate: new Date().toISOString(),
          siteAddress: 'Highway Pier 14-22, South Arterial Corridor',
          siteNotes: 'Mobilization completed. 15 skilled operatives and 2 excavators on site.',
        }),
      }
    );
    assert.equal(contractorWsRes.status, 201, 'Work start declaration must return 201 Created');
    const wsBody = await contractorWsRes.json();
    assert.equal(wsBody.data.workStart.status, 'PENDING_APPROVAL');

    // 6.3 Official engineering verification approves work-start
    const verifyWsRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/work-start/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
        body: JSON.stringify({
          approved: true,
        }),
      }
    );
    assert.equal(verifyWsRes.status, 200, 'Engineering verification must succeed');
    const verifyWsBody = await verifyWsRes.json();
    assert.equal(verifyWsBody.data.workStart.status, 'APPROVED');

    // Work order status must transition to IN_PROGRESS
    const updatedWo = await prisma.workOrder.findUnique({ where: { id: awardedWorkOrderId } });
    assert.equal(updatedWo?.executionStatus, 'IN_PROGRESS');
  });

  test('7. Daily Progress Logging & Milestone Verification Workflow', async () => {
    // 7.1 Contractor logs daily physical progress and materials
    const progRes = await fetch(`${baseUrl}/api/contractor/work-orders/${awardedWorkOrderId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        workPerformed: 'Demolition of cracked deck slab and initial steel reinforcement binding.',
        quantityCompleted: 150,
        unitOfMeasurement: 'sq_meters',
        materialsUsed: '20 metric tonnes Fe 500D TMT rebars',
      }),
    });
    assert.equal(progRes.status, 201, 'Physical progress log must return 201 Created');
    const progBody = await progRes.json();
    assert.equal(progBody.data.progressUpdate.quantityCompleted, 150);

    // 7.2 Contractor claims Milestone 1 completion
    const claimRes = await fetch(
      `${baseUrl}/api/contractor/work-orders/${awardedWorkOrderId}/milestones/${milestone1Id}/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
        body: JSON.stringify({
          actualCompletionDate: new Date().toISOString(),
          completionPercentage: 100,
          submissionNotes: 'All sub-structure testing and reinforcement completed with core strength certification.',
        }),
      }
    );
    assert.equal(claimRes.status, 200, 'Milestone claim must return 200');
    const claimBody = await claimRes.json();
    assert.equal(claimBody.data.milestone.status, 'SUBMITTED');

    // 7.3 Contractor cannot approve their own milestone
    const selfApproveRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/milestones/${milestone1Id}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
        body: JSON.stringify({ approved: true }),
      }
    );
    assert.equal(selfApproveRes.status, 403, 'Contractor cannot approve milestone (403)');

    // 7.4 Official engineer reviews and approves milestone
    const engineerReviewRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/milestones/${milestone1Id}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
        body: JSON.stringify({
          approved: true,
          reviewComments: 'Site inspection verified 100% compliance with load specifications.',
          verifiedCompletionPercentage: 100,
        }),
      }
    );
    assert.equal(engineerReviewRes.status, 200, 'Official review must succeed');
    const reviewBody = await engineerReviewRes.json();
    assert.equal(reviewBody.data.milestone.status, 'APPROVED');
  });

  test('8. Financial Disbursements & Traceable Payment Ledger', async () => {
    // 8.1 Contractor cannot mark payments as paid
    const contractorPayRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
        body: JSON.stringify({
          amount: 500000,
          transactionId: 'TX-ILLEGAL',
        }),
      }
    );
    assert.equal(contractorPayRes.status, 403, 'Contractor cannot record payment disbursements (403)');

    // 8.2 Official records milestone payment disbursement
    const officialPayRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
        body: JSON.stringify({
          amount: 1245000,
          transactionId: `TX-DISB-${Date.now()}`,
          description: 'Milestone 1 Mobilization and Sub-structure Completion Disbursement',
        }),
      }
    );
    assert.equal(officialPayRes.status, 201, 'Official payment recording must return 201');
    const payBody = await officialPayRes.json();
    assert.equal(Number(payBody.data.transaction.amount), 1245000);
    assert.equal(payBody.data.transaction.status, 'COMPLETED');

    // 8.3 Contractor sees payment in their workspace work-orders view
    const woDetailsRes = await fetch(`${baseUrl}/api/contractor/work-orders/${awardedWorkOrderId}`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(woDetailsRes.status, 200);
    const woDetailsBody = await woDetailsRes.json();
    assert.equal(woDetailsBody.data.workOrder.financialTransactions.length >= 1, true);
    assert.equal(Number(woDetailsBody.data.workOrder.financialTransactions[0].amount), 1245000);
  });

  test('9. Warranty & Defect Liability Lifecycle', async () => {
    // 9.1 Official logs a warranty defect against work order
    const reportDefectRes = await fetch(
      `${baseUrl}/api/official/work-orders/${awardedWorkOrderId}/defects`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
        body: JSON.stringify({
          title: 'Hairline stress fracture on expansion joint guard',
          description: 'During 30-day thermal load inspection, a 2mm micro-fissure was detected on pier 16 expansion seal.',
          location: 'Pier 16 East Shoulder',
          severity: 'MODERATE',
        }),
      }
    );
    assert.equal(reportDefectRes.status, 201, 'Defect log must return 201');
    const defBody = await reportDefectRes.json();
    assert.equal(defBody.data.defect.status, 'OPEN');
    defectId = defBody.data.defect.id;

    // 9.2 Contractor views assigned defect in their defects queue
    const contractorDefectsRes = await fetch(`${baseUrl}/api/contractor/defects`, {
      headers: { Cookie: contractorCookie },
    });
    assert.equal(contractorDefectsRes.status, 200);
    const defectsBody = await contractorDefectsRes.json();
    const foundDefect = defectsBody.data.defects.find((d: any) => d.id === defectId);
    assert.ok(foundDefect, 'Reported defect must appear in contractor defect queue');

    // 9.3 Contractor submits rectification evidence
    const rectifyRes = await fetch(`${baseUrl}/api/contractor/defects/${defectId}/rectify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: contractorCookie },
      body: JSON.stringify({
        rectificationNotes:
          'Elastomeric sealant injected under pressure and secondary steel cover plate bolted. Passed ultrasonic density check.',
      }),
    });
    assert.equal(rectifyRes.status, 200, 'Rectification submission must return 200');
    const rectifyBody = await rectifyRes.json();
    assert.equal(rectifyBody.data.defect.status, 'RECTIFIED');

    // 9.4 Official verifies rectification and closes defect
    const verifyDefectRes = await fetch(`${baseUrl}/api/official/defects/${defectId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officialCookie },
      body: JSON.stringify({
        approved: true,
        verificationNotes: 'Ultrasonic testing verified zero leakage and full structural continuity.',
      }),
    });
    assert.equal(verifyDefectRes.status, 200, 'Defect verification must succeed');
    const verifyDefectBody = await verifyDefectRes.json();
    assert.equal(verifyDefectBody.data.defect.status, 'CLOSED');
  });
});
