import { useState, useEffect, useRef } from 'react';
import { NavLink } from '../../router/NavLink.js';
import { useRouter } from '../../router/index.js';
import { useAuth } from '../../context/useAuth.js';
import { useTranslation } from '../../context/useTranslation.js';
import {
  MenuIcon,
  CloseIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  ActivityIcon,
  SettingsIcon,
  LogOutIcon,
  BellIcon,
} from '../ui/icons.js';
import { NotificationDropdown } from './NotificationDropdown.js';
import { LanguageSelector } from './LanguageSelector.js';
import { AccessibilitySettingsModal } from './AccessibilitySettingsModal.js';
import { ThemeToggle } from './ThemeToggle.js';
import { getRolePrimaryNav, getRoleSecondaryNav, getRoleLandingPage } from '../../config/navigation.js';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [secondaryDropdownOpen, setSecondaryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

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

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  // Modern institutional sans-serif navigation link styling
  const navLinkBase =
    'px-2 xl:px-2 2xl:px-3 py-1.5 rounded-lg text-[13px] 2xl:text-[14px] font-medium text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] whitespace-nowrap shrink-0 font-sans select-none';

  const navLinkActive =
    'bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30 font-semibold shadow-2xs';

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

  const formatRoleLabel = (userRole?: string, compact = false) => {
    switch (userRole) {
      case 'ADMIN':
        return compact ? 'Admin' : t('roles.admin');
      case 'GOVERNMENT_OFFICIAL':
        return compact ? 'Official' : t('roles.official');
      case 'CONTRACTOR':
        return compact ? 'Contractor' : t('roles.contractor');
      default:
        return compact ? 'Citizen' : t('roles.citizen');
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
    if (role === 'CONTRACTOR') return <ActivityIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-[#34D399] shrink-0" />;
    if (role === 'ADMIN') return <SettingsIcon className="w-3.5 h-3.5 text-slate-700 dark:text-[#34D399] shrink-0" />;
    if (role === 'GOVERNMENT_OFFICIAL') return <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-700 dark:text-[#34D399] shrink-0" />;
    return null;
  };

  const checkItemActive = (path: string) => {
    const [itemBaseRaw, itemQuery] = path.split('?');
    const [currBaseRaw, currQuery = ''] = currentPath.split('?');
    const itemBase = (itemBaseRaw || '/').replace(/\/+$/, '') || '/';
    const currBase = (currBaseRaw || '/').replace(/\/+$/, '') || '/';

    if (itemQuery !== undefined) {
      return currBase === itemBase && currQuery === itemQuery;
    }
    return currBase === itemBase || (itemBase !== '/' && currBase.startsWith(`${itemBase}/`));
  };

  // Adaptive primary items across desktop breakpoints:
  // 1. lg (1024px - 1279px): first 3 items inline. Items 4-6 in More dropdown.
  // 2. xl+ (>= 1280px): ALL 6 primary items inline!
  const getDesktopItemClass = (index: number) => {
    if (index < 3) return 'inline-flex';
    return 'hidden xl:inline-flex';
  };

  const overflowItemsForLg = primaryNavItems.slice(3);

  const isDropdownActive = [...overflowItemsForLg, ...secondaryNavItems].some((item) =>
    checkItemActive(item.path)
  );

  // Consistent utility icon button styling
  const utilityBtnClass =
    'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1F2937]/80 hover:bg-slate-100 dark:hover:bg-[#374151] text-slate-700 dark:text-[#F8FAFC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] shrink-0';

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#334155] shadow-xs transition-colors duration-150 font-sans [font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[76px] sm:h-[80px] gap-2 lg:gap-3 xl:gap-4">
          
          {/* =====================================================================
              1. LEFT SECTION — Branding
              ===================================================================== */}
          <div className="flex items-center shrink-0 min-w-fit mr-2 xl:mr-4">
            <NavLink
              to={getLogoDestination()}
              exact
              onClick={closeMobileMenu}
              className="flex items-center gap-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] rounded-lg group select-none"
              aria-label="Civora Home"
            >
              <div className="relative flex items-center justify-center h-10 w-14 sm:h-11 sm:w-16 rounded-lg bg-white shadow-2xs border border-slate-200/90 dark:border-slate-700/80 overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-[1.03] p-0.5">
                <img
                  src="/civora_icon.jpeg"
                  alt="Civora"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="hidden min-[1680px]:flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] leading-tight">
                  Civora
                </span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-[#10B981] leading-none">
                  GovTech
                </span>
              </div>
            </NavLink>
          </div>

          {/* =====================================================================
              2. CENTER SECTION — Primary Navigation
              ===================================================================== */}
          <nav
            className="hidden lg:flex items-center flex-1 min-w-0 px-1 xl:px-2 overflow-visible"
            aria-label="Primary Navigation"
          >
            {isLoading ? (
              <div className="h-8 w-64 bg-slate-100 dark:bg-[#1F2937] animate-pulse rounded-lg mx-auto" />
            ) : (
              <div className="flex items-center gap-1 2xl:gap-2 mx-auto shrink-0">
                {/* Responsive Primary Navigation Items */}
                {primaryNavItems.map((item, index) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={`${navLinkBase} ${getDesktopItemClass(index)}`}
                    activeClassName={navLinkActive}
                  >
                    {getNavLabel(item)}
                  </NavLink>
                ))}

                {/* 
                  Adaptive Dropdown for More / Secondary Items:
                  Visible on lg (1024px-1279px) containing overflow items 4, 5, 6 + secondary items.
                  Visible on 2xl+ (>= 1536px) only when secondaryNavItems exist.
                */}
                {(secondaryNavItems.length > 0 || overflowItemsForLg.length > 0) && (
                  <div
                    className={`relative ${
                      secondaryNavItems.length > 0
                        ? 'inline-flex xl:hidden 2xl:inline-flex'
                        : 'inline-flex xl:hidden'
                    }`}
                    ref={dropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setSecondaryDropdownOpen((prev) => !prev)}
                      aria-expanded={secondaryDropdownOpen}
                      aria-haspopup="true"
                      className={`
                        flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg text-[13px] xl:text-[14px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] whitespace-nowrap shrink-0 select-none
                        ${
                          (secondaryDropdownOpen || isDropdownActive)
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30 font-semibold shadow-2xs'
                            : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B]'
                        }
                      `}
                    >
                      {getDropdownIcon()}
                      <span>{getDropdownLabel()}</span>
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 transition-transform duration-200 opacity-80 ${
                          secondaryDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {secondaryDropdownOpen && (
                      <div
                        role="menu"
                        aria-label={`${getDropdownLabel()} Menu`}
                        className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 sm:w-60 rounded-xl bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#334155] shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in duration-150"
                      >
                        {/* Overflow primary items (visible in dropdown below 1280px) */}
                        {primaryNavItems.slice(3).map((item) => (
                          <div key={`overflow-${item.id}`} className="xl:hidden">
                            <NavLink
                              to={item.path}
                              onClick={() => setSecondaryDropdownOpen(false)}
                              className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#273548] hover:text-slate-900 dark:hover:text-[#F8FAFC] rounded-lg transition-colors"
                              activeClassName="bg-emerald-50 text-emerald-800 dark:bg-[#10B981]/15 dark:text-[#34D399] font-semibold"
                            >
                              {getNavLabel(item)}
                            </NavLink>
                          </div>
                        ))}

                        {/* Secondary portals (always inside dropdown if present) */}
                        {secondaryNavItems.length > 0 && (
                          <>
                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-[#374151] mt-1 pt-1">
                              {getDropdownLabel()}
                            </div>
                            {secondaryNavItems.map((subItem) => (
                              <NavLink
                                key={subItem.id}
                                to={subItem.path}
                                onClick={() => setSecondaryDropdownOpen(false)}
                                className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#273548] hover:text-slate-900 dark:hover:text-[#F8FAFC] rounded-lg transition-colors"
                                activeClassName="bg-emerald-50 text-emerald-800 dark:bg-[#10B981]/15 dark:text-[#34D399] font-semibold"
                              >
                                {getNavLabel(subItem)}
                              </NavLink>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* =====================================================================
              3. RIGHT SECTION — Utility Controls (Strictly Ordered)
              Order: 1. Language, 2. Theme, 3. A11y, 4. Notifications, 5. Profile, 6. Sign Out
              ===================================================================== */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto select-none">
            {/* 1. Language Selector */}
            <div className="hidden sm:block">
              <LanguageSelector variant="navbar" />
            </div>

            {/* 2. Theme Toggle */}
            <ThemeToggle className={utilityBtnClass} />

            {/* 3. Accessibility Control */}
            <AccessibilitySettingsModal triggerClassName={utilityBtnClass} />

            {/* 4. Notifications (when authenticated) */}
            {isAuthenticated && (
              <NotificationDropdown triggerClassName={utilityBtnClass} />
            )}

            {/* 5 & 6. User Profile & Sign Out (Authenticated) OR Sign In / Action (Visitor) */}
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1F2937] animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* 5. Administrator Profile Pill */}
                <NavLink
                  to={getLogoDestination()}
                  exact
                  className="hidden md:flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2 sm:px-2.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1F2937]/80 hover:bg-slate-100 dark:hover:bg-[#374151] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                  title={`${user.name} (${formatRoleLabel(user.role)})`}
                >
                  <div className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full bg-emerald-700 dark:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${getRoleBadge(
                      user.role
                    )}`}
                  >
                    <span className="hidden 2xl:inline">{formatRoleLabel(user.role)}</span>
                    <span className="2xl:hidden">{formatRoleLabel(user.role, true)}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] truncate max-w-[85px] xl:max-w-[120px] hidden min-[1680px]:block">
                    {user.name}
                  </span>
                </NavLink>

                {/* 6. Sign Out Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden md:inline-flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1F2937]/80 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800/50 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shrink-0"
                  title={t('nav.signOut')}
                >
                  <LogOutIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden 2xl:inline">{t('nav.signOut')}</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <NavLink
                  to="/login"
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-3.5 rounded-lg text-xs sm:text-sm font-medium border border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1F2937]/80 hover:bg-slate-100 dark:hover:bg-[#374151] text-slate-700 dark:text-[#F8FAFC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                >
                  {t('nav.signIn')}
                </NavLink>
                <NavLink
                  to="/report"
                  className="flex items-center justify-center h-9 sm:h-10 px-3.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                >
                  {t('nav.reportIssue')}
                </NavLink>
              </div>
            )}

            {/* Hamburger Toggle Button (Mobile & Tablet < 1024px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1F2937]/80 hover:bg-slate-100 dark:hover:bg-[#374151] text-slate-700 dark:text-[#F8FAFC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] shrink-0"
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. RESPONSIVE MOBILE & TABLET SLIDE-OUT NAVIGATION DRAWER
          Smooth slide-out drawer with full touch support (44x44px min targets)
          ===================================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop with Blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />

          {/* Slide-out Drawer Container */}
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Civora Mobile Navigation"
            className="fixed inset-y-0 right-0 w-full max-w-sm sm:max-w-md bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-[#334155] shadow-2xl flex flex-col justify-between overflow-y-auto z-50 animate-in slide-in-from-right duration-200"
          >
            {/* Top Bar of Drawer */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#334155] bg-slate-50/60 dark:bg-[#182230]/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-9 w-13 rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
                  <img src="/civora_icon.jpeg" alt="Civora" className="h-full w-full object-contain" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900 dark:text-[#F8FAFC] leading-none">
                    Civora
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-[#10B981]">
                    Civic Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-[#273548] text-slate-500 dark:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                aria-label={t('nav.closeMenu')}
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
              {/* Authenticated User Profile Summary Card */}
              {isAuthenticated && user && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#334155] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-emerald-700 dark:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider shrink-0 ${getRoleBadge(
                      user.role
                    )}`}
                  >
                    {formatRoleLabel(user.role)}
                  </span>
                </div>
              )}

              {/* Primary Navigation Links */}
              <nav className="space-y-1" aria-label="Mobile Primary Navigation">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1 block">
                  {t('nav.mainMenu')}
                </span>
                {primaryNavItems.map((item) => (
                  <NavLink
                    key={`mobile-${item.id}`}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className="flex items-center min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors"
                    activeClassName="bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30 font-semibold"
                  >
                    {getNavLabel(item)}
                  </NavLink>
                ))}
              </nav>

              {/* Secondary Navigation Links (if any) */}
              {secondaryNavItems.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-[#334155] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1 block">
                    {getDropdownLabel()}
                  </span>
                  {secondaryNavItems.map((item) => (
                    <NavLink
                      key={`mobile-sec-${item.id}`}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className="flex items-center min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors"
                      activeClassName="bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30 font-semibold"
                    >
                      {getNavLabel(item)}
                    </NavLink>
                  ))}
                </div>
              )}

              {/* Preferences & Accessibility Section */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#334155] space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block">
                  {t('accessibility.settingsTitle')}
                </span>

                {/* Mobile Language Selector */}
                <div className="px-1">
                  <LanguageSelector variant="default" />
                </div>

                {/* Mobile Theme Toggle */}
                <div className="px-1">
                  <ThemeToggle showLabel className="w-full justify-between min-h-[44px] px-3" />
                </div>

                {/* Mobile Notifications Link (if authenticated) */}
                {isAuthenticated && (
                  <NavLink
                    to="/notifications"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-between min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <BellIcon className="w-4.5 h-4.5" />
                      <span>{t('notifications.title') || 'Notifications'}</span>
                    </span>
                  </NavLink>
                )}
              </div>
            </div>

            {/* Bottom Drawer Actions */}
            <div className="p-5 border-t border-slate-200 dark:border-[#334155] bg-slate-50/60 dark:bg-[#182230]/60 shrink-0">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <LogOutIcon className="w-4.5 h-4.5" />
                  <span>{t('nav.signOut')}</span>
                </button>
              ) : (
                <div className="space-y-2.5">
                  <NavLink
                    to="/report"
                    onClick={closeMobileMenu}
                    className="w-full flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors shadow-2xs"
                  >
                    {t('nav.reportIssue')}
                  </NavLink>
                  <div className="grid grid-cols-2 gap-2">
                    <NavLink
                      to="/login"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1F2937] text-slate-700 dark:text-[#F8FAFC] text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#273548] transition-colors"
                    >
                      {t('nav.signIn')}
                    </NavLink>
                    <NavLink
                      to="/register"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1F2937] text-slate-700 dark:text-[#F8FAFC] text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#273548] transition-colors"
                    >
                      {t('nav.register')}
                    </NavLink>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
