import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ComplaintStatus, ComplaintPriority, UserRole } from '@prisma/client';

let server: http.Server;
let baseUrl: string;

let citizenAToken: string;
let citizenBToken: string;
let adminToken: string;
let officialPwdToken: string;

let citizenAId: string;
let citizenBId: string;
let adminId: string;
let officialPwdId: string;

let deptPwdId: string;
let catRoadsId: string;

let testComplaint1Id: string;
let testComplaint2Id: string;
let privateComplaintId: string;

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

  const pwd = await prisma.department.findUnique({ where: { code: 'PWD' } });
  assert.ok(pwd, 'PWD department must exist');
  deptPwdId = pwd.id;

  const cat = await prisma.complaintCategory.findFirst({
    where: { departmentId: deptPwdId, isActive: true },
  });
  assert.ok(cat, 'PWD category must exist');
  catRoadsId = cat.id;

  // Login accounts
  const login = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CivoraDev123!' }),
    });
    const json = await res.json();
    return { token: json.data.token as string, user: json.data.user };
  };

  const a = await login('aarav.sharma@example.com');
  const b = await login('priya.patel@example.com');
  const adm = await login('admin.meera@civora.local');
  const off = await login('rajesh.kumar@example.com');

  citizenAToken = a.token;
  citizenAId = a.user.id;

  citizenBToken = b.token;
  citizenBId = b.user.id;

  adminToken = adm.token;
  adminId = adm.user.id;

  officialPwdToken = off.token;
  officialPwdId = off.user.id;

  // Create known test complaints with coordinates
  const c1 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-GEO-001' },
    update: {
      latitude: 12.9784,
      longitude: 77.6408,
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      isLocationPublic: true,
    },
    create: {
      trackingId: 'CIV-2026-GEO-001',
      title: 'Pothole on 100ft Road Indira Nagar',
      description: 'Dangerous pothole near metro station',
      categoryId: catRoadsId,
      priority: ComplaintPriority.HIGH,
      status: ComplaintStatus.IN_PROGRESS,
      citizenId: citizenAId,
      assignedDepartmentId: deptPwdId,
      assignedOfficialId: officialPwdId,
      locationAddress: 'Opposite Metro Pillar 42, 100ft Road',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9784,
      longitude: 77.6408,
      isLocationPublic: true,
    },
  });
  testComplaint1Id = c1.id;

  const c2 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-GEO-002' },
    update: {
      latitude: 12.9116,
      longitude: 77.6389,
      locality: 'HSR Layout',
      ward: 'Ward 174',
      isLocationPublic: true,
    },
    create: {
      trackingId: 'CIV-2026-GEO-002',
      title: 'Road damage in HSR Layout Sector 5',
      description: 'Asphalt cracking on market access road',
      categoryId: catRoadsId,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.ASSIGNED,
      citizenId: citizenBId,
      assignedDepartmentId: deptPwdId,
      locationAddress: 'Sector 5 Main Road, near market',
      locality: 'HSR Layout',
      ward: 'Ward 174',
      latitude: 12.9116,
      longitude: 77.6389,
      isLocationPublic: true,
    },
  });
  testComplaint2Id = c2.id;

  // Private complaint (isLocationPublic = false)
  const cPrivate = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-GEO-PRIV' },
    update: {
      latitude: 12.9785,
      longitude: 77.6409,
      isLocationPublic: false,
    },
    create: {
      trackingId: 'CIV-2026-GEO-PRIV',
      title: 'Confidential residential property report',
      description: 'Private courtyard drainage damage',
      categoryId: catRoadsId,
      priority: ComplaintPriority.LOW,
      status: ComplaintStatus.SUBMITTED,
      citizenId: citizenAId,
      locationAddress: 'Private Villa 4B, Indira Nagar',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9785,
      longitude: 77.6409,
      isLocationPublic: false,
    },
  });
  privateComplaintId = cPrivate.id;
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('Module 13: Civic Search, Interactive Maps & Geographic Discovery', () => {
  // --- SECTION 1: Map Viewport Queries & Bounds Validation ---

  test('1. Public map viewport query returns complaints with generalized coordinates and no citizen PII', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=12.80&maxLat=13.10&minLng=77.50&maxLng=77.80`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.count >= 2);
    assert.ok(Array.isArray(json.data.markers));

    // Verify citizen PII is completely stripped
    const marker = json.data.markers.find((m: any) => m.trackingId === 'CIV-2026-GEO-001');
    assert.ok(marker);
    assert.equal(marker.citizenId, undefined);
    assert.equal(marker.citizen, undefined);
    assert.equal(marker.isGeneralized, true);
    assert.ok(typeof marker.latitude === 'number');
    assert.ok(typeof marker.longitude === 'number');
  });

  test('2. Rejects invalid bounding box where minLat > maxLat (400 Bad Request)', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=13.00&maxLat=12.00&minLng=77.50&maxLng=77.80`
    );
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  test('3. Rejects oversized bounding box spanning > 5 degrees (400 VIEWPORT_TOO_LARGE)', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=10.00&maxLat=16.00&minLng=70.00&maxLng=80.00`
    );
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VIEWPORT_TOO_LARGE');
  });

  test('4. Filters map complaints by category and status', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=12.80&maxLat=13.10&minLng=77.50&maxLng=77.80&categoryId=${catRoadsId}&status=IN_PROGRESS`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.data.markers.length >= 1);
    json.data.markers.forEach((m: any) => {
      assert.equal(m.status, 'IN_PROGRESS');
      assert.equal(m.category.id, catRoadsId);
    });
  });

  test('5. Filters map complaints by keyword search', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=12.80&maxLat=13.10&minLng=77.50&maxLng=77.80&search=HSR`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.data.markers.some((m: any) => m.trackingId === 'CIV-2026-GEO-002'));
  });

  test('6. Excludes private complaints (isLocationPublic = false) from public map results', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/complaints?minLat=12.80&maxLat=13.10&minLng=77.50&maxLng=77.80`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    const privMarker = json.data.markers.find((m: any) => m.trackingId === 'CIV-2026-GEO-PRIV');
    assert.equal(privMarker, undefined, 'Private complaint must NOT be included in public map');
  });

  // --- SECTION 2: Nearby Complaints Discovery & Haversine Distance ---

  test('7. Discovers complaints nearby Indira Nagar (12.9784, 77.6408) within 5km, sorted by distance', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/nearby?lat=12.9784&lng=77.6408&radiusKm=5`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.count >= 1);

    const found = json.data.complaints.find((c: any) => c.trackingId === 'CIV-2026-GEO-001');
    assert.ok(found, 'CIV-2026-GEO-001 must be found in nearby complaints');
    assert.ok(found.distanceKm <= 0.2, 'Indira Nagar complaint should be close to 0 km from itself');
  });

  test('8. Respects radius parameter (1km excludes complaints 8km away in HSR Layout)', async () => {
    const res = await fetch(
      `${baseUrl}/api/geo/nearby?lat=12.9784&lng=77.6408&radiusKm=1`
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    const hsrComplaint = json.data.complaints.find((c: any) => c.trackingId === 'CIV-2026-GEO-002');
    assert.equal(hsrComplaint, undefined, 'HSR Layout complaint (8km away) must be excluded from 1km radius');
  });

  test('9. Rejects invalid coordinates for nearby query (>90 lat or >180 lng)', async () => {
    const res = await fetch(`${baseUrl}/api/geo/nearby?lat=95.0&lng=77.6408`);
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  // --- SECTION 3: Geographic Hotspots & Issue Clusters ---

  test('10. Aggregates geographic hotspots by ward with active vs resolved breakdowns', async () => {
    const res = await fetch(`${baseUrl}/api/geo/hotspots?groupBy=ward`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.count > 0);

    const ward82 = json.data.hotspots.find((h: any) => h.name.includes('Ward 82'));
    assert.ok(ward82, 'Ward 82 must be present in hotspots');
    assert.ok(ward82.totalComplaints >= 1);
    assert.ok(typeof ward82.resolutionRate === 'number');
    assert.ok(ward82.topCategory);
  });

  test('11. Aggregates geographic hotspots by locality', async () => {
    const res = await fetch(`${baseUrl}/api/geo/hotspots?groupBy=locality`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.groupBy, 'locality');
    const indiraNagar = json.data.hotspots.find((h: any) => h.name === 'Indira Nagar');
    assert.ok(indiraNagar);
  });

  // --- SECTION 4: Localities Autocomplete & Geocoding ---

  test('12. Returns known Bengaluru administrative localities directory', async () => {
    const res = await fetch(`${baseUrl}/api/geo/localities`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.data.count >= 10);
    const hsr = json.data.localities.find((l: any) => l.name === 'HSR Layout');
    assert.ok(hsr);
    assert.equal(hsr.wardNumber, 'Ward 174');
  });

  test('13. Filters localities directory with search query parameter', async () => {
    const res = await fetch(`${baseUrl}/api/geo/localities?q=Koramangala`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.data.localities.length >= 1);
    assert.equal(json.data.localities[0].name, 'Koramangala');
  });

  test('14. Geocode endpoint matches known landmark and returns coordinates', async () => {
    const res = await fetch(`${baseUrl}/api/geo/geocode?q=Indiranagar`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.found, true);
    assert.equal(json.data.locality, 'Indira Nagar');
    assert.ok(json.data.latitude > 12 && json.data.latitude < 13);
    assert.ok(json.data.longitude > 77 && json.data.longitude < 78);
  });

  test('15. Geocode endpoint returns found: false gracefully for unrecognized address', async () => {
    const res = await fetch(`${baseUrl}/api/geo/geocode?q=NonExistentFictionalGalaxyPlace99`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.found, false);
  });

  // --- SECTION 5: Official & Department Geographic Dashboard ---

  test('16. Citizen cannot access official geographic summary (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/geo/official-summary`, {
      headers: { Authorization: `Bearer ${citizenAToken}` },
    });
    const json = await res.json();

    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });

  test('17. Government Official receives department-scoped geographic analytics', async () => {
    const res = await fetch(`${baseUrl}/api/geo/official-summary`, {
      headers: { Authorization: `Bearer ${officialPwdToken}` },
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.department);
    assert.equal(json.data.department.code, 'PWD');
    assert.ok(typeof json.data.totalGrievances === 'number');
    assert.ok(Array.isArray(json.data.wardBreakdown));
  });

  test('18. Administrator receives citywide geographic analytics', async () => {
    const res = await fetch(`${baseUrl}/api/geo/official-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.totalGrievances >= 2);
  });

  // --- SECTION 6: Update Complaint Location & Audit Trail ---

  test('19. Citizen A updates location on their own complaint', async () => {
    const res = await fetch(`${baseUrl}/api/geo/complaints/${testComplaint1Id}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: JSON.stringify({
        latitude: 12.9789,
        longitude: 77.6412,
        locationAddress: 'Refined GPS pin near Metro Gate 1',
        locationSource: 'MAP_PICKER',
        locationAccuracy: 5.5,
      }),
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.complaint.latitude, 12.9789);
    assert.equal(json.data.complaint.longitude, 77.6412);
    assert.equal(json.data.complaint.locationSource, 'MAP_PICKER');
    assert.equal(json.data.complaint.locationAccuracy, 5.5);

    // Verify audit event was recorded
    const audit = await prisma.auditEvent.findFirst({
      where: {
        entityId: testComplaint1Id,
        action: 'COMPLAINT_LOCATION_UPDATED',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit);
    assert.equal(audit.actorId, citizenAId);
  });

  test('20. Citizen B cannot update location of Citizen A complaint (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/geo/complaints/${testComplaint1Id}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenBToken}`,
      },
      body: JSON.stringify({
        latitude: 12.9999,
        longitude: 77.6666,
      }),
    });
    const json = await res.json();

    assert.equal(res.status, 403);
    assert.equal(json.error.code, 'FORBIDDEN');
  });
});
