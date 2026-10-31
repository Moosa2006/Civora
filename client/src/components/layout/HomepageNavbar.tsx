import { useState, useEffect } from 'react';
import { NavLink } from '../../router/NavLink.js';
import { useRouter } from '../../router/index.js';
import { useAuth } from '../../context/useAuth.js';
import { Container } from './Container.js';
import { LanguageSelector } from './LanguageSelector.js';

export function HomepageNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { currentPath } = useRouter();

  // Close mobile drawer on route change or Escape key
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine user workspace route if already authenticated
  const getUserWorkspacePath = () => {
    if (!user) return '/my-complaints';
    switch (user.role) {
      case 'ADMIN':
        return '/admin/complaints';
      case 'GOVERNMENT_OFFICIAL':
        return '/official/workspace';
      case 'CONTRACTOR':
        return '/contractor/workspace';
      default:
        return '/my-complaints';
    }
  };

  const navLinkClass =
    'px-3.5 py-1.5 rounded-full text-xs lg:text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:text-[#173D32] dark:hover:text-[#7BC4B2] hover:bg-[#173D32]/5 dark:hover:bg-[#4F9B8B]/10 transition-colors font-sans';
  const navLinkActive = 'text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#173D32]/5 dark:bg-[#4F9B8B]/10';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#DED8CB]/70 dark:border-[#283931]/70 bg-[#F4F0E6]/95 dark:bg-[#141C18]/95 backdrop-blur-md transition-colors">
      <Container size="full" className="max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-14">
          {/* 1. Left: Brand Emblem + Wordmark */}
          <NavLink
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 sm:gap-3 py-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] rounded-md shrink-0"
            aria-label="Civora Home"
          >
            <img
              src="/civora_icon.jpeg"
              alt="Civora Emblem"
              className="h-6 sm:h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <img
              src="/civora_text.jpeg"
              alt="Civora"
              className="h-3.5 sm:h-4 w-auto object-contain"
            />
          </NavLink>

          {/* 2. Centre: Tesla-Inspired Minimalist Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Primary Navigation">
            <NavLink
              to="/"
              className={navLinkClass}
              activeClassName={navLinkActive}
            >
              Home
            </NavLink>
            <NavLink
              to="/transparency"
              className={navLinkClass}
              activeClassName={navLinkActive}
            >
              Transparency
            </NavLink>
            <NavLink
              to="/engagement"
              className={navLinkClass}
              activeClassName={navLinkActive}
            >
              Civic Engagement
            </NavLink>
            <a
              href="#about"
              className={navLinkClass}
              onClick={(e) => {
                const el = document.getElementById('about');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              About Civora
            </a>
          </nav>

          {/* 3. Right: Utility Controls & Auth Link */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Minimal Language Utility */}
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            {/* Authentication Action */}
            {isAuthenticated ? (
              <NavLink
                to={getUserWorkspacePath()}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#173D32] text-[#F4F0E6] hover:bg-[#112F26] transition-all shadow-xs"
              >
                Dashboard
              </NavLink>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <NavLink
                  to="/login"
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-[#202522] dark:text-[#E8F0EC] hover:text-[#173D32] hover:bg-[#173D32]/5 transition-colors"
                >
                  Sign In
                </NavLink>
                <NavLink
                  to="/report"
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#173D32] text-[#F4F0E6] hover:bg-[#112F26] transition-all shadow-xs"
                >
                  Report Issue
                </NavLink>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-1.5 rounded-lg text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </Container>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="md:hidden border-t border-[#DED8CB]/60 dark:border-[#283931]/60 bg-[#F4F0E6] dark:bg-[#141C18] px-4 py-5 shadow-xl transition-all"
        >
          <nav className="flex flex-col space-y-2.5">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5 transition-colors"
            >
              Home
            </NavLink>
            <NavLink
              to="/transparency"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5 transition-colors"
            >
              Transparency
            </NavLink>
            <NavLink
              to="/engagement"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5 transition-colors"
            >
              Civic Engagement
            </NavLink>
            <a
              href="#about"
              onClick={(e) => {
                setMobileMenuOpen(false);
                const el = document.getElementById('about');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5 transition-colors"
            >
              About Civora
            </a>

            <div className="pt-3 border-t border-[#DED8CB]/50 dark:border-[#283931]/50 flex flex-col space-y-2">
              <NavLink
                to="/report"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#173D32] text-[#F4F0E6] hover:bg-[#112F26] transition-colors"
              >
                Report an Issue
              </NavLink>
              {isAuthenticated ? (
                <NavLink
                  to={getUserWorkspacePath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5"
                >
                  Go to Dashboard
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 rounded-xl text-sm font-medium text-[#202522] dark:text-[#E8F0EC] hover:bg-[#173D32]/5"
                >
                  Sign In
                </NavLink>
              )}
            </div>

            <div className="pt-2 flex justify-center">
              <LanguageSelector />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
