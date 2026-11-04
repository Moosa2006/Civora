import { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { useRouter } from '../router';
import { getStatusBadgeVariant } from '../utils/status';
import type { Complaint } from '../types/complaint';

export function MyComplaintsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const { t, formatDate } = useTranslation();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchMyComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let url = `/api/complaints/my?page=${page}&limit=10`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to fetch your complaints.');
        return;
      }

      setComplaints(json.data.complaints || []);
      if (json.data.pagination) {
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch {
      setErrorMsg('Unable to retrieve your complaints. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyComplaints();
    }
  }, [isAuthenticated, fetchMyComplaints]);

  if (!authLoading && !isAuthenticated) {
    return (
      <Container size="md" className="py-12 space-y-6">
        <PageHeading
          title="My Civic Complaints"
          description="View and manage issues you have reported across your neighborhood."
        />

        <Card className="border-[#E5E7EB] dark:border-[#374151]">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You must be logged in to access your personal complaint filings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#374151] dark:text-[#D1D5DB]">
              Please log in to your verified citizen profile to see your submitted complaints, inspection updates, and resolution statuses.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button variant="outline" onClick={() => navigate('/register')}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const filterTabs = [
    { label: t('myComplaints.allTab'), value: 'ALL' },
    { label: t('status.SUBMITTED'), value: 'SUBMITTED' },
    { label: t('status.UNDER_REVIEW'), value: 'UNDER_REVIEW' },
    { label: t('status.ASSIGNED'), value: 'ASSIGNED' },
    { label: t('status.IN_PROGRESS'), value: 'IN_PROGRESS' },
    { label: t('status.RESOLVED'), value: 'RESOLVED' },
    { label: t('status.VERIFIED'), value: 'VERIFIED' },
    { label: t('status.REOPENED'), value: 'REOPENED' },
    { label: t('status.REJECTED'), value: 'REJECTED' },
  ];

  return (
    <Container size="lg" className="space-y-8">
      {/* Header */}
      <PageHeading
        title={t('myComplaints.title')}
        description={`${user?.name || t('roles.citizen')} • ${totalCount} ${totalCount === 1 ? 'grievance' : 'grievances'}`}
        badge={
          <Badge variant="default" size="md">
            {t('roles.citizen')}
          </Badge>
        }
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/report')}
            className="shrink-0 cursor-pointer"
          >
            {t('myComplaints.fileComplaintBtn')}
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#E5E7EB] dark:border-[#374151]">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            data-active={statusFilter === tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`civora-liquid-tab px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              statusFilter === tab.value
                ? 'font-semibold'
                : 'text-[#6B7280] dark:text-[#D1D5DB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <Alert variant="error" title="Data Retrieval Error">
          {errorMsg}
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => fetchMyComplaints()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <LoadingIndicator size="lg" label="Loading complaints" />
          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-3">Loading your filed complaints...</span>
        </div>
      ) : complaints.length === 0 ? (
        /* Empty State */
        <EmptyState
          title={statusFilter === 'ALL' ? t('myComplaints.noComplaintsTitle') : `${t('common.status')}: ${statusFilter}`}
          description={
            statusFilter === 'ALL'
              ? t('myComplaints.noComplaintsDesc')
              : ''
          }
          action={
            <Button variant="primary" onClick={() => navigate('/report')}>
              {t('myComplaints.fileComplaintBtn')}
            </Button>
          }
        />
      ) : (
        /* Complaint List */
        <div className="space-y-4">
          {complaints.map((c) => (
            <Card
              key={c.id}
              className={`transition-colors ${
                c.status === 'RESOLVED'
                  ? 'border-[#1E6B52]/40 hover:border-[#1E6B52]/60'
                  : 'hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#34D399]/15 px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#34D399]/30">
                        {c.trackingId}
                      </span>
                      <Badge variant={getStatusBadgeVariant(c.status)} size="sm" hasDot>
                        {t(`status.${c.status}`) || c.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                        • {c.category?.name || 'General Civic Issue'}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] hover:text-[#0B3D2E] dark:hover:text-[#6EE7B7] transition-colors">
                      {c.title}
                    </h3>

                    <p className="text-xs text-[#374151] dark:text-[#D1D5DB] line-clamp-2">
                      {c.description}
                    </p>

                    {c.status === 'RESOLVED' && (
                      <div className="p-2 rounded bg-[#EDF5F1] dark:bg-[#34D399]/12 border border-[#B6DBC7] dark:border-[#34D399]/35 text-xs text-[#18553F] dark:text-[#6EE7B7]">
                        ✓ Municipal work completed — awaiting your citizen verification.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] dark:text-[#D1D5DB] pt-1">
                      <span>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Location:</strong> {c.locality}
                      </span>
                      <span>
                        <strong className="text-[#111827] dark:text-[#F9FAFB]">Lodged:</strong> {formatDate(c.createdAt)}
                      </span>
                      {c.assignedDepartment && (
                        <span>
                          <strong className="text-[#111827] dark:text-[#F9FAFB]">Department:</strong>{' '}
                          {c.assignedDepartment.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    {c.status === 'RESOLVED' ? (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => navigate(`/track?id=${c.trackingId}`)}
                        className="text-xs"
                      >
                        Verify Resolution
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/track?id=${c.trackingId}`)}
                        className="text-xs"
                      >
                        Track Live
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs">
              <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
