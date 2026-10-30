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
import { getRolePrimaryNav, getRoleSecondaryNav } from '../../config/navigation.js';

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

  const navLinkBase =
    'px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-medium text-[#E4E0D5] hover:text-white hover:bg-[#112F26]/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8BFAE] min-h-[36px] flex items-center whitespace-nowrap shrink-0 font-sans';
  const navLinkActive = 'text-white bg-[#112F26] font-semibold shadow-xs border border-[#A8BFAE]/30';

  const getRoleBadge = (userRole?: string) => {
    switch (userRole) {
      case 'ADMIN':
        return 'bg-[#7B4C8D]/25 text-[#E6CEF2] border-[#7B4C8D]/40';
      case 'GOVERNMENT_OFFICIAL':
        return 'bg-[#B26A15]/25 text-[#FADBB3] border-[#B26A15]/40';
      case 'CONTRACTOR':
        return 'bg-[#4F9B8B]/25 text-[#D0F0E8] border-[#4F9B8B]/40';
      default:
        return 'bg-[#A8BFAE]/20 text-[#F4F0E6] border-[#A8BFAE]/30';
    }
  };

  const formatRoleLabel = (userRole?: string) => {
    switch (userRole) {
      case 'ADMIN':
        return 'Admin';
      case 'GOVERNMENT_OFFICIAL':
        return 'Official';
      case 'CONTRACTOR':
        return 'Contractor';
      default:
        return 'Citizen';
    }
  };

  const getDropdownLabel = () => {
    if (role === 'CONTRACTOR') return 'Execution';
    if (role === 'ADMIN') return 'Governance';
    if (role === 'GOVERNMENT_OFFICIAL') return 'Operations';
    return 'More';
  };

  const getDropdownIcon = () => {
    if (role === 'CONTRACTOR') return <ActivityIcon className="w-3.5 h-3.5 text-[#7BC4B2] shrink-0" />;
    if (role === 'ADMIN') return <SettingsIcon className="w-3.5 h-3.5 text-[#E6CEF2] shrink-0" />;
    if (role === 'GOVERNMENT_OFFICIAL') return <ShieldCheckIcon className="w-3.5 h-3.5 text-[#FADBB3] shrink-0" />;
    return null;
  };

  const isDropdownActive = secondaryNavItems.some((item) => {
    const itemPathOnly = item.path.split('?')[0];
    const currentPathOnly = currentPath.split('?')[0];
    return itemPathOnly === currentPathOnly;
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#112F26] bg-[#173D32] shadow-sm">
      <Container size="full" className="max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-4">
          {/* 1. Civora Brand Logo & Name */}
          <NavLink
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center space-x-2.5 sm:space-x-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8BFAE] rounded-lg p-1 min-h-[44px] shrink-0"
            aria-label={`${t('nav.brand')} - ${t('nav.tagline')}`}
          >
            <div className="w-9 h-9 rounded-xl bg-[#F4F0E6] text-[#173D32] flex items-center justify-center font-heading font-bold shadow-xs text-lg transition-transform group-hover:scale-105 shrink-0 border border-[#DED8CB]">
              C
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-lg font-heading font-bold tracking-tight text-[#F4F0E6] block leading-none">
                {t('nav.brand')}
              </span>
              <span className="text-[10px] text-[#A8BFAE] font-normal tracking-wide block mt-0.5">
                {t('nav.tagline')}
              </span>
            </div>
            <span className="sm:hidden text-lg font-heading font-bold tracking-tight text-[#F4F0E6] block leading-none">
              {t('nav.brand')}
            </span>
          </NavLink>

          {/* 2. Desktop Role-Aware Primary Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 flex-1 justify-center min-w-0" aria-label="Main Navigation">
            {isLoading ? (
              <div className="h-6 w-48 bg-[#112F26]/60 animate-pulse rounded-md" />
            ) : (
              <>
                {primaryNavItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={navLinkBase}
                    activeClassName={navLinkActive}
                  >
                    {item.label}
                  </NavLink>
                ))}

                {/* Secondary Grouped Dropdown for specific roles */}
                {secondaryNavItems.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSecondaryDropdownOpen((prev) => !prev)}
                      aria-expanded={secondaryDropdownOpen}
                      aria-haspopup="true"
                      className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8BFAE] min-h-[36px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer font-sans ${
                        isDropdownActive
                          ? 'text-white bg-[#112F26] border border-[#A8BFAE]/30 font-semibold'
                          : 'text-[#E4E0D5] hover:text-white hover:bg-[#112F26]/80'
                      }`}
                    >
                      {getDropdownIcon()}
                      <span>{getDropdownLabel()}</span>
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 text-[#A8BFAE] transition-transform duration-150 ${
                          secondaryDropdownOpen ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </button>

                    {/* Secondary Dropdown Menu */}
                    {secondaryDropdownOpen && (
                      <div
                        role="menu"
                        aria-label={`${getDropdownLabel()} Menu`}
                        className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-xl z-50 p-1.5 space-y-1"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#54625A] dark:text-[#94A79D] border-b border-[#EAE5D9] dark:border-[#283931]">
                          {getDropdownLabel()} Actions
                        </div>
                        {secondaryNavItems.map((subItem) => (
                          <NavLink
                            key={subItem.id}
                            to={subItem.path}
                            onClick={() => setSecondaryDropdownOpen(false)}
                            className="flex items-center px-3 py-2 text-xs font-medium text-[#202522] dark:text-[#F5F2EA] hover:bg-[#ECE7DB] dark:hover:bg-[#1C2823] rounded-lg transition-colors"
                            activeClassName="text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1C2823] font-semibold"
                          >
                            {subItem.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </nav>

          {/* 3. Utility Area (Shared: Language, Accessibility, Notifications, Auth) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Accessibility Settings Modal */}
            <AccessibilitySettingsModal />

            {/* Notification Bell (Authenticated Users) */}
            {isAuthenticated && <NotificationDropdown />}

            {/* User Profile / Auth State Controls */}
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-[#112F26]/60 animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-[#112F26] border border-[#A8BFAE]/25">
                  <div className="w-7 h-7 rounded-full bg-[#F4F0E6] text-[#173D32] font-heading font-semibold text-xs flex items-center justify-center shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left max-w-[120px] xl:max-w-[140px]">
                    <span className="text-xs font-medium text-[#F4F0E6] truncate block leading-tight">
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
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#E4E0D5] hover:text-[#F39182] hover:bg-[#B94B3B]/20 border border-transparent hover:border-[#B94B3B]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B94B3B] min-h-[36px] items-center cursor-pointer font-sans"
                  title={t('nav.signOut')}
                >
                  {t('nav.signOut')}
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <NavLink
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#E4E0D5] hover:text-white hover:bg-[#112F26] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8BFAE] min-h-[36px] flex items-center font-sans"
                >
                  {t('nav.signIn')}
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#173D32] bg-[#F4F0E6] hover:bg-white shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-h-[36px] flex items-center font-sans"
                >
                  {t('nav.register')}
                </NavLink>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg text-[#E4E0D5] hover:text-white hover:bg-[#112F26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8BFAE] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* 4. Mobile Drawer Navigation (Rendered when mobileMenuOpen is true) */}
        {mobileMenuOpen && (
          <nav
            className="lg:hidden py-4 border-t border-[#112F26] space-y-3"
            aria-label="Mobile Navigation"
          >
            {/* Primary Mobile Links */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8BFAE] px-3.5 block mb-1">
                Main Menu
              </span>
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={closeMobileMenu}
                  className={`block ${navLinkBase}`}
                  activeClassName={navLinkActive}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Secondary Mobile Links */}
            {secondaryNavItems.length > 0 && (
              <div className="pt-2 border-t border-[#112F26] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5D4C9] px-3.5 block mb-1">
                  {getDropdownLabel()} Actions
                </span>
                {secondaryNavItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className={`block ${navLinkBase}`}
                    activeClassName={navLinkActive}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Mobile Profile & Authentication Section */}
            <div className="pt-3 border-t border-[#112F26]">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="px-3.5 py-2.5 rounded-lg bg-[#112F26] border border-[#A8BFAE]/25 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-[#F4F0E6] text-[#173D32] font-heading font-semibold text-xs flex items-center justify-center shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[11px] text-[#A8BFAE] truncate">{user.email}</p>
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
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#F39182] hover:bg-[#112F26] rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center"
                  >
                    {t('nav.signOut')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <NavLink
                    to="/login"
                    onClick={closeMobileMenu}
                    className="px-3 py-2 text-center text-xs font-medium text-[#F4F0E6] bg-[#112F26] hover:bg-[#0C241D] rounded-lg border border-[#A8BFAE]/30 transition-colors min-h-[44px] flex items-center justify-center font-sans"
                  >
                    {t('nav.signIn')}
                  </NavLink>
                  <NavLink
                    to="/register"
                    onClick={closeMobileMenu}
                    className="px-3 py-2 text-center text-xs font-semibold text-[#173D32] bg-[#F4F0E6] hover:bg-white rounded-lg shadow-xs transition-colors min-h-[44px] flex items-center justify-center font-sans"
                  >
                    {t('nav.register')}
                  </NavLink>
                </div>
              )}
            </div>
          </nav>
        )}
      </Container>
    </header>
  );
}
