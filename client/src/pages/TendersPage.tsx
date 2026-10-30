import { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/TextInput';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { Alert } from '../components/ui/Alert';

interface TenderSummary {
  id: string;
  tenderNumber: string;
  title: string;
  description: string;
  categoryCode?: string;
  category?: string;
  location: string | null;
  status: string;
  estimatedBudget: number | string | null;
  earnestMoneyDeposit: number | string | null;
  minimumContractorClass?: string | null;
  minLicenseClass?: string | null;
  publicationDate?: string | null;
  publishedAt?: string | null;
  submissionDeadline: string;
  expectedDurationDays: number | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  _count?: {
    bids: number;
  };
}

export function TendersPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const isContractor = user?.role === 'CONTRACTOR';

  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchTenders = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const res = await fetch(`/api/tenders?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data?.tenders)) {
        setTenders(json.data.tenders);
      } else {
        setErrorMessage(json.error?.message || 'Failed to fetch public tenders.');
      }
    } catch {
      setErrorMessage('Network error fetching tenders list. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenders();
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return 'Not Disclosed';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 'Not Disclosed';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Open for Bidding</Badge>;
      case 'UNDER_EVALUATION':
        return <Badge variant="warning">Under Evaluation</Badge>;
      case 'AWARDED':
        return <Badge variant="info">Awarded</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status ? status.replace(/_/g, ' ') : 'Draft'}</Badge>;
    }
  };

  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline).getTime() < Date.now();
  };

  return (
    <Container size="xl" className="py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DED8CB] dark:border-[#283931] pb-6">
        <div>
          <PageHeading
            title="Civic Tenders & Public Procurement"
            description="Explore open civic infrastructure tenders, municipal procurement opportunities, and public bidding contracts."
          />
        </div>
        <div className="flex items-center gap-3">
          {isContractor ? (
            <Button
              variant="primary"
              onClick={() => navigate('/contractor')}
              className="shadow-sm shadow-blue-500/20"
            >
              Contractor Hub & My Bids →
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              className="text-xs"
            >
              Contractor Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <TextInput
              placeholder="Search tender by title, tender no., or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'All Work Categories' },
                { value: 'ROADS_AND_BRIDGES', label: 'Roads & Bridges' },
                { value: 'WATER_AND_DRAINAGE', label: 'Water & Drainage' },
                { value: 'ELECTRICAL_AND_LIGHTING', label: 'Electrical & Lighting' },
                { value: 'SANITATION_AND_WASTE', label: 'Sanitation & Waste' },
                { value: 'BUILDING_AND_CIVIL', label: 'Building & Civil' },
                { value: 'PUBLIC_INFRASTRUCTURE', label: 'Public Infrastructure' },
              ]}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'PUBLISHED', label: 'Open for Bidding' },
                { value: 'UNDER_EVALUATION', label: 'Under Evaluation' },
                { value: 'AWARDED', label: 'Awarded' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
            />
            <Button type="submit" variant="secondary" className="px-4">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {/* Error State with Recovery Action */}
      {errorMessage && (
        <Alert variant="error" title="Could Not Load Tenders">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <Button size="sm" variant="outline" onClick={fetchTenders}>
              Retry Fetch
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingIndicator label="Loading public tenders database..." />
        </div>
      ) : tenders.length === 0 ? (
        <EmptyState
          title="No Tenders Found"
          description="There are currently no published tenders matching your selected criteria. Try resetting filters or searching with different keywords."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setCategoryFilter('');
                fetchTenders();
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        /* Tender Cards Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tenders.map((tender) => {
            const expired = isDeadlinePassed(tender.submissionDeadline);
            const rawCategory = tender.categoryCode || tender.category || 'CIVIC_INFRASTRUCTURE';
            const categoryDisplay = rawCategory.replace(/_/g, ' ');
            const minClass = tender.minimumContractorClass || tender.minLicenseClass || 'Open';

            return (
              <Card
                key={tender.id}
                className="p-6 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="font-mono text-xs text-[#1B5E8A] dark:text-[#78B4DD] bg-[#E8F1F8] dark:bg-[#152733] border border-[#A8C9E3] dark:border-[#22445E] px-2.5 py-1 rounded-md font-semibold">
                      {tender.tenderNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(tender.status)}
                      {tender.status === 'PUBLISHED' && expired && (
                        <Badge variant="danger">Deadline Expired</Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA] mb-2 line-clamp-2">
                    {tender.title}
                  </h3>

                  <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] mb-4 line-clamp-3 leading-relaxed">
                    {tender.description}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931] text-xs">
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Estimated Value</span>
                      <strong className="text-[#185541] dark:text-[#78C7AE] font-semibold text-sm">
                        {formatCurrency(tender.estimatedBudget)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Submission Deadline</span>
                      <strong className={`font-semibold ${expired ? 'text-[#9C3B2D] dark:text-[#F39182]' : 'text-[#854F0B] dark:text-[#F3B768]'}`}>
                        {tender.submissionDeadline
                          ? new Date(tender.submissionDeadline).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'TBD'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Min Class Required</span>
                      <strong className="text-[#202522] dark:text-[#F5F2EA]">
                        {minClass.startsWith('CLASS_') ? minClass.replace('_', ' ') : `Class ${minClass}`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Department</span>
                      <span className="text-[#3E4B44] dark:text-[#C5D4C9] truncate block">
                        {tender.department?.name || 'Public Works Dept'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Project Duration</span>
                      <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                        {tender.expectedDurationDays ? `${tender.expectedDurationDays} Days` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block text-[11px]">Submissions</span>
                      <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                        {tender._count?.bids !== undefined ? `${tender._count.bids} Bids` : 'Confidential'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-[#DED8CB] dark:border-[#283931] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                    Category: <span className="text-[#202522] dark:text-[#F5F2EA] font-medium">{categoryDisplay}</span>
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/tenders/${tender.id}`)}
                  >
                    View Scope & Requirements →
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
