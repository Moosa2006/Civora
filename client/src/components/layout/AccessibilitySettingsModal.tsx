import { useState, useRef, useEffect } from 'react';
import { useAccessibility, type TextSizeOption } from '../../context/useAccessibility.js';
import { useTheme, type ThemePreference } from '../../context/useTheme.js';
import { useTranslation } from '../../context/useTranslation.js';
import { announceToScreenReader } from '../ui/LiveAnnouncer.js';
import { Button } from '../ui/Button.js';
import type { SupportedLocale } from '../../i18n/index.js';

export interface AccessibilitySettingsModalProps {
  triggerClassName?: string;
}

export function AccessibilitySettingsModal({ triggerClassName }: AccessibilitySettingsModalProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const {
    textSize,
    setTextSize,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    resetToDefaults,
  } = useAccessibility();

  const { themePreference, setThemePreference } = useTheme();
  const { locale, setLocale, availableLocales, t } = useTranslation();

  // Focus management and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTextSizeChange = async (size: TextSizeOption) => {
    await setTextSize(size);
    announceToScreenReader(
      `Text size set to ${
        size === 'normal'
          ? t('accessibility.textNormal')
          : size === 'large'
          ? t('accessibility.textLarge')
          : t('accessibility.textLarger')
      }`
    );
  };

  const handleReducedMotionToggle = async () => {
    const nextVal = !reducedMotion;
    await setReducedMotion(nextVal);
    announceToScreenReader(
      nextVal ? 'Reduced motion enabled' : 'Reduced motion disabled'
    );
  };

  const handleHighContrastToggle = async () => {
    const nextVal = !highContrast;
    await setHighContrast(nextVal);
    announceToScreenReader(
      nextVal ? 'High contrast enabled' : 'High contrast disabled'
    );
  };

  const handleReset = async () => {
    await resetToDefaults();
    setThemePreference('system');
    announceToScreenReader('Accessibility settings reset to defaults');
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        aria-label={t('accessibility.settingsTitle')}
        title={t('accessibility.settingsTitle')}
        className={triggerClassName || "civora-liquid-btn civora-liquid-btn--ghost p-2 rounded-lg min-h-[36px] min-w-[36px]"}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="4" r="2" strokeWidth="2" strokeLinecap="round" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 9h16M12 9v12M8 21l4-5 4 5"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-modal-title"
          aria-describedby="a11y-modal-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-lg bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl p-6 sm:p-8 text-[#111827] dark:text-[#F9FAFB]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] dark:border-[#374151]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5ECE8] text-[#0B3D2E] border border-[#0B3D2E]/15 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/30 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="4" r="2" strokeWidth="2" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 9h16M12 9v12M8 21l4-5 4 5"
                    />
                  </svg>
                </div>
                <div>
                  <h2
                    id="a11y-modal-title"
                    className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight leading-tight"
                  >
                    {t('accessibility.settingsTitle')}
                  </h2>
                  <p id="a11y-modal-desc" className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    {t('accessibility.settingsDesc')}
                  </p>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={handleClose}
                aria-label={t('common.close')}
                className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg min-h-[34px] min-w-[34px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Settings Content */}
            <div className="py-5 space-y-5">
              {/* 1. Theme / Appearance Selector */}
              <div>
                <label className="block text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] mb-2">
                  {t('accessibility.themeLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'light' as ThemePreference, label: t('accessibility.themeLight') },
                      { id: 'dark' as ThemePreference, label: t('accessibility.themeDark') },
                      { id: 'system' as ThemePreference, label: t('accessibility.themeSystem') },
                    ]
                  ).map((opt) => {
                    const isSelected = themePreference === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-active={isSelected}
                        aria-pressed={isSelected}
                        onClick={() => setThemePreference(opt.id)}
                        className={`civora-liquid-tab px-3 py-2.5 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399] ${
                          isSelected ? 'font-semibold' : 'text-[#111827] dark:text-[#F9FAFB]'
                        }`}
                      >
                        <span className="block text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Language Option */}
              <div>
                <label className="block text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] mb-2">
                  {t('accessibility.languageLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableLocales.map((loc) => {
                    const isSelected = loc.code === locale;
                    return (
                      <button
                        key={loc.code}
                        type="button"
                        data-active={isSelected}
                        aria-pressed={isSelected}
                        onClick={async () => {
                          await setLocale(loc.code as SupportedLocale);
                          announceToScreenReader(`Language changed to ${loc.name}`);
                        }}
                        className={`civora-liquid-tab px-3 py-2.5 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399] ${
                          isSelected ? 'font-semibold' : 'text-[#111827] dark:text-[#F9FAFB]'
                        }`}
                      >
                        <span className="block text-sm font-medium">{loc.nativeName}</span>
                        <span className="block text-[11px] opacity-75">{loc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Text Sizing */}
              <div>
                <label className="block text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] mb-2">
                  {t('accessibility.textSizeLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'normal', label: t('accessibility.textNormal'), scale: '100%' },
                      { id: 'large', label: t('accessibility.textLarge'), scale: '115%' },
                      { id: 'larger', label: t('accessibility.textLarger'), scale: '130%' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = textSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-active={isSelected}
                        aria-pressed={isSelected}
                        onClick={() => handleTextSizeChange(opt.id)}
                        className={`civora-liquid-tab px-3 py-2.5 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399] ${
                          isSelected ? 'font-semibold' : 'text-[#111827] dark:text-[#F9FAFB]'
                        }`}
                      >
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-[11px] opacity-75">{opt.scale}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Reduced Motion */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151]">
                <div className="pr-4">
                  <span className="block text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">
                    {t('accessibility.reducedMotionLabel')}
                  </span>
                  <span className="block text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    {t('accessibility.reducedMotionDesc')}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  onClick={handleReducedMotionToggle}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399]
                    ${reducedMotion ? 'bg-[#0B3D2E] dark:bg-[#10B981]' : 'bg-[#D1D5DB] dark:bg-[#374151]'}
                  `.trim()}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0
                      transition duration-200 ease-in-out
                      ${reducedMotion ? 'translate-x-5' : 'translate-x-0'}
                    `.trim()}
                  />
                </button>
              </div>

              {/* 5. High Contrast */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151]">
                <div className="pr-4">
                  <span className="block text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">
                    {t('accessibility.highContrastLabel')}
                  </span>
                  <span className="block text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    {t('accessibility.highContrastDesc')}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={highContrast}
                  onClick={handleHighContrastToggle}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399]
                    ${highContrast ? 'bg-[#0B3D2E] dark:bg-[#10B981]' : 'bg-[#D1D5DB] dark:bg-[#374151]'}
                  `.trim()}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0
                      transition duration-200 ease-in-out
                      ${highContrast ? 'translate-x-5' : 'translate-x-0'}
                    `.trim()}
                  />
                </button>
              </div>

              {/* Screen reader & keyboard note */}
              <div className="p-3 bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] rounded-xl text-xs text-[#6B7280] dark:text-[#9CA3AF] space-y-1">
                <p>{t('accessibility.keyboardInstructions')}</p>
                <p>{t('accessibility.screenReaderOptimized')}</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151]">
              <Button onClick={handleReset} variant="ghost" size="sm">
                {t('accessibility.resetBtn')}
              </Button>
              <Button onClick={handleClose} variant="primary" size="md">
                {t('common.done')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
