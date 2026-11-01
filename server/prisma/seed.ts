import {
  PrismaClient,
  UserRole,
  AccountStatus,
  ComplaintPriority,
  ComplaintStatus,
  CivicWorkStatus,
  InspectionOutcome,
  FeasibilityAssessment,
  EstimateStatus,
  ApprovalType,
  ApprovalDecision,
  ContractorStatus,
  ExecutionStatus,
  FinancialRecordType,
  PaymentStatus,
  DocumentCategory,
  DocumentVisibility,
  ProposalStatus,
  PollStatus,
  PollType,
  PollVisibilityRule,
  SlaStatus,
  EscalationLevel,
  EscalationStatus,
  EscalationTrigger,
  ExtensionRequestStatus,
  TenderStatus,
  BidStatus,
  WorkStartStatus,
  MilestoneStatus,
  DefectStatus,
  EvidencePurpose,
  EvidenceReviewStatus,
  NotificationType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Development-only testing password: CivoraDev123!
const DEV_TEST_PASSWORD = 'CivoraDev123!';
const DEV_PASSWORD_HASH = bcrypt.hashSync(DEV_TEST_PASSWORD, 10);

// Primary interactive demo testing password: CivoraDemo@2026
const DEMO_TEST_PASSWORD = 'CivoraDemo@2026';
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_TEST_PASSWORD, 10);

