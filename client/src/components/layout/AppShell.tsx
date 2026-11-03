import type { ReactNode } from 'react';
import { Navbar } from './Navbar.js';
import { HomepageNavbar } from './HomepageNavbar.js';
import { Footer } from './Footer.js';
import { LiveAnnouncer } from '../ui/LiveAnnouncer.js';
import { ErrorBoundary } from '../ui/ErrorBoundary.js';
import { useTranslation } from '../../context/useTranslation.js';
import { useRouter } from '../../router/index.js';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const { currentPath } = useRouter();

  // Normalize path to detect homepage presentation
  const cleanPath = (currentPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const isHomepage = cleanPath === '/' || cleanPath === '/dashboard';

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

      {/* Primary Navigation: Refined minimal bar on homepage; full role-aware bar on internal routes */}
      {isHomepage ? <HomepageNavbar /> : <Navbar />}

      {/* Main Content Area guarded by ErrorBoundary (full-bleed on homepage for immersive hero) */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 w-full focus:outline-none ${isHomepage ? '' : 'py-8 md:py-12'}`}
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
