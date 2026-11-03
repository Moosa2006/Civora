import { useState, type FormEvent } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { getRoleLandingPage } from '../config/navigation';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { PageHeading } from '../components/ui/PageHeading';

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingContractorNotice, setPendingContractorNotice] = useState<{
    companyName?: string;
    registrationNumber?: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setPendingContractorNotice(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      navigate(getRoleLandingPage(result.user?.role));
    } else {
      if (result.errorCode === 'CONTRACTOR_APPLICATION_PENDING') {
        setPendingContractorNotice({
          companyName: result.details?.companyName || 'Registered Enterprise',
          registrationNumber: result.details?.registrationNumber || '',
        });
      }
      setErrorMessage(result.error || 'Authentication failed.');
    }
  };

  if (isAuthenticated && user) {
    return (
      <Container size="md" className="py-12">
        <Card className="text-center p-8 border-[#E5E7EB] dark:border-[#374151]">
          <div className="w-12 h-12 rounded-full bg-[#0B3D2E]/10 text-[#0B3D2E] dark:bg-[#34D399]/15 dark:text-[#34D399] mx-auto flex items-center justify-center text-xl font-bold mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold font-heading text-[#111827] dark:text-[#F9FAFB] mb-2">Already Signed In</h2>
          <p className="text-[#6B7280] dark:text-[#D1D5DB] text-sm mb-6">
            You are currently authenticated as <strong className="text-[#111827] dark:text-[#F9FAFB]">{user.name}</strong> ({user.email}) with role <strong className="text-[#0B3D2E] dark:text-[#34D399]">{user.role}</strong>.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/')}>
              Return to Overview
            </Button>
            <Button variant="secondary" onClick={() => navigate('/report')}>
              Report Civic Issue
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="sm">
      <div
        data-scroll-reveal="true"
        data-reveal-distance="10"
        className="flex justify-center mb-4"
      >
        <img
          src="/civora_icon.jpeg"
          alt="Civora"
          className="w-14 h-14 rounded-2xl object-contain bg-white p-1 shadow-2xs border border-[#E5E7EB] dark:border-[#374151] dark:ring-1 dark:ring-white/15"
        />
      </div>

      <PageHeading
        title={t('auth.signInTitle')}
        description={t('auth.signInDesc')}
        className="text-center md:justify-center mb-8"
      />

      <Card className="p-6 md:p-8 shadow-sm">
        {pendingContractorNotice ? (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50/70 dark:bg-amber-500/10 text-[#92400E] dark:text-[#FCD34D]">
            <h4 className="font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
              Contractor Application Under Review
            </h4>
            <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed mb-3">
              Application for <strong>{pendingContractorNotice.companyName}</strong> (Reg: {pendingContractorNotice.registrationNumber || 'Pending'}) is currently under review by municipal administration. Access will be unlocked once your credentials are verified.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/register?tab=status')}
              className="text-xs"
            >
              Check Live Application Status →
            </Button>
          </div>
        ) : errorMessage ? (
          <Alert variant="error" className="mb-6" title="Sign In Failed">
            {errorMessage}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField label={t('auth.emailLabel')} required id="login-email">
            <TextInput
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label={t('auth.passwordLabel')} required id="login-password">
            <div className="relative">
              <TextInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="civora-liquid-btn civora-liquid-btn--secondary text-xs font-medium px-2.5 py-1 rounded-md"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={isSubmitting}
          >
            {t('auth.submitSignIn')}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#374151] text-center text-sm text-[#6B7280] dark:text-[#D1D5DB] space-y-2.5">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span>Don't have an account?</span>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 rounded-md font-semibold text-sm"
            >
              Register as Citizen
            </button>
            <span className="text-[#D1D5DB] dark:text-[#4B5563]">•</span>
            <button
              type="button"
              onClick={() => navigate('/register?tab=contractor')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 rounded-md font-semibold text-sm"
            >
              Register as Contractor
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate('/register?tab=status')}
              className="civora-liquid-btn civora-liquid-btn--ghost px-3 py-1 rounded-md text-xs font-medium"
            >
              Check Contractor Application Status
            </button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
