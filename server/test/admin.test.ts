import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { sanitizeCsvCell } from '../src/controllers/adminReports.controller.js';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let adminId: string;
let citizenToken: string;
let citizenId: string;
let officialToken: string;

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

  const login = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CivoraDev123!' }),
    });
    const json = (await res.json()) as any;
    assert.ok(json.success, `Login failed for ${email}`);
    return { token: json.data.token as string, user: json.data.user };
  };

  const admin = await login('admin1@example.test');
  adminToken = admin.token;
  adminId = admin.user.id;

  const citizen = await login('citizen1@example.test');
  citizenToken = citizen.token;
  citizenId = citizen.user.id;

  const official = await login('official1@example.test');
  officialToken = official.token;
});

after(async () => {
  // Ensure maintenance mode is disabled after test run
  await prisma.platformSetting.upsert({
    where: { key: 'maintenance_mode' },
    update: { value: 'false' },
    create: { key: 'maintenance_mode', value: 'false', category: 'MAINTENANCE' },
  });

  // Clean up any test incidents
  await prisma.operationalIncident.deleteMany({
    where: { title: { contains: 'Test Incident' } },
  });

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('Module 16: System Administration, Platform Configuration, Audit & Health Tests', () => {
  describe('1. Authorization & RBAC for Admin Endpoints', () => {
    test('Anonymous request to /api/admin/dashboard/overview is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/dashboard/overview`);
      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'UNAUTHORIZED');
    });

    test('Citizen request to /api/admin/dashboard/overview is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/dashboard/overview`, {
        headers: { Authorization: `Bearer ${citizenToken}` },
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as any;
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'FORBIDDEN');
    });

    test('Official request to /api/admin/config is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${officialToken}` },
      });
      assert.equal(res.status, 403);
    });

    test('Administrator request to /api/admin/dashboard/overview succeeds with 200 and real data', async () => {
      const res = await fetch(`${baseUrl}/api/admin/dashboard/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.users.total >= 1);
      assert.ok(data.data.complaints.total >= 0);
      assert.ok('maintenanceMode' in data.data);
      assert.ok(Array.isArray(data.data.recentAuditEvents));
    });
  });

  describe('2. Operational Health & Readiness Probes', () => {
    test('Public Liveness Probe GET /api/health returns 200 with database status', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.equal(data.status, 'ok');
      assert.equal(data.data.database, 'connected');
    });

    test('Public Readiness Probe GET /api/health/ready returns 200 with ready status', async () => {
      const res = await fetch(`${baseUrl}/api/health/ready`);
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.equal(data.status, 'ready');
      assert.equal(data.dependencies.database, 'connected');
    });

    test('Protected Admin Diagnostics GET /api/health/diagnostics returns 200 with memory and open incidents', async () => {
      const res = await fetch(`${baseUrl}/api/health/diagnostics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.memory.rssMb > 0);
      assert.ok('openIncidentsCount' in data.data.metrics);
    });
  });

  describe('3. Platform Configuration Management', () => {
    test('GET /api/admin/config returns safe settings without exposing secrets or .env', async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      const settings = data.data.settings as any[];
      assert.ok(settings.length >= 8);

      // Verify no passwords or keys leaked
      for (const s of settings) {
        assert.ok(!s.key.toLowerCase().includes('password'));
        assert.ok(!s.key.toLowerCase().includes('secret'));
        assert.ok(!s.key.toLowerCase().includes('jwt'));
      }
    });

    test('PUT /api/admin/config/support_email rejects invalid email with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/config/support_email`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: 'not-an-email', reason: 'Testing validation' }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'CONFIG_VALIDATION_ERROR');
    });

    test('PUT /api/admin/config/support_email saves valid email and records change log', async () => {
      const newEmail = 'civic-help@civora.gov.in';
      const res = await fetch(`${baseUrl}/api/admin/config/support_email`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: newEmail, reason: 'Updating official contact email' }),
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);

      // Check change history
      const historyRes = await fetch(`${baseUrl}/api/admin/config/history`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(historyRes.status, 200);
      const historyData = (await historyRes.json()) as any;
      assert.ok(historyData.data.history.length > 0);
      const latest = historyData.data.history[0];
      assert.equal(latest.key, 'support_email');
      assert.equal(latest.newValue, newEmail);
    });
  });

  describe('4. Maintenance Mode & Service Availability Enforcement', () => {
    test('Activating maintenance_mode blocks non-admin write requests with 503', async () => {
      // 1. Activate maintenance mode
      const setRes = await fetch(`${baseUrl}/api/admin/config/maintenance_mode`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: 'true', reason: 'Beginning scheduled maintenance test' }),
      });
      assert.equal(setRes.status, 200);

      // 2. Citizen tries a write operation (e.g. POST complaint) -> 503
      const writeRes = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${citizenToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Broken pipe during maintenance' }),
      });
      assert.equal(writeRes.status, 503);
      const writeData = (await writeRes.json()) as any;
      assert.equal(writeData.success, false);
      assert.equal(writeData.error.code, 'MAINTENANCE_MODE');
      assert.ok(writeData.error.correlationId);

      // 3. Citizen read operation (GET /api/meta/departments) remains accessible
      const readRes = await fetch(`${baseUrl}/api/meta/departments`);
      assert.equal(readRes.status, 200);

      // 4. Admin write operations continue to function
      const adminWriteRes = await fetch(`${baseUrl}/api/admin/config/maintenance_message`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: 'Emergency maintenance window in progress.',
          reason: 'Updating notice',
        }),
      });
      assert.equal(adminWriteRes.status, 200);

      // 5. Deactivate maintenance mode
      const resetRes = await fetch(`${baseUrl}/api/admin/config/maintenance_mode`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: 'false', reason: 'Maintenance window completed' }),
      });
      assert.equal(resetRes.status, 200);
    });
  });

  describe('5. User and Role Administration & Protection Safeguards', () => {
    test('GET /api/admin/users returns user list with role filters and pagination', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users?role=CITIZEN&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.users.length > 0);
      assert.ok(!('passwordHash' in data.data.users[0]));
    });

    test('Self-demotion safeguard: Admin cannot demote their own account', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${adminId}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'CITIZEN' }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.equal(data.error.code, 'SELF_ROLE_MODIFICATION_PROHIBITED');
    });

    test('Self-suspension safeguard: Admin cannot suspend their own account', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${adminId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'SUSPENDED', reason: 'Self suspension test' }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.equal(data.error.code, 'SELF_SUSPENSION_PROHIBITED');
    });

    test('Admin can update citizen account status with mandatory documented reason', async () => {
      // 1. Reject without reason
      const rejectRes = await fetch(`${baseUrl}/api/admin/users/${citizenId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'SUSPENDED', reason: 'sh' }),
      });
      assert.equal(rejectRes.status, 400);

      // 2. Suspend citizen
      const suspendRes = await fetch(`${baseUrl}/api/admin/users/${citizenId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'SUSPENDED',
          reason: 'Temporary investigation of reported activity',
        }),
      });
      assert.equal(suspendRes.status, 200);

      // 3. Reactivate citizen
      const reactivateRes = await fetch(`${baseUrl}/api/admin/users/${citizenId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ACTIVE',
          reason: 'Investigation concluded with no violation found',
        }),
      });
      assert.equal(reactivateRes.status, 200);
    });
  });

  describe('6. Operational Incident Management', () => {
    let incidentId: string;
    let incidentNumber: string;

    test('POST /api/admin/incidents creates operational incident with auto-generated Crockford ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/incidents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Incident: Database Replication Lag Spike',
          description: 'Observed replication lag above 500ms on secondary node during peak load.',
          severity: 'HIGH',
          subsystem: 'DATABASE',
        }),
      });
      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.incidentNumber.startsWith('INC-'));
      incidentId = data.data.id;
      incidentNumber = data.data.incidentNumber;
    });

    test('GET /api/admin/incidents lists created incident with filters', async () => {
      const res = await fetch(`${baseUrl}/api/admin/incidents?severity=HIGH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.data.incidents.some((inc: any) => inc.id === incidentId));
    });

    test('PATCH /api/admin/incidents/:id updates incident to RESOLVED with notes and sets resolvedAt', async () => {
      const res = await fetch(`${baseUrl}/api/admin/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionNotes: 'Replica restarted and catch-up buffer cleared. Latency normalized to 4ms.',
        }),
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.equal(data.data.status, 'RESOLVED');
      assert.ok(data.data.resolvedAt);
      assert.equal(data.data.resolvedBy.id, adminId);
    });
  });

  describe('7. Audit Log Explorer & Details', () => {
    test('GET /api/admin/audit returns paginated audit records with server-side filters', async () => {
      const res = await fetch(`${baseUrl}/api/admin/audit?limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.events.length > 0);
      assert.ok(data.data.pagination.total >= 1);
    });

    test('GET /api/admin/audit/:id returns sanitized details for an audit event', async () => {
      // Fetch latest audit record
      const listRes = await fetch(`${baseUrl}/api/admin/audit?limit=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listData = (await listRes.json()) as any;
      const firstEvent = listData.data.events[0];

      const detailRes = await fetch(`${baseUrl}/api/admin/audit/${firstEvent.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(detailRes.status, 200);
      const detailData = (await detailRes.json()) as any;
      assert.equal(detailData.success, true);
      assert.equal(detailData.data.event.id, firstEvent.id);
    });
  });

  describe('8. Reports & CSV Export with Formula Injection Defense', () => {
    test('sanitizeCsvCell escapes formula characters (=, +, -, @) safely', () => {
      assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
      assert.equal(sanitizeCsvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
      assert.equal(sanitizeCsvCell('@threat'), '"\'@threat"');
      assert.equal(sanitizeCsvCell('-123'), '"\'-123"');
      assert.equal(sanitizeCsvCell('Safe Text'), '"Safe Text"');
    });

    test('GET /api/admin/reports/audit-export streams CSV with Content-Type text/csv', async () => {
      const res = await fetch(`${baseUrl}/api/admin/reports/audit-export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/csv'));
      assert.ok(res.headers.get('content-disposition')?.includes('attachment; filename="civora-audit-log-'));
      const text = await res.text();
      assert.ok(text.includes('Event ID,Timestamp (UTC),Action,Entity Type'));
    });

    test('GET /api/admin/reports/workflow-export streams department workload CSV', async () => {
      const res = await fetch(`${baseUrl}/api/admin/reports/workflow-export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/csv'));
      const text = await res.text();
      assert.ok(text.includes('Department ID,Department Code,Department Name'));
    });

    test('GET /api/admin/reports/incidents-export streams incidents CSV', async () => {
      const res = await fetch(`${baseUrl}/api/admin/reports/incidents-export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/csv'));
      const text = await res.text();
      assert.ok(text.includes('Incident Number,Title,Severity,Subsystem'));
    });
  });
});
