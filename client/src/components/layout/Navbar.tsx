import { useState, useEffect, useRef } from 'react';
import { NavLink } from '../../router/NavLink.js';
import { useRouter } from '../../router/index.js';
import { useAuth } from '../../context/useAuth.js';
import { useTranslation } from '../../context/useTranslation.js';
import { Container } from './Container.js';
import { MenuIcon, CloseIcon, ChevronDownIcon, ShieldCheckIcon, ActivityIcon, SettingsIcon } from '../ui/icons.js';
import { NotificationDropdown } from './NotificationDropdown.js';
import { LanguageSelector } from './LanguageSelector.js';
import { AccessibilitySettingsModal } from './AccessibilitySettingsModal.js';
import { ThemeToggle } from './ThemeToggle.js';
import { getRolePrimaryNav, getRoleSecondaryNav, getRoleLandingPage } from '../../config/navigation.js';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [secondaryDropdownOpen, setSecondaryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation();

  const role = user?.role || null;
  const primaryNavItems = getRolePrimaryNav(role, isAuthenticated);
  const secondaryNavItems = getRoleSecondaryNav(role, isAuthenticated);

  // Close menus on Escape key press or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setSecondaryDropdownOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSecondaryDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setSecondaryDropdownOpen(false);
  }, [currentPath]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    await logout();
    closeMobileMenu();
    setSecondaryDropdownOpen(false);
    navigate('/');
  };

  // Exact Homepage pill navigation link styling with dedicated Dark Mode states
  const navLinkBase =
    'px-3 xl:px-4 py-1.5 rounded-full text-sm xl:text-[15px] font-medium text-[#2D3748] dark:text-[#D1D5DB] hover:text-[#0B3D2E] hover:bg-[#F3F6F4] dark:hover:text-[#F9FAFB] dark:hover:bg-[#273548] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399] whitespace-nowrap shrink-0 font-sans';
  const navLinkActive =
    'bg-[#E5ECE8] !text-[#0B3D2E] dark:bg-[#34D399]/15 dark:!text-[#6EE7B7] font-semibold';

  const getRoleBadge = (userRole?: string) => {
    switch (userRole) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30';
      case 'GOVERNMENT_OFFICIAL':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
      case 'CONTRACTOR':
        return 'bg-emerald-50 text-[#0B6640] border-emerald-200 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/30';
      default:
        return 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/30';
    }
  };

  const formatRoleLabel = (userRole?: string) => {
    switch (userRole) {
      case 'ADMIN':
        return t('roles.admin');
      case 'GOVERNMENT_OFFICIAL':
        return t('roles.official');
      case 'CONTRACTOR':
        return t('roles.contractor');
      default:
        return t('roles.citizen');
    }
  };

  const getDropdownLabel = () => {
    if (role === 'CONTRACTOR') return t('nav.dropdownExecution');
    if (role === 'ADMIN') return t('nav.dropdownGovernance');
    if (role === 'GOVERNMENT_OFFICIAL') return t('nav.dropdownOperations');
    return t('nav.dropdownMore');
  };

  const getNavLabel = (item: { label: string; translationKey?: string }) => {
    if (item.translationKey) {
      const translated = t(item.translationKey);
      if (translated && translated !== item.translationKey) return translated;
    }
    return item.label;
  };

  const getLogoDestination = () => {
    if (!isAuthenticated || !user) return '/';
    return getRoleLandingPage(user.role);
  };

  const getDropdownIcon = () => {
    if (role === 'CONTRACTOR') return <ActivityIcon className="w-3.5 h-3.5 text-[#0B6640] dark:text-[#34D399] shrink-0" />;
    if (role === 'ADMIN') return <SettingsIcon className="w-3.5 h-3.5 text-[#0B3D2E] dark:text-[#34D399] shrink-0" />;
    if (role === 'GOVERNMENT_OFFICIAL') return <ShieldCheckIcon className="w-3.5 h-3.5 text-[#0B3D2E] dark:text-[#34D399] shrink-0" />;
    return null;
  };

  const isDropdownActive = secondaryNavItems.some((item) => {
    const [itemBaseRaw, itemQuery] = item.path.split('?');
    const [currBaseRaw, currQuery = ''] = currentPath.split('?');
    const itemBase = (itemBaseRaw || '/').replace(/\/+$/, '') || '/';
    const currBase = (currBaseRaw || '/').replace(/\/+$/, '') || '/';

    if (itemQuery !== undefined) {
      return currBase === itemBase && currQuery === itemQuery;
    }
    return currBase === itemBase || currBase.startsWith(`${itemBase}/`);
  });

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-[#111827]/95 dark:backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#374151] shadow-2xs transition-colors duration-150">
      <Container size="xl">
        <div className="flex items-center justify-between h-16 sm:h-[68px] gap-2 lg:gap-4">
          {/* 1. Left: Civora Brand Logo (Preserved & Clearly Framed in Both Themes) */}
          <div className="flex items-center shrink-0">
            <NavLink
              to={getLogoDestination()}
              exact
              onClick={closeMobileMenu}
              className="flex items-center py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] dark:focus-visible:ring-[#34D399] rounded-lg"
              aria-label="Civora Home"
            >
              <img
                src="/civora_icon.jpeg"
                alt="Civora"
                className="h-10 sm:h-11 w-auto object-contain transition-transform duration-200 hover:scale-105 dark:bg-white dark:rounded-xl dark:px-1.5 dark:py-0.5 dark:ring-1 dark:ring-white/15"
              />
            </NavLink>
          </div>

          {/* 2. Centre: Role-Aware Pill Navigation Matching Homepage */}
          <nav
            className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 flex-1 justify-center min-w-0"
            aria-label="Primary Navigation"
          >
            {isLoading ? (
              <div className="h-7 w-52 bg-[#F3F4F6] dark:bg-[#273548] animate-pulse rounded-full" />
            ) : (
              <>
                {primaryNavItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={navLinkBase}
                    activeClassName={navLinkActive}
                  >
                    {getNavLabel(item)}
                  </NavLink>
                ))}

                {/* Secondary Grouped Dropdown (More / Execution / Operations / Governance) */}
                {secondaryNavItems.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSecondaryDropdownOpen((prev) => !prev)}
                      aria-expanded={secondaryDropdownOpen}
                      aria-haspopup="true"
                      className={`civora-liquid-btn ${
                        isDropdownActive || secondaryDropdownOpen
                          ? 'civora-liquid-btn--outline font-semibold'
                          : 'civora-liquid-btn--ghost'
                      } px-3.5 xl:px-4 py-1.5 rounded-full text-sm xl:text-[15px] font-medium gap-1.5 whitespace-nowrap shrink-0`}
                    >
                      {getDropdownIcon()}
                      <span>{getDropdownLabel()}</span>
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          secondaryDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {secondaryDropdownOpen && (
                      <div
                        role="menu"
                        aria-label={`${getDropdownLabel()} Menu`}
                        className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-xl z-50 p-1.5 space-y-0.5"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] border-b border-[#F3F4F6] dark:border-[#374151] mb-1">
                          {getDropdownLabel()}
                        </div>
                        {secondaryNavItems.map((subItem) => (
                          <NavLink
                            key={subItem.id}
                            to={subItem.path}
                            onClick={() => setSecondaryDropdownOpen(false)}
                            className="flex items-center px-3 py-2 text-xs font-medium text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#273548] rounded-lg transition-colors"
                            activeClassName="!text-[#0B3D2E] dark:!text-[#6EE7B7] bg-[#E5ECE8] dark:bg-[#34D399]/15 font-semibold"
                          >
                            {getNavLabel(subItem)}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </nav>

          {/* 3. Right: Language Selector, Theme Toggle, Accessibility, Notifications & Auth Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:block">
              <LanguageSelector variant="forest-pill" />
            </div>

            <ThemeToggle />

            <AccessibilitySettingsModal />

            {isAuthenticated && <NotificationDropdown />}

            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-[#F3F4F6] dark:bg-[#273548] animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <NavLink
                  to={getLogoDestination()}
                  exact
                  className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#0B3D2E] dark:bg-[#0D7A58] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left max-w-[110px] xl:max-w-[140px]">
                    <span className="text-xs font-medium text-[#111827] dark:text-[#F9FAFB] truncate block leading-tight">
                      {user.name}
                    </span>
                    <span
                      className={`inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded border mt-0.5 leading-none ${getRoleBadge(
                        user.role
                      )}`}
                    >
                      {formatRoleLabel(user.role)}
                    </span>
                  </div>
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="civora-liquid-btn civora-liquid-btn--ghost hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-medium hover:!text-[#B91C1C] dark:hover:!text-[#FCA5A5] min-h-[36px] items-center font-sans"
                  title={t('nav.signOut')}
                >
                  {t('nav.signOut')}
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2.5">
                <NavLink
                  to="/login"
                  className="civora-liquid-btn civora-liquid-btn--ghost px-3 py-1.5 rounded-lg text-sm font-medium min-h-[36px]"
                  activeClassName="civora-liquid-btn--outline font-semibold"
                >
                  {t('nav.signIn')}
                </NavLink>
                <NavLink
                  to="/report"
                  className="civora-liquid-btn civora-liquid-btn--primary px-4 py-2 rounded-lg text-sm font-medium min-h-[38px]"
                >
                  {t('nav.reportIssue')}
                </NavLink>
              </div>
            )}

            {/* Mobile Menu Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="civora-liquid-btn civora-liquid-btn--ghost lg:hidden p-2 rounded-lg min-h-[40px] min-w-[40px]"
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </Container>

      {/* 4. Responsive Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="lg:hidden border-t border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#182230] px-4 sm:px-6 py-4 shadow-lg space-y-4"
        >
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] px-3 pb-1">
              {t('nav.mainMenu')}
            </span>
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={closeMobileMenu}
                className="px-3.5 py-2.5 rounded-lg text-sm font-medium text-[#2D3748] dark:text-[#D1D5DB] hover:bg-[#F3F6F4] dark:hover:bg-[#273548] transition-colors"
                activeClassName="bg-[#E5ECE8] !text-[#0B3D2E] dark:bg-[#34D399]/15 dark:!text-[#6EE7B7] font-semibold"
              >
                {getNavLabel(item)}
              </NavLink>
            ))}

            {secondaryNavItems.length > 0 && (
              <div className="pt-2 mt-2 border-t border-[#F3F4F6] dark:border-[#374151] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] px-3 block pb-1">
                  {getDropdownLabel()}
                </span>
                {secondaryNavItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className="block px-3.5 py-2.5 rounded-lg text-sm font-medium text-[#2D3748] dark:text-[#D1D5DB] hover:bg-[#F3F6F4] dark:hover:bg-[#273548] transition-colors"
                    activeClassName="bg-[#E5ECE8] !text-[#0B3D2E] dark:bg-[#34D399]/15 dark:!text-[#6EE7B7] font-semibold"
                  >
                    {getNavLabel(item)}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Mobile Profile & Auth Controls */}
            <div className="pt-3 mt-2 border-t border-[#E5E7EB] dark:border-[#374151]">
              {isAuthenticated && user ? (
                <div className="space-y-2.5">
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-[#0B3D2E] dark:bg-[#0D7A58] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111827] dark:text-[#F9FAFB] truncate">{user.name}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{user.email}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${getRoleBadge(
                        user.role
                      )}`}
                    >
                      {formatRoleLabel(user.role)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="civora-liquid-btn civora-liquid-btn--danger w-full px-3.5 py-2.5 text-sm font-medium rounded-lg"
                  >
                    {t('nav.signOut')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col space-y-2.5">
                  <NavLink
                    to="/report"
                    onClick={closeMobileMenu}
                    className="civora-liquid-btn civora-liquid-btn--primary w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium"
                  >
                    {t('nav.reportIssue')}
                  </NavLink>
                  <div className="grid grid-cols-2 gap-2">
                    <NavLink
                      to="/login"
                      onClick={closeMobileMenu}
                      className="civora-liquid-btn civora-liquid-btn--secondary px-3 py-2.5 text-center text-sm font-medium rounded-lg"
                    >
                      {t('nav.signIn')}
                    </NavLink>
                    <NavLink
                      to="/register"
                      onClick={closeMobileMenu}
                      className="civora-liquid-btn civora-liquid-btn--outline px-3 py-2.5 text-center text-sm font-medium rounded-lg"
                    >
                      {t('nav.register')}
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 sm:hidden flex items-center justify-between gap-2">
              <LanguageSelector variant="forest-pill" />
              <div className="w-36">
                <ThemeToggle showLabel />
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
