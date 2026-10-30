import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

import { z } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const correlationId = req.correlationId;

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    const issue = err.issues?.[0];
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: issue ? issue.message : 'Invalid request data.',
        details: err.flatten().fieldErrors,
        correlationId,
      },
    });
  }

  // Log internal error for debugging (without leaking to client)
  console.error(`[Civora Server Error ${correlationId || 'N/A'}]:`, err);

  // Prisma initialization errors (connection string parsing, unreachable host, auth failures)
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[Civora Database Initialization Error ${correlationId || 'N/A'}]:`, err.message.replace(/postgresql:\/\/[^@\s]+@[^\s]+/gi, 'postgresql://***@***'));
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is temporarily unavailable. Please try again shortly.',
        correlationId,
      },
    });
  }

  // Prisma-specific known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P1xxx codes denote database connection, authentication, and reachability issues
    if (err.code.startsWith('P1')) {
      console.error(`[Civora Database Connection Error ${correlationId || 'N/A'}]:`, err.code, err.message);
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database service is temporarily unavailable. Please try again shortly.',
          correlationId,
        },
      });
    }

    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `A record with this ${target} already exists.`,
          correlationId,
        },
      });
    }

    if (err.code === 'P2025' || err.code === 'P2023') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record does not exist.',
          correlationId,
        },
      });
    }
  }

  // Handle generic errors safely without leaking internal secrets, file paths, or DB URLs
  const isDev = process.env.NODE_ENV === 'development';
  let message = 'An unexpected internal server error occurred.';

  if (isDev && err instanceof Error) {
    // Sanitize message to strip local file paths, connection strings, or internal invocation stacks
    let raw = err.message.replace(/postgresql:\/\/[^@\s]+@[^\s]+/gi, 'postgresql://***@***');
    raw = raw.replace(/[A-Za-z]:\\[^:\s\n]+/g, '[internal-path]');
    if (raw.includes('Invalid `prisma.')) {
      raw = 'A database query operation could not be processed.';
    }
    message = raw;
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      correlationId,
    },
  });
}

