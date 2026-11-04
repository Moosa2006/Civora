import { lazy, Suspense } from 'react';
import { Router, useRouter } from './router';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { I18nProvider } from './context/I18nContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';
import { LoadingIndicator } from './components/ui/LoadingIndicator';

// Eager load core landing page for instant first contentful paint
import { LandingPage } from './pages/LandingPage';

// Lazy load route pages for performance & minimal initial bundle
const TransparencyPage = lazy(() => import('./pages/TransparencyPage').then((m) => ({ default: m.TransparencyPage })));
const ReportIssuePage = lazy(() => import('./pages/ReportIssuePage').then((m) => ({ default: m.ReportIssuePage })));
const TrackComplaintPage = lazy(() => import('./pages/TrackComplaintPage').then((m) => ({ default: m.TrackComplaintPage })));
const MyComplaintsPage = lazy(() => import('./pages/MyComplaintsPage').then((m) => ({ default: m.MyComplaintsPage })));
const AdminComplaintsPage = lazy(() => import('./pages/AdminComplaintsPage').then((m) => ({ default: m.AdminComplaintsPage })));
const OfficialWorkspacePage = lazy(() => import('./pages/OfficialWorkspacePage').then((m) => ({ default: m.OfficialWorkspacePage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })));
const SlaManagementPage = lazy(() => import('./pages/SlaManagementPage').then((m) => ({ default: m.SlaManagementPage })));
const AdminSystemPage = lazy(() => import('./pages/AdminSystemPage').then((m) => ({ default: m.AdminSystemPage })));
const EngagementHubPage = lazy(() => import('./pages/EngagementHubPage').then((m) => ({ default: m.EngagementHubPage })));
const ProposalSubmitPage = lazy(() => import('./pages/ProposalSubmitPage').then((m) => ({ default: m.ProposalSubmitPage })));
const ProposalDetailPage = lazy(() => import('./pages/ProposalDetailPage').then((m) => ({ default: m.ProposalDetailPage })));
const PollDetailPage = lazy(() => import('./pages/PollDetailPage').then((m) => ({ default: m.PollDetailPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const CivicMapPage = lazy(() => import('./pages/CivicMapPage').then((m) => ({ default: m.CivicMapPage })));
const ModerationQueuePage = lazy(() => import('./pages/ModerationQueuePage').then((m) => ({ default: m.ModerationQueuePage })));
const PlatformRulesPage = lazy(() => import('./pages/PlatformRulesPage').then((m) => ({ default: m.PlatformRulesPage })));
const TendersPage = lazy(() => import('./pages/TendersPage').then((m) => ({ default: m.TendersPage })));
const TenderDetailPage = lazy(() => import('./pages/TenderDetailPage').then((m) => ({ default: m.TenderDetailPage })));
const ContractorWorkspacePage = lazy(() => import('./pages/ContractorWorkspacePage').then((m) => ({ default: m.ContractorWorkspacePage })));
const AdminTendersPage = lazy(() => import('./pages/AdminTendersPage').then((m) => ({ default: m.AdminTendersPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function AppContent() {
  const { currentPath } = useRouter();
  // Strip query string and normalize trailing slash (except root '/')
  const rawPath = currentPath.split('?')[0];
  const cleanPath = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : (rawPath || '/');

  const renderCurrentPage = () => {
    if (cleanPath === '/engagement') {
      return <EngagementHubPage />;
    }
    if (cleanPath === '/engagement/proposals/new') {
      return <ProposalSubmitPage />;
    }
    if (cleanPath.startsWith('/engagement/proposals/')) {
      return <ProposalDetailPage />;
    }
    if (cleanPath.startsWith('/engagement/polls/')) {
      return <PollDetailPage />;
    }
    if (cleanPath.startsWith('/tenders/') && cleanPath !== '/tenders') {
      return <TenderDetailPage />;
    }

    switch (cleanPath) {
      case '/':
      case '':
      case '/dashboard':
        return <LandingPage />;
      case '/map':
      case '/explore':
        return <CivicMapPage />;
      case '/transparency':
        return <TransparencyPage />;
      case '/report':
        return <ReportIssuePage />;
      case '/track':
        return <TrackComplaintPage />;
      case '/my-complaints':
        return <MyComplaintsPage />;
      case '/admin':
      case '/admin/complaints':
        return <AdminComplaintsPage />;
      case '/admin/moderation':
        return <ModerationQueuePage />;
      case '/admin/system':
      case '/admin/health':
        return <AdminSystemPage />;
      case '/rules':
        return <PlatformRulesPage />;
      case '/tenders':
        return <TendersPage />;
      case '/contractor':
      case '/contractor/workspace':
        return <ContractorWorkspacePage />;
      case '/admin/tenders':
      case '/official/tenders':
        return <AdminTendersPage />;
      case '/official':
      case '/official/workspace':
        return <OfficialWorkspacePage />;
      case '/notifications':
        return <NotificationsPage />;
      case '/settings/notifications':
        return <NotificationPreferencesPage />;
      case '/sla':
        return <SlaManagementPage />;
      case '/login':
        return <LoginPage />;
      case '/register':
        return <RegisterPage />;
      default:
        return <NotFoundPage />;
    }
  };

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh] py-16" aria-live="polite">
            <LoadingIndicator size="lg" label="Loading page..." />
          </div>
        }
      >
        {renderCurrentPage()}
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <I18nProvider>
            <ThemeProvider>
              <AccessibilityProvider>
                <AppContent />
              </AccessibilityProvider>
            </ThemeProvider>
          </I18nProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}
