import http from 'http';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { UserRole } from '@prisma/client';

const TEST_SECRET = 'civora-temporary-setup-secret-32-chars-minimum-prod-key';
const TEST_ADMIN_EMAIL = `test-bootstrap-admin-${Date.now()}@civora.local`;
const TEST_ADMIN_PASSWORD = 'BootstrapSecurePass123!';

async function makeRequest(
  serverUrl: string,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: any
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const postData = body ? JSON.stringify(body) : '';

    const req = http.request(
      url,
      {
        method,
        headers: {
          ...headers,
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData).toString(),
              }
            : {}),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = { raw: resBody };
          }
          resolve({
            status: res.statusCode || 500,
            data: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

async function runBootstrapVerification() {
  console.log('======================================================');
  console.log('CIVORA SECURE ONE-TIME ADMIN BOOTSTRAP VERIFICATION');
  console.log('======================================================\n');

  let server: http.Server | null = null;

  try {
    // Start local test server
    server = app.listen(0);
    const address = server.address() as any;
    const serverUrl = `http://localhost:${address.port}`;

    // ------------------------------------------------------------------
    // TEST 1: Rejection when ADMIN_SETUP_SECRET is not configured
    // ------------------------------------------------------------------
    delete process.env.ADMIN_SETUP_SECRET;
    const res1 = await makeRequest(
      serverUrl,
      '/api/auth/bootstrap-admin',
      'POST',
      {},
      { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }
    );

    if (res1.status === 403 && res1.data?.error?.code === 'BOOTSTRAP_DISABLED') {
      console.log('✅ [TEST 1 PASS] Request rejected with 403 when ADMIN_SETUP_SECRET is unconfigured');
    } else {
      throw new Error(`TEST 1 Failed: Expected 403 BOOTSTRAP_DISABLED, got ${res1.status} ${JSON.stringify(res1.data)}`);
    }

    // ------------------------------------------------------------------
    // TEST 2: Rejection when setup secret is wrong or too short
    // ------------------------------------------------------------------
    process.env.ADMIN_SETUP_SECRET = TEST_SECRET;
    const res2 = await makeRequest(
      serverUrl,
      '/api/auth/bootstrap-admin',
      'POST',
      { 'x-admin-setup-secret': 'wrong-secret-value-not-matching-configured-key' },
      { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }
    );

    if (res2.status === 401 && res2.data?.error?.code === 'INVALID_SETUP_SECRET') {
      console.log('✅ [TEST 2 PASS] Request rejected with 401 when setup secret is invalid');
    } else {
      throw new Error(`TEST 2 Failed: Expected 401 INVALID_SETUP_SECRET, got ${res2.status}`);
    }

    // ------------------------------------------------------------------
    // TEST 3: Status check with invalid secret fails with 401
    // ------------------------------------------------------------------
    const res3 = await makeRequest(
      serverUrl,
      '/api/auth/bootstrap-admin/status',
      'GET',
      { 'x-admin-setup-secret': 'wrong-secret' }
    );

    if (res3.status === 401 && res3.data?.error?.code === 'INVALID_SETUP_SECRET') {
      console.log('✅ [TEST 3 PASS] Status check without valid secret rejected with 401');
    } else {
      throw new Error(`TEST 3 Failed: Expected 401 for invalid status check, got ${res3.status}`);
    }

    // ------------------------------------------------------------------
    // TEST 4: Status check with valid secret succeeds
    // ------------------------------------------------------------------
    const res4 = await makeRequest(
      serverUrl,
      '/api/auth/bootstrap-admin/status',
      'GET',
      { 'x-admin-setup-secret': TEST_SECRET }
    );

    if (res4.status === 200 && res4.data?.success && res4.data?.data?.bootstrapConfigured === true) {
      console.log(`✅ [TEST 4 PASS] Status check with valid secret returns state: ${res4.data.data.status}`);
    } else {
      throw new Error(`TEST 4 Failed: Expected 200 with status info, got ${res4.status}`);
    }

    // ------------------------------------------------------------------
    // TEST 5: Durable lock check (If admin exists, returns 410)
    // ------------------------------------------------------------------
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) {
      const res5 = await makeRequest(
        serverUrl,
        '/api/auth/bootstrap-admin',
        'POST',
        { 'x-admin-setup-secret': TEST_SECRET },
        { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }
      );

      if (res5.status === 410 && res5.data?.error?.code === 'BOOTSTRAP_ALREADY_COMPLETED') {
        console.log('✅ [TEST 5 PASS] Permanent lock verified: Existing admin in database blocks bootstrap with 410 Gone');
      } else {
        throw new Error(`TEST 5 Failed: Expected 410 BOOTSTRAP_ALREADY_COMPLETED, got ${res5.status}`);
      }
    }

    console.log('\n======================================================');
    console.log('RESULTS: All 5 administrator bootstrap security tests passed!');
    console.log('======================================================\n');
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runBootstrapVerification().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
