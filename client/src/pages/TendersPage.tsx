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
    <Container size="xl" className="space-y-8">
      {/* Standardized Page Header */}
      <PageHeading
        title="Civic Tenders & Public Procurement"
        description="Explore open civic infrastructure tenders, municipal procurement opportunities, and public bidding contracts."
        className="mb-0"
        actions={
          isContractor ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/contractor')}>
              Contractor Hub & My Bids →
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Contractor Sign In
            </Button>
          )
        }
      />

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
                className="p-6 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="font-mono text-xs text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#34D399]/15 border border-[#0B3D2E]/15 dark:border-[#34D399]/30 px-2.5 py-1 rounded-md font-semibold">
                      {tender.tenderNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(tender.status)}
                      {tender.status === 'PUBLISHED' && expired && (
                        <Badge variant="danger">Deadline Expired</Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] mb-2 line-clamp-2">
                    {tender.title}
                  </h3>

                  <p className="text-sm text-[#4B5563] dark:text-[#D1D5DB] mb-4 line-clamp-3 leading-relaxed">
                    {tender.description}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 bg-[#F9FAFB] dark:bg-[#182230] p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#374151] text-xs">
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Estimated Value</span>
                      <strong className="text-[#0B6640] dark:text-[#34D399] font-semibold text-sm">
                        {formatCurrency(tender.estimatedBudget)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Submission Deadline</span>
                      <strong className={`font-semibold ${expired ? 'text-[#B91C1C] dark:text-[#F39182]' : 'text-[#92400E] dark:text-[#F3B768]'}`}>
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
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Min Class Required</span>
                      <strong className="text-[#111827] dark:text-[#F9FAFB]">
                        {minClass.startsWith('CLASS_') ? minClass.replace('_', ' ') : `Class ${minClass}`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Department</span>
                      <span className="text-[#374151] dark:text-[#D1D5DB] truncate block">
                        {tender.department?.name || 'Public Works Dept'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Project Duration</span>
                      <span className="text-[#374151] dark:text-[#D1D5DB]">
                        {tender.expectedDurationDays ? `${tender.expectedDurationDays} Days` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6B7280] dark:text-[#D1D5DB] block text-[11px]">Submissions</span>
                      <span className="text-[#374151] dark:text-[#D1D5DB]">
                        {tender._count?.bids !== undefined ? `${tender._count.bids} Bids` : 'Confidential'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                    Category: <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">{categoryDisplay}</span>
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
