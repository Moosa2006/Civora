import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { PageHeading } from '../components/ui/PageHeading';

type RegisterTab = 'citizen' | 'contractor' | 'status';

interface ContractorStatusData {
  companyName: string;
  registrationNumber: string;
  contactPerson: string;
  email: string;
  licenseClass: string;
  workCategories: string[];
  operatingRegion: string;
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  submittedAt: string;
  verifiedAt: string | null;
  reviewNotes: string | null;
}

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const { currentPath, navigate } = useRouter();

  // Read initial tab from URL query parameter
  const searchParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
  const urlTab = searchParams.get('tab');
  const initialTab: RegisterTab = urlTab === 'contractor' ? 'contractor' : urlTab === 'status' ? 'status' : 'citizen';

  const [activeTab, setActiveTab] = useState<RegisterTab>(initialTab);

  // Sync tab with URL parameter if it changes
  useEffect(() => {
    const params = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
    const tab = params.get('tab');
    if (tab === 'contractor' || tab === 'status' || tab === 'citizen') {
      setActiveTab(tab);
    }
  }, [currentPath]);

  // Citizen Registration Form State
  const [citName, setCitName] = useState('');
  const [citEmail, setCitEmail] = useState('');
  const [citPhone, setCitPhone] = useState('');
  const [citPassword, setCitPassword] = useState('');
  const [citConfirmPassword, setCitConfirmPassword] = useState('');
  const [citShowPassword, setCitShowPassword] = useState(false);

  // Contractor Application Form State
  const [compName, setCompName] = useState('');
  const [compRegNumber, setCompRegNumber] = useState('');
  const [compPan, setCompPan] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compRegion, setCompRegion] = useState('Bengaluru Urban & BBMP Zones');
  const [compLicenseClass, setCompLicenseClass] = useState('CLASS_B');
  const [compCategories, setCompCategories] = useState<string[]>(['ROADS_POTHOLES']);
  const [contName, setContName] = useState('');
  const [contEmail, setContEmail] = useState('');
  const [contPhone, setContPhone] = useState('');
  const [contPassword, setContPassword] = useState('');
  const [contConfirmPassword, setContConfirmPassword] = useState('');
  const [contShowPassword, setContShowPassword] = useState(false);

  // Contractor Status Search State
  const [statusQuery, setStatusQuery] = useState('');
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<ContractorStatusData | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // General Form States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedContractorData, setSubmittedContractorData] = useState<any | null>(null);

  const availableCategories = [
    { id: 'ROADS_POTHOLES', label: 'Roads, Footpaths & Potholes' },
    { id: 'DRAINAGE_OVERFLOW', label: 'Water Supply & Storm Drainage' },
    { id: 'SOLID_WASTE', label: 'Sanitation & Solid Waste' },
    { id: 'ELECTRICAL_STREETLIGHTS', label: 'Electrical & Street Lighting' },
    { id: 'INFRASTRUCTURE_PARKS', label: 'Town Planning & Public Infrastructure' },
  ];

  const handleCategoryToggle = (catId: string) => {
    setCompCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleCitizenSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!citName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!citEmail.trim() || !citEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!citPassword || citPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (citPassword !== citConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await register(citName.trim(), citEmail.trim(), citPassword, citPhone.trim() || undefined);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('Your Citizen account has been registered successfully! Redirecting...');
      setTimeout(() => {
        navigate('/');
      }, 1200);
    } else {
      setErrorMessage(result.error || 'Registration failed. Please check your information.');
    }
  };

  const handleContractorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmittedContractorData(null);

    // Validate Company fields
    if (!compName.trim()) {
      setErrorMessage('Please enter the registered company or business name.');
      return;
    }
    if (!compRegNumber.trim()) {
      setErrorMessage('Please enter the company registration identifier.');
      return;
    }
    if (!compPan.trim()) {
      setErrorMessage('Please enter the corporate PAN or Tax ID.');
      return;
    }
    if (!compAddress.trim()) {
      setErrorMessage('Please provide the registered business address.');
      return;
    }
    if (compCategories.length === 0) {
      setErrorMessage('Please select at least one municipal work category.');
      return;
    }

    // Validate Contact / Signatory fields
    if (!contName.trim()) {
      setErrorMessage('Please enter the authorized contact person full name.');
      return;
    }
    if (!contEmail.trim() || !contEmail.includes('@')) {
      setErrorMessage('Please enter a valid official work email address.');
      return;
    }
    if (!contPhone.trim() || contPhone.trim().length < 7) {
      setErrorMessage('Please enter a valid official contact telephone number.');
      return;
    }
    if (!contPassword || contPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (contPassword !== contConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register-contractor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: contName.trim(),
          email: contEmail.trim(),
          phone: contPhone.trim(),
          password: contPassword,
          companyName: compName.trim(),
          registrationNumber: compRegNumber.trim(),
          panOrTaxId: compPan.trim(),
          businessAddress: compAddress.trim(),
          operatingRegion: compRegion.trim(),
          licenseClass: compLicenseClass,
          workCategories: compCategories,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Contractor application submission failed.');
        return;
      }

      setSubmittedContractorData(json.data.application);
      setSuccessMessage('Contractor application submitted successfully for administrative review.');
    } catch {
      setErrorMessage('Unable to connect to the onboarding server. Please check your network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusSearch = async (e: FormEvent) => {
    e.preventDefault();
    setStatusError(null);
    setStatusResult(null);

    const q = statusQuery.trim();
    if (!q) {
      setStatusError('Please provide your work email address or registration number.');
      return;
    }

    setIsSearchingStatus(true);
    try {
      const paramName = q.includes('@') ? 'email' : 'registrationNumber';
      const res = await fetch(`/api/auth/contractor-application-status?${paramName}=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setStatusError(json.error?.message || 'No matching contractor application found.');
        return;
      }

      setStatusResult(json.data);
    } catch {
      setStatusError('Failed to retrieve application status. Please try again.');
    } finally {
      setIsSearchingStatus(false);
    }
  };

  if (isAuthenticated) {
    return (
      <Container size="md" className="py-12">
        <Card className="text-center p-8 border border-[#0B3D2E]/30 dark:border-[#34D399]/35 bg-[#E8F1EC] dark:bg-[#1F2937]">
          <h2 className="text-xl font-semibold text-[#111827] dark:text-[#F9FAFB] mb-2">You are already signed in</h2>
          <p className="text-[#374151] dark:text-[#D1D5DB] text-sm mb-6">
            You are currently authenticated in Civora. Registration is only required for new platform accounts.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Return to Overview
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-12">
      <div className="flex justify-center mb-4">
        <img
          src="/civora_icon.jpeg"
          alt="Civora"
          className="w-14 h-14 rounded-2xl object-contain bg-white p-1 shadow-xs border border-gray-100 dark:border-[#374151] dark:ring-1 dark:ring-white/15"
        />
      </div>

      <PageHeading
        title="Civora Registration & Onboarding"
        description="Create your citizen account to report and track neighborhood issues, or register your engineering firm for municipal civic works procurement."
        className="text-center md:justify-center mb-6"
      />

      {/* Tab Selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex flex-wrap justify-center gap-1.5 rounded-xl p-1.5 bg-[#F3F4F6]/80 dark:bg-[#273548]/80 border border-[#E5E7EB] dark:border-[#374151] shadow-2xs">
          <button
            type="button"
            data-active={activeTab === 'citizen'}
            onClick={() => {
              setActiveTab('citizen');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`civora-liquid-tab px-5 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'citizen' ? 'font-semibold' : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            Citizen Account
          </button>
          <button
            type="button"
            data-active={activeTab === 'contractor'}
            onClick={() => {
              setActiveTab('contractor');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`civora-liquid-tab px-5 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'contractor' ? 'font-semibold' : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            Contractor Application
          </button>
          <button
            type="button"
            data-active={activeTab === 'status'}
            onClick={() => {
              setActiveTab('status');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`civora-liquid-tab px-5 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'status' ? 'font-semibold' : 'text-[#4B5563] dark:text-[#D1D5DB]'
            }`}
          >
            Track Status
          </button>
        </div>
      </div>

      {/* 1. CITIZEN REGISTRATION FORM */}
      {activeTab === 'citizen' && (
        <Card className="max-w-xl mx-auto p-6 md:p-8 shadow-xs">
          <div className="mb-6 pb-4 border-b border-[#E5E7EB] dark:border-[#374151]">
            <h3 className="text-lg font-semibold text-[#111827] dark:text-[#F9FAFB]">Public Citizen Registration</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
              Immediate access to report potholes, overflowing drains, broken lights, and monitor municipal SLAs.
            </p>
          </div>

          {errorMessage && (
            <Alert variant="error" className="mb-6" title="Registration Error">
              {errorMessage}
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success" className="mb-6" title="Success">
              {successMessage}
            </Alert>
          )}

          <form onSubmit={handleCitizenSubmit} className="space-y-4" noValidate>
            <FormField label="Full Name" required id="reg-name">
              <TextInput
                id="reg-name"
                type="text"
                value={citName}
                onChange={(e) => setCitName(e.target.value)}
                placeholder="e.g., Aarav Sharma"
                autoComplete="name"
                required
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Email Address" required id="reg-email" helperText="Used for tracking updates and sign-in.">
              <TextInput
                id="reg-email"
                type="email"
                value={citEmail}
                onChange={(e) => setCitEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Phone Number (Optional)" id="reg-phone" helperText="For emergency civic alerts and SMS updates.">
              <TextInput
                id="reg-phone"
                type="tel"
                value={citPhone}
                onChange={(e) => setCitPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Password" required id="reg-password" helperText="Minimum 8 characters.">
              <div className="relative">
                <TextInput
                  id="reg-password"
                  type={citShowPassword ? 'text' : 'password'}
                  value={citPassword}
                  onChange={(e) => setCitPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  className="pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => setCitShowPassword((prev) => !prev)}
                    className="civora-liquid-btn civora-liquid-btn--secondary text-xs font-medium px-2.5 py-1 rounded-md"
                    tabIndex={-1}
                  >
                    {citShowPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </FormField>

            <FormField label="Confirm Password" required id="reg-confirm-password">
              <TextInput
                id="reg-confirm-password"
                type={citShowPassword ? 'text' : 'password'}
                value={citConfirmPassword}
                onChange={(e) => setCitConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
              />
            </FormField>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
              >
                Create Citizen Account
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#374151] text-center text-sm text-[#6B7280] dark:text-[#D1D5DB]">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 rounded-md font-semibold text-sm"
            >
              Sign In Here
            </button>
          </div>
        </Card>
      )}

      {/* 2. CONTRACTOR APPLICATION FORM */}
      {activeTab === 'contractor' && (
        <Card className="max-w-2xl mx-auto p-6 md:p-8 shadow-xs">
          <div className="mb-6 pb-4 border-b border-[#E5E7EB] dark:border-[#374151]">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F1EC] dark:bg-[#34D399]/12 text-[#185541] dark:text-[#34D399] border border-[#A8C9B8] dark:border-[#34D399]/35">
                Verified Vendor Portal
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">Contractor Organization Onboarding</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1 leading-relaxed">
              Register your engineering company or authorized firm to participate in e-tenders, submit bids, and execute public infrastructure work orders. All applications require administrative verification before portal bidding privileges are enabled.
            </p>
          </div>

          {errorMessage && (
            <Alert variant="error" className="mb-6" title="Application Error">
              {errorMessage}
            </Alert>
          )}

          {submittedContractorData ? (
            <div className="p-6 rounded-xl border border-[#A8C9B8] dark:border-[#34D399]/35 bg-[#E8F1EC]/60 dark:bg-[#34D399]/10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#0B3D2E] dark:bg-[#0D7A58] text-white mx-auto flex items-center justify-center text-xl font-bold">
                ✓
              </div>
              <h4 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">Application Received & Under Review</h4>
              <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed max-w-md mx-auto">
                Your application for <strong>{submittedContractorData.companyName}</strong> has been submitted to the municipal procurement board.
              </p>

              <div className="p-4 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Registration Number:</span>
                  <span className="font-mono font-medium text-[#111827] dark:text-[#F9FAFB]">{submittedContractorData.registrationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Class:</span>
                  <span className="font-medium text-[#185541] dark:text-[#34D399]">{submittedContractorData.licenseClass}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Official Contact:</span>
                  <span className="font-medium text-[#111827] dark:text-[#F9FAFB]">{submittedContractorData.contactPerson}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Status:</span>
                  <Badge variant="warning">UNDER_REVIEW</Badge>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    setStatusQuery(submittedContractorData.registrationNumber);
                    setActiveTab('status');
                  }}
                >
                  Track Live Status
                </Button>
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Return to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleContractorSubmit} className="space-y-6" noValidate>
              {/* Section A: Company Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#D1D5DB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
                  1. Company & Entity Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Registered Company Name" required id="comp-name">
                    <TextInput
                      id="comp-name"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g., Apex Urban Infrastructure Ltd"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <FormField label="Registration / CIN Number" required id="comp-reg" helperText="State or Municipal PWD registration ID">
                    <TextInput
                      id="comp-reg"
                      value={compRegNumber}
                      onChange={(e) => setCompRegNumber(e.target.value)}
                      placeholder="e.g., REG-2024-KA-8810"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Tax / PAN / GSTIN ID" required id="comp-pan">
                    <TextInput
                      id="comp-pan"
                      value={compPan}
                      onChange={(e) => setCompPan(e.target.value)}
                      placeholder="e.g., AAACA1234F"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <FormField label="Contractor License Class" required id="comp-class">
                    <Select
                      id="comp-class"
                      value={compLicenseClass}
                      onChange={(e) => setCompLicenseClass(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="CLASS_A">Class A (Major Projects &gt; ₹1 Crore)</option>
                      <option value="CLASS_B">Class B (Medium Works ₹25 Lakhs - ₹1 Crore)</option>
                      <option value="CLASS_C">Class C (Ward Works ₹5 - ₹25 Lakhs)</option>
                      <option value="CLASS_D">Class D (Minor Works &lt; ₹5 Lakhs)</option>
                    </Select>
                  </FormField>
                </div>

                <FormField label="Operating Region" required id="comp-region">
                  <TextInput
                    id="comp-region"
                    value={compRegion}
                    onChange={(e) => setCompRegion(e.target.value)}
                    placeholder="e.g., Bengaluru Urban & BBMP Zones"
                    required
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField label="Registered Business Address" required id="comp-address">
                  <TextArea
                    id="comp-address"
                    value={compAddress}
                    onChange={(e) => setCompAddress(e.target.value)}
                    placeholder="Full registered office address"
                    rows={2}
                    required
                    disabled={isSubmitting}
                  />
                </FormField>

                <div>
                  <label className="block text-xs font-medium text-[#374151] dark:text-[#D1D5DB] mb-2">
                    Work Specialization Categories <span className="text-rose-600 dark:text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          compCategories.includes(cat.id)
                            ? 'bg-[#E5ECE8] dark:bg-emerald-950/40 border-[#0B3D2E] dark:border-emerald-500/50 text-[#0B3D2E] dark:text-emerald-200 font-medium'
                            : 'bg-[#F9FAFB] dark:bg-[#182230] border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#D1D5DB] hover:bg-[#F3F4F6] dark:hover:bg-[#273548]/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={compCategories.includes(cat.id)}
                          onChange={() => handleCategoryToggle(cat.id)}
                          className="rounded text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399]"
                        />
                        <span>{cat.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section B: Signatory & Account Credentials */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#D1D5DB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
                  2. Authorized Signatory & Portal Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Contact Person Full Name" required id="cont-name">
                    <TextInput
                      id="cont-name"
                      value={contName}
                      onChange={(e) => setContName(e.target.value)}
                      placeholder="e.g., Sanjay Hegde (Director)"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <FormField label="Official Contact Phone" required id="cont-phone">
                    <TextInput
                      id="cont-phone"
                      type="tel"
                      value={contPhone}
                      onChange={(e) => setContPhone(e.target.value)}
                      placeholder="+91 98450 11223"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>

                <FormField label="Official Work Email" required id="cont-email" helperText="Primary email for tender award notices and sign-in.">
                  <TextInput
                    id="cont-email"
                    type="email"
                    value={contEmail}
                    onChange={(e) => setContEmail(e.target.value)}
                    placeholder="contracts@yourcompany.com"
                    required
                    disabled={isSubmitting}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Password" required id="cont-password" helperText="Minimum 8 characters.">
                    <div className="relative">
                      <TextInput
                        id="cont-password"
                        type={contShowPassword ? 'text' : 'password'}
                        value={contPassword}
                        onChange={(e) => setContPassword(e.target.value)}
                        placeholder="Create strong password"
                        required
                        disabled={isSubmitting}
                        className="pr-16"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={() => setContShowPassword((prev) => !prev)}
                          className="civora-liquid-btn civora-liquid-btn--secondary text-xs font-medium px-2.5 py-1 rounded-md"
                          tabIndex={-1}
                        >
                          {contShowPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                  </FormField>

                  <FormField label="Confirm Password" required id="cont-confirm-password">
                    <TextInput
                      id="cont-confirm-password"
                      type={contShowPassword ? 'text' : 'password'}
                      value={contConfirmPassword}
                      onChange={(e) => setContConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isSubmitting}
                >
                  Submit Contractor Application for Review
                </Button>
                <p className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] text-center mt-2">
                  By submitting, you certify that the provided business credentials and tax identifiers are valid.
                </p>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#374151] text-center text-sm text-[#6B7280] dark:text-[#D1D5DB]">
            Already verified?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 rounded-md font-semibold text-sm"
            >
              Sign In to Contractor Portal
            </button>
          </div>
        </Card>
      )}

      {/* 3. TRACK APPLICATION STATUS */}
      {activeTab === 'status' && (
        <Card className="max-w-xl mx-auto p-6 md:p-8 shadow-xs">
          <div className="mb-6 pb-4 border-b border-[#E5E7EB] dark:border-[#374151]">
            <h3 className="text-lg font-semibold text-[#111827] dark:text-[#F9FAFB]">Track Contractor Application</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
              Enter the registration number or work email address used during contractor registration to verify verification status.
            </p>
          </div>

          <form onSubmit={handleStatusSearch} className="space-y-4 mb-6">
            <FormField label="Email or Registration Number" required id="status-q">
              <TextInput
                id="status-q"
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value)}
                placeholder="e.g., REG-2024-KA-8810 or contracts@example.com"
                required
                disabled={isSearchingStatus}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isSearchingStatus}
            >
              Check Live Status
            </Button>
          </form>

          {statusError && (
            <Alert variant="error" className="mb-6" title="Lookup Failed">
              {statusError}
            </Alert>
          )}

          {statusResult && (
            <div className="p-5 rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">{statusResult.companyName}</h4>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-mono mt-0.5">{statusResult.registrationNumber}</p>
                </div>
                <Badge
                  variant={
                    statusResult.status === 'APPROVED'
                      ? 'success'
                      : statusResult.status === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {statusResult.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#E5E7EB] dark:border-[#374151] pt-3">
                <div>
                  <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Contact Person</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">{statusResult.contactPerson}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Class</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">{statusResult.licenseClass}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Region</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">{statusResult.operatingRegion}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] dark:text-[#D1D5DB] block">Submitted At</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">
                    {new Date(statusResult.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {statusResult.status === 'APPROVED' && (
                <div className="p-3 rounded-lg bg-[#E8F1EC] dark:bg-[#34D399]/12 border border-[#A8C9B8] dark:border-[#34D399]/35 text-xs text-[#185541] dark:text-[#34D399]">
                  <p className="font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1">Application Verified & Approved</p>
                  <p className="mb-2 text-[#374151] dark:text-[#D1D5DB]">Your enterprise credentials have been verified. You may now sign in using your work email and password to access the Contractor Portal.</p>
                  <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                    Sign In Now
                  </Button>
                </div>
              )}

              {statusResult.status === 'UNDER_REVIEW' && (
                <div className="p-3 rounded-lg bg-[#FEF6E9] dark:bg-amber-950/30 border border-[#F3B768] dark:border-amber-500/30 text-xs text-[#854F0B] dark:text-[#F3B768]">
                  <p className="font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1">Administrative Verification in Progress</p>
                  <p className="text-[#6B7280] dark:text-[#D1D5DB]">Municipal administrators are verifying your license class and corporate tax ID. Most applications are processed within 1-2 business days.</p>
                </div>
              )}

              {statusResult.status === 'REJECTED' && (
                <div className="p-3 rounded-lg bg-[#FBEBE8] dark:bg-red-950/30 border border-[#F39182] dark:border-red-500/30 text-xs text-[#9C3B2D] dark:text-[#F39182]">
                  <p className="font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1">Application Not Approved</p>
                  <p className="text-[#6B7280] dark:text-[#D1D5DB]">{statusResult.reviewNotes || 'Credential verification could not be satisfied. Please contact the procurement registry.'}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-center text-xs text-[#6B7280] dark:text-[#D1D5DB]">
            Need to register a different organization?{' '}
            <button
              type="button"
              onClick={() => setActiveTab('contractor')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 rounded-md font-semibold text-xs"
            >
              Start New Application
            </button>
          </div>
        </Card>
      )}
    </Container>
  );
}
