import { useMemo } from 'react';
import DoodleCrewFooter, {
  type FooterAction,
  type FooterColumn,
  type FooterLink,
} from '../ui/doodle-crew-footer.js';
import { useRouter } from '../../router/index.js';
import { useTranslation } from '../../context/useTranslation.js';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  const { navigate } = useRouter();
  const { t, locale } = useTranslation();

  const aboutLabel = locale === 'en' ? 'About' : t('nav.aboutCivora');

  const columns = useMemo<FooterColumn[]>(
    () => [
      {
        title: 'Explore',
        links: [
          { label: t('nav.home'), href: '/' },
          { label: t('nav.transparency'), href: '/transparency' },
          { label: t('nav.publicTenders'), href: '/tenders' },
          { label: aboutLabel, href: '/#about' },
        ],
      },
      {
        title: 'Citizen Services',
        links: [
          { label: t('nav.reportIssue'), href: '/report' },
          { label: t('nav.trackComplaint'), href: '/track' },
          { label: t('nav.civicMap'), href: '/map' },
          { label: t('nav.civicEngagement'), href: '/engagement' },
        ],
      },
      {
        title: 'Accountability',
        links: [
          { label: t('nav.myComplaints'), href: '/my-complaints' },
          { label: t('nav.slaEscalations'), href: '/sla' },
          { label: t('footer.platformRules'), href: '/rules' },
        ],
      },
      {
        title: 'Portals',
        links: [
          { label: t('nav.signIn'), href: '/login' },
          { label: t('nav.register'), href: '/register' },
          { label: t('nav.fieldOps'), href: '/official/workspace' },
          { label: 'Contractor Portal', href: '/contractor' },
        ],
      },
    ],
    [t, aboutLabel],
  );

  const actions = useMemo<FooterAction[]>(
    () => [
      {
        label: t('home.reportCta'),
        href: '/report',
        icon: 'bolt',
        variant: 'solid',
      },
      {
        label: t('nav.transparency'),
        href: '/transparency',
        icon: 'sparkle',
        variant: 'outline',
      },
    ],
    [t],
  );

  const legal = useMemo<FooterLink[]>(
    () => [
      { label: locale === 'en' ? 'Platform Rules' : t('footer.platformRules'), href: '/rules' },
      { label: t('nav.transparency'), href: '/transparency' },
      { label: aboutLabel, href: '/#about' },
    ],
    [t, locale, aboutLabel],
  );

  const socials = useMemo<FooterLink[]>(
    () => [
      { label: t('nav.civicMap'), href: '/map' },
      { label: t('nav.trackComplaint'), href: '/track' },
      { label: t('nav.civicEngagement'), href: '/engagement' },
      { label: t('nav.publicTenders'), href: '/tenders' },
    ],
    [t],
  );

  return (
    <DoodleCrewFooter
      wordmark="CIVORA"
      brand={t('nav.brand')}
      logoSrc="/civora_icon.jpeg"
      blurb={t('footer.civicMission')}
      tagline="The Voice of the People, The Will of the Nation."
      columns={columns}
      actions={actions}
      copyright={`© ${CURRENT_YEAR} ${t('footer.rightsReserved')}`}
      legal={legal}
      socials={socials}
      preset="auto"
      onNavigate={navigate}
    />
  );
}
