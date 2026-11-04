import { useTheme } from '../../context/useTheme.js';
import { useTranslation } from '../../context/useTranslation.js';

export interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const label = isDark ? t('nav.switchToLight') : t('nav.switchToDark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={`
        civora-liquid-btn
        ${showLabel ? 'civora-liquid-btn--secondary px-3 py-2 w-full justify-between' : 'civora-liquid-btn--ghost p-2 min-w-[36px]'}
        gap-2 rounded-lg min-h-[36px]
        ${className}
      `.trim()}
    >
      {showLabel && (
        <span className="text-xs font-medium">
          {isDark ? t('accessibility.themeDark') : t('accessibility.themeLight')}
        </span>
      )}

      <span className="relative inline-flex items-center justify-center w-5 h-5">
        {isDark ? (
          /* Clean Sun Icon (switch to Light Mode) */
          <svg
            className="w-5 h-5 text-[#FCD34D] transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" strokeWidth="2" />
            <path
              strokeLinecap="round"
              strokeWidth="2"
              d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
            />
          </svg>
        ) : (
          /* Clean Moon Icon (switch to Dark Mode) */
          <svg
            className="w-5 h-5 text-[#374151] transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

