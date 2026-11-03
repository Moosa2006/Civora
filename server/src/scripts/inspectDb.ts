import { prisma } from '../lib/prisma.js';

async function inspect() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      createdAt: true,
      _count: {
        select: {
          submittedComplaints: true,
          assignedComplaints: true,
          submittedBids: true,
          auditEvents: true,
        },
      },
    },
  });

  console.log(`TOTAL_USERS: ${users.length}`);
  for (const u of users) {
    console.log(JSON.stringify(u));
  }

  const complaintsCount = await prisma.complaint.count();
  const tendersCount = await prisma.tender.count();
  const bidsCount = await prisma.tenderBid.count();
  const departmentsCount = await prisma.department.count();
  const categoriesCount = await prisma.complaintCategory.count();

  console.log({
    complaintsCount,
    tendersCount,
    bidsCount,
    departmentsCount,
    categoriesCount,
  });
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
