import { useState, type FormEvent } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
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
        <Card className="text-center p-8 border-[#DED8CB] dark:border-[#283931]">
          <div className="w-12 h-12 rounded-full bg-[#173D32]/10 text-[#173D32] dark:bg-[#7BC4B2]/20 dark:text-[#7BC4B2] mx-auto flex items-center justify-center text-xl font-bold mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold font-heading text-[#202522] dark:text-[#E8F0EC] mb-2">Already Signed In</h2>
          <p className="text-[#4A5750] dark:text-[#A8BFAE] text-sm mb-6">
            You are currently authenticated as <strong className="text-[#202522] dark:text-[#E8F0EC]">{user.name}</strong> ({user.email}) with role <strong className="text-[#173D32] dark:text-[#7BC4B2]">{user.role}</strong>.
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
    <Container size="sm" className="py-12">
      <PageHeading
        title="Sign In to Civora"
        description="Access your civic complaint tracker, contractor workspace, official department queue, or administrative dashboard."
        className="text-center mb-8"
      />

      <Card className="p-6 md:p-8 border-[#DED8CB] dark:border-[#283931] shadow-md">
        {pendingContractorNotice ? (
          <div className="mb-6 p-4 rounded-xl border border-[#9C6D19]/40 bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#9C6D19] dark:text-[#E8C07D]">
            <h4 className="font-bold font-heading text-[#202522] dark:text-[#E8F0EC] flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#9C6D19] animate-pulse"></span>
              Contractor Application Under Review
            </h4>
            <p className="text-xs text-[#4A5750] dark:text-[#A8BFAE] leading-relaxed mb-3">
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
          <FormField label="Email Address" required id="login-email">
            <TextInput
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., citizen@example.com"
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="Password" required id="login-password">
            <div className="relative">
              <TextInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#4A5750] hover:text-[#202522] dark:text-[#A8BFAE] dark:hover:text-[#E8F0EC] px-2 py-1 rounded bg-[#ECE7DB] hover:bg-[#DED8CB] dark:bg-[#1D2A25] dark:hover:bg-[#283931] transition-colors border border-[#DED8CB] dark:border-[#283931]"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={isSubmitting}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#DED8CB] dark:border-[#283931] text-center text-sm text-[#54625A] dark:text-[#C5D4C9] space-y-2">
          <div>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-[#173D32] dark:text-[#7BC4B2] font-semibold underline underline-offset-4 cursor-pointer hover:underline"
            >
              Register as Citizen
            </button>
            <span className="mx-2 text-[#DED8CB] dark:text-[#283931]">•</span>
            <button
              type="button"
              onClick={() => navigate('/register?tab=contractor')}
              className="text-[#173D32] dark:text-[#7BC4B2] font-semibold underline underline-offset-4 cursor-pointer hover:underline"
            >
              Register as Contractor
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate('/register?tab=status')}
              className="text-xs text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#F5F2EA] underline underline-offset-2 cursor-pointer font-medium"
            >
              Check Contractor Application Status
            </button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