async function seed() {
  console.log('[Civora Seed] Starting reproducible database seeding...');

  // ==========================================
  // 1. Master Departments
  // ==========================================
  console.log('[Civora Seed] Seeding municipal departments...');
  const deptPwd = await prisma.department.upsert({
    where: { code: 'PWD' },
    update: {},
    create: {
      code: 'PWD',
      name: 'Public Works Department',
      description: 'Responsible for road construction, potholes, footpaths, bridges, and municipal infrastructure.',
      isActive: true,
    },
  });

  const deptWssb = await prisma.department.upsert({
    where: { code: 'WSSB' },
    update: {},
    create: {
      code: 'WSSB',
      name: 'Water Supply & Sewerage Board',
      description: 'Manages potable drinking water supply, pipeline maintenance, storm drains, and sewage disposal.',
      isActive: true,
    },
  });

  const deptSan = await prisma.department.upsert({
    where: { code: 'SAN' },
    update: {},
    create: {
      code: 'SAN',
      name: 'Solid Waste Management & Sanitation',
      description: 'Handles municipal solid waste collection, public bins, street sweeping, and sanitary hygiene.',
      isActive: true,
    },
  });

  const deptEsl = await prisma.department.upsert({
    where: { code: 'ESL' },
    update: {},
    create: {
      code: 'ESL',
      name: 'Electrical & Street Lighting',
      description: 'Maintains streetlights, intersection lighting grids, public electrical safety, and junction boxes.',
      isActive: true,
    },
  });

  const deptTpi = await prisma.department.upsert({
    where: { code: 'TPI' },
    update: {},
    create: {
      code: 'TPI',
      name: 'Town Planning & Public Infrastructure',
      description: 'Oversees public parks, community amenities, boundary walls, and municipal zoning compliance.',
      isActive: true,
    },
  });

  // ==========================================
  // 2. Complaint Categories
  // ==========================================
  console.log('[Civora Seed] Seeding complaint categories...');
  const catRoads = await prisma.complaintCategory.upsert({
    where: { code: 'ROADS_POTHOLES' },
    update: {},
    create: {
      code: 'ROADS_POTHOLES',
      name: 'Roads, Footpaths & Potholes',
      description: 'Crater potholes, damaged asphalt, missing curb stones, and dangerous pedestrian footpaths.',
      departmentId: deptPwd.id,
      isActive: true,
    },
  });

  const catDrainage = await prisma.complaintCategory.upsert({
    where: { code: 'DRAINAGE_OVERFLOW' },
    update: {},
    create: {
      code: 'DRAINAGE_OVERFLOW',
      name: 'Drainage & Waterlogging',
      description: 'Clogged storm drains, overflowing manholes, and seasonal water accumulation on streets.',
      departmentId: deptWssb.id,
      isActive: true,
    },
  });

  const catGarbage = await prisma.complaintCategory.upsert({
    where: { code: 'GARBAGE_DUMPING' },
    update: {},
    create: {
      code: 'GARBAGE_DUMPING',
      name: 'Garbage & Waste Disposal',
      description: 'Uncollected residential waste, overflowing public dumpsters, and illegal trash dumping.',
      departmentId: deptSan.id,
      isActive: true,
    },
  });

  const catLighting = await prisma.complaintCategory.upsert({
    where: { code: 'STREETLIGHT_OUTAGE' },
    update: {},
    create: {
      code: 'STREETLIGHT_OUTAGE',
      name: 'Streetlights & Electrical Hazards',
      description: 'Dark roadway segments, flickering poles, broken fixtures, and exposed roadside wiring.',
      departmentId: deptEsl.id,
      isActive: true,
    },
  });

  const catInfra = await prisma.complaintCategory.upsert({
    where: { code: 'INFRASTRUCTURE_DAMAGE' },
    update: {},
    create: {
      code: 'INFRASTRUCTURE_DAMAGE',
      name: 'Parks & Public Property',
      description: 'Damaged public benches, broken park swings, breached fencing, and municipal property damage.',
      departmentId: deptTpi.id,
      isActive: true,
    },
  });

  // ==========================================
  // 3. Fictional Users (Citizens, Officials, Admin)
  // ==========================================
  console.log('[Civora Seed] Seeding fictional accounts...');
  const citizenAarav = await prisma.user.upsert({
    where: { email: 'aarav.sharma@example.com' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'aarav.sharma@example.com',
      name: 'Aarav Sharma',
      phone: '+91 98765 43210',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-01-15T10:00:00Z'),
    },
  });

  const citizenPriya = await prisma.user.upsert({
    where: { email: 'priya.patel@example.com' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'priya.patel@example.com',
      name: 'Priya Patel',
      phone: '+91 98765 43211',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-02-10T11:30:00Z'),
    },
  });

  const citizenRahul = await prisma.user.upsert({
    where: { email: 'rahul.verma@example.com' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'rahul.verma@example.com',
      name: 'Rahul Verma',
      phone: '+91 98765 43212',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-03-01T09:15:00Z'),
    },
  });

  const officialRajesh = await prisma.user.upsert({
    where: { email: 'rajesh.kumar@example.com' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'rajesh.kumar@example.com',
      name: 'Engineer Rajesh Kumar',
      phone: '+91 98765 43220',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.GOVERNMENT_OFFICIAL,
      accountStatus: AccountStatus.ACTIVE,
      departmentId: deptPwd.id,
      emailVerifiedAt: new Date('2025-11-01T08:00:00Z'),
    },
  });

  const officialSunita = await prisma.user.upsert({
    where: { email: 'sunita.rao@example.com' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'sunita.rao@example.com',
      name: 'Inspector Sunita Rao',
      phone: '+91 98765 43221',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.GOVERNMENT_OFFICIAL,
      accountStatus: AccountStatus.ACTIVE,
      departmentId: deptSan.id,
      emailVerifiedAt: new Date('2025-12-05T09:00:00Z'),
    },
  });

  const adminMeera = await prisma.user.upsert({
    where: { email: 'admin.meera@civora.local' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'admin.meera@civora.local',
      name: 'Meera Desai (System Admin)',
      phone: '+91 98765 43200',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2025-10-01T00:00:00Z'),
    },
  });

  // Explicit Module 5 Test Accounts (Testing Credentials: CivoraDev123!)
  await prisma.user.upsert({
    where: { email: 'citizen1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'citizen1@example.test',
      name: 'Test Citizen One',
      phone: '+91 90000 00001',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'official1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'official1@example.test',
      name: 'Test Official One',
      phone: '+91 90000 00002',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.GOVERNMENT_OFFICIAL,
      accountStatus: AccountStatus.ACTIVE,
      departmentId: deptPwd.id,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'admin1@example.test',
      name: 'Test Administrator One',
      phone: '+91 90000 00003',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'contractor1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'contractor1@example.test',
      name: 'Sanjay Hegde (Apex Infra)',
      phone: '+91 90000 00004',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CONTRACTOR,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'suspended1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH, accountStatus: AccountStatus.SUSPENDED },
    create: {
      email: 'suspended1@example.test',
      name: 'Suspended Test User',
      phone: '+91 90000 00004',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.SUSPENDED,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'pending1@example.test' },
    update: { passwordHash: DEV_PASSWORD_HASH, accountStatus: AccountStatus.PENDING_VERIFICATION },
    create: {
      email: 'pending1@example.test',
      name: 'Pending Verification Test User',
      phone: '+91 90000 00005',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.PENDING_VERIFICATION,
    },
  });

  // ==========================================
  // 3.1 Primary Demonstration Accounts (CivoraDemo@2026)
  // ==========================================
  console.log('[Civora Seed] Seeding 4 primary demonstration accounts (CivoraDemo@2026)...');
  const demoCitizen = await prisma.user.upsert({
    where: { email: 'citizen@civora.test' },
    update: {
      name: 'Aarav Sharma',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: 'citizen@civora.test',
      name: 'Aarav Sharma',
      phone: '+91 98765 43210',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-01-15T10:00:00Z'),
    },
  });

  const demoOfficial = await prisma.user.upsert({
    where: { email: 'official@civora.test' },
    update: {
      name: 'Priya Verma',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.GOVERNMENT_OFFICIAL,
      accountStatus: AccountStatus.ACTIVE,
      departmentId: deptPwd.id,
    },
    create: {
      email: 'official@civora.test',
      name: 'Priya Verma',
      phone: '+91 98765 43230',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.GOVERNMENT_OFFICIAL,
      accountStatus: AccountStatus.ACTIVE,
      departmentId: deptPwd.id,
      emailVerifiedAt: new Date('2025-10-01T08:00:00Z'),
    },
  });

  const demoContractor = await prisma.user.upsert({
    where: { email: 'contractor@civora.test' },
    update: {
      name: 'Rahul Mehta',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.CONTRACTOR,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: 'contractor@civora.test',
      name: 'Rahul Mehta',
      phone: '+91 98450 99887',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.CONTRACTOR,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2025-09-01T00:00:00Z'),
    },
  });

  const demoAdmin = await prisma.user.upsert({
    where: { email: 'admin@civora.test' },
    update: {
      name: 'System Administrator',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: 'admin@civora.test',
      name: 'System Administrator',
      phone: '+91 98765 43000',
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2025-08-01T00:00:00Z'),
    },
  });

  // ==========================================
  // 4. Complaints (Civic Scenarios & Full Workflow Distribution)
  // ==========================================
  console.log('[Civora Seed] Seeding complaints and status history...');
  const complaint1 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00101' },
    update: {
      citizenId: demoCitizen.id,
      assignedOfficialId: demoOfficial.id,
    },
    create: {
      trackingId: 'CIV-2026-00101',
      title: 'Deep hazardous pothole on 4th Main Road',
      description: 'Approximately 1.2 meter wide crater in middle lane causing severe two-wheeler skids and traffic congestion.',
      categoryId: catRoads.id,
      priority: ComplaintPriority.HIGH,
      status: ComplaintStatus.ASSIGNED,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptPwd.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Opposite Central Library, 4th Main Road',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9784000,
      longitude: 77.6408000,
      reviewedAt: new Date('2026-10-10T10:00:00Z'),
      assignedAt: new Date('2026-10-10T11:30:00Z'),
      createdAt: new Date('2026-10-09T18:45:00Z'),
    },
  });

  const complaint2 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00102' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00102',
      title: 'Overflowing community garbage bin near Sector 5 market',
      description: 'Garbage has not been collected for three consecutive days. Waste spilling onto pedestrian pathway.',
      categoryId: catGarbage.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.IN_PROGRESS,
      citizenId: citizenPriya.id,
      assignedDepartmentId: deptSan.id,
      assignedOfficialId: officialSunita.id,
      locationAddress: 'Corner of 7th Cross and Market Road, Sector 5',
      locality: 'HSR Layout',
      ward: 'Ward 174',
      latitude: 12.9116000,
      longitude: 77.6389000,
      reviewedAt: new Date('2026-10-12T09:00:00Z'),
      assignedAt: new Date('2026-10-12T09:45:00Z'),
      createdAt: new Date('2026-10-11T20:10:00Z'),
    },
  });

  const complaint3 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00103' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00103',
      title: 'Non-functioning streetlights along outer ring junction',
      description: 'Continuous stretch of 5 street poles dark since Friday rain, creating unsafe conditions for pedestrians.',
      categoryId: catLighting.id,
      priority: ComplaintPriority.LOW,
      status: ComplaintStatus.SUBMITTED,
      citizenId: citizenRahul.id,
      locationAddress: 'Service Road underpass junction, Outer Ring Road',
      locality: 'Bellandur',
      ward: 'Ward 150',
      latitude: 12.9260000,
      longitude: 77.6762000,
      createdAt: new Date('2026-10-15T21:00:00Z'),
    },
  });

  const complaint4 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00104' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00104',
      title: 'Burst water pipeline flooding residential sidewalk',
      description: 'Clean drinking water gushing from underground pipe joint onto road surface. Risk of foundation erosion.',
      categoryId: catDrainage.id,
      priority: ComplaintPriority.URGENT,
      status: ComplaintStatus.UNDER_REVIEW,
      citizenId: citizenAarav.id,
      assignedDepartmentId: deptWssb.id,
      locationAddress: 'Near Water Tank, 12th Cross, 3rd Block',
      locality: 'Koramangala',
      ward: 'Ward 151',
      latitude: 12.9345000,
      longitude: 77.6253000,
      reviewedAt: new Date('2026-10-16T08:30:00Z'),
      createdAt: new Date('2026-10-16T07:15:00Z'),
    },
  });

  const complaint5 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00105' },
    update: { assignedOfficialId: demoOfficial.id },
    create: {
      trackingId: 'CIV-2026-00105',
      title: 'Broken footpath slabs near metro entrance',
      description: 'Concrete pavement pavers collapsed, leaving exposed iron reinforcement mesh.',
      categoryId: catRoads.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.RESOLVED,
      citizenId: citizenPriya.id,
      assignedDepartmentId: deptPwd.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Metro Gate 2 exit footpath, MG Road',
      locality: 'Central Ward',
      ward: 'Ward 111',
      latitude: 12.9756000,
      longitude: 77.6066000,
      resolutionNotes: 'Slabs replaced with non-slip granite pavers; joint grouting completed and verified by site inspection.',
      reviewedAt: new Date('2026-10-01T10:00:00Z'),
      assignedAt: new Date('2026-10-01T12:00:00Z'),
      resolvedAt: new Date('2026-10-05T16:30:00Z'),
      verifiedAt: new Date('2026-10-06T11:00:00Z'),
      createdAt: new Date('2026-09-30T14:20:00Z'),
    },
  });

  const complaint6 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00106' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00106',
      title: 'Unauthorized construction debris in park perimeter',
      description: 'Building rubble dumped along children park pathway.',
      categoryId: catGarbage.id,
      priority: ComplaintPriority.LOW,
      status: ComplaintStatus.CLOSED,
      citizenId: citizenRahul.id,
      assignedDepartmentId: deptSan.id,
      assignedOfficialId: officialSunita.id,
      locationAddress: 'Lakeside Park boundary, 6th Block',
      locality: 'Koramangala',
      ward: 'Ward 151',
      latitude: 12.9320000,
      longitude: 77.6210000,
      resolutionNotes: 'Municipal tipper truck deployed; entire debris removed and area sanitised.',
      reviewedAt: new Date('2026-09-20T09:00:00Z'),
      assignedAt: new Date('2026-09-20T11:00:00Z'),
      resolvedAt: new Date('2026-09-22T14:00:00Z'),
      verifiedAt: new Date('2026-09-23T10:00:00Z'),
      closedAt: new Date('2026-09-25T17:00:00Z'),
      createdAt: new Date('2026-09-19T16:40:00Z'),
    },
  });

  const complaint7 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00201' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00201',
      title: 'Severe cratering and asphalt erosion outside St. Jude School',
      description: 'Hazardous cluster of potholes directly outside school pedestrian crossing. Morning school buses and parents on two-wheelers are swerving into oncoming traffic.',
      categoryId: catRoads.id,
      priority: ComplaintPriority.HIGH,
      status: ComplaintStatus.IN_PROGRESS,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptPwd.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'School Gate 1, 12th Main Road, HAL 2nd Stage',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9789000,
      longitude: 77.6412000,
      reviewedAt: new Date('2026-10-18T09:00:00Z'),
      assignedAt: new Date('2026-10-18T10:30:00Z'),
      createdAt: new Date('2026-10-17T15:20:00Z'),
    },
  });

  const complaint8 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00202' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00202',
      title: 'Sewage backflow and overflowing manhole near bus terminus',
      description: 'Underground sewer chamber blocked. Foul wastewater flooding approximately 50 meters of commercial footpath causing acute pedestrian disruption.',
      categoryId: catDrainage.id,
      priority: ComplaintPriority.URGENT,
      status: ComplaintStatus.ASSIGNED,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptWssb.id,
      assignedOfficialId: officialRajesh.id,
      locationAddress: 'Opposite BMTC Depot Exit, 80 Feet Road',
      locality: 'Koramangala 4th Block',
      ward: 'Ward 151',
      latitude: 12.9348000,
      longitude: 77.6258000,
      reviewedAt: new Date('2026-10-21T08:00:00Z'),
      assignedAt: new Date('2026-10-21T09:30:00Z'),
      createdAt: new Date('2026-10-20T19:40:00Z'),
    },
  });

  const complaint9 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00203' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00203',
      title: 'Flickering high-mast streetlamps causing blind curve hazard',
      description: 'Three consecutive high-mast sodium lamps on the S-curve road segment are blinking intermittently, leaving the turn dangerously pitch black at night.',
      categoryId: catLighting.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.SUBMITTED,
      citizenId: demoCitizen.id,
      locationAddress: 'Sector 2 S-Curve Flyover descent, 14th Main',
      locality: 'HSR Layout',
      ward: 'Ward 174',
      latitude: 12.9122000,
      longitude: 77.6395000,
      createdAt: new Date('2026-10-24T21:15:00Z'),
    },
  });

  const complaint10 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00204' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00204',
      title: 'Illegal commercial bio-waste dumping in vacant municipal plot',
      description: 'Unregistered commercial catering trucks dumping food waste, plastic containers, and wet refuse in public open plot every midnight. Strays and stench accumulating.',
      categoryId: catGarbage.id,
      priority: ComplaintPriority.HIGH,
      status: ComplaintStatus.UNDER_REVIEW,
      citizenId: citizenPriya.id,
      assignedDepartmentId: deptSan.id,
      locationAddress: 'Survey No. 42/1, Green Glen Layout, Outer Ring Road',
      locality: 'Bellandur',
      ward: 'Ward 150',
      latitude: 12.9265000,
      longitude: 77.6769000,
      reviewedAt: new Date('2026-10-23T11:00:00Z'),
      createdAt: new Date('2026-10-23T07:30:00Z'),
    },
  });

  const complaint11 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00205' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00205',
      title: 'Damaged children swing set and exposed iron edges in public park',
      description: 'Two toddler swings snapped from rusted ceiling chains with jagged metal links hanging. Park bench slats also broken.',
      categoryId: catInfra.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.RESOLVED,
      citizenId: citizenRahul.id,
      assignedDepartmentId: deptTpi.id,
      assignedOfficialId: officialRajesh.id,
      locationAddress: 'BBMP Children Park, 27th Cross, 4th Block',
      locality: 'Jayanagar',
      ward: 'Ward 153',
      latitude: 12.9288000,
      longitude: 77.5835000,
      resolutionNotes: 'Damaged swing frame replaced with safety-certified rubberized swings; chain links renewed with anti-rust galvanized coating and verified by assistant engineer.',
      reviewedAt: new Date('2026-10-04T10:00:00Z'),
      assignedAt: new Date('2026-10-04T12:00:00Z'),
      resolvedAt: new Date('2026-10-08T15:00:00Z'),
      verifiedAt: new Date('2026-10-09T11:00:00Z'),
      createdAt: new Date('2026-10-03T16:20:00Z'),
    },
  });

  const complaint12 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00206' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00206',
      title: 'Reopened: Pothole cold-mix patch washed away after single monsoon rainfall',
      description: 'The previous cold asphalt patch disintegrated within 48 hours of rain. Crater is even wider now and loose gravel is causing vehicular skidding.',
      categoryId: catRoads.id,
      priority: ComplaintPriority.URGENT,
      status: ComplaintStatus.REOPENED,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptPwd.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Near 12th Main Junction, 100 Feet Road',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9715000,
      longitude: 77.6402000,
      resolutionNotes: 'Initial cold-mix patch applied 12-Oct. Citizen reported rapid erosion under storm run-off. Reopened for mechanical hot-mix rolling and tack-coat seal.',
      reviewedAt: new Date('2026-10-11T10:00:00Z'),
      assignedAt: new Date('2026-10-11T12:00:00Z'),
      resolvedAt: new Date('2026-10-13T16:00:00Z'),
      createdAt: new Date('2026-10-10T14:10:00Z'),
    },
  });

  const complaint13 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00207' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00207',
      title: 'Verified: Stormwater drain desilting completed before seasonal rains',
      description: 'Primary arterial stormwater canal choked with silt, plastic weeds, and concrete blockages. Desilting completed and verified by reporting citizen.',
      categoryId: catDrainage.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.VERIFIED,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptWssb.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Opposite ITPL Main Entrance, Whitefield Main Road',
      locality: 'Whitefield',
      ward: 'Ward 84',
      latitude: 12.9698000,
      longitude: 77.7499000,
      resolutionNotes: 'Hydraulic desilting excavator deployed across 450 meters canal stretch. All silt extracted and carted away. Gradient inspected.',
      reviewedAt: new Date('2026-10-02T09:00:00Z'),
      assignedAt: new Date('2026-10-02T11:00:00Z'),
      resolvedAt: new Date('2026-10-06T17:00:00Z'),
      verifiedAt: new Date('2026-10-07T10:30:00Z'),
      createdAt: new Date('2026-10-01T11:00:00Z'),
    },
  });

  const complaint14 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00208' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00208',
      title: 'Exposed roadside underground cable junction box without cover',
      description: 'High voltage electrical feeder pillar box on pedestrian footpath has missing steel door. Live copper terminals exposed within easy reach of children.',
      categoryId: catLighting.id,
      priority: ComplaintPriority.URGENT,
      status: ComplaintStatus.IN_PROGRESS,
      citizenId: citizenPriya.id,
      assignedDepartmentId: deptEsl.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Footpath opposite Canara Bank, 8th Cross',
      locality: 'Malleshwaram',
      ward: 'Ward 65',
      latitude: 13.0035000,
      longitude: 77.5711000,
      reviewedAt: new Date('2026-10-22T08:30:00Z'),
      assignedAt: new Date('2026-10-22T09:15:00Z'),
      createdAt: new Date('2026-10-21T18:00:00Z'),
    },
  });

  const complaint15 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-00209' },
    update: {},
    create: {
      trackingId: 'CIV-2026-00209',
      title: 'Commercial billboard dispute on private cooperative society boundary',
      description: 'Complaint submitted claiming advertising hoarding is blocking public footpath view.',
      categoryId: catInfra.id,
      priority: ComplaintPriority.LOW,
      status: ComplaintStatus.REJECTED,
      citizenId: citizenRahul.id,
      assignedDepartmentId: deptTpi.id,
      assignedOfficialId: officialRajesh.id,
      locationAddress: 'Corner of 5th Main & Outer Ring Road',
      locality: 'BTM Layout',
      ward: 'Ward 176',
      latitude: 12.9165000,
      longitude: 77.6101000,
      rejectionReason: 'Field verification by Town Planning inspector confirmed the hoarding structure is fully within registered private society compound wall and holds valid commercial advertisement permit #AD-8842.',
      reviewedAt: new Date('2026-10-15T11:00:00Z'),
      createdAt: new Date('2026-10-14T16:30:00Z'),
    },
  });

  const complaint16 = await prisma.complaint.upsert({
    where: { trackingId: 'CIV-2026-G3NFZ' },
    update: {},
    create: {
      trackingId: 'CIV-2026-G3NFZ',
      title: 'Cracked stormwater culvert cover with photographic evidence',
      description: 'RCC precast culvert slab over storm channel has cracked through middle with steel rebar exposed. Heavy trucks turning from main road risk caving in.',
      categoryId: catRoads.id,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.ASSIGNED,
      citizenId: demoCitizen.id,
      assignedDepartmentId: deptPwd.id,
      assignedOfficialId: demoOfficial.id,
      locationAddress: 'Drainage crossing culvert, 10th Main, HAL 3rd Stage',
      locality: 'Indira Nagar',
      ward: 'Ward 82',
      latitude: 12.9732000,
      longitude: 77.6445000,
      reviewedAt: new Date('2026-10-18T10:00:00Z'),
      assignedAt: new Date('2026-10-18T11:00:00Z'),
      createdAt: new Date('2026-10-17T14:00:00Z'),
    },
  });

  // Seed Complaint Status History
  const historyCount = await prisma.complaintStatusHistory.count({
    where: { complaintId: complaint1.id },
  });
  if (historyCount === 0) {
    await prisma.complaintStatusHistory.createMany({
      data: [
        {
          complaintId: complaint1.id,
          fromStatus: null,
          toStatus: ComplaintStatus.SUBMITTED,
          changedById: citizenAarav.id,
          reasonOrRemarks: 'Citizen lodged report through public web portal.',
          createdAt: new Date('2026-10-09T18:45:00Z'),
        },
        {
          complaintId: complaint1.id,
          fromStatus: ComplaintStatus.SUBMITTED,
          toStatus: ComplaintStatus.UNDER_REVIEW,
          changedById: adminMeera.id,
          reasonOrRemarks: 'Reviewer validated photographic evidence and priority classification.',
          createdAt: new Date('2026-10-10T10:00:00Z'),
        },
        {
          complaintId: complaint1.id,
          fromStatus: ComplaintStatus.UNDER_REVIEW,
          toStatus: ComplaintStatus.ASSIGNED,
          changedById: adminMeera.id,
          reasonOrRemarks: 'Dispatched to PWD Division 4; assigned to Executive Engineer Rajesh Kumar.',
          createdAt: new Date('2026-10-10T11:30:00Z'),
        },
      ],
    });
  }

  // ==========================================
  // 5. Civic Works (Formal Municipal Projects)
  // ==========================================
  console.log('[Civora Seed] Seeding civic work project and complaint links...');
  const civicWork1 = await prisma.civicWork.upsert({
    where: { workOrderNumber: 'CW-2026-0042' },
    update: {},
    create: {
      workOrderNumber: 'CW-2026-0042',
      title: 'Major Resurfacing and Drainage Restoration on 4th Main Road',
      description: 'Comprehensive milling of damaged asphalt surface, laying 50mm Bituminous Concrete, and reconstructing stormwater roadside gutters.',
      workType: 'ROAD_RESURFACING',
      departmentId: deptPwd.id,
      location: '4th Main Road Corridor (Ch. 0+000 to 1+200)',
      ward: 'Ward 82',
      estimatedBudget: 750000.00,
      sanctionedAmount: 750000.00,
      plannedStartDate: new Date('2026-10-15T00:00:00Z'),
      plannedEndDate: new Date('2026-11-30T00:00:00Z'),
      actualStartDate: new Date('2026-10-16T09:00:00Z'),
      workStatus: CivicWorkStatus.IN_PROGRESS,
    },
  });

  // Link Complaint 1 to Civic Work 1
  await prisma.civicWorkComplaint.upsert({
    where: {
      civicWorkId_complaintId: {
        civicWorkId: civicWork1.id,
        complaintId: complaint1.id,
      },
    },
    update: {},
    create: {
      civicWorkId: civicWork1.id,
      complaintId: complaint1.id,
      notes: 'Pothole issue on 4th Main Road aggregated into the comprehensive road resurfacing package CW-2026-0042.',
    },
  });

  // ==========================================
  // 6. Site Inspection & Technical Assessment
  // ==========================================
  console.log('[Civora Seed] Seeding site inspection and engineering assessment...');
  const existingInspection = await prisma.siteInspection.findFirst({
    where: { complaintId: complaint1.id },
  });
  if (!existingInspection) {
    await prisma.siteInspection.create({
      data: {
        complaintId: complaint1.id,
        civicWorkId: civicWork1.id,
        inspectorId: officialRajesh.id,
        inspectionDate: new Date('2026-10-11T14:00:00Z'),
        outcome: InspectionOutcome.NEEDS_REPAIR,
        observations: 'Severe alligator cracking around 1.2m diameter pothole. Base water penetration observed.',
        measurements: 'Length: 1.25m, Width: 0.95m, Average Depth: 110mm.',
        notes: 'Patch work insufficient; full section milling required under CW-2026-0042.',
      },
    });
  }

  const existingAssessment = await prisma.technicalAssessment.findFirst({
    where: { complaintId: complaint1.id },
  });
  if (!existingAssessment) {
    await prisma.technicalAssessment.create({
      data: {
        complaintId: complaint1.id,
        civicWorkId: civicWork1.id,
        assessorId: officialRajesh.id,
        assessmentDate: new Date('2026-10-12T11:00:00Z'),
        technicalFindings: 'Subgrade failure caused by inadequate storm drain drainage on northern roadway side.',
        requiredWork: 'Milling of bituminous surface, drainage culvert reconstruction, and dense bituminous macadam overlay.',
        estimatedScope: '1.2 km road length, 7m carriageway width.',
        feasibility: FeasibilityAssessment.FEASIBLE,
        recommendation: 'Incorporate into municipal capital works package CW-2026-0042 with contractor execution.',
      },
    });
  }

  // ==========================================
  // 7. Estimates & Line Items
  // ==========================================
  console.log('[Civora Seed] Seeding estimate and line items...');
  const estimate1 = await prisma.estimate.upsert({
    where: { estimateNumber: 'EST-2026-0089' },
    update: {},
    create: {
      estimateNumber: 'EST-2026-0089',
      civicWorkId: civicWork1.id,
      version: 1,
      preparedById: officialRajesh.id,
      preparationDate: new Date('2026-10-13T10:00:00Z'),
      description: 'Detailed project estimate for asphalt milling and bituminous concrete resurfacing.',
      status: EstimateStatus.APPROVED,
      totalAmount: 715000.00,
    },
  });

  const lineItemCount = await prisma.estimateLineItem.count({
    where: { estimateId: estimate1.id },
  });
  if (lineItemCount === 0) {
    await prisma.estimateLineItem.createMany({
      data: [
        {
          estimateId: estimate1.id,
          itemNumber: 1,
          description: 'Milling of damaged bituminous surface (depth up to 50mm) and disposal of millings.',
          quantity: 2500.00,
          unitOfMeasurement: 'sq.m',
          unitRate: 120.00,
          totalAmount: 300000.00,
        },
        {
          estimateId: estimate1.id,
          itemNumber: 2,
          description: 'Providing and laying 50mm thick Bituminous Concrete overlay as per MoRTH Section 507.',
          quantity: 350.00,
          unitOfMeasurement: 'cu.m',
          unitRate: 1185.71,
          totalAmount: 415000.00,
        },
      ],
    });
  }

  // ==========================================
  // 8. Approvals & Sanctions
  // ==========================================
  console.log('[Civora Seed] Seeding administrative & technical approvals...');
  await prisma.approvalSanction.upsert({
    where: { referenceNumber: 'APV-2026-0034' },
    update: {},
    create: {
      referenceNumber: 'APV-2026-0034',
      civicWorkId: civicWork1.id,
      estimateId: estimate1.id,
      approvalType: ApprovalType.TECHNICAL_SANCTION,
      approverId: adminMeera.id,
      decision: ApprovalDecision.APPROVED,
      decisionDate: new Date('2026-10-14T15:00:00Z'),
      sanctionedAmount: 750000.00,
      remarks: 'Technical estimates verified and approved under Ward 82 Infrastructure Maintenance Grant.',
    },
  });

  // ==========================================
  // 9. Contractor, Tenders & Work Order Execution (Module 17)
  // ==========================================
  console.log('[Civora Seed] Seeding contractor, tenders, and work order...');
  const contractorApex = await prisma.contractor.upsert({
    where: { registrationNumber: 'REG-2024-KA-8810' },
    update: {
      businessAddress: 'Plot 45, Peenya Industrial Area, Phase 2, Bengaluru, Karnataka 560058',
      operatingRegion: 'Bengaluru Urban & BBMP East/South',
      licenseClass: 'CLASS_A',
      panOrTaxId: 'AAACA1234F',
      workCategories: ['ROADS_POTHOLES', 'DRAINAGE_OVERFLOW', 'ROAD_RESURFACING'],
      isVerified: true,
      verifiedAt: new Date('2025-10-01T10:00:00Z'),
      verifiedById: adminMeera.id,
    },
    create: {
      registrationNumber: 'REG-2024-KA-8810',
      name: 'Apex Urban Infrastructure Ltd',
      contactPerson: 'Sanjay Hegde (Project Director)',
      email: 'contracts@apexurbaninfra.example.com',
      phone: '+91 98450 11223',
      status: ContractorStatus.ACTIVE,
      businessAddress: 'Plot 45, Peenya Industrial Area, Phase 2, Bengaluru, Karnataka 560058',
      operatingRegion: 'Bengaluru Urban & BBMP East/South',
      licenseClass: 'CLASS_A',
      panOrTaxId: 'AAACA1234F',
      workCategories: ['ROADS_POTHOLES', 'DRAINAGE_OVERFLOW', 'ROAD_RESURFACING'],
      isVerified: true,
      verifiedAt: new Date('2025-10-01T10:00:00Z'),
      verifiedById: adminMeera.id,
    },
  });

  // Link contractor user to contractor organization
  await prisma.user.updateMany({
    where: {
      email: { in: ['contractor1@example.test', 'contractor@civora.test'] },
    },
    data: { contractorId: contractorApex.id },
  });

  // Seed Published Tenders
  const tender1 = await prisma.tender.upsert({
    where: { tenderNumber: 'TND-2026-0001' },
    update: {},
    create: {
      tenderNumber: 'TND-2026-0001',
      title: 'Milling, Dense Bituminous Resurfacing & Kerb Restoration - Corridor 4',
      description: 'Competitive e-tender for heavy machine asphalt milling, laying of 50mm Bituminous Concrete, kerb stone painting, and road safety thermoplastic markings.',
      departmentId: deptPwd.id,
      civicWorkId: civicWork1.id,
      categoryCode: 'ROADS_POTHOLES',
      location: '4th Main Road Corridor (Ch. 0+000 to 1+200)',
      ward: 'Ward 82',
      estimatedBudget: 750000.00,
      earnestMoneyDeposit: 15000.00,
      minimumContractorClass: 'CLASS_B',
      status: TenderStatus.AWARDED,
      publicationDate: new Date('2026-10-01T09:00:00Z'),
      submissionDeadline: new Date('2026-10-14T17:00:00Z'),
      expectedDurationDays: 45,
      eligibilityCriteria: 'Contractor must be Class B or higher with registered GSTIN and prior experience in highway/urban road resurfacing.',
      scopeOfWork: 'Complete milling of 2500 sq.m surface, laying 350 cu.m bituminous concrete, and reconstruct 120m stormwater roadside gutter.',
      createdById: officialRajesh.id,
    },
  });

  const tender2 = await prisma.tender.upsert({
    where: { tenderNumber: 'TND-2026-0002' },
    update: {},
    create: {
      tenderNumber: 'TND-2026-0002',
      title: 'Reinforced Concrete Stormwater Culvert Construction at 12th Cross',
      description: 'Open public tender for excavation, RCC box culvert fabrication, precast cover slab installation, and high-velocity silt trap construction.',
      departmentId: deptWssb.id,
      categoryCode: 'DRAINAGE_OVERFLOW',
      location: '12th Cross Junction, Indiranagar',
      ward: 'Ward 112',
      estimatedBudget: 1250000.00,
      earnestMoneyDeposit: 25000.00,
      minimumContractorClass: 'CLASS_A',
      status: TenderStatus.PUBLISHED,
      publicationDate: new Date('2026-10-18T10:00:00Z'),
      submissionDeadline: new Date('2026-11-15T18:00:00Z'),
      expectedDurationDays: 60,
      eligibilityCriteria: 'Registered Class A municipal contractors with active GSTIN and minimum 2 executed culvert projects.',
      scopeOfWork: 'Construct 45m RCC underground box culvert, manhole inspection chambers, and connect to primary trunk line.',
      createdById: officialRajesh.id,
    },
  });

  // Seed Winning Bid for Tender 1
  const contractorUser = await prisma.user.findUnique({
    where: { email: 'contractor1@example.test' },
  });

  let winningBid = await prisma.tenderBid.findFirst({
    where: { tenderId: tender1.id, contractorId: contractorApex.id },
  });

  if (!winningBid && contractorUser) {
    winningBid = await prisma.tenderBid.create({
      data: {
        bidNumber: 'BID-2026-0001',
        tenderId: tender1.id,
        contractorId: contractorApex.id,
        submittedById: contractorUser.id,
        bidAmount: 715000.00,
        proposedDurationDays: 40,
        technicalProposal: 'Apex Infra deploys modern high-capacity cold milling machines and electronic paver with dual slope sensors for smooth grade.',
        methodology: 'Phase 1: Night-time cold milling (10 PM to 5 AM); Phase 2: Tack coat spraying; Phase 3: Hot mix paving and rolling.',
        declarationAccepted: true,
        status: BidStatus.ACCEPTED,
        officialEvaluationNotes: 'Technically responsive. Lowest evaluated qualified bidder. Financial quote is 4.6% below administrative sanction limit.',
        evaluatedById: officialRajesh.id,
        evaluatedAt: new Date('2026-10-15T10:00:00Z'),
      },
    });

    await prisma.tender.update({
      where: { id: tender1.id },
      data: { awardedBidId: winningBid.id },
    });
  }

  const workOrder1 = await prisma.workOrder.upsert({
    where: { workOrderNumber: 'WO-2026-0012' },
    update: {
      tenderId: tender1.id,
      tenderBidId: winningBid ? winningBid.id : undefined,
    },
    create: {
      workOrderNumber: 'WO-2026-0012',
      civicWorkId: civicWork1.id,
      contractorId: contractorApex.id,
      tenderId: tender1.id,
      tenderBidId: winningBid ? winningBid.id : undefined,
      workOrderDate: new Date('2026-10-15T11:00:00Z'),
      contractAmount: 715000.00,
      startDate: new Date('2026-10-16T09:00:00Z'),
      expectedCompletionDate: new Date('2026-11-25T18:00:00Z'),
      executionStatus: ExecutionStatus.IN_PROGRESS,
    },
  });

  // Seed Work Start Declaration
  const existingStart = await prisma.workStartDeclaration.findFirst({
    where: { workOrderId: workOrder1.id },
  });
  if (!existingStart && contractorUser) {
    await prisma.workStartDeclaration.create({
      data: {
        workOrderId: workOrder1.id,
        contractorId: contractorApex.id,
        submittedById: contractorUser.id,
        declaredStartDate: new Date('2026-10-16T09:00:00Z'),
        siteAddress: '4th Main Road Corridor, Ward 82, Bengaluru',
        latitude: 12.9716000,
        longitude: 77.5946000,
        siteNotes: 'Site possession taken. Barricades and retroreflective warning signs installed. Milling machine mobilized.',
        status: WorkStartStatus.VERIFIED,
        verifiedById: officialRajesh.id,
        verifiedAt: new Date('2026-10-16T12:00:00Z'),
        reviewNotes: 'Site inspection completed. Traffic diversion permits verified. Work commencement approved.',
      },
    });
  }

  // Seed Contract Milestones
  const milestoneCount = await prisma.contractMilestone.count({
    where: { workOrderId: workOrder1.id },
  });
  if (milestoneCount === 0 && contractorUser) {
    await prisma.contractMilestone.createMany({
      data: [
        {
          workOrderId: workOrder1.id,
          milestoneNumber: 1,
          title: 'Cold Milling & Debris Hauling',
          description: 'Full 50mm depth milling across 2500 sq.m carriageway and complete cleaning.',
          targetPhysicalPercentage: 35.00,
          targetAmount: 250000.00,
          targetDueDate: new Date('2026-10-22T18:00:00Z'),
          status: MilestoneStatus.APPROVED,
          claimedDate: new Date('2026-10-20T17:00:00Z'),
          claimedPhysicalPercentage: 35.00,
          claimedNotes: 'Milling finished across 2550 sq.m. Millings hauled to authorized municipal dump.',
          claimedById: contractorUser.id,
          reviewedById: officialRajesh.id,
          reviewedAt: new Date('2026-10-21T11:00:00Z'),
          reviewerRemarks: 'Site inspected. Surface profile and transverse slope satisfactory.',
        },
        {
          workOrderId: workOrder1.id,
          milestoneNumber: 2,
          title: 'Tack Coat & Bituminous Concrete Laying',
          description: 'Application of bituminous tack coat and laying of 50mm compacted BC layer.',
          targetPhysicalPercentage: 70.00,
          targetAmount: 300000.00,
          targetDueDate: new Date('2026-11-05T18:00:00Z'),
          status: MilestoneStatus.SUBMITTED_FOR_REVIEW,
          claimedDate: new Date('2026-10-28T16:00:00Z'),
          claimedPhysicalPercentage: 68.50,
          claimedNotes: 'BC paving completed for 950m length. Compaction density tests submitted.',
          claimedById: contractorUser.id,
        },
        {
          workOrderId: workOrder1.id,
          milestoneNumber: 3,
          title: 'Kerb Painting & Thermoplastic Road Markings',
          description: 'High-durability thermoplastic lane stripes, pedestrian zebra stripes, and kerb painting.',
          targetPhysicalPercentage: 100.00,
          targetAmount: 165000.00,
          targetDueDate: new Date('2026-11-25T18:00:00Z'),
          status: MilestoneStatus.PENDING,
        },
      ],
    });
  }

  // Seed Defect / Warranty Request
  const defectCount = await prisma.defectWarrantyRequest.count({
    where: { workOrderId: workOrder1.id },
  });
  if (defectCount === 0 && contractorUser) {
    await prisma.defectWarrantyRequest.create({
      data: {
        trackingId: 'DEF-2026-0001',
        workOrderId: workOrder1.id,
        contractorId: contractorApex.id,
        reportedById: officialRajesh.id,
        title: 'Minor raveling at pavement transition seam near 2nd Cross',
        description: 'Joint seam between old and new asphalt shows minor granular aggregate separation.',
        location: 'Ch. 0+450 (Northern carriageway edge)',
        severity: 'LOW',
        status: DefectStatus.REPORTED,
        isWarrantyCovered: true,
      },
    });
  }

  const progressCount = await prisma.executionProgressUpdate.count({
    where: { workOrderId: workOrder1.id },
  });
  if (progressCount === 0) {
    await prisma.executionProgressUpdate.create({
      data: {
        workOrderId: workOrder1.id,
        loggedById: officialRajesh.id,
        updateDate: new Date('2026-10-16T17:00:00Z'),
        physicalProgressPercentage: 65.50,
        financialProgressAmount: 468325.00,
        progressNotes: 'Milling completed across all lanes. Tack coat sprayed and first layer of bitumen laid.',
        milestoneReached: 'Subgrade and prime-coat milestones achieved.',
      },
    });
  }

  // ==========================================
  // 10. Financial Records
  // ==========================================
  console.log('[Civora Seed] Seeding financial transactions...');
  const existingTx = await prisma.financialTransaction.findFirst({
    where: {
      civicWorkId: civicWork1.id,
      paymentReference: 'TREASURY-2026-Q3-0914',
    },
  });
  if (!existingTx) {
    await prisma.financialTransaction.create({
      data: {
        civicWorkId: civicWork1.id,
        recordType: FinancialRecordType.BUDGET_ALLOCATION,
        amount: 750000.00,
        paymentDate: new Date('2026-10-15T14:30:00Z'),
        paymentReference: 'TREASURY-2026-Q3-0914',
        paymentStatus: PaymentStatus.PAID,
        remarks: 'Ward 82 Infrastructure Maintenance Special Grant released from municipal treasury.',
      },
    });
  }

  // ==========================================
  // 11. Documents & Audit Events Metadata
  // ==========================================
  console.log('[Civora Seed] Seeding document metadata and audit logs...');
  const existingDoc = await prisma.document.findFirst({
    where: { complaintId: complaint1.id },
  });
  if (!existingDoc) {
    await prisma.document.create({
      data: {
        fileName: 'pothole_site_photo_oct2026.jpg',
        storageKey: 'evidence/complaints/CIV-2026-00101/pothole_site_photo_oct2026.jpg',
        mimeType: 'image/jpeg',
        fileSize: BigInt(245780),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        uploaderId: citizenAarav.id,
        visibility: DocumentVisibility.PUBLIC,
        description: 'Citizen photograph showing deep crater pothole with vehicle hazard.',
        complaintId: complaint1.id,
      },
    });
  }

  const auditCount = await prisma.auditEvent.count();
  if (auditCount === 0) {
    await prisma.auditEvent.createMany({
      data: [
        {
          entityType: 'COMPLAINT',
          entityId: complaint1.id,
          action: 'STATUS_CHANGE',
          actorId: adminMeera.id,
          details: { fromStatus: 'UNDER_REVIEW', toStatus: 'ASSIGNED', assignedToDepartment: 'PWD' },
          ipAddress: '127.0.0.1',
          userAgent: 'Civora-Admin-Console/1.0',
        },
        {
          entityType: 'CIVIC_WORK',
          entityId: civicWork1.id,
          action: 'CREATE',
          actorId: adminMeera.id,
          details: { workOrderNumber: 'CW-2026-0042', estimatedBudget: 750000.00 },
          ipAddress: '127.0.0.1',
          userAgent: 'Civora-Admin-Console/1.0',
        },
      ],
    });
  }

  // ==========================================
  // 12. Module 10: Civic Engagement, Proposals & Public Polls
  // ==========================================
  console.log('[Civora Seed] Seeding Module 10 proposals, public polls, and engagement records...');
  
  // Proposal 1: Accepted for consideration with official response and community endorsement
  const existingProp1 = await prisma.communityProposal.findUnique({
    where: { trackingId: 'PROP-2026-00010' },
  });

  if (!existingProp1) {
    const prop1 = await prisma.communityProposal.create({
      data: {
        trackingId: 'PROP-2026-00010',
        title: 'Establish Solar-Powered Public Reading Gazebo in Sector 4 Park',
        description: 'Construct a sheltered open-air reading pavilion with solar rooftop panels, energy-efficient LED night illumination, and weather-resistant wooden benches to promote neighborhood community study and outdoor gathering.',
        problemStatement: 'The public park in Sector 4 has substantial underutilized lawn space but lacks shaded seating or quiet study spaces for neighborhood students and senior citizens.',
        suggestedSolution: 'Install an eco-friendly modular wooden gazebo with 1.2kW solar panels, integrated USB charging points, and nighttime warm-white lighting.',
        locality: 'Sector 4 Community Park, East Lawn',
        categoryId: catInfra.id,
        submitterId: citizenAarav.id,
        status: ProposalStatus.ACCEPTED_FOR_CONSIDERATION,
        internalModerationNotes: 'Site inspection conducted by Town Planning field unit on Oct 14. Concept feasible within municipal park development guidelines.',
        publicExplanation: 'The proposal aligns with the municipal green amenities plan and has passed initial feasibility checks.',
        officialResponse: 'The Town Planning Department acknowledges and accepts this proposal for technical feasibility analysis. It has been referred to the engineering cell for inclusion in the forthcoming ward amenity prioritization study.',
        officialResponseById: officialRajesh.id,
        officialResponseAt: new Date('2026-10-15T14:30:00Z'),
      },
    });

    // Add Endorsements
    await prisma.proposalSupport.createMany({
      data: [
        { proposalId: prop1.id, userId: citizenPriya.id },
        { proposalId: prop1.id, userId: citizenRahul.id },
      ],
      skipDuplicates: true,
    });

    // Add Public Comments
    await prisma.proposalComment.createMany({
      data: [
        {
          proposalId: prop1.id,
          authorId: citizenPriya.id,
          content: 'This would be wonderful for students studying in the evening. Highly support the solar lighting aspect!',
          createdAt: new Date('2026-10-15T10:15:00Z'),
        },
        {
          proposalId: prop1.id,
          authorId: citizenRahul.id,
          content: 'Please ensure adequate waste bins are installed alongside the gazebo structure to keep the lawn clean.',
          createdAt: new Date('2026-10-15T12:00:00Z'),
        },
      ],
    });
  }

  // Proposal 2: Published proposal undergoing active citizen endorsement
  const existingProp2 = await prisma.communityProposal.findUnique({
    where: { trackingId: 'PROP-2026-00011' },
  });

  if (!existingProp2) {
    const prop2 = await prisma.communityProposal.create({
      data: {
        trackingId: 'PROP-2026-00011',
        title: 'Add Raised Pedestrian Zebra Crossing with High-Visibility Signage near Silver Oak School',
        description: 'Install a 10cm raised tabletop pedestrian crossing with reflective yellow-and-white road paint, flashing solar warning beacons, and school-zone speed limit signage.',
        problemStatement: 'Vehicles traveling along 5th Main frequently exceed safe speeds directly in front of the primary school gate during morning drop-off hours.',
        suggestedSolution: 'Install an engineered raised speed table crossing that naturally forces vehicles to slow down to 20 km/h while allowing children to cross at curb level.',
        locality: '5th Main Road, Opposite Silver Oak School Gate 2',
        categoryId: catRoads.id,
        submitterId: citizenPriya.id,
        status: ProposalStatus.PUBLISHED,
        internalModerationNotes: 'Verified not a complaint: suggests new traffic-calming infrastructure rather than reporting a pothole. Approved for public listing.',
      },
    });

    // Add Support
    await prisma.proposalSupport.create({
      data: { proposalId: prop2.id, userId: citizenAarav.id },
    });
  }

  // Proposal 3: Fresh proposal under moderation review
  const existingProp3 = await prisma.communityProposal.findUnique({
    where: { trackingId: 'PROP-2026-00012' },
  });

  if (!existingProp3) {
    await prisma.communityProposal.create({
      data: {
        trackingId: 'PROP-2026-00012',
        title: 'Deploy Color-Coded Segregated Waste Bins along Commercial Market Walkway',
        description: 'Install 12 pairs of color-coded wet/dry dual-stream stainless steel dustbins along the high-footfall bazaar corridor.',
        locality: 'Station Road Commercial Market Corridor',
        categoryId: catGarbage.id,
        submitterId: citizenRahul.id,
        status: ProposalStatus.UNDER_REVIEW,
        internalModerationNotes: 'Pending review by Sanitation Department zonal coordinator.',
      },
    });
  }

  // Public Poll 1: Active Advisory Poll on Ward Safety
  const existingPoll1 = await prisma.publicPoll.findFirst({
    where: { title: 'Ward 12 Traffic Calming & Pedestrian Safety Priority Survey' },
  });

  if (!existingPoll1) {
    const poll1 = await prisma.publicPoll.create({
      data: {
        title: 'Ward 12 Traffic Calming & Pedestrian Safety Priority Survey',
        question: 'Which traffic safety improvement should the municipality prioritize for the Central Avenue corridor this fiscal quarter?',
        description: 'The Town Planning Department is planning localized traffic-calming interventions along Central Avenue. Please indicate your priority preference. Results are advisory and will inform engineering recommendations.',
        category: { connect: { id: catRoads.id } },
        pollType: PollType.SINGLE_CHOICE,
        maxSelections: 1,
        status: PollStatus.OPEN,
        visibilityRule: PollVisibilityRule.ALWAYS_VISIBLE,
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-11-30T23:59:59Z'),
        createdBy: { connect: { id: adminMeera.id } },
        options: {
          create: [
            { text: 'Raised Speed Tables & Visual Rumble Strips at Intersections', orderIndex: 0 },
            { text: 'Pelican Pedestrian Signal with Audible Countdown Timer', orderIndex: 1 },
            { text: 'Dedicated Bike Lane with Concrete Bollard Buffer', orderIndex: 2 },
            { text: 'Mini Roundabout Conversion at 5th Cross Crossing', orderIndex: 3 },
          ],
        },
      },
      include: { options: true },
    });

    // Seed synthetic vote from citizenAarav on option 0
    const option0 = poll1.options[0];
    if (option0) {
      await prisma.pollParticipation.create({
        data: { pollId: poll1.id, userId: citizenAarav.id },
      });
      await prisma.pollVote.create({
        data: { pollId: poll1.id, optionId: option0.id, userId: citizenAarav.id },
      });
    }

    // Seed synthetic vote from citizenPriya on option 1
    const option1 = poll1.options[1];
    if (option1) {
      await prisma.pollParticipation.create({
        data: { pollId: poll1.id, userId: citizenPriya.id },
      });
      await prisma.pollVote.create({
        data: { pollId: poll1.id, optionId: option1.id, userId: citizenPriya.id },
      });
    }
  }

  // Public Poll 2: Concluded survey on park amenities
  const existingPoll2 = await prisma.publicPoll.findFirst({
    where: { title: 'Community Park Lighting & Night Security Preference Poll' },
  });

  if (!existingPoll2) {
    const poll2 = await prisma.publicPoll.create({
      data: {
        title: 'Community Park Lighting & Night Security Preference Poll',
        question: 'What lighting preference do you favor for community walking tracks after 8:00 PM?',
        description: 'Advisory poll to establish balance between nighttime safety illumination and light pollution control.',
        category: { connect: { id: catLighting.id } },
        pollType: PollType.SINGLE_CHOICE,
        maxSelections: 1,
        status: PollStatus.CLOSED,
        visibilityRule: PollVisibilityRule.AFTER_CLOSE,
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2026-09-30T23:59:59Z'),
        createdBy: { connect: { id: adminMeera.id } },
        options: {
          create: [
            { text: 'Full-brightness warm LED lighting along primary tracks until 10 PM', orderIndex: 0 },
            { text: 'Motion-sensing smart illumination that dims when path is vacant', orderIndex: 1 },
            { text: 'Low-height bollard illumination focusing light strictly on pathway pavement', orderIndex: 2 },
          ],
        },
      },
      include: { options: true },
    });

    // Seed votes
    if (poll2.options[1]) {
      await prisma.pollParticipation.create({
        data: { pollId: poll2.id, userId: citizenAarav.id },
      });
      await prisma.pollVote.create({
        data: { pollId: poll2.id, optionId: poll2.options[1].id, userId: citizenAarav.id },
      });
    }
  }

  // ==========================================
  // 13. Module 11: Service-Level Agreements (SLAs), Policies & Escalations
  // ==========================================
  console.log('[Civora Seed] Seeding SLA policies, demo overdue cases, and escalations...');

  // 13.1 SLA Policies
  // Policy 1: Urgent Hazard Fast-Track
  let policyUrgent = await prisma.slaPolicy.findFirst({
    where: { name: 'Urgent Hazard & Critical Infrastructure Policy' },
  });
  if (!policyUrgent) {
    policyUrgent = await prisma.slaPolicy.create({
      data: {
        name: 'Urgent Hazard & Critical Infrastructure Policy',
        description: 'Rapid response and resolution commitment for urgent public safety hazards and infrastructure failures.',
        priority: ComplaintPriority.URGENT,
        responseTargetHours: 4,      // 4 hours response
        resolutionTargetHours: 24,   // 24 hours resolution
        warningThresholdHours: 4,    // warning 4h before deadline
        escalationThresholdHours: 6, // escalate 6h after breach
        isActive: true,
        isDefault: false,
        createdById: adminMeera.id,
      },
    });
  }

  // Policy 2: Roads & Potholes Standard Commitment
  let policyRoads = await prisma.slaPolicy.findFirst({
    where: { name: 'Roads, Footpaths & Asphalt Repair SLA' },
  });
  if (!policyRoads) {
    policyRoads = await prisma.slaPolicy.create({
      data: {
        name: 'Roads, Footpaths & Asphalt Repair SLA',
        description: 'Standard municipal turnaround target for road surface craters, potholes, and curb repairs.',
        categoryId: catRoads.id,
        responseTargetHours: 24,
        resolutionTargetHours: 72,
        warningThresholdHours: 12,
        escalationThresholdHours: 24,
        isActive: true,
        isDefault: false,
        createdById: adminMeera.id,
      },
    });
  }

  // Policy 3: Garbage & Sanitation SLA
  let policySanitation = await prisma.slaPolicy.findFirst({
    where: { name: 'Municipal Sanitation & Waste Clearance SLA' },
  });
  if (!policySanitation) {
    policySanitation = await prisma.slaPolicy.create({
      data: {
        name: 'Municipal Sanitation & Waste Clearance SLA',
        description: 'Turnaround target for overflowing dumpsters and commercial waste accumulation.',
        categoryId: catGarbage.id,
        responseTargetHours: 12,
        resolutionTargetHours: 48,
        warningThresholdHours: 8,
        escalationThresholdHours: 12,
        isActive: true,
        isDefault: false,
        createdById: adminMeera.id,
      },
    });
  }

  // Policy 4: Platform-Wide Fallback Default Policy
  let policyDefault = await prisma.slaPolicy.findFirst({
    where: { name: 'Civora Municipal Standard Default SLA' },
  });
  if (!policyDefault) {
    policyDefault = await prisma.slaPolicy.create({
      data: {
        name: 'Civora Municipal Standard Default SLA',
        description: 'Default citizen commitment applied when no category or priority specific policy overrides.',
        responseTargetHours: 24,
        resolutionTargetHours: 96,
        warningThresholdHours: 24,
        escalationThresholdHours: 24,
        isActive: true,
        isDefault: true,
        createdById: adminMeera.id,
      },
    });
  }

  // Attach SLA snapshots to existing seeded complaints if they don't have one
  const allExistingComplaints = await prisma.complaint.findMany({
    include: { sla: true },
  });

  for (const c of allExistingComplaints) {
    if (!c.sla) {
      let chosenPolicy = policyDefault;
      if (c.priority === ComplaintPriority.URGENT) {
        chosenPolicy = policyUrgent;
      } else if (c.categoryId === catRoads.id) {
        chosenPolicy = policyRoads;
      } else if (c.categoryId === catGarbage.id) {
        chosenPolicy = policySanitation;
      }

      const clockStart = c.createdAt;
      const respDeadline = new Date(clockStart.getTime() + chosenPolicy.responseTargetHours * 3600000);
      const resDeadline = new Date(clockStart.getTime() + chosenPolicy.resolutionTargetHours * 3600000);
      const isResolved =
        c.status === ComplaintStatus.RESOLVED ||
        c.status === ComplaintStatus.VERIFIED ||
        c.status === ComplaintStatus.CLOSED;

      let slaStatus = SlaStatus.ON_TRACK;
      if (isResolved) {
        slaStatus = SlaStatus.RESOLVED_ON_TIME;
      }

      await prisma.complaintSla.create({
        data: {
          complaintId: c.id,
          policyId: chosenPolicy.id,
          policyName: chosenPolicy.name,
          responseTargetHours: chosenPolicy.responseTargetHours,
          resolutionTargetHours: chosenPolicy.resolutionTargetHours,
          clockStartedAt: clockStart,
          originalResponseDeadline: respDeadline,
          originalResolutionDeadline: resDeadline,
          currentResponseDeadline: respDeadline,
          currentResolutionDeadline: resDeadline,
          respondedAt: c.acceptedAt || c.assignedAt || null,
          isResponseOverdue: false,
          isResolutionOverdue: false,
          slaStatus,
        },
      });
    }
  }

  // 13.2 Seed Specific Realistic Demonstration Scenarios:
  const existingOverdueComplaint = await prisma.complaint.findFirst({
    where: { trackingId: 'CIV-2026-OVERDUE-01' },
  });

  if (!existingOverdueComplaint) {
    const overdueCreated = new Date(Date.now() - 5 * 24 * 3600000); // 5 days ago
    const overdueResDeadline = new Date(Date.now() - 2 * 24 * 3600000); // 2 days ago (breached!)

    const overdueComp = await prisma.complaint.create({
      data: {
        trackingId: 'CIV-2026-OVERDUE-01',
        title: 'Severely Broken Drainage Canal Flooding Pedestrian Underpass',
        description: 'Storm water conduit collapsed causing 2 feet of dirty water stagnation. Pedestrians cannot access metro station entrance.',
        categoryId: catDrainage.id,
        priority: ComplaintPriority.HIGH,
        status: ComplaintStatus.IN_PROGRESS,
        citizenId: citizenPriya.id,
        assignedDepartmentId: deptWssb.id,
        assignedOfficialId: officialRajesh.id,
        locationAddress: 'Sector 4 Metro Station Pedestrian Underpass',
        locality: 'Sector 4',
        createdAt: overdueCreated,
      },
    });

    const overdueSla = await prisma.complaintSla.create({
      data: {
        complaintId: overdueComp.id,
        policyId: policyDefault.id,
        policyName: policyDefault.name,
        responseTargetHours: 24,
        resolutionTargetHours: 72,
        clockStartedAt: overdueCreated,
        originalResponseDeadline: new Date(overdueCreated.getTime() + 24 * 3600000),
        originalResolutionDeadline: overdueResDeadline,
        currentResponseDeadline: new Date(overdueCreated.getTime() + 24 * 3600000),
        currentResolutionDeadline: overdueResDeadline,
        respondedAt: new Date(overdueCreated.getTime() + 12 * 3600000),
        isResponseOverdue: false,
        isResolutionOverdue: true,
        slaStatus: SlaStatus.RESOLUTION_OVERDUE,
        estimatedCompletionDate: new Date(Date.now() + 2 * 24 * 3600000),
        estimatedCompletionNotes: 'Specialized hydraulic excavation equipment arriving tomorrow morning.',
      },
    });

    // Seed Level 2 Escalation
    const escalation = await prisma.complaintEscalation.create({
      data: {
        complaintId: overdueComp.id,
        escalationLevel: EscalationLevel.LEVEL_2_SUPERVISOR,
        triggerReason: EscalationTrigger.RESOLUTION_DEADLINE_MISSED,
        status: EscalationStatus.ACKNOWLEDGED,
        notes: 'Resolution deadline breached by 48 hours without closure. Automatically escalated to Department Supervisor.',
        isSystemGenerated: true,
        acknowledgedById: adminMeera.id,
        acknowledgedAt: new Date(Date.now() - 24 * 3600000),
        actionPlan: 'Coordinate emergency water pumping with civil defense and issue emergency procurement for conduit sleeves.',
        actionPlanRecordedById: adminMeera.id,
        actionPlanRecordedAt: new Date(Date.now() - 18 * 3600000),
      },
    });

    await prisma.escalationActionLog.create({
      data: {
        escalationId: escalation.id,
        actorId: adminMeera.id,
        action: 'SUPERVISOR_ACKNOWLEDGED',
        notes: 'Supervisor acknowledged breach and summoned site engineer for urgent debrief.',
      },
    });

    // Seed Extension Request
    await prisma.slaExtensionRequest.create({
      data: {
        complaintId: overdueComp.id,
        complaintSlaId: overdueSla.id,
        requestedByOfficialId: officialRajesh.id,
        previousResolutionDeadline: overdueResDeadline,
        requestedResolutionDeadline: new Date(Date.now() + 3 * 24 * 3600000),
        reason: 'Groundwater table influx requires 48 hours continuous de-watering before reinforced concrete placement.',
        status: ExtensionRequestStatus.PENDING,
      },
    });
  }

  // ==========================================
  // 14. Demo Complaints Status History & Activity Logs
  // ==========================================
  console.log('[Civora Seed] Seeding status history and activity logs for demo complaints...');
  
  const h7 = await prisma.complaintStatusHistory.count({ where: { complaintId: complaint7.id } });
  if (h7 === 0) {
    await prisma.complaintStatusHistory.createMany({
      data: [
        {
          complaintId: complaint7.id,
          fromStatus: null,
          toStatus: ComplaintStatus.SUBMITTED,
          changedById: demoCitizen.id,
          reasonOrRemarks: 'Citizen lodged urgent hazard report via portal with photo evidence.',
          createdAt: new Date('2026-10-17T15:20:00Z'),
        },
        {
          complaintId: complaint7.id,
          fromStatus: ComplaintStatus.SUBMITTED,
          toStatus: ComplaintStatus.UNDER_REVIEW,
          changedById: demoAdmin.id,
          reasonOrRemarks: 'Dispatched to field inspection team. Priority confirmed as HIGH due to school transit zone.',
          createdAt: new Date('2026-10-18T09:00:00Z'),
        },
        {
          complaintId: complaint7.id,
          fromStatus: ComplaintStatus.UNDER_REVIEW,
          toStatus: ComplaintStatus.ASSIGNED,
          changedById: demoAdmin.id,
          reasonOrRemarks: 'Assigned to PWD Division 2 and Assistant Executive Engineer Priya Verma.',
          createdAt: new Date('2026-10-18T10:30:00Z'),
        },
        {
          complaintId: complaint7.id,
          fromStatus: ComplaintStatus.ASSIGNED,
          toStatus: ComplaintStatus.IN_PROGRESS,
          changedById: demoOfficial.id,
          reasonOrRemarks: 'Milling machine and hot-mix asphalt paver crew mobilized to school frontage.',
          createdAt: new Date('2026-10-19T08:00:00Z'),
        },
      ],
    });
  }

  const h12 = await prisma.complaintStatusHistory.count({ where: { complaintId: complaint12.id } });
  if (h12 === 0) {
    await prisma.complaintStatusHistory.createMany({
      data: [
        {
          complaintId: complaint12.id,
          fromStatus: null,
          toStatus: ComplaintStatus.SUBMITTED,
          changedById: demoCitizen.id,
          reasonOrRemarks: 'Pothole cluster reported on 100 Feet Road.',
          createdAt: new Date('2026-10-10T14:10:00Z'),
        },
        {
          complaintId: complaint12.id,
          fromStatus: ComplaintStatus.SUBMITTED,
          toStatus: ComplaintStatus.ASSIGNED,
          changedById: demoAdmin.id,
          reasonOrRemarks: 'Assigned to PWD division for quick response.',
          createdAt: new Date('2026-10-11T12:00:00Z'),
        },
        {
          complaintId: complaint12.id,
          fromStatus: ComplaintStatus.ASSIGNED,
          toStatus: ComplaintStatus.RESOLVED,
          changedById: demoOfficial.id,
          reasonOrRemarks: 'Cold-mix asphalt patch applied by emergency mobile unit.',
          createdAt: new Date('2026-10-13T16:00:00Z'),
        },
        {
          complaintId: complaint12.id,
          fromStatus: ComplaintStatus.RESOLVED,
          toStatus: ComplaintStatus.REOPENED,
          changedById: demoCitizen.id,
          reasonOrRemarks: 'Cold patch disintegrated within 48 hours of rain. Crater is even wider now. Need hot-mix rolling.',
          createdAt: new Date('2026-10-16T11:20:00Z'),
        },
      ],
    });
  }

  const h13 = await prisma.complaintStatusHistory.count({ where: { complaintId: complaint13.id } });
  if (h13 === 0) {
    await prisma.complaintStatusHistory.createMany({
      data: [
        {
          complaintId: complaint13.id,
          fromStatus: null,
          toStatus: ComplaintStatus.SUBMITTED,
          changedById: demoCitizen.id,
          reasonOrRemarks: 'Stormwater canal silt accumulation reported.',
          createdAt: new Date('2026-10-01T11:00:00Z'),
        },
        {
          complaintId: complaint13.id,
          fromStatus: ComplaintStatus.SUBMITTED,
          toStatus: ComplaintStatus.ASSIGNED,
          changedById: demoAdmin.id,
          reasonOrRemarks: 'Assigned to WSSB Stormwater Maintenance team.',
          createdAt: new Date('2026-10-02T11:00:00Z'),
        },
        {
          complaintId: complaint13.id,
          fromStatus: ComplaintStatus.ASSIGNED,
          toStatus: ComplaintStatus.IN_PROGRESS,
          changedById: demoOfficial.id,
          reasonOrRemarks: 'Excavator and suction trucks clearing debris.',
          createdAt: new Date('2026-10-04T09:00:00Z'),
        },
        {
          complaintId: complaint13.id,
          fromStatus: ComplaintStatus.IN_PROGRESS,
          toStatus: ComplaintStatus.RESOLVED,
          changedById: demoOfficial.id,
          reasonOrRemarks: '450m canal channel cleared and desilted.',
          createdAt: new Date('2026-10-06T17:00:00Z'),
        },
        {
          complaintId: complaint13.id,
          fromStatus: ComplaintStatus.RESOLVED,
          toStatus: ComplaintStatus.VERIFIED,
          changedById: demoCitizen.id,
          reasonOrRemarks: 'Inspected site personally. Drain is completely cleared of silt and water flow is unobstructed. Great work.',
          createdAt: new Date('2026-10-07T10:30:00Z'),
        },
      ],
    });
  }

  // ==========================================
  // 15. Evidence Documents & Attachments
  // ==========================================
  console.log('[Civora Seed] Seeding evidence documents and resolution proof...');
  const doc7 = await prisma.document.findFirst({ where: { complaintId: complaint7.id } });
  if (!doc7) {
    await prisma.document.create({
      data: {
        fileName: 'school_pothole_crater_evidence.jpg',
        storageKey: 'evidence/complaints/CIV-2026-00201/school_pothole_crater_evidence.jpg',
        mimeType: 'image/jpeg',
        fileSize: BigInt(342150),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        evidencePurpose: EvidencePurpose.CITIZEN_SUPPORTING,
        visibility: DocumentVisibility.PUBLIC,
        reviewStatus: EvidenceReviewStatus.VERIFIED,
        uploaderId: demoCitizen.id,
        reviewedById: demoAdmin.id,
        reviewedAt: new Date('2026-10-18T09:30:00Z'),
        description: 'Photograph of 1.4m wide road crater directly outside St. Jude School front gate.',
        complaintId: complaint7.id,
      },
    });
  }

  const doc13 = await prisma.document.findFirst({ where: { complaintId: complaint13.id } });
  if (!doc13) {
    await prisma.document.create({
      data: {
        fileName: 'stormwater_desilted_completion_photo.jpg',
        storageKey: 'evidence/complaints/CIV-2026-00207/stormwater_desilted_completion_photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: BigInt(412890),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        evidencePurpose: EvidencePurpose.RESOLUTION_PROOF,
        visibility: DocumentVisibility.PUBLIC,
        reviewStatus: EvidenceReviewStatus.VERIFIED,
        uploaderId: demoOfficial.id,
        reviewedById: demoAdmin.id,
        reviewedAt: new Date('2026-10-06T18:00:00Z'),
        description: 'Official completion photograph showing unobstructed canal bed and gradient.',
        complaintId: complaint13.id,
      },
    });
  }

  const doc16 = await prisma.document.findFirst({
    where: { complaintId: complaint16.id, fileName: 'gne_loo.png' },
  });
  if (!doc16) {
    await prisma.document.create({
      data: {
        fileName: 'gne_loo.png',
        storageKey: 'evidence/complaints/CIV-2026-G3NFZ/gne_loo.png',
        mimeType: 'image/png',
        fileSize: BigInt(198540),
        documentCategory: DocumentCategory.COMPLAINT_EVIDENCE,
        evidencePurpose: EvidencePurpose.CITIZEN_SUPPORTING,
        visibility: DocumentVisibility.PUBLIC,
        reviewStatus: EvidenceReviewStatus.PENDING_REVIEW,
        uploaderId: demoCitizen.id,
        description: 'Citizen photograph of collapsed precast culvert slab over drainage channel.',
        complaintId: complaint16.id,
      },
    });
  }

  // ==========================================
  // 16. Citizen-Official Interactive Messages
  // ==========================================
  console.log('[Civora Seed] Seeding interactive citizen-official messages...');
  const msgCount7 = await prisma.complaintMessage.count({ where: { complaintId: complaint7.id } });
  if (msgCount7 === 0) {
    await prisma.complaintMessage.createMany({
      data: [
        {
          complaintId: complaint7.id,
          senderId: demoCitizen.id,
          message: 'The pothole is directly outside the school crossing gate. Morning buses have to swerve into oncoming traffic. Please expedite.',
          createdAt: new Date('2026-10-17T15:25:00Z'),
        },
        {
          complaintId: complaint7.id,
          senderId: demoOfficial.id,
          message: 'Site inspection completed this morning. PWD cold milling unit and hot-mix paver scheduled for tomorrow 10:00 AM.',
          createdAt: new Date('2026-10-18T11:00:00Z'),
        },
        {
          complaintId: complaint7.id,
          senderId: demoCitizen.id,
          message: 'Thank you Engineer Priya. Parents will be very relieved to see this addressed.',
          createdAt: new Date('2026-10-18T11:30:00Z'),
        },
      ],
    });
  }

  // ==========================================
  // 17. User Notifications
  // ==========================================
  console.log('[Civora Seed] Seeding user notifications for all personas...');
  const notifCount = await prisma.notification.count({
    where: { userId: demoCitizen.id },
  });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: demoCitizen.id,
          type: NotificationType.COMPLAINT_SUBMITTED,
          title: 'Complaint Registered',
          message: 'Your report on St. Jude School potholes has been registered with tracking ID CIV-2026-00201.',
          actionUrl: '/track?id=CIV-2026-00201',
          createdAt: new Date('2026-10-17T15:20:00Z'),
        },
        {
          userId: demoCitizen.id,
          type: NotificationType.STATUS_CHANGED,
          title: 'Work In Progress',
          message: 'CIV-2026-00201 has been moved to IN_PROGRESS. Asphalt milling equipment deployed.',
          actionUrl: '/track?id=CIV-2026-00201',
          createdAt: new Date('2026-10-19T08:00:00Z'),
        },
        {
          userId: demoCitizen.id,
          type: NotificationType.RESOLUTION_SUBMITTED,
          title: 'Resolution Ready for Verification',
          message: 'Drain desilting for CIV-2026-00207 has been marked RESOLVED. Please verify the work.',
          actionUrl: '/track?id=CIV-2026-00207',
          createdAt: new Date('2026-10-06T17:00:00Z'),
        },
        {
          userId: demoCitizen.id,
          type: NotificationType.MESSAGE_RECEIVED,
          title: 'New Official Message',
          message: 'Official Priya Verma replied to your message on CIV-2026-00201.',
          actionUrl: '/track?id=CIV-2026-00201',
          createdAt: new Date('2026-10-18T11:00:00Z'),
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: demoOfficial.id,
          type: NotificationType.DEPARTMENT_ASSIGNED,
          title: 'New Department Assignment',
          message: 'High priority complaint CIV-2026-00201 (School Road cratering) assigned to your queue.',
          actionUrl: '/official/workspace',
          createdAt: new Date('2026-10-18T10:30:00Z'),
        },
        {
          userId: demoOfficial.id,
          type: NotificationType.COMPLAINT_REOPENED,
          title: 'Complaint Reopened by Citizen',
          message: 'Citizen Aarav Sharma reopened CIV-2026-00206 with feedback regarding asphalt patch durability.',
          actionUrl: '/official/workspace',
          createdAt: new Date('2026-10-16T11:20:00Z'),
        },
        {
          userId: demoOfficial.id,
          type: NotificationType.SLA_WARNING,
          title: 'SLA Target Warning',
          message: 'Resolution target for CIV-2026-00101 is approaching in 18 hours.',
          actionUrl: '/sla',
          createdAt: new Date('2026-10-19T09:00:00Z'),
        },
        {
          userId: demoOfficial.id,
          type: NotificationType.MESSAGE_RECEIVED,
          title: 'Citizen Message Received',
          message: 'Aarav Sharma sent a message on CIV-2026-00201.',
          actionUrl: '/official/workspace',
          createdAt: new Date('2026-10-18T11:30:00Z'),
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: demoContractor.id,
          type: NotificationType.TENDER_PUBLISHED,
          title: 'New Public Tender Published',
          message: 'Tender TND-2026-0001 (Bituminous Resurfacing - Corridor 4) is open for bidding.',
          actionUrl: '/tenders',
          createdAt: new Date('2026-10-10T10:00:00Z'),
        },
        {
          userId: demoContractor.id,
          type: NotificationType.CONTRACT_AWARDED,
          title: 'Tender Contract Awarded',
          message: 'Congratulations! Your bid BID-2026-0001 was accepted for Tender TND-2026-0001.',
          actionUrl: '/contractor?tab=bids',
          createdAt: new Date('2026-10-15T10:00:00Z'),
        },
        {
          userId: demoContractor.id,
          type: NotificationType.MILESTONE_APPROVED,
          title: 'Milestone Claim Approved',
          message: 'Milestone 1 for Work Order WO-2026-001 has been approved for payment release.',
          actionUrl: '/contractor?tab=milestones',
          createdAt: new Date('2026-10-18T16:00:00Z'),
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: demoAdmin.id,
          type: NotificationType.SYSTEM_ALERT,
          title: 'System Health & SLA Engine Alert',
          message: 'Automated evaluation complete: 1 complaint escalated to Level 2 supervisor.',
          actionUrl: '/admin/system',
          createdAt: new Date('2026-10-20T00:00:00Z'),
        },
        {
          userId: demoAdmin.id,
          type: NotificationType.EVIDENCE_UPLOADED,
          title: 'Evidence Pending Review',
          message: 'New citizen evidence photo uploaded for CIV-2026-00206 awaiting moderation.',
          actionUrl: '/admin/complaints',
          createdAt: new Date('2026-10-18T09:30:00Z'),
        },
      ],
    });
  }

  console.log('[Civora Seed] Database seeding completed successfully! All records verified.');
}

seed()
  .catch((e) => {
    console.error('[Civora Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
