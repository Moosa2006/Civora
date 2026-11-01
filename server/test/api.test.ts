import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;

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
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Civora Backend API & Health Tests', () => {
  test('GET /api/health returns 200 OK and reports connected database', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200, 'Health endpoint should return 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'civora-backend');
    assert.equal(body.data.api, 'ok');
    assert.equal(body.data.database, 'connected');
    assert.equal(typeof body.data.latencyMs, 'number');
    assert.ok(body.data.latencyMs >= 0);
  });

  test('GET /api/health/diagnostics rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/health/diagnostics`);
    assert.equal(res.status, 401, 'Unauthenticated diagnostics probe should return 401');
  });

  test('GET /api/health/diagnostics returns detailed system telemetry for authorized Admin', async () => {
    // Authenticate as Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.meera@civora.local', password: 'CivoraDev123!' }),
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data.token;

    const res = await fetch(`${baseUrl}/api/health/diagnostics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200, 'Admin diagnostics endpoint should return 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.service, 'civora-backend');
    assert.equal(typeof body.data.uptimeSeconds, 'number');
    assert.ok(body.data.uptimeSeconds >= 0);
    assert.equal(typeof body.data.memory.rssMb, 'number');
    assert.equal(typeof body.data.memory.heapUsedMb, 'number');
    assert.equal(body.data.database.status, 'connected');
    assert.equal(typeof body.data.metrics.complaintsCount, 'number');
    assert.equal(typeof body.data.metrics.usersCount, 'number');
    assert.equal(typeof body.data.metrics.departmentsCount, 'number');
  });

  test('GET /api/nonexistent-endpoint returns structured 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    assert.equal(res.status, 404, 'Unknown endpoint should return 404');

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.message.includes('not found'));
  });

  test('GET /api/meta/departments returns seeded active departments', async () => {
    const res = await fetch(`${baseUrl}/api/meta/departments`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 5, 'Should have at least 5 seeded departments');

    const pwd = body.data.find((d: { code: string }) => d.code === 'PWD');
    assert.ok(pwd, 'PWD department should be present');
    assert.equal(pwd.name, 'Public Works Department');
  });

  test('GET /api/meta/categories returns categories with department relations', async () => {
    const res = await fetch(`${baseUrl}/api/meta/categories`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 5, 'Should have at least 5 complaint categories');

    const potholeCat = body.data.find((c: { code: string }) => c.code === 'ROADS_POTHOLES');
    assert.ok(potholeCat, 'ROADS_POTHOLES category should be present');
    assert.ok(potholeCat.department, 'Category must have a department relation');
    assert.equal(potholeCat.department.code, 'PWD');
  });

  test('GET /api/meta/stats returns live aggregated counts', async () => {
    const res = await fetch(`${baseUrl}/api/meta/stats`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.activeDepartments >= 5);
    assert.ok(body.data.activeCategories >= 5);
    assert.ok(body.data.totalComplaintsLogged >= 6);
    assert.ok(body.data.activeCivicWorks >= 1);
  });
});

describe('Database Integration & Seed Data Integrity Tests', () => {
  test('Prisma can query seeded users and verify role distribution', async () => {
    const users = await prisma.user.findMany({
      select: { email: true, role: true, accountStatus: true },
    });
    assert.ok(users.length >= 6, 'Should have at least 6 seeded users');

    const admin = users.find((u) => u.email === 'admin.meera@civora.local');
    assert.ok(admin, 'Admin account should exist');
    assert.equal(admin.role, 'ADMIN');

    const citizens = users.filter((u) => u.role === 'CITIZEN');
    assert.ok(citizens.length >= 3, 'Should have at least 3 citizens');

    const officials = users.filter((u) => u.role === 'GOVERNMENT_OFFICIAL');
    assert.ok(officials.length >= 2, 'Should have at least 2 officials');
  });

  test('Seeded complaints possess valid relations and status history', async () => {
    const complaint = await prisma.complaint.findUnique({
      where: { trackingId: 'CIV-2026-00101' },
      include: {
        citizen: true,
        assignedDepartment: true,
        assignedOfficial: true,
        statusHistory: true,
        documents: true,
      },
    });

    assert.ok(complaint, 'Complaint CIV-2026-00101 should exist');
    assert.equal(complaint.trackingId, 'CIV-2026-00101');
    assert.equal(complaint.citizen.email, 'aarav.sharma@example.com');
    assert.equal(complaint.assignedDepartment?.code, 'PWD');
    assert.equal(complaint.assignedOfficial?.email, 'rajesh.kumar@example.com');
    assert.ok(complaint.statusHistory.length >= 3, 'Should have 3 status transitions');
    assert.ok(complaint.documents.length >= 1, 'Should have attached photo evidence document');
  });

  test('Seeded civic work links to complaint, estimate, and work order', async () => {
    const civicWork = await prisma.civicWork.findUnique({
      where: { workOrderNumber: 'CW-2026-0042' },
      include: {
        department: true,
        complaintLinks: {
          include: { complaint: true },
        },
        estimates: {
          include: { lineItems: true },
        },
        approvals: true,
        workOrders: {
          include: {
            contractor: true,
            progressUpdates: true,
          },
        },
        financialRecords: true,
      },
    });

    assert.ok(civicWork, 'Civic Work CW-2026-0042 must exist');
    assert.equal(civicWork.department.code, 'PWD');

    // Complaint M:N link
    assert.ok(civicWork.complaintLinks.length >= 1);
    assert.equal(civicWork.complaintLinks[0].complaint.trackingId, 'CIV-2026-00101');

    // Estimate & line items
    assert.ok(civicWork.estimates.length >= 1);
    assert.equal(civicWork.estimates[0].estimateNumber, 'EST-2026-0089');
    assert.ok(civicWork.estimates[0].lineItems.length >= 2);

    // Approval
    assert.ok(civicWork.approvals.length >= 1);
    assert.equal(civicWork.approvals[0].approvalType, 'TECHNICAL_SANCTION');

    // Work order & contractor
    assert.ok(civicWork.workOrders.length >= 1);
    const wo = civicWork.workOrders[0];
    assert.equal(wo.workOrderNumber, 'WO-2026-0012');
    assert.equal(wo.contractor.registrationNumber, 'REG-2024-KA-8810');
    assert.ok(wo.progressUpdates.length >= 1);
    assert.equal(Number(wo.progressUpdates[0].physicalProgressPercentage), 65.5);

    // Financial transaction
    assert.ok(civicWork.financialRecords.length >= 1);
    assert.equal(civicWork.financialRecords[0].paymentReference, 'TREASURY-2026-Q3-0914');
  });
});

describe('Centralized Error Handling Unit Tests', () => {
  test('errorHandler formats generic Error into 500 JSON without crashing', async () => {
    const { errorHandler } = await import('../src/middleware/errorHandler.js');
    let statusCode = 0;
    let jsonBody: any = null;

    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      },
    };

    errorHandler(new Error('Simulated internal failure'), {} as any, mockRes, () => {});

    assert.equal(statusCode, 500);
    assert.equal(jsonBody.success, false);
    assert.equal(jsonBody.error.code, 'INTERNAL_SERVER_ERROR');
    assert.ok(jsonBody.error.message);
  });
});
