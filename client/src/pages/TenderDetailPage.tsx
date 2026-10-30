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
    <Container size="xl" className="py-8 space-y-8">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tenders')}>
          ← Return to Tenders
        </Button>
        <span className="font-mono text-xs text-[#54625A] dark:text-[#C5D4C9]">
          Ref: {tender.tenderNumber}
        </span>
      </div>

      {bidSubmitSuccess && (
        <Alert variant="success" title="Proposal Submitted Successfully">
          {bidSubmitSuccess}
        </Alert>
      )}

      {/* Main Header Card */}
      <Card className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-6 mb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#E8F1F8] dark:bg-[#152733] text-[#1B5E8A] dark:text-[#78B4DD] border border-[#A8C9E3] dark:border-[#22445E] font-semibold">
                {tender.tenderNumber}
              </span>
              <Badge variant={tender.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                {(tender.status || 'UNKNOWN').replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                Department:{' '}
                <strong className="text-[#202522] dark:text-[#F5F2EA]">
                  {tender.department?.name || 'Municipal Works'}
                </strong>
              </span>
            </div>
            <PageHeading title={tender.title} />
            <p className="text-[#3E4B44] dark:text-[#C5D4C9] text-sm md:text-base leading-relaxed">
              {tender.description}
            </p>
          </div>

          {/* Action Trigger */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            {tender.status === 'PUBLISHED' && !isExpired && (
              <>
                {tender.myBid ? (
                  <Badge variant="info">Bid Already Submitted</Badge>
                ) : isContractor ? (
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={Boolean(tender.eligibility && !tender.eligibility.canBid)}
                    onClick={() => setIsBidModalOpen(true)}
                  >
                    Submit Bid Proposal
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => navigate('/login')}>
                    Sign in to Bid
                  </Button>
                )}
              </>
            )}
            {isExpired && <Badge variant="danger">Bidding Closed</Badge>}
          </div>
        </div>

        {/* Vital Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
          <div>
            <span className="text-[#54625A] dark:text-[#C5D4C9] block text-xs">Estimated Budget</span>
            <strong className="text-[#185541] dark:text-[#78C7AE] text-lg font-bold">
              {formatCurrency(tender.estimatedBudget)}
            </strong>
          </div>
          <div>
            <span className="text-[#54625A] dark:text-[#C5D4C9] block text-xs">Earnest Money Deposit (EMD)</span>
            <strong className="text-[#202522] dark:text-[#F5F2EA] text-lg font-bold">
              {formatCurrency(tender.earnestMoneyDeposit)}
            </strong>
          </div>
          <div>
            <span className="text-[#54625A] dark:text-[#C5D4C9] block text-xs">Submission Deadline</span>
            <strong className={`text-sm font-semibold ${isExpired ? 'text-[#9C3B2D] dark:text-[#F39182]' : 'text-[#854F0B] dark:text-[#F3B768]'}`}>
              {tender.submissionDeadline
                ? new Date(tender.submissionDeadline).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'TBD'}
            </strong>
          </div>
          <div>
            <span className="text-[#54625A] dark:text-[#C5D4C9] block text-xs">Minimum License Class</span>
            <strong className="text-[#202522] dark:text-[#F5F2EA] text-sm font-semibold">
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
            <h3 className="text-base font-semibold text-[#202522] dark:text-[#F5F2EA] border-b border-[#DED8CB] dark:border-[#283931] pb-2">
              Scope of Work & Deliverables
            </h3>
            <div className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] whitespace-pre-line leading-relaxed">
              {tender.scopeOfWork || 'Detailed scope of work available upon official tender dossier request.'}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#202522] dark:text-[#F5F2EA] border-b border-[#DED8CB] dark:border-[#283931] pb-2">
              Technical Criteria & Quality Requirements
            </h3>
            <div className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] whitespace-pre-line leading-relaxed">
              {tender.technicalCriteria || (tender as any).eligibilityCriteria || 'Standard municipal engineering specifications apply.'}
            </div>
          </Card>

          {tender.awardedBid && (
            <Card className="p-6 bg-[#E8F1EC] dark:bg-[#14261F] border-[#A8C9B8] dark:border-[#204A3A] space-y-2">
              <h3 className="text-base font-semibold text-[#185541] dark:text-[#78C7AE]">
                Official Award Outcome
              </h3>
              <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9]">
                This tender was awarded to{' '}
                <strong className="text-[#202522] dark:text-[#F5F2EA]">
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
            <h3 className="text-base font-semibold text-[#202522] dark:text-[#F5F2EA] flex items-center justify-between">
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
                  <p className="text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed font-medium">
                    {tender.eligibility.reason || (tender.eligibility.reasons && tender.eligibility.reasons[0]) || 'Eligibility criteria evaluated.'}
                  </p>

                  <div className="space-y-2 border-t border-[#DED8CB] dark:border-[#283931] pt-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Account Status</span>
                      <strong className="text-[#202522] dark:text-[#F5F2EA] uppercase">
                        {tender.eligibility.details.status}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Official Verification</span>
                      <strong
                        className={
                          tender.eligibility.details.isVerified
                            ? 'text-[#185541] dark:text-[#78C7AE]'
                            : 'text-[#854F0B] dark:text-[#F3B768]'
                        }
                      >
                        {tender.eligibility.details.isVerified ? 'Verified' : 'Pending Verification'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Your License Class</span>
                      <strong className="text-[#202522] dark:text-[#F5F2EA]">
                        Class {tender.eligibility.details.contractorClass || 'Not Set'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Required Minimum</span>
                      <strong className="text-[#202522] dark:text-[#F5F2EA]">
                        Class {tender.eligibility.details.requiredClass || 'None'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Deadline Status</span>
                      <strong
                        className={
                          tender.eligibility.details.deadlinePassed
                            ? 'text-[#9C3B2D] dark:text-[#F39182]'
                            : 'text-[#185541] dark:text-[#78C7AE]'
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
                  <p className="text-[#3E4B44] dark:text-[#C5D4C9]">
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
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                Evaluating your profile against tender requirements...
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
                  <span className="text-[#54625A] dark:text-[#C5D4C9]">Proposed Amount</span>
                  <strong className="text-[#185541] dark:text-[#78C7AE]">
                    {formatCurrency(tender.myBid.bidAmount)}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A8C9E3]/40 dark:border-[#22445E]/40">
                  <span className="text-[#54625A] dark:text-[#C5D4C9]">Proposed Duration</span>
                  <span className="text-[#202522] dark:text-[#F5F2EA]">
                    {tender.myBid.proposedDurationDays} Days
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A8C9E3]/40 dark:border-[#22445E]/40">
                  <span className="text-[#54625A] dark:text-[#C5D4C9]">Submitted At</span>
                  <span className="text-[#202522] dark:text-[#F5F2EA]">
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
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA]">
                Submit Bid for {tender.tenderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIsBidModalOpen(false)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#F5F2EA] text-lg font-bold cursor-pointer"
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

              <div className="flex items-start gap-3 p-3 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                <input
                  type="checkbox"
                  id="bid-declaration"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#173D32] focus:ring-[#173D32] cursor-pointer"
                  required
                />
                <label htmlFor="bid-declaration" className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed cursor-pointer">
                  I hereby declare that our organization meets all stated eligibility requirements, possesses the requisite technical capacity, and agrees to Civora's public transparency and milestone verification standards.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
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
