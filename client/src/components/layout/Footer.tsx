import { Container } from './Container.js';
import { NavLink } from '../../router/NavLink.js';
import { useTranslation } from '../../context/useTranslation.js';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-[#173D32] bg-[#102620] mt-16 text-[#A8BFAE] font-sans">
      <Container size="lg" className="py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Civora Mission */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#F4F0E6] text-[#173D32] flex items-center justify-center font-heading font-bold text-sm">
                C
              </div>
              <span className="text-base font-heading font-bold text-[#F4F0E6] tracking-tight">Civora</span>
            </div>
            <p className="text-sm text-[#A8BFAE] leading-relaxed">
              {t('footer.civicMission')}
            </p>
            <div className="text-xs text-[#C5D4C9] font-medium">
              Civic Issue Reporting & Public Accountability Platform
            </div>
          </div>

          {/* Citizen Services */}
          <div>
            <h4 className="text-xs font-heading font-semibold uppercase tracking-wider text-[#F4F0E6] mb-3">
              Citizen Services
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <NavLink to="/report" className="hover:text-white transition-colors">
                  {t('nav.reportIssue')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/track" className="hover:text-white transition-colors">
                  {t('nav.trackComplaint')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/transparency" className="hover:text-white transition-colors">
                  {t('nav.transparency')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/engagement" className="hover:text-white transition-colors">
                  {t('nav.engagement')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/my-complaints" className="hover:text-white transition-colors">
                  {t('nav.myComplaints')}
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Platform & Accountability */}
          <div>
            <h4 className="text-xs font-heading font-semibold uppercase tracking-wider text-[#F4F0E6] mb-3">
              Accountability & Governance
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <NavLink to="/" className="hover:text-white transition-colors">
                  {t('home.howItWorksTitle')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/transparency" className="hover:text-white transition-colors">
                  {t('transparency.departmentTitle')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/sla" className="hover:text-white transition-colors">
                  {t('nav.slaEscalations')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/official/workspace" className="hover:text-white transition-colors">
                  {t('nav.fieldOps')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/complaints" className="hover:text-white transition-colors">
                  {t('nav.staffTriage')}
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Public Standards & Policies */}
          <div>
            <h4 className="text-xs font-heading font-semibold uppercase tracking-wider text-[#F4F0E6] mb-3">
              Public Standards
            </h4>
            <div className="space-y-2.5 text-xs text-[#A8BFAE]">
              <p>
                <strong className="text-[#F4F0E6] block">Verified Resolution:</strong>
                Issues are marked resolved only with photographic before-and-after proof.
              </p>
              <p>
                <strong className="text-[#F4F0E6] block">Citizen Privacy:</strong>
                Personal identities are shielded from public transparency views.
              </p>
              <p>
                <strong className="text-[#F4F0E6] block">Accessibility Guarantee:</strong>
                Designed for WCAG 2.2 AA compliance with multilingual support and keyboard navigation.
              </p>
              <div className="pt-1.5 flex flex-col gap-1.5">
                <NavLink to="/rules" className="text-[#7BC4B2] hover:underline font-medium transition-colors">
                  {t('footer.platformRules')} &rarr;
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#173D32] flex flex-col sm:flex-row items-center justify-between text-xs text-[#C5D4C9] gap-4">
          <p>&copy; {CURRENT_YEAR} {t('footer.rightsReserved')}</p>
          <div className="flex items-center gap-4">
            <span className="text-[#E8F0EC]">Verified Evidence</span>
            <span className="text-[#A8BFAE]">&bull;</span>
            <span className="text-[#E8F0EC]">Auditable Timestamps</span>
            <span className="text-[#A8BFAE]">&bull;</span>
            <span className="text-[#E8F0EC]">{t('footer.accessibilityNotice')}</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
