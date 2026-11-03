import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolves and validates the database connection URL for PostgreSQL connection poolers (e.g. Supabase Supavisor / PgBouncer).
 *
 * When using Supabase port 6543 (Transaction Mode Pooler), Prisma MUST have `pgbouncer=true` in its query string.
 * Without `pgbouncer=true`, Prisma issues prepared statements ("s0", "s1", etc.) which collide across pooled connections,
 * resulting in PostgreSQL error 42P05: `prepared statement "s0" already exists`.
 */
function resolveDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  const isPooler = rawUrl.includes(':6543') || rawUrl.includes('pooler.supabase.com');
  const hasPgBouncer = /[?&]pgbouncer=true/i.test(rawUrl);

  if (isPooler && !hasPgBouncer) {
    const separator = rawUrl.includes('?') ? '&' : '?';
    const patchedUrl = `${rawUrl}${separator}pgbouncer=true`;
    console.log(
      '[Civora Database] Automatically appended pgbouncer=true to DATABASE_URL for transaction pooler compatibility (preventing PostgreSQL 42P05).'
    );
    // Sync process.env.DATABASE_URL so any external or sub-process references inherit it
    process.env.DATABASE_URL = patchedUrl;
    return patchedUrl;
  }

  return rawUrl;
}

const resolvedDatabaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedDatabaseUrl ? { datasourceUrl: resolvedDatabaseUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Always maintain a strict singleton across all environments (development, test, and production)
globalForPrisma.prisma = prisma;

export default prisma;
