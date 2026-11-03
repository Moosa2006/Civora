import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { optionalAuthenticateUser } from './middleware/auth.middleware.js';
import { maintenanceModeMiddleware } from './middleware/maintenanceMode.middleware.js';

dotenv.config();

export function createApp() {
  const app = express();

  // Trust reverse proxy (Render & Vercel) for accurate client IP identification and secure cookies
  app.set('trust proxy', 1);

  // Attach safe correlation ID to every request
  app.use(requestIdMiddleware);

  // S04 & S05 Remediation: Enforce standard security and privacy headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    next();
  });

  // Dynamic and resilient CORS configuration supporting production, custom, and preview domains
  const clientOriginEnv = process.env.CLIENT_ORIGIN || 'https://civora-tau.vercel.app';
  const configuredOrigins = clientOriginEnv
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowedOrigins = new Set([
    'https://civora-tau.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
    ...configuredOrigins,
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.trim().replace(/\/+$/, '');
        if (
          allowedOrigins.has(normalized) ||
          /^https:\/\/civora-[a-z0-9-]+.*\.vercel\.app$/.test(normalized) ||
          /^https:\/\/.*\.vercel\.app$/.test(normalized)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    })
  );

  // S03 Remediation: CSRF Origin Protection on all state-changing mutations
  app.use((req, res, next) => {
    const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    if (mutationMethods.has(req.method)) {
      const originHeader = req.headers.origin;
      if (originHeader) {
        const normalized = originHeader.trim().replace(/\/+$/, '');
        const isAllowed =
          allowedOrigins.has(normalized) ||
          /^https:\/\/civora-[a-z0-9-]+.*\.vercel\.app$/.test(normalized) ||
          /^https:\/\/.*\.vercel\.app$/.test(normalized);

        if (!isAllowed) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'CSRF_ORIGIN_DENIED',
              message: 'Request origin is not authorized for state-changing mutations.',
            },
          });
        }
      }
    }
    next();
  });
  app.use(express.json());
  app.use(cookieParser());

  // Populate optional user context for maintenance mode checks
  app.use(optionalAuthenticateUser);
  app.use(maintenanceModeMiddleware);

  // Mount API Router
  app.use('/api', apiRouter);

  // 404 Handler for Unmatched Endpoints
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
