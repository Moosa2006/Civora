import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let citizenToken: string;
let testDepartmentId: string;

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
    assert.ok(json.success, `Login failed for ${email}: ${JSON.stringify(json)}`);
    return { token: json.data.token as string, user: json.data.user };
  };

  const admin = await login('admin1@example.test');
  adminToken = admin.token;

  const citizen = await login('citizen1@example.test');
  citizenToken = citizen.token;

  // Find a valid department
  const dept = await prisma.department.findFirst();
  assert.ok(dept, 'At least one department must exist in test database');
  testDepartmentId = dept.id;
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('Civora Authentication & Onboarding Lifecycle Suite', () => {
  const ts = Date.now();

  describe('1. Public Citizen Registration & Authentication', () => {
    const citizenEmail = `onboard_citizen_${ts}@test.local`;

    test('POST /api/auth/register creates citizen with CITIZEN role and ACTIVE status', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Citizen Tester',
          email: citizenEmail,
          password: 'CitizenPass123!',
          phone: '+91 98765 43210',
        }),
      });

      assert.equal(res.status, 201);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.user.role, 'CITIZEN');
      assert.equal(json.data.user.accountStatus, 'ACTIVE');

      // Verify DB record
      const dbUser = await prisma.user.findUnique({ where: { email: citizenEmail } });
      assert.ok(dbUser);
      assert.equal(dbUser.role, 'CITIZEN');
      assert.equal(dbUser.accountStatus, 'ACTIVE');
    });

    test('POST /api/auth/register rejects duplicate citizen email with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Citizen Tester Duplicate',
          email: citizenEmail,
          password: 'CitizenPass123!',
        }),
      });

      assert.equal(res.status, 409);
      const json = (await res.json()) as any;
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'EMAIL_ALREADY_EXISTS');
    });
  });

  describe('2. Public Contractor Registration Flow', () => {
    const contractorEmail = `contractor_app_${ts}@test.local`;
    const regNum = `REG-${ts}`;

    test('POST /api/auth/register-contractor creates unverified contractor and pending user account', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: `Apex Infra Works ${ts}`,
          registrationNumber: regNum,
          licenseClass: 'CLASS_A',
          workCategories: ['ROADS_POTHOLES', 'CIVIL_WORKS'],
          businessAddress: '404 Industrial Corridor, Sector 9',
          operatingRegion: 'Metropolitan Zone North',
          panOrTaxId: `ABCDE${ts.toString().slice(-4)}F`,
          name: 'Bob Builder',
          email: contractorEmail,
          password: 'ContractorPass123!',
          phone: '+91 98888 77777',
        }),
      });

      assert.equal(res.status, 201);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.application.status, 'UNDER_REVIEW');
      assert.equal(json.data.application.registrationNumber, regNum);
      assert.equal(json.data.user.accountStatus, 'PENDING_VERIFICATION');
      assert.equal(json.data.user.role, 'CONTRACTOR');

      // Verify Contractor entity in DB
      const dbContractor = await prisma.contractor.findUnique({
        where: { registrationNumber: regNum },
        include: { users: true },
      });
      assert.ok(dbContractor);
      assert.equal(dbContractor.isVerified, false);
      assert.equal(dbContractor.status, 'INACTIVE');
      assert.equal(dbContractor.users.length, 1);
      assert.equal(dbContractor.users[0].accountStatus, 'PENDING_VERIFICATION');

      // Verify Audit Event logged
      const audit = await prisma.auditEvent.findFirst({
        where: {
          action: 'CONTRACTOR_APPLICATION_SUBMITTED',
          entityId: dbContractor.id,
        },
      });
      assert.ok(audit, 'Audit event CONTRACTOR_APPLICATION_SUBMITTED must be created');
    });

    test('POST /api/auth/register-contractor rejects duplicate registration number with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Different Name LLC',
          registrationNumber: regNum,
          licenseClass: 'CLASS_B',
          workCategories: ['ROADS_POTHOLES'],
          businessAddress: '123 Secondary Rd',
          operatingRegion: 'South Zone',
          panOrTaxId: 'PANTX12345',
          name: 'Other Person',
          email: `other_${ts}@test.local`,
          password: 'ValidPassword123!',
          phone: '+91 91111 22222',
        }),
      });

      assert.equal(res.status, 409);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'CONTRACTOR_REGISTRATION_EXISTS');
    });

    test('POST /api/auth/register-contractor rejects duplicate applicant email with 409', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Third Company',
          registrationNumber: `REG-DIFF-${ts}`,
          licenseClass: 'CLASS_B',
          workCategories: ['ROADS_POTHOLES'],
          businessAddress: '123 Secondary Rd',
          operatingRegion: 'South Zone',
          panOrTaxId: 'PANTX12346',
          name: 'Bob Builder Clone',
          email: contractorEmail,
          password: 'ValidPassword123!',
          phone: '+91 91111 22222',
        }),
      });

      assert.equal(res.status, 409);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    test('GET /api/auth/contractor-application-status returns real-time status by email', async () => {
      const res = await fetch(`${baseUrl}/api/auth/contractor-application-status?email=${encodeURIComponent(contractorEmail)}`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'UNDER_REVIEW');
      assert.equal(json.data.registrationNumber, regNum);
    });

    test('GET /api/auth/contractor-application-status returns real-time status by registrationNumber', async () => {
      const res = await fetch(`${baseUrl}/api/auth/contractor-application-status?registrationNumber=${encodeURIComponent(regNum)}`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'UNDER_REVIEW');
    });

    test('GET /api/auth/contractor-application-status returns 404 for unknown lookup', async () => {
      const res = await fetch(`${baseUrl}/api/auth/contractor-application-status?email=nonexistent_${ts}@test.local`);
      assert.equal(res.status, 404);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'APPLICATION_NOT_FOUND');
    });

    test('POST /api/auth/login returns 403 CONTRACTOR_APPLICATION_PENDING for unverified contractor', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contractorEmail,
          password: 'ContractorPass123!',
        }),
      });

      assert.equal(res.status, 403);
      const json = (await res.json()) as any;
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'CONTRACTOR_APPLICATION_PENDING');
      assert.equal(json.error.details.registrationNumber, regNum);
      assert.equal(json.error.details.isVerified, false);
    });
  });

  describe('3. Admin Contractor Review & Approval Lifecycle', () => {
    let targetContractorId: string;
    const regNum = `REVIEW-${Date.now()}`;
    const applicantEmail = `contractor_review_${Date.now()}@test.local`;

    before(async () => {
      // Create a contractor application for review testing
      const res = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Metro Paving Corp',
          registrationNumber: regNum,
          licenseClass: 'CLASS_B',
          workCategories: ['ROADS_POTHOLES'],
          businessAddress: '77 Commerce Highway',
          operatingRegion: 'Central District',
          panOrTaxId: `PANREV${Date.now().toString().slice(-4)}`,
          name: 'Review Applicant',
          email: applicantEmail,
          password: 'ReviewPass123!',
          phone: '+91 93333 44444',
        }),
      });
      const json = (await res.json()) as any;
      assert.ok(json.data?.application?.id, `Contractor application creation failed: ${JSON.stringify(json)}`);
      targetContractorId = json.data.application.id;
    });

    test('GET /api/admin/contractor-applications rejects unauthenticated or citizen access', async () => {
      // Unauthenticated
      const unauthRes = await fetch(`${baseUrl}/api/admin/contractor-applications`);
      assert.equal(unauthRes.status, 401);

      // Citizen
      const citizenRes = await fetch(`${baseUrl}/api/admin/contractor-applications`, {
        headers: { Authorization: `Bearer ${citizenToken}` },
      });
      assert.equal(citizenRes.status, 403);
    });

    test('GET /api/admin/contractor-applications lists applications for Admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/contractor-applications?q=${encodeURIComponent(regNum)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.applications));
      const found = json.data.applications.find((app: any) => app.registrationNumber === regNum);
      assert.ok(found, 'Should find newly registered contractor application');
      assert.equal(found.isVerified, false);
      assert.equal(found.users.length, 1);
    });

    test('POST /api/admin/contractors/:id/approve verifies contractor and activates user account', async () => {
      const res = await fetch(`${baseUrl}/api/admin/contractors/${targetContractorId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          notes: 'Documentation and municipal bond verified.',
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.isVerified, true);
      assert.equal(json.data.status, 'ACTIVE');

      // Verify DB state
      const dbContractor = await prisma.contractor.findUnique({
        where: { id: targetContractorId },
        include: { users: true },
      });
      assert.equal(dbContractor?.isVerified, true);
      assert.equal(dbContractor?.status, 'ACTIVE');
      assert.equal(dbContractor?.users[0].accountStatus, 'ACTIVE');

      // Verify Audit Event logged
      const audit = await prisma.auditEvent.findFirst({
        where: {
          action: 'CONTRACTOR_APPLICATION_APPROVED',
          entityId: targetContractorId,
        },
      });
      assert.ok(audit, 'Audit event CONTRACTOR_APPLICATION_APPROVED must be logged');
    });

    test('Approved contractor can successfully log in and authenticate', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: applicantEmail,
          password: 'ReviewPass123!',
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.user.role, 'CONTRACTOR');
      assert.equal(json.data.user.accountStatus, 'ACTIVE');
    });

    test('POST /api/admin/contractors/:id/reject suspends contractor with mandatory reason', async () => {
      // Create another contractor to test rejection
      const rejReg = `REJ-${Date.now()}`;
      const rejEmail = `rej_${Date.now()}@test.local`;
      const createRes = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Suspicious Builders Co',
          registrationNumber: rejReg,
          licenseClass: 'CLASS_D',
          workCategories: ['CIVIL_WORKS'],
          businessAddress: '99 Back Alley',
          operatingRegion: 'Outskirts',
          panOrTaxId: `REJPAN${Date.now().toString().slice(-4)}`,
          name: 'Shady Sam',
          email: rejEmail,
          password: 'Password123!',
          phone: '+91 92222 33333',
        }),
      });
      const createJson = (await createRes.json()) as any;
      const rejContractorId = createJson.data.application.id;

      // Reject without reason fails with 400
      const failRes = await fetch(`${baseUrl}/api/admin/contractors/${rejContractorId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: '' }),
      });
      assert.equal(failRes.status, 400);

      // Reject with valid reason
      const rejRes = await fetch(`${baseUrl}/api/admin/contractors/${rejContractorId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reason: 'Failed municipal license authenticity check.',
        }),
      });

      assert.equal(rejRes.status, 200);
      const rejData = (await rejRes.json()) as any;
      assert.equal(rejData.success, true);
      assert.equal(rejData.data.status, 'INACTIVE');

      // Status lookup shows REJECTED with note
      const statusRes = await fetch(`${baseUrl}/api/auth/contractor-application-status?email=${encodeURIComponent(rejEmail)}`);
      assert.equal(statusRes.status, 200);
      const statusJson = (await statusRes.json()) as any;
      assert.equal(statusJson.data.status, 'REJECTED');
      assert.ok(statusJson.data.reviewNotes.includes('Failed municipal license'));
    });
  });

  describe('4. Admin Official Onboarding & Role Governance', () => {
    const officialEmail = `onboarded_official_${Date.now()}@civora.gov`;

    test('POST /api/admin/officials rejects unauthorized requests', async () => {
      const res = await fetch(`${baseUrl}/api/admin/officials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          name: 'Jane Officer',
          email: officialEmail,
          password: 'OfficialPass123!',
          departmentId: testDepartmentId,
        }),
      });

      assert.equal(res.status, 403);
    });

    test('POST /api/admin/officials rejects invalid department ID with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/officials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Jane Officer',
          email: officialEmail,
          password: 'OfficialPass123!',
          departmentId: '00000000-0000-0000-0000-000000000000',
        }),
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'INVALID_DEPARTMENT');
    });

    test('POST /api/admin/officials successfully creates and activates government official', async () => {
      const res = await fetch(`${baseUrl}/api/admin/officials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Officer Jane Doe',
          email: officialEmail,
          password: 'OfficialPass123!',
          departmentId: testDepartmentId,
          phone: '+91 91234 56789',
        }),
      });

      assert.equal(res.status, 201);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.role, 'GOVERNMENT_OFFICIAL');
      assert.equal(json.data.accountStatus, 'ACTIVE');
      assert.equal(json.data.departmentId, testDepartmentId);

      // Verify DB record
      const dbUser = await prisma.user.findUnique({
        where: { email: officialEmail },
        include: { department: true },
      });
      assert.ok(dbUser);
      assert.equal(dbUser.role, 'GOVERNMENT_OFFICIAL');
      assert.equal(dbUser.departmentId, testDepartmentId);

      // Verify Audit Event logged
      const audit = await prisma.auditEvent.findFirst({
        where: {
          action: 'OFFICIAL_ACCOUNT_CREATED',
          entityId: dbUser.id,
        },
      });
      assert.ok(audit, 'Audit event OFFICIAL_ACCOUNT_CREATED must be logged');
    });

    test('Newly onboarded official can log in and receives canonical GOVERNMENT_OFFICIAL role', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: officialEmail,
          password: 'OfficialPass123!',
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.user.role, 'GOVERNMENT_OFFICIAL');
      assert.equal(json.data.user.departmentId, testDepartmentId);
    });

    test('PATCH /api/admin/users/:id/role requires valid department for GOVERNMENT_OFFICIAL', async () => {
      // Create citizen without department
      const user = await prisma.user.create({
        data: {
          name: 'Promote Target',
          email: `promote_target_${Date.now()}@test.local`,
          passwordHash: 'dummyhash',
          role: 'CITIZEN',
          accountStatus: 'ACTIVE',
        },
      });

      const failRes = await fetch(`${baseUrl}/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          role: 'GOVERNMENT_OFFICIAL',
          // departmentId omitted
        }),
      });

      assert.equal(failRes.status, 400);
      const json = (await failRes.json()) as any;
      assert.equal(json.error.code, 'DEPARTMENT_REQUIRED');
    });
  });
});
