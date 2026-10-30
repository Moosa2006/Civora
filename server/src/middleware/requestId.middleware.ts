import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

// Extend Express Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'];
  const correlationId =
    typeof existingId === 'string' && existingId.trim().length > 0
      ? existingId.trim()
      : `civ-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  return next();
}
