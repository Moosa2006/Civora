import { useState, useEffect } from 'react';
import { NavLink } from '../../router/NavLink.js';
import { useRouter } from '../../router/index.js';
import { useAuth } from '../../context/useAuth.js';
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

  const navLinkBase =
    'px-3.5 py-1.5 rounded-full text-sm font-medium text-[#2D3748] hover:text-[#0B3D2E] transition-colors font-sans';
  const navLinkActive = 'bg-[#E5ECE8] text-[#173D32] font-semibold';

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100/90 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-[68px]">
          {/* 1. Left: Civora Icon (As shown in reference screenshot) */}
          <div className="flex items-center">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] rounded-md"
              aria-label="Civora Home"
            >
              <img
                src="/civora_icon.jpeg"
                alt="Civora"
                className="h-10 sm:h-11 w-auto object-contain transition-transform duration-200 hover:scale-105"
              />
            </NavLink>
          </div>

          {/* 2. Centre: Clean Navigation Links Matching Screenshot */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Primary Navigation">
            <NavLink
              to="/"
              className={navLinkBase}
              activeClassName={navLinkActive}
            >
              Home
            </NavLink>
            <NavLink
              to="/transparency"
              className={navLinkBase}
              activeClassName={navLinkActive}
            >
              Transparency
            </NavLink>
            <NavLink
              to="/engagement"
              className={navLinkBase}
              activeClassName={navLinkActive}
            >
              Civic Engagement
            </NavLink>
            <a
              href="#about"
              className={navLinkBase}
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

          {/* 3. Right: Language Selector, Sign In, Report Issue */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Language Selector in Forest-Green Pill */}
            <div className="hidden sm:block">
              <LanguageSelector variant="forest-pill" />
            </div>

            {/* Authentication Action */}
            {isAuthenticated ? (
              <NavLink
                to={getUserWorkspacePath()}
                className="hidden sm:inline-block px-3.5 py-1.5 rounded-md text-sm font-medium text-[#2D3748] hover:text-[#0B3D2E] transition-colors"
              >
                Dashboard
              </NavLink>
            ) : (
              <NavLink
                to="/login"
                className="hidden sm:inline-block px-2.5 py-1.5 text-sm font-medium text-[#2D3748] hover:text-[#0B3D2E] transition-colors"
              >
                Sign In
              </NavLink>
            )}

            {/* Primary Action Button: Report Issue */}
            <NavLink
              to="/report"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white bg-[#0B3D2E] hover:bg-[#072B20] transition-colors shadow-2xs"
            >
              Report Issue
            </NavLink>

            {/* Mobile Menu Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-md text-[#2D3748] hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="md:hidden border-t border-gray-100 bg-white px-5 py-5 shadow-lg space-y-3"
        >
          <nav className="flex flex-col space-y-2">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[#2D3748] hover:bg-[#E5ECE8]"
            >
              Home
            </NavLink>
            <NavLink
              to="/transparency"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[#2D3748] hover:bg-[#E5ECE8]"
            >
              Transparency
            </NavLink>
            <NavLink
              to="/engagement"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[#2D3748] hover:bg-[#E5ECE8]"
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
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[#2D3748] hover:bg-[#E5ECE8]"
            >
              About Civora
            </a>

            <div className="pt-3 border-t border-gray-100 flex flex-col space-y-2.5">
              <NavLink
                to="/report"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-white bg-[#0B3D2E] hover:bg-[#072B20]"
              >
                Report Issue
              </NavLink>
              {isAuthenticated ? (
                <NavLink
                  to={getUserWorkspacePath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 rounded-md text-sm font-medium text-[#2D3748] hover:bg-gray-100"
                >
                  Dashboard
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 rounded-md text-sm font-medium text-[#2D3748] hover:bg-gray-100"
                >
                  Sign In
                </NavLink>
              )}
            </div>

            <div className="pt-2 flex justify-center">
              <LanguageSelector variant="forest-pill" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
