import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { UserRole, AccountStatus } from '@prisma/client';

async function setup() {
  console.log('[Setup Legitimate Roles] Setting up verified accounts for operational verification...');

  // 1. Official Rajesh Kumar
  const deptPwd = await prisma.department.findUnique({ where: { code: 'PWD' } });
  if (deptPwd) {
    const officialPassHash = await hashPassword('OfficialPass#2026!');
    const official = await prisma.user.upsert({
      where: { email: 'rajesh.kumar@civora.gov' },
      update: {
        passwordHash: officialPassHash,
        accountStatus: AccountStatus.ACTIVE,
        departmentId: deptPwd.id,
      },
      create: {
        email: 'rajesh.kumar@civora.gov',
        name: 'Engineer Rajesh Kumar',
        phone: '+91 98765 43220',
        passwordHash: officialPassHash,
        role: UserRole.GOVERNMENT_OFFICIAL,
        accountStatus: AccountStatus.ACTIVE,
        departmentId: deptPwd.id,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Official account ready: ${official.email} (Dept: PWD)`);
  }

  // 2. Contractor Sanjay Hegde (Apex Urban Infrastructure Ltd)
  const contractorApex = await prisma.contractor.findUnique({
    where: { registrationNumber: 'REG-2024-KA-8810' },
  });

  if (contractorApex) {
    const contractorPassHash = await hashPassword('ContractorPass#2026!');
    const contractor = await prisma.user.upsert({
      where: { email: 'sanjay.hegde@apexinfra.in' },
      update: {
        passwordHash: contractorPassHash,
        accountStatus: AccountStatus.ACTIVE,
        contractorId: contractorApex.id,
      },
      create: {
        email: 'sanjay.hegde@apexinfra.in',
        name: 'Sanjay Hegde',
        phone: '+91 98450 11223',
        passwordHash: contractorPassHash,
        role: UserRole.CONTRACTOR,
        accountStatus: AccountStatus.ACTIVE,
        contractorId: contractorApex.id,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Contractor account ready: ${contractor.email} (Company: ${contractorApex.name})`);
  }

  // 3. Citizen Aarav Sharma
  const citizenPassHash = await hashPassword('CitizenPass#2026!');
  const citizen = await prisma.user.upsert({
    where: { email: 'aarav.sharma@civora.net' },
    update: {
      passwordHash: citizenPassHash,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: 'aarav.sharma@civora.net',
      name: 'Aarav Sharma',
      phone: '+91 98765 43210',
      passwordHash: citizenPassHash,
      role: UserRole.CITIZEN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Citizen account ready: ${citizen.email}`);
}

setup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

