import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ProposalStatus, PollStatus } from '@prisma/client';

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

let validCategoryId: string;
let createdProposalId: string;
let createdProposalTrackingId: string;

let createdPollId: string;
let pollOptionIds: string[] = [];

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

  // Login Official (Rajesh)
  const resOff = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh.kumar@example.com', password: 'CivoraDev123!' }),
  });
  const dataOff = await resOff.json();
  officialToken = dataOff.data.token;
  officialId = dataOff.data.user.id;

  // Get active category
  const category = await prisma.complaintCategory.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  validCategoryId = category!.id;
});

after(async () => {
  // Cleanup test data created during test
  if (createdPollId) {
    await prisma.publicPoll.deleteMany({ where: { id: createdPollId } });
  }
  if (createdProposalId) {
    await prisma.communityProposal.deleteMany({ where: { id: createdProposalId } });
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Module 10: Civic Engagement, Proposals, Polls & Community Feedback', () => {
  // ==========================================
  // 1. Proposal Submission & Validation
  // ==========================================
  describe('1. Community Proposal Submission & Validation', () => {
    test('POST /api/engagement/proposals rejects unauthenticated requests (401)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Install solar streetlights',
          description: 'This is a detailed description of the community proposal for solar lights.',
          categoryId: validCategoryId,
        }),
      });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    test('POST /api/engagement/proposals rejects short title and description (400)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Bad',
          description: 'Too short',
          categoryId: validCategoryId,
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    test('POST /api/engagement/proposals creates valid proposal with tracking ID (201)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Establish Community Butterfly Garden at Indira Park',
          description:
            'A civic proposal to allocate underutilized park area for native flowering plants and pedestrian butterfly walkway.',
          categoryId: validCategoryId,
          locality: 'Sector 4, Central Park',
          problemStatement: 'The northeast corner of Indira Park is currently overgrown and collects discarded trash.',
          suggestedSolution: 'Clear the weeds, plant native perennial shrubs, and install educational signage.',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.proposal);
      assert.ok(json.data.trackingId);
      assert.match(json.data.trackingId, /^PROP-\d{4}-[A-Z0-9]+$/);
      assert.equal(json.data.proposal.status, ProposalStatus.SUBMITTED);

      createdProposalId = json.data.proposal.id;
      createdProposalTrackingId = json.data.trackingId;

      // Verify submitter received in-app notification
      const notif = await prisma.notification.findFirst({
        where: {
          userId: citizenAId,
          type: 'PROPOSAL_SUBMITTED',
          entityId: createdProposalId,
        },
      });
      assert.ok(notif, 'Submitter should receive PROPOSAL_SUBMITTED notification');
    });
  });

  // ==========================================
  // 2. Proposal Visibility & Privacy Controls
  // ==========================================
  describe('2. Proposal Visibility & Privacy Controls', () => {
    test('GET /api/engagement/proposals excludes SUBMITTED proposals from public listing', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const found = json.data.find((p: any) => p.id === createdProposalId);
      assert.equal(found, undefined, 'Unpublished proposal must not be visible in public listing');
    });

    test('GET /api/engagement/proposals/:id returns 404 for stranger (Citizen B) on unpublished proposal', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      assert.equal(res.status, 404, 'Strangers must not see unpublished proposal details');
    });

    test('GET /api/engagement/proposals/:id allows Submitter (Citizen A) to view own proposal', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, createdProposalId);
      assert.equal(json.data.status, ProposalStatus.SUBMITTED);
    });

    test('GET /api/engagement/proposals/my lists citizen submissions', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/my`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      const found = json.data.find((p: any) => p.id === createdProposalId);
      assert.ok(found, 'Submitter should see own proposal in my-proposals');
    });
  });

  // ==========================================
  // 3. Proposal Moderation Workflow
  // ==========================================
  describe('3. Proposal Moderation & Official Review', () => {
    test('Citizen cannot moderate proposals (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/admin/proposals/${createdProposalId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          status: 'PUBLISHED',
          internalNotes: 'Illegal attempt',
        }),
      });

      assert.equal(res.status, 403);
    });

    test('Admin moderates proposal to PUBLISHED with internal notes (200)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/admin/proposals/${createdProposalId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'PUBLISHED',
          internalNotes: 'Reviewed by parks department staff. Feasible for community input.',
          publicExplanation: 'Proposal meets municipal community guidelines.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, ProposalStatus.PUBLISHED);

      // Verify submitter received status update notification
      const notif = await prisma.notification.findFirst({
        where: {
          userId: citizenAId,
          type: 'PROPOSAL_STATUS_CHANGED',
          entityId: createdProposalId,
        },
      });
      assert.ok(notif, 'Citizen should receive PROPOSAL_STATUS_CHANGED notification');
      assert.ok(notif.message.includes('approved and published'));
    });

    test('Published proposal now appears in public explorer without internal moderation notes', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, ProposalStatus.PUBLISHED);
      assert.equal(json.data.internalModerationNotes, undefined, 'Internal notes must be stripped from public view');
    });

    test('Official posts authoritative response to proposal (200)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/admin/proposals/${createdProposalId}/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officialToken}`,
        },
        body: JSON.stringify({
          officialResponse:
            'The Town Planning and Horticulture teams have reviewed this proposal. A preliminary site inspection will assess soil suitability for native flowering plants.',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.officialResponse.includes('Horticulture teams'));

      // Verify submitter received PROPOSAL_RESPONSE notification
      const notif = await prisma.notification.findFirst({
        where: {
          userId: citizenAId,
          type: 'PROPOSAL_RESPONSE',
          entityId: createdProposalId,
        },
      });
      assert.ok(notif, 'Submitter must receive PROPOSAL_RESPONSE notification');
    });
  });

  // ==========================================
  // 4. Community Support & Discussion
  // ==========================================
  describe('4. Community Support & Public Discussion', () => {
    test('Citizen B toggles community support (adds vote)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.supported, true);
      assert.equal(json.data.supportCount, 1);
    });

    test('Citizen B toggles community support again (removes vote)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.supported, false);
      assert.equal(json.data.supportCount, 0);
    });

    test('Citizen B adds support back and posts a public comment', async () => {
      // Re-add support
      await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      // Post comment
      const commentRes = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          content: 'This would be a wonderful addition for families and local children! Strongly support.',
        }),
      });

      assert.equal(commentRes.status, 201);
      const commentJson = await commentRes.json();
      assert.equal(commentJson.success, true);
      assert.ok(commentJson.data.id);

      // Verify comments listing
      const listRes = await fetch(`${baseUrl}/api/engagement/proposals/${createdProposalId}/comments`);
      assert.equal(listRes.status, 200);
      const listJson = await listRes.json();
      assert.equal(listJson.success, true);
      assert.equal(listJson.data.length, 1);
      assert.equal(listJson.data[0].author.name, 'Priya Patel');
    });
  });

  // ==========================================
  // 5. Public Polls & Voting Integrity
  // ==========================================
  describe('5. Public Polls & Voting Integrity', () => {
    test('Citizen cannot create public poll (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/admin/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          title: 'Illegal Citizen Poll',
          question: 'Should citizens create polls?',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          options: ['Yes', 'No'],
        }),
      });

      assert.equal(res.status, 403);
    });

    test('Admin creates public single-choice poll with 3 options (201)', async () => {
      const startDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const endDate = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days ahead

      const res = await fetch(`${baseUrl}/api/engagement/admin/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Sector 4 Pedestrian Priority Survey',
          question: 'What pedestrian improvement should the municipal council prioritize in Sector 4?',
          description: 'Advisory community poll to gauge resident preference for pedestrian safety.',
          categoryId: validCategoryId,
          locality: 'Sector 4',
          pollType: 'SINGLE_CHOICE',
          visibilityRule: 'ALWAYS_VISIBLE',
          startDate,
          endDate,
          options: [
            'Raised Zebra Crossings & Ramps',
            'Dedicated Cycle Track & Bollards',
            'Solar Pedestrian Footpath Lighting',
          ],
          isAdvisory: true,
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.id);
      assert.equal(json.data.status, PollStatus.OPEN);
      assert.equal(json.data.options.length, 3);

      createdPollId = json.data.id;
      pollOptionIds = json.data.options.map((o: any) => o.id);
    });

    test('Citizen A submits vote for Option 1 in poll (200)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/polls/${createdPollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          optionIds: [pollOptionIds[0]],
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      // Verify user received confirmation alert
      const notif = await prisma.notification.findFirst({
        where: {
          userId: citizenAId,
          type: 'SYSTEM_ALERT',
          entityId: createdPollId,
        },
      });
      assert.ok(notif, 'Citizen must receive vote confirmation alert');
    });

    test('Citizen A cannot vote a second time in same poll (409 Conflict - Concurrency Safe)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/polls/${createdPollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          optionIds: [pollOptionIds[1]],
        }),
      });

      assert.equal(res.status, 409, 'Duplicate participation must be rejected with 409 Conflict');
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'ALREADY_VOTED');
    });

    test('Submitting multiple options for a SINGLE_CHOICE poll is rejected (400)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/polls/${createdPollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenBToken}`,
        },
        body: JSON.stringify({
          optionIds: [pollOptionIds[0], pollOptionIds[1]],
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'SINGLE_CHOICE_VIOLATION');
    });

    test('Poll detail reflects recorded votes and percentages correctly', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/polls/${createdPollId}`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.totalVotes, 1);
      assert.equal(json.data.hasVoted, true);
      assert.deepEqual(json.data.votedOptionIds, [pollOptionIds[0]]);

      const opt1 = json.data.options.find((o: any) => o.id === pollOptionIds[0]);
      assert.equal(opt1.voteCount, 1);
      assert.equal(opt1.percentage, 100);

      const opt2 = json.data.options.find((o: any) => o.id === pollOptionIds[1]);
      assert.equal(opt2.voteCount, 0);
      assert.equal(opt2.percentage, 0);
    });

    test('GET /api/engagement/analytics/overview returns aggregate civic metrics', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/analytics/overview`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.publishedProposals >= 1);
      assert.ok(json.data.totalPolls >= 1);
      assert.ok(json.data.totalPollParticipants >= 1);
      assert.ok(json.data.totalSupports >= 1);
      assert.ok(typeof json.data.officialResponseRate === 'number');
    });
  });
});
