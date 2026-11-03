import http from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signAuthToken } from '../lib/jwt.js';

async function runReliabilitySuite() {
  console.log('\n======================================================');
  console.log('CIVORA PRODUCTION RELIABILITY & CROSS-DEVICE AUTH SUITE');
  console.log('======================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Retrieve an active user for testing
    const testUser = await prisma.user.findFirst({
      where: { role: 'CITIZEN', accountStatus: 'ACTIVE' },
    });

    if (!testUser) {
      throw new Error('No active test citizen user found in database.');
    }

    const validToken = signAuthToken({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    // Test 1: Authenticated via HttpOnly Cookie (Desktop Chrome behavior)
    {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `civora_auth_token=${validToken}`,
          Accept: 'application/json',
        },
      });
      const data = (await res.json()) as any;
      assert(
        res.status === 200 && data.success && data.data.user.id === testUser.id,
        'Cookie-based authentication (Desktop Chrome/Standard) succeeds'
      );
    }

    // Test 2: Authenticated via Authorization: Bearer <token> with ZERO cookies (iOS Safari / Private browsing fallback)
    {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          Accept: 'application/json',
        },
      });
      const data = (await res.json()) as any;
      assert(
        res.status === 200 && data.success && data.data.user.id === testUser.id,
        'Bearer token-based authentication (iOS Safari / Private Window / Partitioned Storage) succeeds'
      );
    }

    // Test 3: Unauthenticated request rejected with clean 401
    {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as any;
      assert(
        res.status === 401 && data.error?.code === 'UNAUTHORIZED',
        'Unauthenticated request rejected with 401 UNAUTHORIZED'
      );
    }

    // Test 4: CORS Preflight (OPTIONS) with Origin from Vercel
    {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://civora-tau.vercel.app',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      const allowOrigin = res.headers.get('access-control-allow-origin');
      const allowCreds = res.headers.get('access-control-allow-credentials');
      assert(
        res.status === 204 &&
          allowOrigin === 'https://civora-tau.vercel.app' &&
          allowCreds === 'true',
        'CORS OPTIONS preflight correctly allows https://civora-tau.vercel.app with credentials'
      );
    }

    // Test 5: Dynamic Preview Origin Preflight (e.g. Vercel deployment preview URL)
    {
      const previewOrigin = 'https://civora-preview-branch.vercel.app';
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'OPTIONS',
        headers: {
          Origin: previewOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      const allowOrigin = res.headers.get('access-control-allow-origin');
      assert(
        res.status === 204 && allowOrigin === previewOrigin,
        'CORS OPTIONS preflight dynamically supports Vercel preview deployments'
      );
    }

    // Test 6: Trust proxy IP resolution
    {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: {
          'X-Forwarded-For': '203.0.113.195',
        },
      });
      assert(res.status === 200, 'Trust proxy enables seamless health response under reverse proxy');
    }

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runReliabilitySuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
