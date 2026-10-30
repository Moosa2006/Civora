import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth.js';

export type TextSizeOption = 'normal' | 'large' | 'larger';

export interface AccessibilityPreferences {
  textSize: TextSizeOption;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface AccessibilityContextType extends AccessibilityPreferences {
  setTextSize: (size: TextSizeOption) => Promise<void>;
  setReducedMotion: (enabled: boolean) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isSystemReducedMotion: boolean;
}

export const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

const STORAGE_KEY = 'civora_a11y_prefs';

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textSize: 'normal',
  reducedMotion: false,
  highContrast: false,
};

function getInitialPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        textSize: ['normal', 'large', 'larger'].includes(parsed.textSize)
          ? parsed.textSize
          : 'normal',
        reducedMotion: Boolean(parsed.reducedMotion),
        highContrast: Boolean(parsed.highContrast),
      };
    }
  } catch {
    // Fall back to system defaults
  }

  // Check OS reduced motion preference
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return {
    ...DEFAULT_PREFERENCES,
    reducedMotion: Boolean(prefersReduced),
  };
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(getInitialPreferences);
  const [isSystemReducedMotion, setIsSystemReducedMotion] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Detect OS media query changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsSystemReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsSystemReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Synchronize HTML element attributes on state change
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    root.dataset.textSize = prefs.textSize;
    root.dataset.reducedMotion = String(prefs.reducedMotion || isSystemReducedMotion);
    root.dataset.highContrast = String(prefs.highContrast);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Local storage unavailable
    }
  }, [prefs, isSystemReducedMotion]);

  // Load preferences from server when logging in
  useEffect(() => {
    async function loadServerPreferences() {
      if (!isAuthenticated || !user) return;
      try {
        const res = await fetch('/api/accessibility/preferences', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.preferences && !json.data.preferences.isDefault) {
            const serverPrefs = json.data.preferences;
            setPrefs({
              textSize: ['normal', 'large', 'larger'].includes(serverPrefs.textSize)
                ? serverPrefs.textSize
                : 'normal',
              reducedMotion: Boolean(serverPrefs.reducedMotion),
              highContrast: Boolean(serverPrefs.highContrast),
            });
          }
        }
      } catch {
        // Silently continue
      }
    }

    loadServerPreferences();
  }, [isAuthenticated, user]);

  const saveToServer = useCallback(
    async (updated: Partial<AccessibilityPreferences>) => {
      if (!isAuthenticated) return;
      try {
        await fetch('/api/accessibility/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(updated),
        });
      } catch {
        // Ignore failure, local state remains
      }
    },
    [isAuthenticated]
  );

  const setTextSize = useCallback(
    async (size: TextSizeOption) => {
      setPrefs((prev) => {
        const updated = { ...prev, textSize: size };
        saveToServer({ textSize: size });
        return updated;
      });
    },
    [saveToServer]
  );

  const setReducedMotion = useCallback(
    async (enabled: boolean) => {
      setPrefs((prev) => {
        const updated = { ...prev, reducedMotion: enabled };
        saveToServer({ reducedMotion: enabled });
        return updated;
      });
    },
    [saveToServer]
  );

  const setHighContrast = useCallback(
    async (enabled: boolean) => {
      setPrefs((prev) => {
        const updated = { ...prev, highContrast: enabled };
        saveToServer({ highContrast: enabled });
        return updated;
      });
    },
    [saveToServer]
  );

  const resetToDefaults = useCallback(async () => {
    setPrefs(DEFAULT_PREFERENCES);
    await saveToServer(DEFAULT_PREFERENCES);
  }, [saveToServer]);

  return (
    <AccessibilityContext.Provider
      value={{
        ...prefs,
        setTextSize,
        setReducedMotion,
        setHighContrast,
        resetToDefaults,
        isSystemReducedMotion,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}
