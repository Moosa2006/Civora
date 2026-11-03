import { prisma } from '../lib/prisma.js';

async function listDbs() {
  const result: any = await prisma.$queryRawUnsafe(
    `SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datistemplate = false;`
  );
  console.log('DATABASES:', result);
}

listDbs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

