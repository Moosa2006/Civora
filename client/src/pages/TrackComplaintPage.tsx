import { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import {
  SearchIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  MapPinIcon,
  CloseIcon,
  AlertTriangleIcon,
  ClockIcon,
  FileTextIcon,
} from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useTranslation } from '../context/useTranslation';
import { useRouter } from '../router';
import { getStatusBadgeVariant } from '../utils/status';
import type { Complaint } from '../types/complaint';
import { ComplaintMessageThread } from '../components/complaints/ComplaintMessageThread';
import { EvidenceSection } from '../components/evidence/EvidenceSection';

export function TrackComplaintPage() {
  const { user, isAuthenticated } = useAuth();
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation();

  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Verification & Reopening modal states
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComplaint = useCallback(async (idToSearch: string) => {
    if (!idToSearch || idToSearch.trim().length === 0) {
      setErrorMsg('Please enter a valid tracking ID.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    setComplaint(null);

    try {
      const res = await fetch(`/api/complaints/track/${encodeURIComponent(idToSearch.trim().toUpperCase())}`, {
        credentials: 'include',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(
          json.error?.message ||
            'No civic complaint found with this tracking ID. Please verify the identifier and try again.'
        );
        return;
      }

      setComplaint(json.data.complaint);
    } catch {
      setErrorMsg('Unable to connect to tracking server. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check URL query parameters whenever currentPath changes (?id=CIV-...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchStr = currentPath.includes('?')
        ? currentPath.slice(currentPath.indexOf('?'))
        : window.location.search;
      const params = new URLSearchParams(searchStr);
      const idParam = params.get('id');
      if (idParam && idParam.trim()) {
        const cleanId = idParam.trim().toUpperCase();
        setTrackingId(cleanId);
        fetchComplaint(cleanId);
        window.scrollTo(0, 0);
      }
    }
  }, [currentPath, fetchComplaint]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingId.trim()) {
      const cleanId = trackingId.trim().toUpperCase();
      navigate(`/track?id=${encodeURIComponent(cleanId)}`);
      fetchComplaint(cleanId);
      window.scrollTo(0, 0);
    }
  };

  const handleResetSearch = () => {
    setTrackingId('');
    setComplaint(null);
    setErrorMsg(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const input = document.getElementById('tracking-id-input');
      if (input) input.focus();
    }
  };

  const handleConfirmResolution = async () => {
    if (!complaint) return;
    const complaintIdentifier = complaint.id || complaint.trackingId;
    setActionLoading(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch(`/api/complaints/${complaintIdentifier}/verify-resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          feedback: verificationFeedback.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMsg(json.error?.message || 'Failed to verify resolution.');
        return;
      }

      setActionSuccessMsg('Thank you! Resolution verified successfully. The civic complaint has been finalized.');
      fetchComplaint(complaint.trackingId);
    } catch {
      setActionErrorMsg('Network error while verifying resolution.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestReopening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    if (!reopenReason.trim()) {
      setActionErrorMsg('A detailed reason is required to request reopening.');
      return;
    }

    const complaintIdentifier = complaint.id || complaint.trackingId;
    setActionLoading(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch(`/api/complaints/${complaintIdentifier}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reopenReason: reopenReason.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMsg(json.error?.message || 'Failed to request reopening.');
        return;
      }

      setActionSuccessMsg('Reopening requested. The complaint has been sent back to the municipal department for review.');
      setShowReopenModal(false);
      setReopenReason('');
      fetchComplaint(complaint.trackingId);
    } catch {
      setActionErrorMsg('Network error while requesting reopening.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Pending';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isOwnerCitizen = isAuthenticated && complaint && user && (user.id === complaint.citizenId || user.role === 'ADMIN');

  return (
    <Container size="lg" className="space-y-8">
      {/* Header */}
      <PageHeading
        title={t('tracking.heading')}
        description={t('tracking.subheading')}
        badge={
          <Badge variant="info" size="md" hasDot>
            {t('common.status')}
          </Badge>
        }
      />

      {/* Tracking Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tracking.heading')}</CardTitle>
          <CardDescription>
            {t('tracking.subheading')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="max-w-2xl space-y-2">
            <label htmlFor="tracking-id-input" className="block text-sm font-medium text-[#3E4B44] dark:text-[#C5D4C9]">
              {t('tracking.inputPlaceholder')}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <TextInput
                  id="tracking-id-input"
                  placeholder={t('tracking.inputPlaceholder')}
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                  leftIcon={<SearchIcon className="w-4 h-4 text-[#54625A] dark:text-[#C5D4C9]" />}
                  className="h-10"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !trackingId.trim()}
                leftIcon={<SearchIcon className="w-4 h-4" />}
                className="w-full sm:w-auto shrink-0 h-10"
              >
                {loading ? 'Searching...' : 'Track Issue'}
              </Button>
            </div>
            <p id="tracking-id-input-helper" className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
              Format: CIV-YYYY-XXXXX
            </p>
          </form>
        </CardContent>
      </Card>

      {errorMsg && (
        <Alert variant="error" title="Record Not Found">
          {errorMsg}
        </Alert>
      )}

      {actionSuccessMsg && (
        <Alert variant="success" title="Citizen Verification Updated">
          {actionSuccessMsg}
        </Alert>
      )}

      {actionErrorMsg && (
        <Alert variant="error" title="Action Failed">
          {actionErrorMsg}
        </Alert>
      )}

      {/* Live Complaint Result */}
      {complaint && (
        <div className="space-y-6">
          {/* Citizen Verification Banner for RESOLVED Complaints */}
          {complaint.status === 'RESOLVED' && (
            <Card className="border-[#1E6B52]/30 bg-white dark:bg-[#16201C] shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1E6B52] dark:bg-[#78C7AE]" />
                      <h3 className="text-base font-heading font-semibold text-[#185541] dark:text-[#78C7AE]">
                        Official Resolution Submitted — Pending Citizen Verification
                      </h3>
                    </div>
                    <p className="text-xs text-[#4A5750] dark:text-[#B0C0B6] max-w-2xl leading-relaxed">
                      The responsible municipal department has marked this issue as resolved. As the citizen reporter, please inspect the work and confirm whether the problem is fixed or request reopening if the issue persists.
                    </p>
                    {complaint.resolutionNotes && (
                      <div className="mt-2 p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#141C18] border border-[#DED8CB] dark:border-[#283931] text-xs text-[#202522] dark:text-[#F5F2EA]">
                        <strong className="text-[#1E6B52] dark:text-[#78C7AE]">Official Resolution Summary: </strong>
                        {complaint.resolutionNotes}
                      </div>
                    )}
                  </div>

                  {isOwnerCitizen ? (
                    <div className="flex flex-col gap-2 shrink-0 max-w-xs w-full">
                      <TextInput
                        id="verification-feedback-input"
                        placeholder="Optional feedback note..."
                        value={verificationFeedback}
                        onChange={(e) => setVerificationFeedback(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={handleConfirmResolution}
                          leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                          className="cursor-pointer"
                        >
                          {actionLoading ? 'Processing...' : 'Confirm Resolution'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setShowReopenModal(true)}
                          leftIcon={<AlertTriangleIcon className="w-4 h-4" />}
                          className="border-[#B94B3B]/40 text-[#B94B3B] hover:bg-[#B94B3B]/10 cursor-pointer"
                        >
                          Request Reopening
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] bg-[#FAF8F5] dark:bg-[#141C18] px-3 py-2 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      {!isAuthenticated ? (
                        <span>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="text-[#173D32] dark:text-[#7BC4B2] p-0 h-auto inline underline font-semibold">
                            Sign in
                          </Button>{' '}
                          with the reporter account to verify this resolution.
                        </span>
                      ) : (
                        <span>Awaiting verification by the citizen who lodged this complaint.</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verified Resolution Banner */}
          {complaint.status === 'VERIFIED' && (
            <Card className="border-[#1E6B52]/30 bg-white dark:bg-[#16201C] shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircleIcon className="w-6 h-6 text-[#1E6B52] dark:text-[#78C7AE] shrink-0" />
                <div className="text-xs">
                  <strong className="text-[#185541] dark:text-[#78C7AE] block text-sm font-heading">Citizen Verified & Finalized</strong>
                  <span className="text-[#4A5750] dark:text-[#B0C0B6]">
                    The citizen reporter confirmed that this civic issue was satisfactorily addressed on {formatDate(complaint.verifiedAt)}.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reopened Banner */}
          {complaint.status === 'REOPENED' && (
            <Card className="border-amber-500/40 bg-amber-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangleIcon className="w-6 h-6 text-amber-400 shrink-0" />
                <div className="text-xs">
                  <strong className="text-[#854F0B] dark:text-[#F3BA6C] block text-sm">Citizen Requested Reopening</strong>
                  <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                    The citizen indicated the issue was incomplete or recurring. This complaint is back under active departmental follow-up.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SLA Commitment & Public Accountability Card */}
          {((complaint as any).sla || (complaint as any).escalations?.length > 0) && (
            <Card className="border-[#4F9B8B]/40 shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED8CB] dark:border-[#283931] pb-3">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-[#173D32] dark:text-[#7BC4B2] shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-[#202522] dark:text-[#F5F2EA]">
                        Service-Level Agreement (SLA) & Public Commitments
                      </h3>
                      <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                        Target timelines committed under policy:{' '}
                        <strong className="text-[#202522] dark:text-[#F5F2EA]">
                          {(complaint as any).sla?.policyName || 'Standard Municipal SLA'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* SLA Status Badge */}
                  <div>
                    {(() => {
                      const sla = (complaint as any).sla;
                      if (!sla) {
                        return <Badge variant="neutral">No Configured SLA</Badge>;
                      }
                      if (sla.slaStatus === 'RESOLVED_ON_TIME') {
                        return <Badge variant="success">Resolved on Target</Badge>;
                      }
                      if (sla.slaStatus === 'RESOLVED_LATE') {
                        return <Badge variant="warning">Resolved after Target</Badge>;
                      }
                      if (sla.isResolutionOverdue || sla.slaStatus === 'RESOLUTION_OVERDUE') {
                        return <Badge variant="danger">Resolution Overdue</Badge>;
                      }
                      if (sla.isResponseOverdue || sla.slaStatus === 'RESPONSE_OVERDUE') {
                        return <Badge variant="danger">Response Overdue</Badge>;
                      }
                      if (sla.slaStatus === 'APPROACHING_DEADLINE') {
                        return <Badge variant="warning">Approaching Target</Badge>;
                      }
                      return <Badge variant="info">On Track</Badge>;
                    })()}
                  </div>
                </div>

                {/* Deadlines Grid */}
                {(complaint as any).sla && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">Response Target:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">
                        {new Date((complaint as any).sla.currentResponseDeadline).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </div>

                    <div className="bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-3 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">Resolution Target:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">
                        {new Date((complaint as any).sla.currentResolutionDeadline).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </div>

                    {(complaint as any).sla.estimatedCompletionDate && (
                      <div className="bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-3 rounded-lg border border-[#4F9B8B]/40 sm:col-span-2 md:col-span-1">
                        <span className="text-[#1D584D] dark:text-[#7BC4B2] font-semibold block mb-0.5">Department Estimated Completion:</span>
                        <strong className="text-[#202522] dark:text-[#F5F2EA]">
                          {new Date((complaint as any).sla.estimatedCompletionDate).toLocaleDateString()}
                        </strong>
                        {(complaint as any).sla.estimatedCompletionNotes && (
                          <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">
                            {(complaint as any).sla.estimatedCompletionNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Public Escalation Notice */}
                {Array.isArray((complaint as any).escalations) &&
                  (complaint as any).escalations.some((e: any) => e.status !== 'RESOLVED') && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FDF6ED] dark:bg-[#281D0E] border border-[#F2D7A5] dark:border-[#533916] text-xs text-[#854F0B] dark:text-[#F3BA6C]">
                      <AlertTriangleIcon className="w-4 h-4 text-[#854F0B] dark:text-[#F3B768] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#202522] dark:text-[#F5F2EA]">Supervisory Escalation Notice: </strong>
                        This case has been formally escalated to departmental supervisors to accelerate inspection, resource allocation, and resolution.
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Status & Details Card */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-bold text-[#1D584D] dark:text-[#7BC4B2] bg-[#4F9B8B]/12 dark:bg-[#1D3E37] px-2.5 py-0.5 rounded border border-[#4F9B8B]/30">
                          {complaint.trackingId}
                        </span>
                        <Badge variant={getStatusBadgeVariant(complaint.status)} size="sm" hasDot>
                          {complaint.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl">{complaint.title}</CardTitle>
                    </div>

                    <div className="text-left sm:text-right text-xs text-[#54625A] dark:text-[#C5D4C9]">
                      <span>Lodged on:</span>
                      <p className="text-[#202522] dark:text-[#E8F0EC] font-medium">{formatDate(complaint.createdAt)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Category & Location Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] text-xs">
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">Civic Category:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">{complaint.category?.name || 'Civic Issue'}</strong>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">Assigned Department:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">
                        {complaint.assignedDepartment?.name || 'Under Departmental Review'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#54625A] dark:text-[#C5D4C9] block mb-0.5">Priority:</span>
                      <strong className="text-[#202522] dark:text-[#E8F0EC]">{complaint.priority}</strong>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] mb-2">
                      Reported Issue Details
                    </h4>
                    <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed whitespace-pre-line bg-[#ECE7DB]/30 dark:bg-[#1D2A25]/30 p-3.5 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      {complaint.description}
                    </p>
                  </div>

                  {/* Location Info */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] mb-2 flex items-center gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-[#185541] dark:text-[#78C7AE]" />
                      Location Information
                    </h4>
                    <div className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] space-y-1 bg-[#ECE7DB]/30 dark:bg-[#1D2A25]/30 p-3.5 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      <p>
                        <strong className="text-[#202522] dark:text-[#E8F0EC]">Address: </strong>
                        {complaint.locationAddress}
                      </p>
                      <p>
                        <strong className="text-[#202522] dark:text-[#E8F0EC]">Locality: </strong>
                        {complaint.locality} {complaint.ward ? `• ${complaint.ward}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Rejection / Resolution Callouts */}
                  {complaint.status === 'REJECTED' && complaint.rejectionReason && (
                    <Alert variant="error" title="Review Decision: Rejected">
                      {complaint.rejectionReason}
                    </Alert>
                  )}

                  {complaint.status === 'RESOLVED' && complaint.resolutionNotes && (
                    <Alert variant="success" title="Municipal Resolution Notes">
                      {complaint.resolutionNotes}
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Official Progress Updates Feed */}
              {complaint.progressUpdates && complaint.progressUpdates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-[#173D32] dark:text-[#7BC4B2]" />
                      Official Progress Updates ({complaint.progressUpdates.length})
                    </CardTitle>
                    <CardDescription>
                      Field maintenance milestones logged by authorized department personnel
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {complaint.progressUpdates.map((update) => (
                      <div
                        key={update.id}
                        className="p-3.5 rounded-lg bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 border border-[#DED8CB] dark:border-[#283931] space-y-1.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#202522] dark:text-[#E8F0EC] text-sm">{update.title}</span>
                            <span className="px-2 py-0.5 rounded bg-[#173D32]/10 dark:bg-[#1D3E37] text-[#173D32] dark:text-[#7BC4B2] font-mono text-[10px] border border-[#173D32]/20 dark:border-[#4F9B8B]/30">
                              {update.stageOrEvent}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                            {formatDate(update.createdAt)}
                          </span>
                        </div>
                        <p className="text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">{update.description}</p>
                        <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] pt-1 flex items-center gap-2">
                          <span>Logged by: <strong className="text-[#202522] dark:text-[#F5F2EA]">{update.author?.name || 'Department Officer'}</strong></span>
                          {update.department && <span>• {update.department.name}</span>}
                          {update.actionDate && <span>• Target: {formatDate(update.actionDate)}</span>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Site Inspections */}
              {complaint.inspections && complaint.inspections.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileTextIcon className="w-4 h-4 text-[#854F0B] dark:text-[#F3B768]" />
                      Official Site Inspections ({complaint.inspections.length})
                    </CardTitle>
                    <CardDescription>
                      On-site inspection findings, readings, and outcome assessments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {complaint.inspections.map((insp) => (
                      <div
                        key={insp.id}
                        className="p-3.5 rounded-lg bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 border border-[#DED8CB] dark:border-[#283931] space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#854F0B] dark:text-[#F3BA6C]">
                            Outcome: {insp.outcome.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                            Inspected on: {formatDate(insp.inspectionDate)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[#3E4B44] dark:text-[#C5D4C9]">
                            <strong className="text-[#202522] dark:text-[#F5F2EA]">Findings: </strong>
                            {insp.findings}
                          </p>
                          {insp.measurementsOrReadings && (
                            <p className="text-[#3E4B44] dark:text-[#C5D4C9]">
                              <strong className="text-[#202522] dark:text-[#F5F2EA]">Measurements: </strong>
                              {insp.measurementsOrReadings}
                            </p>
                          )}
                        </div>
                        <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] pt-1">
                          Inspector: <strong className="text-[#202522] dark:text-[#F5F2EA]">{insp.inspector?.name || 'Assigned Officer'}</strong>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Module 12: Secure Evidence & Verification Records */}
              <EvidenceSection
                complaintId={complaint.id || complaint.trackingId}
                trackingId={complaint.trackingId}
                isOwner={!!isOwnerCitizen}
                departmentId={complaint.assignedDepartment?.id}
                onEvidenceChange={() => fetchComplaint(complaint.trackingId)}
                onSearchAgain={handleResetSearch}
              />
            </div>

            {/* Audit History / Timeline Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4 text-[#185541] dark:text-[#78C7AE]" />
                    Public Audit Timeline
                  </CardTitle>
                  <CardDescription>
                    Cryptographically traceable municipal lifecycle log
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {complaint.timeline && complaint.timeline.length > 0 ? (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#DED8CB] dark:before:bg-[#283931]">
                      {complaint.timeline.map((item, idx) => (
                        <div key={idx} className="relative group">
                          <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#173D32] dark:bg-[#7BC4B2] border-2 border-white dark:border-[#16201C]" />
                          <div className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={getStatusBadgeVariant(item.toStatus)} size="sm">
                                {item.toStatus}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] block mt-1">
                              {formatDate(item.createdAt)}
                            </span>
                            {item.reasonOrRemarks && (
                              <p className="text-[11px] text-[#3E4B44] dark:text-[#C5D4C9] mt-1 italic">
                                &ldquo;{item.reasonOrRemarks}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Initial filing registered.</p>
                  )}

                  <div className="pt-3 border-t border-[#DED8CB] dark:border-[#283931] text-[11px] text-[#54625A] dark:text-[#C5D4C9] flex items-center gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-[#185541] dark:text-[#78C7AE]" />
                    Privacy Protected: Citizen identity is never exposed.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Module 9: Citizen–Official Communication Thread */}
          {(isOwnerCitizen || user?.role === 'GOVERNMENT_OFFICIAL' || user?.role === 'ADMIN') && (
            <div className="mt-8">
              <ComplaintMessageThread
                complaintId={complaint.id}
                trackingId={complaint.trackingId}
              />
            </div>
          )}
        </div>
      )}

      {/* Citizen Reopening Request Modal */}
      {showReopenModal && complaint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-[#9C3B2D]/40 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[#9C3B2D] dark:text-[#F39182]">Request Complaint Reopening</CardTitle>
                <CardDescription>
                  Tracking ID: {complaint.trackingId}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-lg cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestReopening} className="space-y-4">
                <Alert variant="warning" title="Important">
                  Reopening will notify municipal supervisors and return this complaint to the department queue for remedial inspection.
                </Alert>

                <FormField
                  id="reopen-reason"
                  label="Reopening Explanation (Mandatory)"
                  required
                  helperText="Explain why the proposed resolution was incomplete or what issues remain."
                >
                  <TextArea
                    id="reopen-reason"
                    placeholder="e.g. Only half of the pothole was filled; waterlogging still recurs when it rains..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    required
                  />
                </FormField>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DED8CB] dark:border-[#283931]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowReopenModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={actionLoading || !reopenReason.trim()}
                    className="cursor-pointer"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Reopening Request'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  );
}
