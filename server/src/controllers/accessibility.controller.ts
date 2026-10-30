import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  updateAccessibilityPreferencesSchema,
  SUPPORTED_LANGUAGES,
} from '../validation/accessibility.validation.js';

export const DEFAULT_ACCESSIBILITY_PREFERENCES = {
  language: 'en',
  textSize: 'normal',
  reducedMotion: false,
  highContrast: false,
};

export const SUPPORTED_LANGUAGES_METADATA = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    dir: 'ltr',
    isDefault: true,
    completeness: 100,
    regionalCoverage: 'Pan-India / Administrative',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    dir: 'ltr',
    isDefault: false,
    completeness: 100,
    regionalCoverage: 'Official / Northern & Central India',
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    dir: 'ltr',
    isDefault: false,
    completeness: 100,
    regionalCoverage: 'Punjab & Regional Civic Communities',
  },
];

/**
 * GET /api/accessibility/languages
 * Public directory of supported civic languages with native metadata
 */
export async function getSupportedLanguages(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      languages: SUPPORTED_LANGUAGES_METADATA,
      defaultLanguage: 'en',
      totalCount: SUPPORTED_LANGUAGES_METADATA.length,
    },
  });
}

/**
 * GET /api/accessibility/preferences
 * Retrieve current user's accessibility preferences (or standard defaults for visitors)
 */
export async function getUserAccessibilityPreferences(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(200).json({
        success: true,
        data: {
          preferences: {
            ...DEFAULT_ACCESSIBILITY_PREFERENCES,
            isDefault: true,
          },
        },
      });
    }

    const pref = await prisma.userAccessibilityPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return res.status(200).json({
        success: true,
        data: {
          preferences: {
            ...DEFAULT_ACCESSIBILITY_PREFERENCES,
            isDefault: true,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        preferences: {
          id: pref.id,
          userId: pref.userId,
          language: pref.language,
          textSize: pref.textSize,
          reducedMotion: pref.reducedMotion,
          highContrast: pref.highContrast,
          updatedAt: pref.updatedAt,
          isDefault: false,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/accessibility/preferences
 * Update current authenticated user's accessibility and language preferences
 */
export async function updateUserAccessibilityPreferences(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to persist account accessibility preferences.',
        },
      });
    }

    const parseResult = updateAccessibilityPreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid accessibility preferences payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { language, textSize, reducedMotion, highContrast } = parseResult.data;

    const updated = await prisma.userAccessibilityPreference.upsert({
      where: { userId },
      create: {
        userId,
        language: language ?? DEFAULT_ACCESSIBILITY_PREFERENCES.language,
        textSize: textSize ?? DEFAULT_ACCESSIBILITY_PREFERENCES.textSize,
        reducedMotion: reducedMotion ?? DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
        highContrast: highContrast ?? DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
      },
      update: {
        ...(language !== undefined && { language }),
        ...(textSize !== undefined && { textSize }),
        ...(reducedMotion !== undefined && { reducedMotion }),
        ...(highContrast !== undefined && { highContrast }),
      },
    });

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        action: 'UPDATE',
        entityType: 'USER_ACCESSIBILITY_PREFERENCE',
        entityId: updated.id,
        actorId: userId,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        details: {
          language: updated.language,
          textSize: updated.textSize,
          reducedMotion: updated.reducedMotion,
          highContrast: updated.highContrast,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Accessibility preferences updated successfully.',
      data: {
        preferences: {
          id: updated.id,
          userId: updated.userId,
          language: updated.language,
          textSize: updated.textSize,
          reducedMotion: updated.reducedMotion,
          highContrast: updated.highContrast,
          updatedAt: updated.updatedAt,
          isDefault: false,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
