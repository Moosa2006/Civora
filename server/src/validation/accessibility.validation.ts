import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const updateAccessibilityPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    message: 'Language must be one of: en, hi, pa',
  }).optional(),
  textSize: z.enum(TEXT_SIZES, {
    message: 'Text size must be one of: normal, large, larger',
  }).optional(),
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
});

export type UpdateAccessibilityPreferencesInput = z.infer<typeof updateAccessibilityPreferencesSchema>;
