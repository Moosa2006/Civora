import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { NotificationType, ComplaintStatus } from '@prisma/client';
import { NotificationService } from '../src/lib/notificationService.js';

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

let testComplaintId: string;
let testTrackingId: string;
let createdNotificationId: string;

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

  // Find a complaint owned by Citizen A
  const existingComplaint = await prisma.complaint.findFirst({
    where: { citizenId: citizenAId },
  });

  if (existingComplaint) {
    testComplaintId = existingComplaint.id;
    testTrackingId = existingComplaint.trackingId;
  } else {
    // Create one for Citizen A
    const cat = await prisma.complaintCategory.findFirst();
    const created = await prisma.complaint.create({
      data: {
        trackingId: 'CIV-2026-TESTM9',
        title: 'Module 9 Test Complaint',
        description: 'Testing notifications and messages',
        citizenId: citizenAId,
        categoryId: cat!.id,
        locationAddress: 'Test Road, Block 1',
        locality: 'Test Nagar',
      },
    });
    testComplaintId = created.id;
    testTrackingId = created.trackingId;
  }
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Module 9: Notifications, Communication & Preferences Tests', () => {
  describe('1. In-App Notifications API', () => {
    test('GET /api/notifications requires authentication (401 when unauthorized)', async () => {
      const res = await fetch(`${baseUrl}/api/notifications`);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    test('Creates an in-app notification via NotificationService and verifies in list', async () => {
      const created = await NotificationService.sendNotification({
        userId: citizenAId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Test Notification Alert',
        message: 'This is a test notification alert for Module 9.',
        entityType: 'COMPLAINT',
        entityId: testComplaintId,
        actionUrl: `/track?id=${testTrackingId}`,
        deduplicateSeconds: 0,
      });

      assert.ok(created);
      createdNotificationId = created.id;

      const res = await fetch(`${baseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.notifications));
      assert.ok(json.data.notifications.length > 0);

      const found = json.data.notifications.find((n: any) => n.id === createdNotificationId);
      assert.ok(found, 'Created notification must be in list');
      assert.equal(found.isRead, false);
      assert.equal(found.title, 'Test Notification Alert');
      assert.ok(json.data.pagination.unreadCount >= 1);
    });

    test('GET /api/notifications/unread-count returns accurate count', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(typeof json.data.unreadCount, 'number');
      assert.ok(json.data.unreadCount >= 1);
    });

    test('PATCH /api/notifications/:id/read marks notification as read', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/${createdNotificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.notification.isRead, true);
      assert.ok(json.data.notification.readAt);
    });

    test('PATCH /api/notifications/:id/read forbids Citizen B from reading Citizen A notification', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/${createdNotificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'FORBIDDEN');
    });

    test('POST /api/notifications/mark-all-read marks all unread notifications as read', async () => {
      // Create another unread notification first
      await NotificationService.sendNotification({
        userId: citizenAId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Unread Alert',
        message: 'Alert message to be marked read',
        deduplicateSeconds: 0,
      });

      const res = await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.count >= 1);

      // Verify unread count is now 0
      const countRes = await fetch(`${baseUrl}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      const countJson = await countRes.json();
      assert.equal(countJson.data.unreadCount, 0);
    });
  });

  describe('2. Notification Preferences API', () => {
    test('GET /api/notifications/preferences returns user settings or defaults', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/preferences`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.preferences);
      assert.equal(json.data.preferences.statusChangeAlerts, true);
      assert.equal(json.data.preferences.emailNotifications, false);
    });

    test('PUT /api/notifications/preferences updates settings', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${citizenAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusChangeAlerts: false,
          emailNotifications: true,
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.preferences.statusChangeAlerts, false);
      assert.equal(json.data.preferences.emailNotifications, true);

      // Verify NotificationService respects the disabled statusChangeAlerts preference
      const skippedNotif = await NotificationService.notifyComplaintStatusChanged(
        {
          id: testComplaintId,
          trackingId: testTrackingId,
          title: 'Test',
          citizenId: citizenAId,
          status: ComplaintStatus.UNDER_REVIEW,
        },
        'Test remarks'
      );
      assert.equal(skippedNotif, null, 'Notification must be skipped when preference toggle is false');

      // Re-enable for subsequent tests
      await fetch(`${baseUrl}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${citizenAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusChangeAlerts: true,
          emailNotifications: false,
        }),
      });
    });

    test('Deduplication prevents rapid identical notifications within window', async () => {
      const first = await NotificationService.sendNotification({
        userId: citizenAId,
        type: NotificationType.PROGRESS_UPDATE,
        title: 'Dedup Check',
        message: 'Message 1',
        entityId: testComplaintId,
        deduplicateSeconds: 30,
      });
      assert.ok(first);

      const second = await NotificationService.sendNotification({
        userId: citizenAId,
        type: NotificationType.PROGRESS_UPDATE,
        title: 'Dedup Check',
        message: 'Message 2',
        entityId: testComplaintId,
        deduplicateSeconds: 30,
      });

      assert.equal(second?.id, first?.id, 'Second call must return the existing notification rather than duplicate');
    });
  });

  describe('3. Citizen–Official Complaint Communication Thread', () => {
    test('POST /api/complaints/:id/messages sends a message from Citizen A', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${citizenAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello, could you provide an update on when the field inspection is scheduled?',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.message);
      assert.equal(json.data.message.sender.id, citizenAId);
      assert.equal(json.data.message.isInternal, false);
    });

    test('POST /api/complaints/:id/messages rejects empty message with 400', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${citizenAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '   ',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    test('GET /api/complaints/:id/messages returns message history for complaint owner', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/messages`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.messages));
      assert.ok(json.data.messages.length >= 1);
      assert.equal(json.data.trackingId, testTrackingId);
    });

    test('GET /api/complaints/:id/messages forbids Citizen B from viewing Citizen A messages (403)', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/messages`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'FORBIDDEN');
    });

    test('Admin sends response message and Citizen A receives notification', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Field inspection has been scheduled for tomorrow morning.',
        }),
      });

      assert.equal(res.status, 201);

      // Verify Citizen A received MESSAGE_RECEIVED notification
      const notifRes = await fetch(`${baseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      const notifJson = await notifRes.json();
      const messageNotif = notifJson.data.notifications.find(
        (n: any) => n.type === 'MESSAGE_RECEIVED' && n.entityId === testComplaintId
      );

      assert.ok(messageNotif, 'Citizen A must receive MESSAGE_RECEIVED notification');
      assert.ok(messageNotif.title.includes('Department Message'));
    });
  });
});
