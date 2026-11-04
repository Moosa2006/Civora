import type { ReactNode } from 'react';
import { Navbar } from './Navbar.js';
import { Footer } from './Footer.js';
import { LiveAnnouncer } from '../ui/LiveAnnouncer.js';
import { ErrorBoundary } from '../ui/ErrorBoundary.js';
import { useTranslation } from '../../context/useTranslation.js';
import { useRouter } from '../../router/index.js';
import { useScrollReveal } from '../../hooks/useScrollReveal.js';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const { currentPath } = useRouter();

  useScrollReveal(currentPath);

  // Normalize path to detect full-bleed homepage presentation
  const cleanPath = (currentPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const isHomepage = cleanPath === '/' || cleanPath === '/dashboard';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-background)] text-[var(--color-text-primary)] selection:bg-[#0B3D2E]/15 selection:text-[#0B3D2E] dark:selection:bg-[#34D399]/25 dark:selection:text-[#F9FAFB] font-sans transition-colors duration-150">
      {/* Screen reader live announcement region */}
      <LiveAnnouncer />

      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#0B3D2E] dark:focus:bg-[#0D7A58] focus:text-white focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#0B6640] dark:focus:ring-[#34D399] font-semibold"
      >
        {t('nav.skipToMain')}
      </a>

      {/* Unified Global Navbar across all public & authenticated routes */}
      <Navbar />

      {/* Main Content Area guarded by ErrorBoundary */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 w-full focus:outline-none ${isHomepage ? '' : 'py-8 sm:py-10'}`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Persistent Footer */}
      <Footer />
    </div>
  );
}
