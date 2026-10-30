import app from './app.js';
import { prisma } from './lib/prisma.js';
import { ensureBaselineMetadata } from './lib/metadataBootstrap.js';

const PORT = process.env.PORT || 5000;

let server: ReturnType<typeof app.listen> | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[Civora Backend] Server running on http://localhost:${PORT}`);
    console.log(`[Civora Backend] Health endpoint: http://localhost:${PORT}/api/health`);

    // Ensure baseline municipal metadata asynchronously on startup
    ensureBaselineMetadata().catch((err) => {
      console.warn('[Civora Backend] Background metadata bootstrap deferred:', err?.message || err);
    });
  });

  const handleShutdown = async (signal: string) => {
    console.log(`[Civora Backend] Received ${signal}. Closing server gracefully...`);
    if (server) {
      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log('[Civora Backend] Prisma disconnected. Process exiting.');
          process.exit(0);
        } catch (err) {
          console.error('[Civora Backend] Error during database disconnect:', err);
          process.exit(1);
        }
      });
    } else {
      await prisma.$disconnect();
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void handleShutdown('SIGINT'));
  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
}

export default app;
// Civora Server Entry
