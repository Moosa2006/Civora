import type { Request, Response, NextFunction } from 'express';
import { UserRestrictionType } from '@prisma/client';
import { RestrictionService } from '../lib/restrictionService.js';

/**
 * Middleware factory that prevents restricted users from performing specific civic actions.
 */
export function requireNoRestriction(restrictionType: UserRestrictionType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    try {
      const check = await RestrictionService.hasActiveRestriction(req.user.id, restrictionType);
      if (check.isRestricted) {
        const expiryStr = check.expiresAt
          ? ` until ${new Date(check.expiresAt).toLocaleString()}`
          : '';

        return res.status(403).json({
          success: false,
          error: {
            code: 'USER_RESTRICTED',
            message: `Your account is temporarily restricted from this action (${restrictionType.replace(/_/g, ' ')})${expiryStr}. Reason: ${check.reason || 'Policy compliance review'}.`,
            expiresAt: check.expiresAt,
          },
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
