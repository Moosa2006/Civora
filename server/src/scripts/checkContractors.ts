import { prisma } from '../lib/prisma.js';

async function checkContractors() {
  const contractors = await prisma.contractor.findMany({
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
        },
      },
    },
  });
  console.log('Contractors in DB:', JSON.stringify(contractors, null, 2));
}

checkContractors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

