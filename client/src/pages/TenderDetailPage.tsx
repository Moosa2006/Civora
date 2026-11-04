import { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

interface TenderDetail {
  id: string;
  tenderNumber: string;
  title: string;
  description: string;
  category: string;
  scopeOfWork: string;
  technicalCriteria: string;
  location: string | null;
  status: string;
  estimatedBudget: number | null;
  earnestMoneyDeposit: number | null;
  minLicenseClass: string | null;
  publishedAt: string | null;
  submissionDeadline: string;
  expectedDurationDays: number | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  publishedBy: {
    id: string;
    name: string;
  } | null;
  awardedBid?: {
    id: string;
    bidAmount: number;
    contractor: {
      name: string;
      registrationNumber: string | null;
    };
  } | null;
  eligibility?: {
    isEligible: boolean;
    reason: string;
    reasons?: string[];
    canBid: boolean;
    status?: string;
    details?: {
      isVerified: boolean;
      status: string;
      contractorClass: string | null;
      requiredClass: string | null;
      deadlinePassed: boolean;
      alreadyBid: boolean;
    };
  } | null;
  myBid?: {
    id: string;
    bidNumber?: string;
    bidAmount: number;
    proposedDurationDays: number;
    technicalProposal: string;
    status: string;
    submittedAt?: string;
    createdAt?: string;
  } | null;
}

export function TenderDetailPage() {
  const { currentPath, navigate } = useRouter();
  const { user } = useAuth();
  const isContractor = user?.role === 'CONTRACTOR';

  // Extract tender ID from path: /tenders/:id
  const tenderId = currentPath.split('/')[2]?.split('?')[0];

  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bid submission modal state
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [proposedDays, setProposedDays] = useState('');
  const [technicalProposal, setTechnicalProposal] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidSubmitError, setBidSubmitError] = useState<string | null>(null);
  const [bidSubmitSuccess, setBidSubmitSuccess] = useState<string | null>(null);

  const fetchTenderDetails = async () => {
    if (!tenderId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tenders/${tenderId}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success && json.data?.tender) {
        const t = json.data.tender;
        if (!t.id || !t.tenderNumber || !t.title || !t.status) {
          setErrorMessage('Tender data format is malformed or missing required specifications.');
          return;
        }
        setTender(t);
      } else {
        setErrorMessage(json.error?.message || 'Tender not found or inaccessible.');
      }
    } catch {
      setErrorMessage('Failed to connect to the tender server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenderDetails();
  }, [tenderId]);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidSubmitError(null);

    const parsedAmount = parseFloat(bidAmount);
    const parsedDays = parseInt(proposedDays, 10);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setBidSubmitError('Please enter a valid positive bid amount.');
      return;
    }
    if (isNaN(parsedDays) || parsedDays <= 0) {
      setBidSubmitError('Please enter a valid duration in days.');
      return;
    }
    if (!technicalProposal.trim() || technicalProposal.trim().length < 20) {
      setBidSubmitError('Technical proposal must provide at least 20 characters explaining execution approach.');
      return;
    }
    if (!declarationAccepted) {
      setBidSubmitError('You must accept the compliance and integrity declaration.');
      return;
    }

    setIsSubmittingBid(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bidAmount: parsedAmount,
          proposedDurationDays: parsedDays,
          technicalProposal: technicalProposal.trim(),
          declarationAccepted: true,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setBidSubmitSuccess(
          `Bid successfully registered! Reference: ${json.data?.bid?.id || 'PERSISTED'}. Your bid is now pending official review.`
        );
        setIsBidModalOpen(false);
        fetchTenderDetails();
      } else {
        setBidSubmitError(json.error?.message || 'Bid submission was rejected by the server.');
      }
    } catch {
      setBidSubmitError('Network failure submitting bid. Please try again.');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return 'Not Disclosed';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (isLoading) {
    return (
      <Container size="lg" className="py-16 text-center">
        <LoadingIndicator label="Loading tender specifications and eligibility..." />
      </Container>
    );
  }

  if (errorMessage || !tender) {
    return (
      <Container size="md" className="py-12">
        <Alert variant="error" title="Tender Unavailable" className="mb-4">
          {errorMessage || 'Tender specifications could not be loaded.'}
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/tenders')}>
          ← Back to All Tenders
        </Button>
      </Container>
    );
  }

  const isExpired = tender.submissionDeadline
    ? new Date(tender.submissionDeadline).getTime() < Date.now()
    : false;

  return (
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title={tender.title}
        description={tender.description}
        className="mb-0"
        eyebrow={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/tenders')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 -ml-2 rounded-md text-xs font-semibold"
            >
              &larr; Return to Tenders
            </button>
            <span className="text-[#D1D5DB]">&bull;</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#E5ECE8] dark:bg-[#34D399]/15 text-[#0B3D2E] dark:text-[#34D399] font-semibold">
              {tender.tenderNumber}
            </span>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              Department:{' '}
              <strong className="text-[#111827] dark:text-[#F9FAFB]">
                {tender.department?.name || 'Municipal Works'}
              </strong>
            </span>
          </div>
        }
        badge={
          <Badge variant={tender.status === 'PUBLISHED' ? 'success' : 'neutral'}>
            {(tender.status || 'UNKNOWN').replace(/_/g, ' ')}
          </Badge>
        }
        actions={
          <>
            {tender.status === 'PUBLISHED' && !isExpired && (
              <>
                {tender.myBid ? (
                  <Badge variant="info">Bid Already Submitted</Badge>
                ) : isContractor ? (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={Boolean(tender.eligibility && !tender.eligibility.canBid)}
                    onClick={() => setIsBidModalOpen(true)}
                  >
                    Submit Bid Proposal
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>
                    Sign in to Bid
                  </Button>
                )}
              </>
            )}
            {isExpired && <Badge variant="danger">Bidding Closed</Badge>}
          </>
        }
      />

      {bidSubmitSuccess && (
        <Alert variant="success" title="Proposal Submitted Successfully">
          {bidSubmitSuccess}
        </Alert>
      )}

      {/* Vital Metrics Summary Card */}
      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151]">
          <div>
            <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-xs">Estimated Budget</span>
            <strong className="text-[#0B6640] dark:text-[#34D399] text-lg font-bold">
              {formatCurrency(tender.estimatedBudget)}
            </strong>
          </div>
          <div>
            <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-xs">Earnest Money Deposit (EMD)</span>
            <strong className="text-[#111827] dark:text-[#F9FAFB] text-lg font-bold">
              {formatCurrency(tender.earnestMoneyDeposit)}
            </strong>
          </div>
          <div>
            <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-xs">Submission Deadline</span>
            <strong className={`text-sm font-semibold ${isExpired ? 'text-[#B91C1C] dark:text-[#F39182]' : 'text-[#92400E] dark:text-[#F3B768]'}`}>
              {tender.submissionDeadline
                ? new Date(tender.submissionDeadline).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'TBD'}
            </strong>
          </div>
          <div>
            <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-xs">Minimum License Class</span>
            <strong className="text-[#111827] dark:text-[#F9FAFB] text-sm font-semibold">
              Class {tender.minLicenseClass || 'Open to all classes'}
            </strong>
          </div>
        </div>
      </Card>

      {/* Two Column Section: Scope & Eligibility */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Scope of Work and Technical Specifications */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Scope of Work & Deliverables
            </h3>
            <div className="text-sm text-[#374151] dark:text-[#D1D5DB] whitespace-pre-line leading-relaxed">
              {tender.scopeOfWork || 'Detailed scope of work available upon official tender dossier request.'}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] border-b border-[#E5E7EB] dark:border-[#374151] pb-2">
              Technical Criteria & Quality Requirements
            </h3>
            <div className="text-sm text-[#374151] dark:text-[#D1D5DB] whitespace-pre-line leading-relaxed">
              {tender.technicalCriteria || (tender as any).eligibilityCriteria || 'Standard municipal engineering specifications apply.'}
            </div>
          </Card>

          {tender.awardedBid && (
            <Card className="p-6 bg-[#E8F1EC] dark:bg-[#34D399]/12 border-[#A8C9B8] dark:border-[#34D399]/35 space-y-2">
              <h3 className="text-base font-semibold text-[#185541] dark:text-[#34D399]">
                Official Award Outcome
              </h3>
              <p className="text-sm text-[#374151] dark:text-[#D1D5DB]">
                This tender was awarded to{' '}
                <strong className="text-[#111827] dark:text-[#F9FAFB]">
                  {tender.awardedBid.contractor?.name || 'Selected Contractor'}
                </strong>{' '}
                for {formatCurrency(tender.awardedBid.bidAmount)}.
              </p>
            </Card>
          )}
        </div>

        {/* Right Column (1 Col): Server-Side Eligibility & Contractor Actions */}
        <div className="space-y-6">
          {/* Eligibility Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] flex items-center justify-between">
              <span>Contractor Eligibility</span>
              {tender.eligibility && (
                <Badge variant={tender.eligibility.canBid ? 'success' : 'danger'}>
                  {tender.eligibility.canBid ? 'Eligible' : 'Ineligible'}
                </Badge>
              )}
            </h3>

            {isContractor && tender.eligibility ? (
              tender.eligibility.details ? (
                <div className="space-y-4 text-xs">
                  <p className="text-[#374151] dark:text-[#D1D5DB] leading-relaxed font-medium">
                    {tender.eligibility.reason || (tender.eligibility.reasons && tender.eligibility.reasons[0]) || 'Eligibility criteria evaluated.'}
                  </p>

                  <div className="space-y-2 border-t border-[#E5E7EB] dark:border-[#374151] pt-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Account Status</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB] uppercase">
                        {tender.eligibility.details.status}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Official Verification</span>
                      <strong
                        className={
                          tender.eligibility.details.isVerified
                            ? 'text-[#185541] dark:text-[#34D399]'
                            : 'text-[#854F0B] dark:text-[#F3B768]'
                        }
                      >
                        {tender.eligibility.details.isVerified ? 'Verified' : 'Pending Verification'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Your License Class</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">
                        Class {tender.eligibility.details.contractorClass || 'Not Set'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Required Minimum</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">
                        Class {tender.eligibility.details.requiredClass || 'None'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Deadline Status</span>
                      <strong
                        className={
                          tender.eligibility.details.deadlinePassed
                            ? 'text-[#9C3B2D] dark:text-[#F39182]'
                            : 'text-[#185541] dark:text-[#34D399]'
                        }
                      >
                        {tender.eligibility.details.deadlinePassed ? 'Expired' : 'Active'}
                      </strong>
                    </div>
                  </div>

                  {!tender.eligibility.canBid && (
                    <Alert variant="warning" className="text-xs">
                      You cannot submit a bid because the above eligibility constraints or deadlines are unmet.
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-[#374151] dark:text-[#D1D5DB]">
                    {tender.eligibility.reason || (tender.eligibility.reasons && tender.eligibility.reasons[0]) || 'Eligibility criteria evaluated.'}
                  </p>
                  {!tender.eligibility.canBid && (
                    <Alert variant="warning" className="text-xs">
                      You cannot submit a bid for this tender under your current organization status.
                    </Alert>
                  )}
                </div>
              )
            ) : isContractor ? (
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Evaluating your profile against tender requirements...
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                  Only verified contractors registered on Civora may participate in formal tendering.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => navigate('/login')}
                >
                  Contractor Sign In
                </Button>
              </div>
            )}
          </Card>

          {/* Existing Bid Card */}
          {tender.myBid && (
            <Card className="p-6 bg-[#E8F1F8]/50 dark:bg-[#152733]/50 border-[#A8C9E3] dark:border-[#22445E] space-y-4">
              <h3 className="text-base font-semibold text-[#1B5E8A] dark:text-[#78B4DD] flex items-center justify-between">
                <span>Your Bid Record</span>
                <Badge variant="info">{tender.myBid.status}</Badge>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#A8C9E3]/40 dark:border-[#22445E]/40">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Proposed Amount</span>
                  <strong className="text-[#185541] dark:text-[#34D399]">
                    {formatCurrency(tender.myBid.bidAmount)}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A8C9E3]/40 dark:border-[#22445E]/40">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Proposed Duration</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB]">
                    {tender.myBid.proposedDurationDays} Days
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A8C9E3]/40 dark:border-[#22445E]/40">
                  <span className="text-[#6B7280] dark:text-[#D1D5DB]">Submitted At</span>
                  <span className="text-[#111827] dark:text-[#F9FAFB]">
                    {tender.myBid.submittedAt || tender.myBid.createdAt
                      ? new Date(tender.myBid.submittedAt || tender.myBid.createdAt!).toLocaleDateString('en-IN')
                      : 'Recently'}
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => navigate('/contractor')}
              >
                Track in Contractor Hub →
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Interactive Bid Submission Modal */}
      {isBidModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#374151] pb-3">
              <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
                Submit Bid for {tender.tenderNumber}
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setIsBidModalOpen(false)}
                className="civora-liquid-btn civora-liquid-btn--ghost px-2.5 py-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {bidSubmitError && (
              <Alert variant="error" title="Submission Failed">
                {bidSubmitError}
              </Alert>
            )}

            <form onSubmit={handleBidSubmit} className="space-y-4">
              <FormField label="Proposed Bid Amount (INR ₹)" required id="bid-amount">
                <TextInput
                  id="bid-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`e.g., ${tender.estimatedBudget ? tender.estimatedBudget * 0.95 : '500000'}`}
                  required
                />
              </FormField>

              <FormField label="Proposed Execution Timeline (in Days)" required id="bid-days">
                <TextInput
                  id="bid-days"
                  type="number"
                  min="1"
                  value={proposedDays}
                  onChange={(e) => setProposedDays(e.target.value)}
                  placeholder={`e.g., ${tender.expectedDurationDays || '90'}`}
                  required
                />
              </FormField>

              <FormField label="Technical Proposal & Execution Approach" required id="bid-tech">
                <TextArea
                  id="bid-tech"
                  rows={4}
                  value={technicalProposal}
                  onChange={(e) => setTechnicalProposal(e.target.value)}
                  placeholder="Outline your machinery deployment, quality assurance plan, material sourcing, and compliance with Civora standards..."
                  required
                />
              </FormField>

              <div className="flex items-start gap-3 p-3 bg-[#F9FAFB] dark:bg-[#182230] rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
                <input
                  type="checkbox"
                  id="bid-declaration"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#E5E7EB] dark:border-[#374151] bg-[#F3F4F6] dark:bg-[#273548] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                  required
                />
                <label htmlFor="bid-declaration" className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed cursor-pointer">
                  I hereby declare that our organization meets all stated eligibility requirements, possesses the requisite technical capacity, and agrees to Civora's public transparency and milestone verification standards.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#374151]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsBidModalOpen(false)}
                  disabled={isSubmittingBid}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingBid}
                >
                  Confirm & Submit Bid
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Container>
  );
}
