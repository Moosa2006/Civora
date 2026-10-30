import { en, type TranslationDictionary } from './locales/en.js';
import { hi } from './locales/hi.js';
import { pa } from './locales/pa.js';

export const SUPPORTED_LOCALES = ['en', 'hi', 'pa'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleMetadata {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  script: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALE_INFO: Record<SupportedLocale, LocaleMetadata> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    dir: 'ltr',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    dir: 'ltr',
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    dir: 'ltr',
  },
};

export const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en,
  hi,
  pa,
};

/**
 * Safely resolves a dot-notation key (e.g. 'common.submit' or 'complaints.titleLabel')
 * Falls back to English if the key is missing in the chosen language.
 */
export function resolveTranslationKey(
  locale: SupportedLocale,
  keyPath: string,
  params?: Record<string, string | number>
): string {
  const currentDict = dictionaries[locale] || dictionaries.en;
  const parts = keyPath.split('.');

  // 1. Try active locale
  let val: any = currentDict;
  for (const part of parts) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      val = undefined;
      break;
    }
  }

  // 2. Fall back to English if missing or not string
  if (typeof val !== 'string') {
    let fallbackVal: any = dictionaries.en;
    for (const part of parts) {
      if (fallbackVal && typeof fallbackVal === 'object' && part in fallbackVal) {
        fallbackVal = fallbackVal[part];
      } else {
        fallbackVal = undefined;
        break;
      }
    }
    val = typeof fallbackVal === 'string' ? fallbackVal : keyPath;
  }

  // 3. Interpolate variables e.g. {{name}} or {name}
  if (params && typeof val === 'string') {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      val = (val as string)
        .replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(paramVal))
        .replace(new RegExp(`{\\s*${paramKey}\\s*}}`, 'g'), String(paramVal));
    });
  }

  return typeof val === 'string' ? val : keyPath;
}

/**
 * Locale-aware date formatting
 */
export function formatLocaleDate(
  date: Date | string | number,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const intlLocale = locale === 'hi' ? 'hi-IN' : locale === 'pa' ? 'pa-IN' : 'en-IN';
    return new Intl.DateTimeFormat(intlLocale, options).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Locale-aware number formatting
 */
export function formatLocaleNumber(
  num: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions
): string {
  try {
    const intlLocale = locale === 'hi' ? 'hi-IN' : locale === 'pa' ? 'pa-IN' : 'en-IN';
    return new Intl.NumberFormat(intlLocale, options).format(num);
  } catch {
    return String(num);
  }
}
