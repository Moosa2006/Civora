import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  LOCALE_INFO,
  type LocaleMetadata,
  resolveTranslationKey,
  formatLocaleDate,
  formatLocaleNumber,
} from '../i18n/index.js';
import { useAuth } from './useAuth.js';

export interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  availableLocales: LocaleMetadata[];
  isChangingLocale: boolean;
}

export const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'civora_language';

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';

  // 1. Check localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
    return saved as SupportedLocale;
  }

  // 2. Check navigator.language
  const browserLang = navigator.language?.toLowerCase() || '';
  if (browserLang.startsWith('hi')) return 'hi';
  if (browserLang.startsWith('pa')) return 'pa';

  // 3. Default to English
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectInitialLocale);
  const [isChangingLocale, setIsChangingLocale] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Sync HTML document attributes on mount & locale change
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  // Sync authenticated user's remote preference when logging in
  useEffect(() => {
    async function syncRemotePreference() {
      if (!isAuthenticated || !user) return;
      try {
        const res = await fetch('/api/accessibility/preferences', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.preferences?.language) {
            const remoteLang = json.data.preferences.language as SupportedLocale;
            if ((SUPPORTED_LOCALES as readonly string[]).includes(remoteLang)) {
              setLocaleState(remoteLang);
              localStorage.setItem(STORAGE_KEY, remoteLang);
            }
          }
        }
      } catch {
        // Silently continue with local preference if server is unreachable
      }
    }

    syncRemotePreference();
  }, [isAuthenticated, user]);

  const setLocale = useCallback(
    async (newLocale: SupportedLocale) => {
      if (!SUPPORTED_LOCALES.includes(newLocale)) return;

      setIsChangingLocale(true);
      setLocaleState(newLocale);
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;

      // Persist to backend if authenticated
      if (isAuthenticated) {
        try {
          await fetch('/api/accessibility/preferences', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ language: newLocale }),
          });
        } catch {
          // Local state already updated
        }
      }

      setIsChangingLocale(false);
    },
    [isAuthenticated]
  );

  const t = useCallback(
    (keyPath: string, params?: Record<string, string | number>) => {
      return resolveTranslationKey(locale, keyPath, params);
    },
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      return formatLocaleDate(date, locale, options);
    },
    [locale]
  );

  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions) => {
      return formatLocaleNumber(num, locale, options);
    },
    [locale]
  );

  const availableLocales = Object.values(LOCALE_INFO);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        formatDate,
        formatNumber,
        availableLocales,
        isChangingLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
