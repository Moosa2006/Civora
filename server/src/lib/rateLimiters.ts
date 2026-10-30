import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Creates standardized rate limiter error responses
 */
function createRateLimitHandler(actionName: string) {
  return (req: Request, res: Response) => {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many ${actionName} requests. Please slow down and try again later.`,
        retryAfterSeconds: Math.ceil(Number(res.getHeader('Retry-After')) || 60),
      },
    });
  };
}

/**
 * 1. Authentication Rate Limiter (Login, Register, Password Reset)
 * 15 requests per 15 minutes in production (elevated in test)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('authentication'),
});

/**
 * 2. Complaint Submission Limiter (Prevents automated complaint flooding)
 * 25 complaints per hour per account/IP
 */
export const complaintCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest ? 1000 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('complaint creation'),
});

/**
 * 3. Comment / Communication Limiter
 * 40 messages/comments per 15 minutes
 */
export const commentCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('commenting or messaging'),
});

/**
 * 4. Community Proposal Submission Limiter
 * 10 proposals per 24 hours
 */
export const proposalCreateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('proposal submission'),
});

/**
 * 5. Public Poll Voting Limiter
 * 30 vote actions per 15 minutes
 */
export const pollVoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('poll voting'),
});

/**
 * 6. Abuse Report Submission Limiter (Prevents malicious report flooding / harassment)
 * 20 reports per 15 minutes
 */
export const abuseReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('abuse report'),
});

/**
 * 7. Search & Geographic Query Limiter
 * 120 queries per minute
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('search query'),
});

/**
 * 8. Strict rate limiter for explicit unit test validation
 * Max 2 requests per 10 seconds to verify HTTP 429 and retry headers
 */
export const testStrictRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('test action'),
});
