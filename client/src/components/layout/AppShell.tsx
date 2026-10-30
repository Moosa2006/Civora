import type { ReactNode } from 'react';
import { Navbar } from './Navbar.js';
import { Footer } from './Footer.js';
import { LiveAnnouncer } from '../ui/LiveAnnouncer.js';
import { ErrorBoundary } from '../ui/ErrorBoundary.js';
import { useTranslation } from '../../context/useTranslation.js';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-background)] text-[var(--color-text-primary)] selection:bg-[#173D32]/20 selection:text-[#173D32] dark:selection:bg-[#4F9B8B]/30 dark:selection:text-[#F4F0E6] font-sans">
      {/* Screen reader live announcement region */}
      <LiveAnnouncer />

      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#173D32] focus:text-[#F4F0E6] focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#4F9B8B] font-semibold"
      >
        {t('nav.skipToMain')}
      </a>

      {/* Primary Navigation */}
      <Navbar />

      {/* Main Content Area guarded by ErrorBoundary */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full py-8 md:py-12 focus:outline-none">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Persistent Footer */}
      <Footer />
    </div>
  );
}
