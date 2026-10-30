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

  // Attach safe correlation ID to every request
  app.use(requestIdMiddleware);

  // Middleware
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
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
