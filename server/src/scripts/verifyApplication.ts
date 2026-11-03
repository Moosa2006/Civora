import http from 'http';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function record(suite: string, test: string, passed: boolean, error?: string, details?: any) {
  results.push({ suite, test, passed, error: passed ? undefined : error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${suite}] ${test}`);
  if (!passed && error) {
    console.error(`   Error: ${error}`);
  }
}

async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
  } = {}
) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let bodyStr: string | undefined;
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  return {
    status: res.status,
    headers: res.headers,
    json,
  };
}

async function runVerification() {
  console.log('\n======================================================');
  console.log('CIVORA PRODUCTION APPLICATION VERIFICATION SUITE');
  console.log('======================================================\n');

  // Start temporary HTTP server on random open port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as any;
  const baseUrl = `http://localhost:${addr.port}`;
  console.log(`Test server running at ${baseUrl}`);

  let submittedComplaintId: string | null = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Public Health Check
    // ----------------------------------------------------
    const healthRes = await request(baseUrl, '/api/health');
    record(
      'System Health',
      'GET /api/health returns HTTP 200 with database connected',
      healthRes.status === 200 && healthRes.json?.status === 'ok' && healthRes.json?.data?.database === 'connected',
      healthRes.status !== 200 ? `Status ${healthRes.status}: ${JSON.stringify(healthRes.json)}` : undefined
    );

    // ----------------------------------------------------
    // TEST 2: Citizen Workflow
    // ----------------------------------------------------
    const citLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'aarav.sharma@civora.net', password: 'CitizenPass#2026!' },
    });
    const citizenToken = citLogin.json?.data?.token;
    record(
      'Citizen Workflow',
      'Citizen authenticates with valid credentials',
      citLogin.status === 200 && !!citizenToken && citLogin.json?.data?.user?.role === 'CITIZEN',
      citLogin.status !== 200 ? JSON.stringify(citLogin.json) : undefined
    );

    let submittedTrackingId: string | null = null;

    if (citizenToken) {
      // Find a category belonging to PWD for filing complaint
      const category = await prisma.complaintCategory.findFirst({
        where: { department: { code: 'PWD' }, isActive: true },
      });

      const newComplaint = await request(baseUrl, '/api/complaints', {
        method: 'POST',
        token: citizenToken,
        body: {
          title: 'Production Verification Pothole Inspection Request',
          description: 'Detailed inspection of asphalt subsidence near junction. Verified test record.',
          categoryId: category?.id,
          priority: 'MEDIUM',
          locationAddress: 'Corner of 5th Main and 8th Cross',
          locality: 'Indiranagar Central',
          ward: 'Ward 82',
          latitude: 12.9716,
          longitude: 77.5946,
        },
      });

      submittedTrackingId = newComplaint.json?.data?.complaint?.trackingId;
      submittedComplaintId = newComplaint.json?.data?.complaint?.id;

      record(
        'Citizen Workflow',
        'Citizen submits complaint and receives valid tracking ID',
        newComplaint.status === 201 && typeof submittedTrackingId === 'string' && submittedTrackingId.startsWith('CIV-'),
        newComplaint.status !== 201 ? JSON.stringify(newComplaint.json) : undefined,
        { trackingId: submittedTrackingId }
      );

      // Query own complaints
      const myComplaints = await request(baseUrl, '/api/complaints/my', {
        token: citizenToken,
      });
      record(
        'Citizen Workflow',
        'Citizen retrieves their submitted complaints list',
        myComplaints.status === 200 && Array.isArray(myComplaints.json?.data?.complaints),
        myComplaints.status !== 200 ? JSON.stringify(myComplaints.json) : undefined
      );

      // Track complaint by tracking ID (Public / Citizen Track)
      if (submittedTrackingId) {
        const trackRes = await request(baseUrl, `/api/complaints/track/${submittedTrackingId}`);
        record(
          'Citizen Workflow',
          'Track complaint via tracking ID returns correct status',
          trackRes.status === 200 && trackRes.json?.data?.complaint?.trackingId === submittedTrackingId,
          trackRes.status !== 200 ? JSON.stringify(trackRes.json) : undefined
        );
      }

      // Notifications endpoint
      const notifRes = await request(baseUrl, '/api/notifications', {
        token: citizenToken,
      });
      record(
        'Citizen Workflow',
        'Citizen accesses notification inbox',
        notifRes.status === 200 && Array.isArray(notifRes.json?.data?.notifications),
        notifRes.status !== 200 ? JSON.stringify(notifRes.json) : undefined
      );
    }

    // ----------------------------------------------------
    // TEST 3: Administrator Triage & Assignment Workflow
    // ----------------------------------------------------
    const adminLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@civora.gov', password: 'CivoraAdmin#2026!' },
    });
    const adminToken = adminLogin.json?.data?.token;
    record(
      'Admin Workflow',
      'Administrator authenticates successfully',
      adminLogin.status === 200 && !!adminToken && adminLogin.json?.data?.user?.role === 'ADMIN',
      adminLogin.status !== 200 ? JSON.stringify(adminLogin.json) : undefined
    );

    const offLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'rajesh.kumar@civora.gov', password: 'OfficialPass#2026!' },
    });
    const officialToken = offLogin.json?.data?.token;
    const officialId = offLogin.json?.data?.user?.id;
    const deptId = offLogin.json?.data?.user?.departmentId;

    if (adminToken && submittedComplaintId && deptId) {
      // Assign complaint to PWD and Official Rajesh Kumar
      const assignRes = await request(baseUrl, `/api/admin/complaints/${submittedComplaintId}/assign`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          departmentId: deptId,
          officialId: officialId,
          remarks: 'Triage complete. Assigned to PWD Engineer Rajesh Kumar.',
        },
      });
      record(
        'Triage & Assignment Workflow',
        'Administrator assigns complaint to PWD department and official',
        assignRes.status === 200 && assignRes.json?.success === true,
        assignRes.status !== 200 ? JSON.stringify(assignRes.json) : undefined
      );
    }

    // ----------------------------------------------------
    // TEST 4: Official Workflow
    // ----------------------------------------------------
    record(
      'Official Workflow',
      'Official authenticates successfully',
      offLogin.status === 200 && !!officialToken && offLogin.json?.data?.user?.role === 'GOVERNMENT_OFFICIAL',
      offLogin.status !== 200 ? JSON.stringify(offLogin.json) : undefined
    );

    if (officialToken && submittedComplaintId) {
      // Official posts progress update
      const progressRes = await request(baseUrl, `/api/complaints/${submittedComplaintId}/progress`, {
        method: 'POST',
        token: officialToken,
        body: {
          title: 'Field Team Dispatched for Milling',
          description: 'Official PWD crew dispatched to site for physical inspection and pothole repair.',
          stage: 'INSPECTION',
        },
      });
      record(
        'Official Workflow',
        'Official logs verified execution progress update',
        progressRes.status === 201 && progressRes.json?.success === true,
        progressRes.status !== 201 ? JSON.stringify(progressRes.json) : undefined
      );

      // Official views assigned department queue
      const queueRes = await request(baseUrl, '/api/official/complaints', {
        token: officialToken,
      });
      record(
        'Official Workflow',
        'Official retrieves authorized department assignment queue',
        queueRes.status === 200 && Array.isArray(queueRes.json?.data?.complaints),
        queueRes.status !== 200 ? JSON.stringify(queueRes.json) : undefined
      );
    }

    // ----------------------------------------------------
    // TEST 5: Contractor Workflow
    // ----------------------------------------------------
    const contLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'sanjay.hegde@apexinfra.in', password: 'ContractorPass#2026!' },
    });
    const contractorToken = contLogin.json?.data?.token;
    record(
      'Contractor Workflow',
      'Contractor authenticates successfully',
      contLogin.status === 200 && !!contractorToken && contLogin.json?.data?.user?.role === 'CONTRACTOR',
      contLogin.status !== 200 ? JSON.stringify(contLogin.json) : undefined
    );

    if (contractorToken) {
      // Discover open tenders
      const tendersRes = await request(baseUrl, '/api/tenders', {
        token: contractorToken,
      });
      record(
        'Contractor Workflow',
        'Contractor discovers eligible public tenders',
        tendersRes.status === 200 && Array.isArray(tendersRes.json?.data?.tenders),
        tendersRes.status !== 200 ? JSON.stringify(tendersRes.json) : undefined
      );

      // View contractor profile and bids
      const profileRes = await request(baseUrl, '/api/contractor/profile', {
        token: contractorToken,
      });
      record(
        'Contractor Workflow',
        'Contractor accesses verified enterprise profile',
        profileRes.status === 200 && profileRes.json?.data?.contractor?.name === 'Apex Urban Infrastructure Ltd',
        profileRes.status !== 200 ? JSON.stringify(profileRes.json) : undefined
      );

      const bidsRes = await request(baseUrl, '/api/contractor/bids', {
        token: contractorToken,
      });
      record(
        'Contractor Workflow',
        'Contractor retrieves their submitted bids list',
        bidsRes.status === 200 && Array.isArray(bidsRes.json?.data?.bids),
        bidsRes.status !== 200 ? JSON.stringify(bidsRes.json) : undefined
      );
    }

    // ----------------------------------------------------
    // TEST 6: Administrator Overview & Audit Workflow
    // ----------------------------------------------------
    if (adminToken) {
      const auditRes = await request(baseUrl, '/api/admin/audit', {
        token: adminToken,
      });
      record(
        'Admin Workflow',
        'Administrator retrieves authoritative audit log stream',
        auditRes.status === 200 && Array.isArray(auditRes.json?.data?.events),
        auditRes.status !== 200 ? JSON.stringify(auditRes.json) : undefined
      );

      const sysOverview = await request(baseUrl, '/api/admin/dashboard/overview', {
        token: adminToken,
      });
      record(
        'Admin Workflow',
        'Administrator retrieves platform operational overview',
        sysOverview.status === 200 && sysOverview.json?.success === true,
        sysOverview.status !== 200 ? JSON.stringify(sysOverview.json) : undefined
      );
    }

    // ----------------------------------------------------
    // TEST 7: Cross-Role Security Enforcement
    // ----------------------------------------------------
    // 7a. Citizen trying to access admin audit route
    const citizenAdminAttempt = await request(baseUrl, '/api/admin/audit', {
      token: citizenToken,
    });
    record(
      'Security RBAC',
      'Citizen blocked from Admin route (/api/admin/audit) -> 403 Forbidden',
      citizenAdminAttempt.status === 403,
      citizenAdminAttempt.status !== 403 ? `Expected 403, got ${citizenAdminAttempt.status}` : undefined
    );

    // 7b. Citizen trying to access official complaints queue
    const citizenOfficialAttempt = await request(baseUrl, '/api/official/complaints', {
      token: citizenToken,
    });
    record(
      'Security RBAC',
      'Citizen blocked from Official route (/api/official/complaints) -> 403 Forbidden',
      citizenOfficialAttempt.status === 403,
      citizenOfficialAttempt.status !== 403 ? `Expected 403, got ${citizenOfficialAttempt.status}` : undefined
    );

    // 7c. Contractor trying to access admin route
    const contractorAdminAttempt = await request(baseUrl, '/api/admin/audit', {
      token: contractorToken,
    });
    record(
      'Security RBAC',
      'Contractor blocked from Admin route (/api/admin/audit) -> 403 Forbidden',
      contractorAdminAttempt.status === 403,
      contractorAdminAttempt.status !== 403 ? `Expected 403, got ${contractorAdminAttempt.status}` : undefined
    );

    // 7d. Unauthenticated user trying to access protected route
    const unauthAttempt = await request(baseUrl, '/api/complaints/my');
    record(
      'Security RBAC',
      'Unauthenticated request blocked from protected route (/api/complaints/my) -> 401 Unauthorized',
      unauthAttempt.status === 401,
      unauthAttempt.status !== 401 ? `Expected 401, got ${unauthAttempt.status}` : undefined
    );

    // 7e. Attempting login with deactivated demo account credentials
    const demoLoginAttempt = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'citizen1@example.test', password: 'CivoraDev123!' },
    });
    record(
      'Security Decommissioning',
      'Deactivated demo account (citizen1@example.test) login rejected -> 401',
      demoLoginAttempt.status === 401,
      demoLoginAttempt.status !== 401 ? `Expected 401, got ${demoLoginAttempt.status}` : undefined
    );

    const devPasswordAttempt = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@civora.gov', password: 'CivoraDev123!' },
    });
    record(
      'Security Decommissioning',
      'Old development password (CivoraDev123!) rejected against legitimate admin -> 401',
      devPasswordAttempt.status === 401,
      devPasswordAttempt.status !== 401 ? `Expected 401, got ${devPasswordAttempt.status}` : undefined
    );

    // ----------------------------------------------------
    // Cleanup Verification Test Records
    // ----------------------------------------------------
    if (submittedComplaintId) {
      await prisma.auditEvent.deleteMany({
        where: { entityType: 'COMPLAINT', entityId: submittedComplaintId },
      });
      await prisma.complaintStatusHistory.deleteMany({
        where: { complaintId: submittedComplaintId },
      });
      await prisma.complaint.delete({
        where: { id: submittedComplaintId },
      });
      console.log('🧹 Cleaned up test complaint record.');
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('VERIFICATION RESULTS SUMMARY');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Executed: ${results.length}`);
  console.log(`Passed:               ${passedCount}`);
  console.log(`Failed:               ${failedCount}`);

  if (failedCount > 0) {
    console.error('❌ Verification suite encountered failures.');
    process.exit(1);
  } else {
    console.log('🎉 ALL APPLICATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
