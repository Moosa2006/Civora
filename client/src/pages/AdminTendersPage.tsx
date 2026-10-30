import { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';

type AdminTab = 'tenders' | 'bid_evaluation' | 'approvals' | 'payments' | 'contractors';

export function AdminTendersPage() {
  const { navigate } = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isStaff = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL');

  const [activeTab, setActiveTab] = useState<AdminTab>('tenders');
  const [tenders, setTenders] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create Tender Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tNumber, setTNumber] = useState(`TND-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tCategory, setTCategory] = useState('ROADS_AND_BRIDGES');
  const [tScope, setTScope] = useState('');
  const [tTech, setTTech] = useState('');
  const [tLocation, setTLocation] = useState('');
  const [tBudget, setTBudget] = useState('');
  const [tEmd, setTEmd] = useState('');
  const [tDeadline, setTDeadline] = useState('');
  const [tDays, setTDays] = useState('90');
  const [tMinClass, setTMinClass] = useState('B');
  const [isCreatingTender, setIsCreatingTender] = useState(false);

  // Bid Evaluation & Award Modal State
  const [selectedTenderForBids, setSelectedTenderForBids] = useState<any | null>(null);
  const [tenderBids, setTenderBids] = useState<any[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedBidToAward, setSelectedBidToAward] = useState<any | null>(null);
  const [awardJustification, setAwardJustification] = useState('');
  const [isSubmittingAward, setIsSubmittingAward] = useState(false);

  const fetchTendersAndData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/tenders', { headers: { Accept: 'application/json' }, credentials: 'include' }),
        fetch('/api/official/contractors', { headers: { Accept: 'application/json' }, credentials: 'include' }),
      ]);
      const [tJson, cJson] = await Promise.all([tRes.json(), cRes.json()]);

      if (tRes.ok && tJson.success) setTenders(tJson.data.tenders || []);
      if (cRes.ok && cJson.success) setContractors(cJson.data.contractors || []);
    } catch {
      setErrorMessage('Failed to connect to official procurement services.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isStaff) {
      fetchTendersAndData();
    }
  }, [authLoading, isStaff]);

  const loadTenderBids = async (tender: any) => {
    setSelectedTenderForBids(tender);
    setIsLoadingBids(true);
    try {
      const res = await fetch(`/api/tenders/${tender.id}/bids`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTenderBids(json.data.bids || []);
      } else {
        setErrorMessage(json.error?.message || 'Could not load bids.');
      }
    } catch {
      setErrorMessage('Failed to load bids for tender.');
    } finally {
      setIsLoadingBids(false);
    }
  };

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTender(true);
    try {
      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenderNumber: tNumber.trim(),
          title: tTitle.trim(),
          description: tDescription.trim(),
          category: tCategory,
          scopeOfWork: tScope.trim(),
          technicalCriteria: tTech.trim(),
          location: tLocation.trim() || undefined,
          estimatedBudget: parseFloat(tBudget),
          earnestMoneyDeposit: tEmd ? parseFloat(tEmd) : undefined,
          submissionDeadline: new Date(tDeadline).toISOString(),
          expectedDurationDays: parseInt(tDays, 10),
          minLicenseClass: tMinClass,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage(`Tender ${tNumber} created as draft.`);
        setIsCreateModalOpen(false);
        fetchTendersAndData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to create tender.');
      }
    } catch {
      setErrorMessage('Network error creating draft tender.');
    } finally {
      setIsCreatingTender(false);
    }
  };

  const handlePublishTender = async (tenderId: string) => {
    if (!confirm('Publish this tender publicly for bidding?')) return;
    try {
      const res = await fetch(`/api/tenders/${tenderId}/publish`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage('Tender published publicly for bidding.');
        fetchTendersAndData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to publish tender.');
      }
    } catch {
      setErrorMessage('Network error publishing tender.');
    }
  };

  const handleAwardTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenderForBids || !selectedBidToAward) return;
    setIsSubmittingAward(true);
    try {
      const res = await fetch(`/api/tenders/${selectedTenderForBids.id}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          winningBidId: selectedBidToAward.id,
          awardJustification: awardJustification.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage(
          `Tender successfully awarded! Generated Work Order #${json.data?.workOrder?.orderNumber || 'GENERATED'}.`
        );
        setAwardModalOpen(false);
        fetchTendersAndData();
        loadTenderBids(selectedTenderForBids);
      } else {
        setErrorMessage(json.error?.message || 'Failed to award tender.');
      }
    } catch {
      setErrorMessage('Network error awarding tender.');
    } finally {
      setIsSubmittingAward(false);
    }
  };

  const handleVerifyContractor = async (contractorId: string) => {
    if (!confirm('Mark this contractor as verified and accredited?')) return;
    try {
      const res = await fetch(`/api/official/contractors/${contractorId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isVerified: true }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage('Contractor enterprise accredited and verified.');
        fetchTendersAndData();
      } else {
        setErrorMessage(json.error?.message || 'Verification update failed.');
      }
    } catch {
      setErrorMessage('Network error during contractor verification.');
    }
  };

  if (authLoading) {
    return (
      <Container size="lg" className="py-16 text-center">
        <LoadingIndicator label="Checking procurement authorization..." />
      </Container>
    );
  }

  if (!isStaff) {
    return (
      <Container size="md" className="py-16">
        <Card className="p-8 text-center border-[#DED8CB] dark:border-[#283931] space-y-4">
          <h2 className="text-xl font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">Staff Authorization Required</h2>
          <p className="text-[#4A5750] dark:text-[#A8BFAE] text-sm">
            Only designated government officials and system administrators may access public tendering, bid evaluations, and contractor contract awards.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign In with Official Account
          </Button>
        </Card>
      </Container>
    );
  }

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <Container size="xl" className="py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#173D32]/10 text-[#173D32] dark:bg-[#7BC4B2]/20 dark:text-[#7BC4B2] border border-[#173D32]/20 uppercase font-mono">
              Procurement & Contracts Console
            </span>
            <Badge variant="info">Official Authority</Badge>
          </div>
          <PageHeading
            title="Public Tenders & Contractor Governance"
            description="Manage civic tenders, evaluate competitive bids, execute atomic contract awards, and supervise contractor accreditations."
          />
        </div>
        <div>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Create New Tender Draft
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <Alert variant="success" title="Success" className="mb-4">
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="error" title="Error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#DED8CB] dark:border-[#283931] overflow-x-auto gap-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('tenders')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'tenders'
              ? 'border-[#173D32] text-[#173D32] dark:border-[#7BC4B2] dark:text-[#7BC4B2] font-semibold'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
          }`}
        >
          Tenders Catalog ({tenders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bid_evaluation')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'bid_evaluation'
              ? 'border-[#173D32] text-[#173D32] dark:border-[#7BC4B2] dark:text-[#7BC4B2] font-semibold'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
          }`}
        >
          Bid Review & Award Console
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contractors')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'contractors'
              ? 'border-[#173D32] text-[#173D32] dark:border-[#7BC4B2] dark:text-[#7BC4B2] font-semibold'
              : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
          }`}
        >
          Contractor Directory ({contractors.length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingIndicator label="Loading procurement console..." />
        </div>
      ) : (
        <>
          {/* TAB 1: TENDERS CATALOG */}
          {activeTab === 'tenders' && (
            <div className="space-y-4">
              {tenders.length === 0 ? (
                <EmptyState
                  title="No Tenders Found"
                  description="No tenders have been created yet. Click 'Create New Tender Draft' to begin drafting a public contract."
                  action={
                    <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                      Draft First Tender
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {tenders.map((tender) => (
                    <Card key={tender.id} className="p-6 border-[#DED8CB] dark:border-[#283931] space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] px-2 py-0.5 rounded border border-[#DED8CB] dark:border-[#283931]">
                              {tender.tenderNumber}
                            </span>
                            <Badge variant={tender.status === 'PUBLISHED' ? 'success' : tender.status === 'DRAFT' ? 'neutral' : 'info'}>
                              {tender.status}
                            </Badge>
                          </div>
                          <h4 className="text-base font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">
                            {tender.title}
                          </h4>
                          <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-0.5">
                            Category: {tender.category} | Location: {tender.location || 'Municipal Area'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono tracking-wider text-[#54625A] dark:text-[#C5D4C9] uppercase font-semibold block">Estimated Budget</span>
                          <strong className="text-lg font-bold font-mono text-[#1E6B52] dark:text-[#52B79A]">
                            {formatCurrency(tender.estimatedBudget)}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/50 p-3.5 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Min License Class</span>
                          <span className="text-[#202522] dark:text-[#E8F0EC] font-medium">Class {tender.minLicenseClass || 'Open'}</span>
                        </div>
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Submission Deadline</span>
                          <span className="text-[#202522] dark:text-[#E8F0EC]">
                            {new Date(tender.submissionDeadline).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Duration</span>
                          <span className="text-[#202522] dark:text-[#E8F0EC] font-medium">{tender.expectedDurationDays} Days</span>
                        </div>
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Submissions</span>
                          <span className="text-[#202522] dark:text-[#E8F0EC] font-medium">{tender._count?.bids || 0} Bids Logged</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/tenders/${tender.id}`)}
                        >
                          View Public Page →
                        </Button>
                        <div className="flex items-center gap-2">
                          {tender.status === 'DRAFT' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handlePublishTender(tender.id)}
                            >
                              Publish for Bidding
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setActiveTab('bid_evaluation');
                              loadTenderBids(tender);
                            }}
                          >
                            Inspect Bids ({tender._count?.bids || 0})
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BID REVIEW & AWARD CONSOLE */}
          {activeTab === 'bid_evaluation' && (
            <div className="space-y-6">
              <Card className="p-4 border-[#DED8CB] dark:border-[#283931]">
                <label className="text-xs font-semibold text-[#202522] dark:text-[#E8F0EC] block mb-2">
                  Select Tender to Inspect Submitted Bids:
                </label>
                <Select
                  value={selectedTenderForBids?.id || ''}
                  onChange={(e) => {
                    const found = tenders.find((t) => t.id === e.target.value);
                    if (found) loadTenderBids(found);
                  }}
                  options={[
                    { value: '', label: '-- Choose a Tender --' },
                    ...tenders.map((t) => ({
                      value: t.id,
                      label: `[${t.tenderNumber}] ${t.title} (${t._count?.bids || 0} bids)`,
                    })),
                  ]}
                />
              </Card>

              {selectedTenderForBids ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
                    <div>
                      <span className="font-mono text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2]">
                        {selectedTenderForBids.tenderNumber}
                      </span>
                      <h3 className="text-lg font-bold font-heading text-[#202522] dark:text-[#E8F0EC] mt-0.5">
                        {selectedTenderForBids.title}
                      </h3>
                    </div>
                    <Badge variant={selectedTenderForBids.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                      {selectedTenderForBids.status}
                    </Badge>
                  </div>

                  {isLoadingBids ? (
                    <div className="py-12 text-center">
                      <LoadingIndicator label="Loading contractor bid submissions..." />
                    </div>
                  ) : tenderBids.length === 0 ? (
                    <EmptyState
                      title="No Bids Submitted Yet"
                      description="No contractors have submitted bids for this tender so far."
                    />
                  ) : (
                    <div className="space-y-4">
                      {tenderBids.map((bid) => (
                        <Card key={bid.id} className="p-6 border-[#DED8CB] dark:border-[#283931] space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">
                                  {bid.contractor?.name}
                                </h4>
                                {bid.contractor?.isVerified && (
                                  <Badge variant="success">Verified Enterprise</Badge>
                                )}
                                <Badge variant={bid.status === 'ACCEPTED' ? 'success' : 'neutral'}>
                                  {bid.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">
                                Reg: {bid.contractor?.registrationNumber || 'N/A'} | Class: {bid.contractor?.licenseClass || 'N/A'} | Submitted: {new Date(bid.submittedAt).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-mono tracking-wider text-[#54625A] dark:text-[#C5D4C9] uppercase font-semibold block">Proposed Bid Amount</span>
                              <strong className="text-xl font-bold font-mono text-[#1E6B52] dark:text-[#52B79A]">
                                {formatCurrency(bid.bidAmount)}
                              </strong>
                              <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] block">
                                Duration: {bid.proposedDurationDays} Days
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/60 rounded-xl border border-[#DED8CB] dark:border-[#283931] text-xs">
                            <strong className="text-[#202522] dark:text-[#E8F0EC] block mb-1">Technical Proposal & Methodology:</strong>
                            <p className="text-[#4A5750] dark:text-[#A8BFAE] leading-relaxed whitespace-pre-line">
                              {bid.technicalProposal}
                            </p>
                          </div>

                          {selectedTenderForBids.status !== 'AWARDED' && (
                            <div className="flex justify-end gap-3 pt-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedBidToAward(bid);
                                  setAwardModalOpen(true);
                                }}
                              >
                                Award Contract to this Bidder
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="Select a Tender"
                  description="Choose a tender from the dropdown above to inspect and evaluate submitted contractor bids."
                />
              )}
            </div>
          )}

          {/* TAB 3: CONTRACTOR DIRECTORY */}
          {activeTab === 'contractors' && (
            <div className="space-y-4">
              <div className="border-b border-[#DED8CB] dark:border-[#283931] pb-3">
                <h3 className="text-base font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">
                  Accredited Contractor Directory & Qualification Records
                </h3>
              </div>

              {contractors.length === 0 ? (
                <EmptyState
                  title="No Contractors Registered"
                  description="Registered contractor enterprises will appear here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contractors.map((c) => (
                    <Card key={c.id} className="p-5 border-[#DED8CB] dark:border-[#283931] space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">{c.name}</h4>
                          <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-mono">
                            Reg: {c.registrationNumber || 'PENDING'}
                          </span>
                        </div>
                        <Badge variant={c.isVerified ? 'success' : 'warning'}>
                          {c.isVerified ? 'Verified' : 'Pending Review'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/50 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Class</span>
                          <strong className="text-[#202522] dark:text-[#E8F0EC]">Class {c.licenseClass || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Region</span>
                          <span className="text-[#202522] dark:text-[#E8F0EC]">{c.operatingRegion || 'National'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#54625A] dark:text-[#C5D4C9] block">Categories</span>
                          <span className="text-[#4A5750] dark:text-[#A8BFAE] truncate block">
                            {c.workCategories?.join(', ') || 'General Civil'}
                          </span>
                        </div>
                      </div>

                      {!c.isVerified && (
                        <div className="pt-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleVerifyContractor(c.id)}
                          >
                            Approve Enterprise Accreditation
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create Tender */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <Card className="max-w-2xl w-full p-6 border-[#DED8CB] dark:border-[#283931] shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-2">
              <h3 className="text-lg font-bold font-heading text-[#202522] dark:text-[#E8F0EC]">Create Public Tender Draft</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTender} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Tender Reference Number" required id="ct-num">
                  <TextInput
                    id="ct-num"
                    value={tNumber}
                    onChange={(e) => setTNumber(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Work Category" required id="ct-cat">
                  <Select
                    id="ct-cat"
                    value={tCategory}
                    onChange={(e) => setTCategory(e.target.value)}
                    options={[
                      { value: 'ROADS_AND_BRIDGES', label: 'Roads & Bridges' },
                      { value: 'WATER_AND_DRAINAGE', label: 'Water & Drainage' },
                      { value: 'ELECTRICAL_AND_LIGHTING', label: 'Electrical & Lighting' },
                      { value: 'SANITATION_AND_WASTE', label: 'Sanitation & Waste' },
                      { value: 'BUILDING_AND_CIVIL', label: 'Building & Civil' },
                      { value: 'PUBLIC_INFRASTRUCTURE', label: 'Public Infrastructure' },
                    ]}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Tender Title" required id="ct-title">
                  <TextInput
                    id="ct-title"
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    placeholder="e.g., Construction of Stormwater Drainage Network in Zone 4"
                    required
                  />
                </FormField>
                <FormField label="Project Location" id="ct-loc">
                  <TextInput
                    id="ct-loc"
                    value={tLocation}
                    onChange={(e) => setTLocation(e.target.value)}
                    placeholder="e.g., Ward 12, South Zone"
                  />
                </FormField>
              </div>

              <FormField label="Public Description & Objectives" required id="ct-desc">
                <TextArea
                  id="ct-desc"
                  rows={2}
                  value={tDescription}
                  onChange={(e) => setTDescription(e.target.value)}
                  placeholder="High level civic objective and municipal purpose..."
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Estimated Budget (₹)" required id="ct-budget">
                  <TextInput
                    id="ct-budget"
                    type="number"
                    min="1"
                    value={tBudget}
                    onChange={(e) => setTBudget(e.target.value)}
                    placeholder="e.g., 2500000"
                    required
                  />
                </FormField>
                <FormField label="Earnest Money Deposit (₹)" id="ct-emd">
                  <TextInput
                    id="ct-emd"
                    type="number"
                    min="0"
                    value={tEmd}
                    onChange={(e) => setTEmd(e.target.value)}
                    placeholder="e.g., 50000"
                  />
                </FormField>
                <FormField label="Min Contractor Class" id="ct-class">
                  <Select
                    id="ct-class"
                    value={tMinClass}
                    onChange={(e) => setTMinClass(e.target.value)}
                    options={[
                      { value: 'A', label: 'Class A (Premier)' },
                      { value: 'B', label: 'Class B (Major Works)' },
                      { value: 'C', label: 'Class C (Medium Works)' },
                      { value: 'D', label: 'Class D (Entry Works)' },
                    ]}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Submission Deadline" required id="ct-dead">
                  <TextInput
                    id="ct-dead"
                    type="datetime-local"
                    value={tDeadline}
                    onChange={(e) => setTDeadline(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Expected Duration (Days)" required id="ct-days">
                  <TextInput
                    id="ct-days"
                    type="number"
                    min="1"
                    value={tDays}
                    onChange={(e) => setTDays(e.target.value)}
                    required
                  />
                </FormField>
              </div>

              <FormField label="Scope of Work & Deliverables" required id="ct-scope">
                <TextArea
                  id="ct-scope"
                  rows={3}
                  value={tScope}
                  onChange={(e) => setTScope(e.target.value)}
                  placeholder="Detailed engineering specifications, bill of quantities summary, milestones..."
                  required
                />
              </FormField>

              <FormField label="Technical Qualification Criteria" required id="ct-tech">
                <TextArea
                  id="ct-tech"
                  rows={3}
                  value={tTech}
                  onChange={(e) => setTTech(e.target.value)}
                  placeholder="Machinery requirements, past experience criteria, lab certification..."
                  required
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isCreatingTender}>
                  Save Draft Tender
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Award Tender */}
      {awardModalOpen && selectedBidToAward && selectedTenderForBids && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-lg w-full p-6 border-[#DED8CB] dark:border-[#283931] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold font-heading text-[#202522] dark:text-[#E8F0EC] border-b border-[#DED8CB] dark:border-[#283931] pb-2">
              Award Contract: {selectedTenderForBids.tenderNumber}
            </h3>
            <p className="text-xs text-[#4A5750] dark:text-[#A8BFAE]">
              You are officially recording the award decision to{' '}
              <strong className="text-[#202522] dark:text-[#E8F0EC]">{selectedBidToAward.contractor?.name}</strong> for{' '}
              <strong className="text-[#1E6B52] dark:text-[#52B79A] font-mono">{formatCurrency(selectedBidToAward.bidAmount)}</strong>.
              This will automatically generate a binding Work Order and execution milestones.
            </p>

            <form onSubmit={handleAwardTender} className="space-y-4">
              <FormField label="Official Award Justification & Evaluation Summary" required id="aw-just">
                <TextArea
                  id="aw-just"
                  rows={4}
                  value={awardJustification}
                  onChange={(e) => setAwardJustification(e.target.value)}
                  placeholder="Record the official procurement committee basis for selection (e.g., lowest compliant bidder, demonstrated machinery capability)..."
                  required
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
                <Button type="button" variant="ghost" onClick={() => setAwardModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingAward}>
                  Confirm & Execute Award
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Container>
  );
}
