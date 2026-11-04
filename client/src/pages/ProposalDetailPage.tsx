import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Card } from '../components/ui/Card';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { Alert } from '../components/ui/Alert';
import { TextArea } from '../components/ui/TextArea';
import {
  ThumbUpIcon,
  ChatBubbleIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '../components/ui/icons';
import type { CommunityProposal, ProposalComment } from '../types/engagement';
import { ReportAbuseModal } from '../components/moderation/ReportAbuseModal';
import type { ReportTargetType } from '../types/moderation';

export function ProposalDetailPage() {
  const { currentPath, navigate } = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Extract ID from pathname (e.g. /engagement/proposals/:id)
  const proposalId = currentPath.split('/proposals/')[1]?.split('?')[0];

  const [proposal, setProposal] = useState<CommunityProposal | null>(null);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment Composer
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Staff Moderation State
  const [moderationStatus, setModerationStatus] = useState<string>('PUBLISHED');
  const [internalNotes, setInternalNotes] = useState('');
  const [publicExplanation, setPublicExplanation] = useState('');
  const [officialResponseText, setOfficialResponseText] = useState('');
  const [moderationSubmitting, setModerationSubmitting] = useState(false);
  const [moderationFeedback, setModerationFeedback] = useState<string | null>(null);

  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL';

  // Module 14: Abuse Reporting Modal State
  const [reportModalConfig, setReportModalConfig] = useState<{
    isOpen: boolean;
    targetType: ReportTargetType;
    targetId: string;
    contentTitle?: string;
  }>({
    isOpen: false,
    targetType: 'PROPOSAL',
    targetId: '',
    contentTitle: '',
  });

  const openReportModal = (targetType: ReportTargetType, targetId: string, contentTitle?: string) => {
    setReportModalConfig({
      isOpen: true,
      targetType,
      targetId,
      contentTitle,
    });
  };

  const fetchProposal = useCallback(async () => {
    if (!proposalId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagement/proposals/${proposalId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProposal(json.data);
        setModerationStatus(json.data.status);
        if (json.data.internalModerationNotes) {
          setInternalNotes(json.data.internalModerationNotes);
        }
        if (json.data.publicExplanation) {
          setPublicExplanation(json.data.publicExplanation);
        }
        if (json.data.officialResponse) {
          setOfficialResponseText(json.data.officialResponse);
        }
      } else {
        setError(json.error?.message || 'Proposal not found or access denied.');
      }
    } catch {
      setError('Network error while retrieving proposal.');
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  const fetchComments = useCallback(async () => {
    if (!proposalId) return;
    try {
      const res = await fetch(`/api/engagement/proposals/${proposalId}/comments`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setComments(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, [proposalId]);

  useEffect(() => {
    fetchProposal();
    fetchComments();
  }, [fetchProposal, fetchComments]);

  // Support Toggle Handler
  const handleToggleSupport = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!proposal) return;

    try {
      const res = await fetch(`/api/engagement/proposals/${proposal.id}/support`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setProposal((prev) =>
          prev
            ? {
                ...prev,
                hasSupported: json.data.supported,
                supportCount: json.data.supportCount,
              }
            : null
        );
      }
    } catch {
      // Non-blocking
    }
  };

  // Submit Comment Handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !proposal) return;
    setCommentSubmitting(true);
    setCommentError(null);

    try {
      const res = await fetch(`/api/engagement/proposals/${proposal.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewComment('');
        fetchComments();
      } else {
        setCommentError(json.error?.message || 'Failed to post comment.');
      }
    } catch {
      setCommentError('Network error while posting comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Staff Moderation Submit Handler
  const handleModerate = async () => {
    if (!proposal) return;
    setModerationSubmitting(true);
    setModerationFeedback(null);

    try {
      const res = await fetch(`/api/engagement/admin/proposals/${proposal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: moderationStatus,
          internalNotes: internalNotes.trim() || undefined,
          publicExplanation: publicExplanation.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModerationFeedback(`Proposal status updated to ${moderationStatus}.`);
        fetchProposal();
      } else {
        setModerationFeedback(`Error: ${json.error?.message || 'Failed to update status.'}`);
      }
    } catch {
      setModerationFeedback('Network error while updating proposal status.');
    } finally {
      setModerationSubmitting(false);
    }
  };

  // Post Official Authority Response Handler
  const handlePostOfficialResponse = async () => {
    if (!proposal || !officialResponseText.trim()) return;
    setModerationSubmitting(true);
    setModerationFeedback(null);

    try {
      const res = await fetch(`/api/engagement/admin/proposals/${proposal.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officialResponse: officialResponseText.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setModerationFeedback('Official authority response posted successfully.');
        fetchProposal();
      } else {
        setModerationFeedback(`Error: ${json.error?.message || 'Failed to post response.'}`);
      }
    } catch {
      setModerationFeedback('Network error while posting official response.');
    } finally {
      setModerationSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'ACCEPTED_FOR_CONSIDERATION':
        return 'info';
      case 'UNDER_REVIEW':
        return 'warning';
      case 'NEEDS_CLARIFICATION':
        return 'warning';
      case 'DECLINED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingIndicator label="Loading community proposal..." size="lg" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <Container size="sm" className="space-y-4">
        <Alert variant="error" title="Proposal Unavailable">
          {error || 'The requested community proposal does not exist or has not been published.'}
        </Alert>
        <Button variant="outline" onClick={() => navigate('/engagement')}>
          Return to Civic Engagement Hub
        </Button>
      </Container>
    );
  }

  return (
    <Container size="md" className="space-y-6">
      <PageHeading
        title={proposal.title}
        description={`Submitted by ${proposal.submitter.name} • ${new Date(proposal.createdAt).toLocaleDateString()}${proposal.locality ? ` • Locality: ${proposal.locality}` : ''}`}
        className="mb-0"
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/engagement')}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-0.5 -ml-2 rounded-md text-xs font-semibold gap-1"
            >
              &larr; Back to Civic Engagement Hub
            </button>
            <span className="text-[#D1D5DB]">&bull;</span>
            <span className="font-mono text-xs font-semibold text-[#0B3D2E] bg-[#E5ECE8] dark:bg-[#34D399]/15 dark:text-[#34D399] px-2 py-0.5 rounded">
              {proposal.trackingId}
            </span>
            <span className="text-xs text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-2 py-0.5 rounded">
              {proposal.category.name}
            </span>
          </div>
        }
        badge={
          <Badge variant={getStatusBadgeVariant(proposal.status) as any}>
            {proposal.status.replace(/_/g, ' ')}
          </Badge>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openReportModal('PROPOSAL', proposal.id, proposal.title)}
            leftIcon={<AlertTriangleIcon className="w-3.5 h-3.5 text-[#B91C1C] dark:text-[#FCA5A5]" />}
          >
            Report
          </Button>
        }
      />

      {/* Main Proposal Card */}
      <Card className="p-6 sm:p-8 space-y-6">

        {/* Official Authority Response Banner */}
        {proposal.officialResponse && (
          <div className="p-5 rounded-xl bg-[#E5ECE8]/60 dark:bg-[#273548] border border-[#0B3D2E]/25 dark:border-[#34D399]/35 space-y-2">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B6640] dark:text-emerald-400 uppercase tracking-wider">
                <CheckCircleIcon className="w-4 h-4" /> Official Authority Response
              </div>
              {proposal.officialResponseBy && (
                <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                  {proposal.officialResponseBy.name} ({proposal.officialResponseBy.role})
                </span>
              )}
            </div>
            <p className="text-sm text-[#111827] dark:text-[#F9FAFB] leading-relaxed font-sans">
              {proposal.officialResponse}
            </p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB]">
              Civic Note: An official response acknowledges consideration and feasibility study; it is distinct from approved capital project tenders.
            </p>
          </div>
        )}

        {/* Public Moderator Explanation if Declined or Clarification */}
        {proposal.publicExplanation && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-300">
            <strong>Moderator Note:</strong> {proposal.publicExplanation}
          </div>
        )}

        {/* Problem Statement & Proposed Solution */}
        {(proposal.problemStatement || proposal.suggestedSolution) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {proposal.problemStatement && (
              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] space-y-1">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider block">
                  Identified Problem / Challenge
                </span>
                <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                  {proposal.problemStatement}
                </p>
              </div>
            )}
            {proposal.suggestedSolution && (
              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] space-y-1">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider block">
                  Suggested Action / Solution
                </span>
                <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                  {proposal.suggestedSolution}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Full Proposal Description */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider block">
            Detailed Proposal Description
          </span>
          <p className="text-sm text-[#111827] dark:text-[#F9FAFB] whitespace-pre-wrap leading-relaxed">
            {proposal.description}
          </p>
        </div>

        {/* Endorsement Action */}
        <div className="pt-6 border-t border-[#E5E7EB] dark:border-[#374151] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant={proposal.hasSupported ? 'primary' : 'outline'}
              onClick={handleToggleSupport}
              className="inline-flex items-center gap-2 cursor-pointer"
            >
              <ThumbUpIcon className="w-4 h-4" />
              <span>{proposal.hasSupported ? 'Endorsed' : 'Endorse Proposal'}</span>
              <span className="bg-black/10 dark:bg-[#273548] px-2 py-0.5 rounded-full text-xs font-mono">
                {proposal.supportCount}
              </span>
            </Button>
            <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              {proposal.supportCount === 1 ? '1 citizen endorsement' : `${proposal.supportCount} citizen endorsements`}
            </span>
          </div>

          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1">
            <ChatBubbleIcon className="w-3.5 h-3.5" /> {comments.length} comments
          </span>
        </div>
      </Card>

      {/* Staff Moderation & Authority Tools (Visible to Admins / Officials) */}
      {isStaff && (
        <Card className="p-6 bg-[#F9FAFB] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-[#0B6640] dark:text-[#34D399]" /> Municipal Moderation & Authority Desk
            </h3>
            <span className="text-[11px] font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#1F2937] px-2 py-0.5 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
              Staff Only
            </span>
          </div>

          {moderationFeedback && (
            <Alert variant="info" title="Action Result">
              {moderationFeedback}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                  Change Review Status
                </label>
                <select
                  value={moderationStatus}
                  onChange={(e) => setModerationStatus(e.target.value)}
                  className="w-full bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg px-3 py-2 text-xs text-[#111827] dark:text-[#F9FAFB]"
                >
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="NEEDS_CLARIFICATION">NEEDS CLARIFICATION</option>
                  <option value="PUBLISHED">PUBLISHED (Publicly visible)</option>
                  <option value="ACCEPTED_FOR_CONSIDERATION">ACCEPTED FOR CONSIDERATION</option>
                  <option value="DECLINED">DECLINED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                  Internal Staff Memo (Confidential)
                </label>
                <TextArea
                  placeholder="Notes for fellow reviewers..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                  Public Explanation (Visible to citizen if clarified/declined)
                </label>
                <TextArea
                  placeholder="Public reasoning..."
                  value={publicExplanation}
                  onChange={(e) => setPublicExplanation(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleModerate}
                isLoading={moderationSubmitting}
              >
                Update Status & Notes
              </Button>
            </div>

            <div className="space-y-3 border-t md:border-t-0 md:border-l border-[#E5E7EB] dark:border-[#374151] md:pl-4">
              <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                Post Official Authority Response
              </label>
              <TextArea
                placeholder="Authoritative feedback on municipal feasibility, assessment, or scheduling..."
                value={officialResponseText}
                onChange={(e) => setOfficialResponseText(e.target.value)}
                rows={5}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handlePostOfficialResponse}
                isLoading={moderationSubmitting}
              >
                Publish Official Response
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Community Discussion Thread */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
          <ChatBubbleIcon className="w-5 h-5 text-[#1B5E8A] dark:text-[#78B4DD]" /> Community Discussion ({comments.length})
        </h3>

        {/* Comment Composer */}
        {isAuthenticated ? (
          <form onSubmit={handlePostComment} className="space-y-3">
            {commentError && (
              <Alert variant="error" title="Comment Error">
                {commentError}
              </Alert>
            )}
            <TextArea
              placeholder="Share constructive feedback or perspective on this proposal..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              maxLength={1500}
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={commentSubmitting}
                disabled={!newComment.trim() || commentSubmitting}
              >
                Post Comment
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-lg bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-center space-y-2">
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              Sign in to participate in community discussion on this proposal.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Sign In to Comment
            </Button>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-3 pt-2">
          {comments.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] italic text-center py-4">
              No comments posted yet. Start the conversation!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{comment.author.name}</span>
                    <span className="text-[10px] text-[#374151] dark:text-[#D1D5DB] bg-white dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-1.5 py-0.2 rounded">
                      {comment.author.role === 'ADMIN'
                        ? 'Admin'
                        : comment.author.role === 'GOVERNMENT_OFFICIAL'
                        ? 'Official'
                        : 'Citizen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#6B7280] dark:text-[#D1D5DB]">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openReportModal('PROPOSAL_COMMENT', comment.id, comment.content.slice(0, 60))}
                      className="civora-liquid-btn civora-liquid-btn--ghost px-2 py-0.5 rounded-md text-[11px] hover:!text-rose-700 dark:hover:!text-rose-400"
                      title="Report comment"
                    >
                      Report
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#374151] dark:text-[#D1D5DB] whitespace-pre-wrap leading-relaxed">
                  {comment.content}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Module 14: Citizen Abuse Reporting Modal */}
      <ReportAbuseModal
        isOpen={reportModalConfig.isOpen}
        onClose={() => setReportModalConfig((prev) => ({ ...prev, isOpen: false }))}
        targetType={reportModalConfig.targetType}
        targetId={reportModalConfig.targetId}
        contentTitle={reportModalConfig.contentTitle}
      />
    </Container>
  );
}
