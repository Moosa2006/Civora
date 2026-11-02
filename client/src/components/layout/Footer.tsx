import { Container } from './Container.js';
import { NavLink } from '../../router/NavLink.js';
import { useTranslation } from '../../context/useTranslation.js';

const CURRENT_YEAR = new Date().getFullYear();

interface FooterLinkProps {
  to: string;
  label: string;
}

function FooterLink({ to, label }: FooterLinkProps) {
  return (
    <li>
      <NavLink
        to={to}
        className="group inline-flex items-center text-xs text-[#D6E5DE] hover:text-[#63D6B5] transition-all duration-200 ease-out hover:translate-x-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#63D6B5] rounded-xs"
      >
        <span className="relative after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[1px] after:bg-[#63D6B5] group-hover:after:w-full after:transition-all after:duration-200">
          {label}
        </span>
      </NavLink>
    </li>
  );
}

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-[#285044] bg-[#0B2921] text-[#D6E5DE] font-sans mt-12 sm:mt-16">
      <Container size="lg" className="py-8 sm:py-10">
        {/* Main 4-Column Structured Desktop Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Column 1: Civora Branding & Purpose */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-2.5">
              <img
                src="/civora_icon.jpeg"
                alt="Civora Emblem"
                className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 shrink-0 shadow-xs"
              />
              <span className="text-base font-heading font-bold text-white tracking-tight">Civora</span>
            </div>
            <p className="text-xs text-[#D6E5DE] leading-relaxed">
              {t('footer.civicMission')}
            </p>
            <div className="text-[11px] text-[#B7CCC2] font-medium leading-tight">
              Civic Issue Reporting &amp; Public Accountability Platform
            </div>
          </div>

          {/* Column 2: Citizen Services */}
          <div>
            <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-white mb-2.5">
              Citizen Services
            </h4>
            <ul className="space-y-1.5" role="list">
              <FooterLink to="/report" label={t('nav.reportIssue')} />
              <FooterLink to="/track" label={t('nav.trackComplaint')} />
              <FooterLink to="/transparency" label={t('nav.transparency')} />
              <FooterLink to="/engagement" label={t('nav.engagement')} />
              <FooterLink to="/my-complaints" label={t('nav.myComplaints')} />
            </ul>
          </div>

          {/* Column 3: Accountability & Governance */}
          <div>
            <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-white mb-2.5">
              Accountability &amp; Governance
            </h4>
            <ul className="space-y-1.5" role="list">
              <FooterLink to="/" label={t('home.howItWorksTitle')} />
              <FooterLink to="/transparency" label={t('transparency.departmentTitle')} />
              <FooterLink to="/sla" label={t('nav.slaEscalations')} />
              <FooterLink to="/official/workspace" label={t('nav.fieldOps')} />
              <FooterLink to="/admin/complaints" label={t('nav.staffTriage')} />
            </ul>
          </div>

          {/* Column 4: Public Standards */}
          <div className="space-y-2">
            <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-white mb-2.5">
              Public Standards
            </h4>
            <div className="space-y-2 text-xs text-[#D6E5DE]">
              <div>
                <strong className="text-white block font-semibold text-[11px]">Verified Resolution:</strong>
                <span className="text-[#B7CCC2] text-[11px] leading-snug block">
                  Mandatory timestamped photographic evidence required before issue closure.
                </span>
              </div>
              <div>
                <strong className="text-white block font-semibold text-[11px]">Citizen Privacy:</strong>
                <span className="text-[#B7CCC2] text-[11px] leading-snug block">
                  Identities and high-precision coordinates strictly masked from public lists.
                </span>
              </div>
              <div>
                <strong className="text-white block font-semibold text-[11px]">Accessibility Guarantee:</strong>
                <span className="text-[#B7CCC2] text-[11px] leading-snug block">
                  Engineered for WCAG 2.2 AA standards with keyboard navigation and high contrast.
                </span>
              </div>
              <div className="pt-0.5">
                <NavLink
                  to="/rules"
                  className="group inline-flex items-center gap-1 text-[11px] text-[#63D6B5] hover:text-white font-medium transition-colors"
                >
                  <span className="underline underline-offset-2">{t('footer.platformRules')}</span>
                  <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Bottom Bar */}
        <div className="pt-4 mt-6 border-t border-[#285044] flex flex-col sm:flex-row items-center justify-between text-xs text-[#B7CCC2] gap-2.5">
          <p className="text-[11px] sm:text-xs">
            &copy; {CURRENT_YEAR} Civora. {t('footer.rightsReserved')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#B7CCC2]">
            <span className="text-[#D6E5DE] font-medium">Verified Evidence</span>
            <span className="text-[#285044]" aria-hidden="true">&bull;</span>
            <span className="text-[#D6E5DE] font-medium">Auditable Timestamps</span>
            <span className="text-[#285044]" aria-hidden="true">&bull;</span>
            <span className="text-[#D6E5DE] font-medium">{t('footer.accessibilityNotice')}</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
