import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../context/useTranslation.js';
import { announceToScreenReader } from '../ui/LiveAnnouncer.js';
import type { SupportedLocale } from '../../i18n/index.js';

export function LanguageSelector({
  compact = false,
  variant = 'forest-pill',
}: {
  compact?: boolean;
  variant?: 'default' | 'forest-pill';
}) {
  const { locale, setLocale, availableLocales, isChangingLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const currentLocaleInfo = availableLocales.find((l) => l.code === locale) || availableLocales[0];

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (code: SupportedLocale) => {
    if (code === locale) {
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    await setLocale(code);
    const targetInfo = availableLocales.find((l) => l.code === code);
    announceToScreenReader(
      `Language changed to ${targetInfo?.name || code} (${targetInfo?.nativeName || ''})`
    );
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setTimeout(() => {
        optionsRef.current[0]?.focus();
      }, 50);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % availableLocales.length;
      optionsRef.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + availableLocales.length) % availableLocales.length;
      optionsRef.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      optionsRef.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      optionsRef.current[availableLocales.length - 1]?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        id="language-selector-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current language: ${currentLocaleInfo.name}. Click to change language.`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        disabled={isChangingLocale}
        className={
          variant === 'forest-pill'
            ? 'civora-liquid-btn civora-liquid-btn--primary justify-between gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium min-h-[36px]'
            : `civora-liquid-btn civora-liquid-btn--secondary justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${compact ? 'text-[11px] px-2 py-1' : 'min-h-[36px]'}`
        }
      >
        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 opacity-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            />
          </svg>
          <span className="font-medium">{currentLocaleInfo.name}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 opacity-85 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul
          id="language-selector-listbox"
          role="listbox"
          aria-labelledby="language-selector-button"
          tabIndex={-1}
          className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-xl py-1.5 z-50 focus:outline-none"
        >
          {availableLocales.map((loc, idx) => {
            const isSelected = loc.code === locale;
            return (
              <li key={loc.code} role="presentation">
                <button
                  ref={(el) => {
                    optionsRef.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(loc.code as SupportedLocale)}
                  onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                  className={`
                    w-full text-left px-3.5 py-2 text-xs flex items-center justify-between
                    hover:bg-[#F3F4F6] dark:hover:bg-[#273548] transition-colors cursor-pointer
                    focus-visible:outline-none focus-visible:bg-[#F3F4F6] dark:focus-visible:bg-[#273548] focus-visible:ring-1 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399]
                    ${isSelected ? 'bg-[#E5ECE8] text-[#0B3D2E] dark:bg-[#34D399]/15 dark:text-[#6EE7B7] font-semibold' : 'text-[#111827] dark:text-[#F9FAFB]'}
                  `.trim()}
                >
                  <div>
                    <span className="block font-medium text-sm leading-tight">
                      {loc.nativeName}
                    </span>
                    <span className="block text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                      {loc.name} ({loc.script})
                    </span>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-[#0B3D2E] dark:text-[#34D399] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
