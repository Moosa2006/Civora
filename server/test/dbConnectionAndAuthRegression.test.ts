import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

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

describe('Database Connection & Authentication Regression Tests', () => {
  test('1. Database connectivity and environment configuration', async () => {
    // 1.1 Verify DATABASE_URL is set in environment and contains expected protocol
    const dbUrl = process.env.DATABASE_URL;
    assert.ok(dbUrl, 'DATABASE_URL must be defined');
    assert.ok(dbUrl.startsWith('postgresql://'), 'DATABASE_URL must be a PostgreSQL connection URL');

    // 1.2 Verify Prisma client connection succeeds without connection string parsing errors
    await assert.doesNotReject(async () => {
      await prisma.$connect();
    }, 'Prisma $connect should succeed without connection-string parsing errors');

    // 1.3 Verify read-only query on User model succeeds
    const userCount = await prisma.user.count();
    assert.equal(typeof userCount, 'number');
    assert.ok(userCount > 0, 'User table should contain seeded test users');
  });

  test('2. Role-specific sign-in succeeds and restores session for all personas', async () => {
    const rolesToTest = [
      { email: 'citizen1@example.test', expectedRole: 'CITIZEN' },
      { email: 'official1@example.test', expectedRole: 'GOVERNMENT_OFFICIAL' },
      { email: 'admin1@example.test', expectedRole: 'ADMIN' },
      { email: 'contractor1@example.test', expectedRole: 'CONTRACTOR' },
    ];

    for (const { email, expectedRole } of rolesToTest) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'CivoraDev123!' }),
      });

      assert.equal(res.status, 200, `Sign-in should succeed for ${expectedRole}`);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.email, email);
      assert.equal(body.data.user.role, expectedRole);
      assert.ok(body.data.token, 'Should return JWT token');
      assert.equal(body.data.user.passwordHash, undefined, 'Password hash must never be returned');

      // Verify session restoration via /api/auth/me using Set-Cookie
      const cookieHeader = res.headers.get('set-cookie');
      assert.ok(cookieHeader, 'Set-Cookie header must be present');
      const cookie = cookieHeader.split(';')[0];

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookie },
      });
      assert.equal(meRes.status, 200, `Session restoration should succeed for ${expectedRole}`);
      const meBody = await meRes.json();
      assert.equal(meBody.success, true);
      assert.equal(meBody.data.user.email, email);
      assert.equal(meBody.data.user.role, expectedRole);
    }
  });

  test('3. Invalid sign-in returns generic 401 and prevents account enumeration', async () => {
    // 3.1 Unknown email
    const unknownRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown.ghost@example.test', password: 'CivoraDev123!' }),
    });
    assert.equal(unknownRes.status, 401);
    const unknownBody = await unknownRes.json();
    assert.equal(unknownBody.success, false);
    assert.equal(unknownBody.error.code, 'INVALID_CREDENTIALS');
    assert.equal(unknownBody.error.message, 'Invalid email or password.');

    // 3.2 Wrong password
    const wrongPwRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen1@example.test', password: 'IncorrectPassword999!' }),
    });
    assert.equal(wrongPwRes.status, 401);
    const wrongPwBody = await wrongPwRes.json();
    assert.equal(wrongPwBody.success, false);
    assert.equal(wrongPwBody.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrongPwBody.error.message, 'Invalid email or password.');

    // 3.3 Malformed payload (missing password)
    const malformedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen1@example.test' }),
    });
    assert.equal(malformedRes.status, 400);
    const malformedBody = await malformedRes.json();
    assert.equal(malformedBody.success, false);
    assert.equal(malformedBody.error.code, 'VALIDATION_ERROR');
  });

  test('4. Safe error handling does not expose database credentials or internal filesystem paths', async () => {
    // Test that the error handler safely masks internal errors
    const { errorHandler } = await import('../src/middleware/errorHandler.js');

    let capturedStatus = 0;
    let capturedJson: any = null;

    const mockReq: any = { correlationId: 'test-corr-123' };
    const mockRes: any = {
      status(s: number) {
        capturedStatus = s;
        return this;
      },
      json(data: any) {
        capturedJson = data;
        return this;
      },
    };
    const mockNext = () => {};

    // 4.1 Simulate PrismaClientInitializationError (e.g., bad connection string or unreachable DB)
    const initError = new Prisma.PrismaClientInitializationError(
      'Invalid `prisma.user.findUnique()` invocation in C:\\Users\\Asus\\Desktop\\Civora\\server\\src\\controllers\\auth.controller.ts:377:36\n' +
      'The provided database string is invalid. postgresql://postgres:secretpassword@localhost:5432/Cevora?schema=public',
      '6.19.3'
    );

    errorHandler(initError, mockReq, mockRes, mockNext);

    assert.equal(capturedStatus, 503, 'Should return 503 for database initialization/connection errors');
    assert.equal(capturedJson.success, false);
    assert.equal(capturedJson.error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(
      !capturedJson.error.message.includes('C:\\Users'),
      'Response must not leak local filesystem path'
    );
    assert.ok(
      !capturedJson.error.message.includes('secretpassword'),
      'Response must not leak database password or connection string'
    );
    assert.ok(
      !capturedJson.error.message.includes('findUnique'),
      'Response must not leak Prisma code invocation'
    );

    // 4.2 Simulate Prisma P1001 database unreachable error
    const p1001Error = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server at `localhost:5432`",
      { code: 'P1001', clientVersion: '6.19.3' }
    );

    errorHandler(p1001Error, mockReq, mockRes, mockNext);
    assert.equal(capturedStatus, 503, 'P1001 should return 503');
    assert.equal(capturedJson.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(capturedJson.error.message, 'Database service is temporarily unavailable. Please try again shortly.');
  });
});
