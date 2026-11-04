import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { announceToScreenReader } from '../components/ui/LiveAnnouncer.js';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setThemePreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'civora_theme';

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'system';
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);

  const resolvedTheme: ResolvedTheme =
    themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference;

  // Listen for OS prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Synchronize DOM attributes and localStorage whenever preference or OS theme changes
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
    try {
      if (themePreference === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, themePreference);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [themePreference, resolvedTheme]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    const nextResolved: ResolvedTheme =
      pref === 'system' ? (getSystemDark() ? 'dark' : 'light') : pref;
    applyThemeToDOM(nextResolved);
    setThemePreferenceState(pref);
    announceToScreenReader(
      pref === 'system'
        ? `Appearance set to system default (${nextResolved} mode)`
        : `Switched to ${nextResolved} mode`
    );
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    applyThemeToDOM(nextTheme);
    setThemePreferenceState(nextTheme);
    announceToScreenReader(`Switched to ${nextTheme} mode`);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
        setThemePreference,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

