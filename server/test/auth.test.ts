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

describe('Authentication & Registration Tests', () => {
  const uniqueTimestamp = Date.now();
  const validCitizenEmail = `newcitizen_${uniqueTimestamp}@example.com`;

  test('POST /api/auth/register creates a new citizen account and sets auth cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Citizen',
        email: validCitizenEmail,
        password: 'ValidPassword123!',
        phone: '+91 99999 11111',
      }),
    });

    assert.equal(res.status, 201, 'Should return 201 Created');
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token, 'Should return a JWT token');
    assert.equal(body.data.user.email, validCitizenEmail);
    assert.equal(body.data.user.role, 'CITIZEN');
    assert.equal(body.data.user.passwordHash, undefined, 'Password hash must never be exposed');

    // Verify Set-Cookie header contains civora_auth_token
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('civora_auth_token='));

    // Verify persisted record in DB
    const dbUser = await prisma.user.findUnique({ where: { email: validCitizenEmail } });
    assert.ok(dbUser);
    assert.notEqual(dbUser.passwordHash, 'ValidPassword123!', 'Password must be hashed, never plaintext');
    assert.ok(dbUser.passwordHash.startsWith('$2'), 'Must be a valid bcrypt hash');
  });

  test('POST /api/auth/register enforces CITIZEN role and rejects role escalation', async () => {
    const hackerEmail = `hacker_${uniqueTimestamp}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Actor',
        email: hackerEmail,
        password: 'Password123!',
        role: 'ADMIN', // Attempting to escalate role
        accountStatus: 'SUSPENDED', // Attempting to manipulate status
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.user.role, 'CITIZEN', 'Server must ignore client role and enforce CITIZEN');

    const dbUser = await prisma.user.findUnique({ where: { email: hackerEmail } });
    assert.equal(dbUser?.role, 'CITIZEN');
    assert.equal(dbUser?.accountStatus, 'ACTIVE');
  });

  test('POST /api/auth/register rejects duplicate email with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: validCitizenEmail,
        password: 'ValidPassword123!',
      }),
    });

    assert.equal(res.status, 409, 'Duplicate registration should return 409');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  test('POST /api/auth/register rejects invalid email format', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Email User',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /api/auth/register rejects weak password (<8 characters)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Password User',
        email: `shortpass_${uniqueTimestamp}@example.com`,
        password: 'short',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /api/auth/register rejects missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `missing_name_${uniqueTimestamp}@example.com`,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('Login & Credential Verification Tests', () => {
  test('POST /api/auth/login succeeds with valid seeded credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'citizen1@example.test',
        password: 'CivoraDev123!',
      }),
    });

    assert.equal(res.status, 200, 'Login should succeed with 200');
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token);
    assert.equal(body.data.user.email, 'citizen1@example.test');
    assert.equal(body.data.user.role, 'CITIZEN');
    assert.equal(body.data.user.passwordHash, undefined);

    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('civora_auth_token='));
  });

  test('POST /api/auth/login fails with incorrect password (generic 401 error)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'citizen1@example.test',
        password: 'WrongPassword999!',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');
  });

  test('POST /api/auth/login fails with unknown email (generic 401 error to avoid enumeration)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent.user.999@example.test',
        password: 'AnyPassword123!',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');
  });

  test('POST /api/auth/login rejects suspended accounts with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'suspended1@example.test',
        password: 'CivoraDev123!',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'ACCOUNT_SUSPENDED');
  });

  test('POST /api/auth/login rejects pending verification accounts with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pending1@example.test',
        password: 'CivoraDev123!',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'PENDING_VERIFICATION');
  });
});

describe('Session, Identity & Current User (/api/auth/me) Tests', () => {
  let citizenToken: string;
  let citizenCookie: string;

  before(async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'citizen1@example.test',
        password: 'CivoraDev123!',
      }),
    });
    const data = await loginRes.json();
    citizenToken = data.data.token;
    const cookieHeader = loginRes.headers.get('set-cookie');
    if (cookieHeader) {
      citizenCookie = cookieHeader.split(';')[0];
    }
  });

  test('GET /api/auth/me fails with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/auth/me succeeds with Bearer token and returns safe user profile', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'citizen1@example.test');
    assert.equal(body.data.user.role, 'CITIZEN');
    assert.equal(body.data.user.passwordHash, undefined, 'Must not return passwordHash');
  });

  test('GET /api/auth/me succeeds with HttpOnly cookie session', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: citizenCookie },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'citizen1@example.test');
  });

  test('GET /api/auth/me ignores client query-string parameters to prevent impersonation', async () => {
    // Attempt to impersonate admin by passing admin's ID in query parameter
    const res = await fetch(`${baseUrl}/api/auth/me?userId=00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.user.email, 'citizen1@example.test', 'Identity must come solely from validated token');
    assert.equal(body.data.user.role, 'CITIZEN');
  });

  test('GET /api/auth/me fails with 401 when token is tampered/invalid', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.tampered.token' },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_TOKEN');
  });

  test('POST /api/auth/logout clears auth cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.message.includes('Logged out'));

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && (setCookie.includes('civora_auth_token=;') || setCookie.includes('Max-Age=0')));
  });
});

describe('Role-Based Access Control (RBAC) & Endpoint Authorization Tests', () => {
  let citizenToken: string;
  let officialToken: string;
  let adminToken: string;

  before(async () => {
    // 1. Log in Citizen
    const citizenLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen1@example.test', password: 'CivoraDev123!' }),
    });
    citizenToken = (await citizenLogin.json()).data.token;

    // 2. Log in Official
    const officialLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'official1@example.test', password: 'CivoraDev123!' }),
    });
    officialToken = (await officialLogin.json()).data.token;

    // 3. Log in Admin
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin1@example.test', password: 'CivoraDev123!' }),
    });
    adminToken = (await adminLogin.json()).data.token;
  });

  test('GET /api/auth/admin-check returns 401 for unauthenticated request', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-check`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/auth/admin-check returns 403 Forbidden for Citizen', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-check`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('GET /api/auth/admin-check returns 403 Forbidden for Government Official', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-check`, {
      headers: { Authorization: `Bearer ${officialToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('GET /api/auth/admin-check returns 200 OK for Administrator', async () => {
    const res = await fetch(`${baseUrl}/api/auth/admin-check`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.admin.role, 'ADMIN');
    assert.equal(body.data.admin.email, 'admin1@example.test');
  });
});
