import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;
let citizenToken: string;
let citizenId: string;
let sampleComplaintA: { id: string; trackingId: string };
let sampleComplaintB: { id: string; trackingId: string };

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

  // Login as Citizen (Aarav Sharma)
  const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aarav.sharma@example.com',
      password: 'CivoraDev123!',
    }),
  });
  const dataLogin = await resLogin.json();
  citizenToken = dataLogin.data.token;
  citizenId = dataLogin.data.user.id;

  // Retrieve two distinct complaints belonging to this citizen
  const complaints = await prisma.complaint.findMany({
    where: { citizenId },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });

  assert.ok(complaints.length >= 2, 'Citizen must have at least 2 seeded complaints for navigation regression testing');
  sampleComplaintA = { id: complaints[0].id, trackingId: complaints[0].trackingId };
  sampleComplaintB = { id: complaints[1].id, trackingId: complaints[1].trackingId };
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Module: Track Live Navigation & Scroll Position Regression Tests', () => {
  test('1. Citizen My Complaints endpoint returns complaints with valid tracking IDs', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/my`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.complaints));
    assert.ok(json.data.complaints.length > 0);

    const first = json.data.complaints[0];
    assert.ok(first.trackingId, 'Complaint must have trackingId for Track Live navigation');
    assert.match(first.trackingId, /^CIV-\d{4}-\w+/, 'Tracking ID must follow CIV-YYYY-XXXX pattern');
  });

  test('2. Track Live destination endpoint resolves complaint A by trackingId without PII', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/track/${sampleComplaintA.trackingId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.complaint);
    assert.equal(json.data.complaint.trackingId, sampleComplaintA.trackingId);
    assert.equal(json.data.complaint.id, sampleComplaintA.id);

    // Ensure citizen private information is not leaked in tracking payload
    assert.equal(json.data.complaint.citizen, undefined);
    assert.equal(json.data.complaint.citizenPhone, undefined);
    assert.equal(json.data.complaint.citizenEmail, undefined);
  });

  test('3. Track Live destination endpoint resolves complaint B by trackingId (switching complaints)', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/track/${sampleComplaintB.trackingId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.complaint);
    assert.equal(json.data.complaint.trackingId, sampleComplaintB.trackingId);
    assert.equal(json.data.complaint.id, sampleComplaintB.id);
    assert.notEqual(json.data.complaint.trackingId, sampleComplaintA.trackingId);
  });

  test('4. Direct communication messages endpoint resolves for owner citizen', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/${sampleComplaintA.id}/messages`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.messages));
  });

  test('5. Tracking endpoint supports case-insensitive tracking identifier', async () => {
    const lowerTrackingId = sampleComplaintA.trackingId.toLowerCase();
    const res = await fetch(`${baseUrl}/api/complaints/track/${lowerTrackingId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.complaint.trackingId, sampleComplaintA.trackingId);
  });
});
