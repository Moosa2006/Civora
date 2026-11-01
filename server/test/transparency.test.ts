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
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('Module 8: Public Transparency Dashboard & Civic Project Monitoring Tests', () => {
  describe('1. Public Transparency Metrics', () => {
    test('GET /api/transparency/metrics returns real calculated counts and rates without auth', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/metrics`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.complaints, 'Complaints metrics must exist');
      assert.ok(json.data.civicProjects, 'Civic projects metrics must exist');

      const { complaints, civicProjects } = json.data;

      // Verify numeric types and consistency
      assert.equal(typeof complaints.total, 'number');
      assert.equal(typeof complaints.open, 'number');
      assert.equal(typeof complaints.resolved, 'number');
      assert.equal(typeof complaints.verified, 'number');
      assert.equal(typeof complaints.reopened, 'number');
      assert.equal(typeof complaints.resolutionRate, 'number');
      assert.ok(complaints.resolutionRate >= 0 && complaints.resolutionRate <= 100);

      // Verify status breakdown
      assert.ok(complaints.statusBreakdown);
      assert.equal(typeof complaints.statusBreakdown.SUBMITTED, 'number');
      assert.equal(typeof complaints.statusBreakdown.IN_PROGRESS, 'number');
      assert.equal(typeof complaints.statusBreakdown.RESOLVED, 'number');
      assert.equal(typeof complaints.statusBreakdown.VERIFIED, 'number');

      // Verify civic projects metrics
      assert.equal(typeof civicProjects.total, 'number');
      assert.equal(typeof civicProjects.active, 'number');
      assert.equal(typeof civicProjects.completed, 'number');
      assert.ok(civicProjects.statusBreakdown);
    });
  });

  describe('2. Public Trend Time Series', () => {
    test('GET /api/transparency/trends returns daily buckets for default 30 days', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/trends`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.periodDays, 30);
      assert.ok(Array.isArray(json.data.timeline));
      assert.ok(json.data.timeline.length > 0);

      const firstBucket = json.data.timeline[0];
      assert.ok(firstBucket.date);
      assert.equal(typeof firstBucket.submitted, 'number');
      assert.equal(typeof firstBucket.resolved, 'number');
    });

    test('GET /api/transparency/trends supports custom ?days=7 parameter', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/trends?days=7`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.periodDays, 7);
      assert.ok(json.data.timeline.length >= 7 && json.data.timeline.length <= 9);
    });

    test('GET /api/transparency/trends rejects invalid days range', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/trends?days=-5`);
      assert.equal(res.status, 400);

      const resOversize = await fetch(`${baseUrl}/api/transparency/trends?days=999`);
      assert.equal(resOversize.status, 400);
    });
  });

  describe('3. Status, Category & Priority Distribution', () => {
    test('GET /api/transparency/status-distribution returns categorized distributions', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/status-distribution`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.byStatus));
      assert.ok(Array.isArray(json.data.byCategory));
      assert.ok(Array.isArray(json.data.byPriority));

      // Check category distribution items
      if (json.data.byCategory.length > 0) {
        const cat = json.data.byCategory[0];
        assert.ok(cat.categoryId);
        assert.ok(cat.code);
        assert.ok(cat.name);
        assert.equal(typeof cat.count, 'number');
        assert.equal(typeof cat.percentage, 'number');
      }
    });
  });

  describe('4. Department Accountability Metrics', () => {
    test('GET /api/transparency/departments returns departmental workload & resolution performance', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/departments`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.departments));
      assert.ok(json.data.departments.length > 0);
      assert.ok(json.data.context.fairComparisonGuidance);

      const pwdDept = json.data.departments.find((d: { code: string }) => d.code === 'PWD');
      assert.ok(pwdDept, 'PWD department must be present');
      assert.equal(typeof pwdDept.totalAssigned, 'number');
      assert.equal(typeof pwdDept.activeCount, 'number');
      assert.equal(typeof pwdDept.resolvedCount, 'number');
      assert.equal(typeof pwdDept.resolutionRate, 'number');
      assert.equal(typeof pwdDept.workloadShare, 'number');
    });
  });

  describe('5. Public Safe Complaint Explorer & Privacy Enforcement', () => {
    test('GET /api/transparency/complaints returns paginated complaints without citizen PII', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/complaints?page=1&limit=5`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.complaints));
      assert.ok(json.data.pagination);
      assert.equal(json.data.pagination.page, 1);
      assert.equal(json.data.pagination.limit, 5);

      if (json.data.complaints.length > 0) {
        const c = json.data.complaints[0];
        assert.ok(c.trackingId, 'Tracking ID must be present');
        assert.ok(c.title, 'Title must be present');
        assert.ok(c.status, 'Status must be present');

        // CRITICAL PRIVACY CHECKS: No citizen personal details!
        assert.equal(c.citizenId, undefined, 'citizenId must NOT be exposed');
        assert.equal(c.citizen, undefined, 'citizen object must NOT be exposed');
        assert.equal(c.passwordHash, undefined, 'passwordHash must NOT be exposed');
        assert.equal(c.email, undefined, 'email must NOT be exposed');
        assert.equal(c.phone, undefined, 'phone must NOT be exposed');
      }
    });

    test('GET /api/transparency/complaints supports filtering by status', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/complaints?status=RESOLVED`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      json.data.complaints.forEach((c: { status: string }) => {
        assert.equal(c.status, 'RESOLVED');
      });
    });

    test('GET /api/transparency/complaints rejects invalid page numbers', async () => {
      const res = await fetch(`${baseUrl}/api/transparency/complaints?page=0`);
      assert.equal(res.status, 400);
    });
  });

  describe('6. Formal Civic Project Monitoring', () => {
    let sampleProjectId: string;

    test('GET /api/projects lists formally registered civic projects with progress %', async () => {
      const res = await fetch(`${baseUrl}/api/projects`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.projects));
      assert.ok(json.data.pagination);

      if (json.data.projects.length > 0) {
        const p = json.data.projects[0];
        sampleProjectId = p.id;
        assert.ok(p.workOrderNumber, 'Work order number must exist');
        assert.ok(p.title, 'Project title must exist');
        assert.ok(p.department, 'Responsible department must exist');
        assert.equal(typeof p.estimatedBudget, 'number');
        assert.equal(typeof p.physicalProgressPercentage, 'number');
        assert.ok(p.physicalProgressPercentage >= 0 && p.physicalProgressPercentage <= 100);
        assert.equal(typeof p.linkedComplaintsCount, 'number');
      }
    });

    test('GET /api/projects supports status filtering', async () => {
      const res = await fetch(`${baseUrl}/api/projects?status=IN_PROGRESS`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      json.data.projects.forEach((p: { workStatus: string }) => {
        assert.equal(p.workStatus, 'IN_PROGRESS');
      });
    });

    test('GET /api/projects/:id returns comprehensive project detail and progress history', async () => {
      if (!sampleProjectId) {
        const anyProject = await prisma.civicWork.findFirst();
        if (anyProject) sampleProjectId = anyProject.id;
      }

      if (sampleProjectId) {
        const res = await fetch(`${baseUrl}/api/projects/${sampleProjectId}`);
        assert.equal(res.status, 200);

        const json = await res.json();
        assert.equal(json.success, true);
        assert.ok(json.data.project);

        const p = json.data.project;
        assert.equal(p.id, sampleProjectId);
        assert.ok(p.workOrderNumber);
        assert.ok(p.title);
        assert.ok(p.department);
        assert.ok(Array.isArray(p.progressUpdates));
        assert.ok(Array.isArray(p.linkedComplaints));

        // Privacy check on linked complaints
        p.linkedComplaints.forEach((link: { trackingId: string; citizen?: unknown; citizenId?: unknown }) => {
          assert.ok(link.trackingId);
          assert.equal(link.citizen, undefined);
          assert.equal(link.citizenId, undefined);
        });
      }
    });

    test('GET /api/projects/:id returns 404 for nonexistent project ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${baseUrl}/api/projects/${nonExistentId}`);
      assert.equal(res.status, 404);

      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'PROJECT_NOT_FOUND');
    });
  });
});
