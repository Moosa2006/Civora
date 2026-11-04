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
import {
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
} from '../components/ui/icons';
import type { PublicPoll } from '../types/engagement';

export function PollDetailPage() {
  const { currentPath, navigate } = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Extract ID from pathname (e.g. /engagement/polls/:id)
  const pollId = currentPath.split('/polls/')[1]?.split('?')[0];

  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Voting State
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState<string | null>(null);

  // Admin Status Update State
  const [adminStatus, setAdminStatus] = useState<string>('OPEN');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const fetchPoll = useCallback(async () => {
    if (!pollId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagement/polls/${pollId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPoll(json.data);
        setAdminStatus(json.data.status);
      } else {
        setError(json.error?.message || 'Public civic poll not found.');
      }
    } catch {
      setError('Network error while loading civic poll.');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const handleOptionSelect = (optId: string) => {
    if (!poll) return;

    if (poll.pollType === 'SINGLE_CHOICE') {
      setSelectedOptions([optId]);
    } else {
      if (selectedOptions.includes(optId)) {
        setSelectedOptions((prev) => prev.filter((id) => id !== optId));
      } else {
        if (selectedOptions.length < poll.maxSelections) {
          setSelectedOptions((prev) => [...prev, optId]);
        }
      }
    }
  };

  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poll) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (selectedOptions.length === 0) {
      setVoteError('Please select at least one option to vote.');
      return;
    }

    setSubmittingVote(true);
    setVoteError(null);
    setVoteSuccess(null);

    try {
      const res = await fetch(`/api/engagement/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIds: selectedOptions }),
      });

      const json = await res.json();
      if (json.success) {
        setVoteSuccess('Your vote has been recorded securely. Thank you for participating!');
        fetchPoll();
      } else {
        setVoteError(json.error?.message || 'Unable to record vote.');
      }
    } catch {
      setVoteError('Network error while recording vote. Please try again.');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleAdminStatusChange = async (newStatus: string) => {
    if (!poll || !isAdmin) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/engagement/admin/polls/${poll.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        fetchPoll();
      }
    } catch {
      // Non-blocking
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingIndicator label="Loading public civic poll..." size="lg" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <Container size="sm" className="space-y-4">
        <Alert variant="error" title="Poll Unavailable">
          {error || 'This public civic poll could not be located.'}
        </Alert>
        <Button variant="outline" onClick={() => navigate('/engagement')}>
          Return to Civic Engagement Hub
        </Button>
      </Container>
    );
  }

  const isClosed = poll.status === 'CLOSED';
  const showResults = poll.resultsVisible || poll.hasVoted || isClosed;
  const canVote = poll.status === 'OPEN' && !poll.hasVoted;

  return (
    <Container size="md" className="space-y-6">
      <PageHeading
        title={poll.question}
        description={poll.description || undefined}
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
            <span className="text-xs font-semibold text-[#0B3D2E] dark:text-[#34D399] uppercase tracking-wider">
              {poll.title}
            </span>
          </div>
        }
        badge={
          <Badge variant={poll.status === 'OPEN' ? 'success' : 'neutral'}>
            {poll.status}
          </Badge>
        }
        actions={
          <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-1.5 bg-[#F9FAFB] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-3 py-1.5 rounded-lg">
            <ClockIcon className="w-3.5 h-3.5 text-[#0B3D2E] dark:text-[#34D399]" />
            {isClosed ? 'Closed' : `Deadline: ${new Date(poll.endDate).toLocaleDateString()}`}
          </span>
        }
      />

      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {poll.category && (
            <span className="text-xs text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-2.5 py-1 rounded-md font-medium">
              {poll.category.name}
            </span>
          )}
          <span className="text-xs text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#273548] border border-[#E5E7EB] dark:border-[#374151] px-2.5 py-1 rounded-md font-medium">
            {poll.pollType === 'SINGLE_CHOICE' ? 'Single Choice' : `Multi Choice (Max ${poll.maxSelections})`}
          </span>
        </div>

        {/* Advisory Statement */}
        <div className="p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] flex items-start gap-2.5 text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
          <InfoIcon className="w-4 h-4 text-[#0B6640] dark:text-[#34D399] shrink-0 mt-0.5" />
          <div>
            <strong>Civic Advisory Poll:</strong> Participation is strictly limited to one response per signed-in account. Results represent respondent preferences and are advisory to municipal planning.
          </div>
        </div>

        {voteSuccess && (
          <Alert variant="success" title="Response Recorded">
            {voteSuccess}
          </Alert>
        )}

        {voteError && (
          <Alert variant="error" title="Vote Error">
            {voteError}
          </Alert>
        )}

        {/* Already Voted Banner */}
        {poll.hasVoted && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-300">
            <CheckCircleIcon className="w-5 h-5 text-[#0B6640] dark:text-emerald-400 shrink-0" />
            <div>
              <strong>Your participation is recorded.</strong> Thank you for sharing your perspective on this civic issue.
            </div>
          </div>
        )}

        {/* Voting Options (Form) */}
        {canVote ? (
          <form onSubmit={handleSubmitVote} className="space-y-4 pt-2">
            <div className="space-y-2.5">
              {poll.options.map((opt) => {
                const isSelected = selectedOptions.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleOptionSelect(opt.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#E5ECE8] dark:bg-[#34D399]/15 border-[#0B3D2E] dark:border-[#34D399] text-[#0B3D2E] dark:text-[#F9FAFB] font-semibold shadow-xs'
                        : 'bg-[#F9FAFB] dark:bg-[#182230] border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#D1D5DB] hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-${
                          poll.pollType === 'SINGLE_CHOICE' ? 'full' : 'md'
                        } border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#0B3D2E] dark:bg-[#0D7A58] border-[#0B3D2E] dark:border-[#0D7A58] text-white'
                            : 'border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937]'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm font-medium">{opt.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                {poll.pollType === 'SINGLE_CHOICE'
                  ? 'Select 1 option'
                  : `Select up to ${poll.maxSelections} option(s)`}
              </span>
              <Button
                type="submit"
                variant="primary"
                isLoading={submittingVote}
                disabled={selectedOptions.length === 0 || submittingVote}
                className="cursor-pointer"
              >
                Submit Response
              </Button>
            </div>
          </form>
        ) : showResults ? (
          /* Results View */
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider">
              <span>Poll Results</span>
              <span>{poll.totalVotes} total responses</span>
            </div>

            <div className="space-y-3">
              {poll.options.map((opt) => {
                const pct = opt.percentage || 0;
                const wasVoted = poll.votedOptionIds?.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`p-4 rounded-xl border space-y-2 ${
                      wasVoted
                        ? 'bg-[#E5ECE8]/60 dark:bg-[#34D399]/15/40 border-[#0B3D2E]/30 dark:border-[#34D399]/35'
                        : 'bg-[#F9FAFB] dark:bg-[#182230] border-[#E5E7EB] dark:border-[#374151]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{opt.text}</span>
                        {wasVoted && (
                          <span className="text-[10px] font-semibold text-[#0B3D2E] dark:text-[#34D399] bg-[#E5ECE8] dark:bg-[#273548] px-1.5 py-0.2 rounded border border-[#0B3D2E]/20 dark:border-[#374151]">
                            Your Vote
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#111827] dark:text-[#F9FAFB]">
                        {opt.voteCount} votes ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-[#E5E7EB] dark:bg-[#273548] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          wasVoted ? 'bg-[#0B3D2E] dark:bg-[#34D399]' : 'bg-[#6B7280]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-center space-y-2">
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              Results for this poll will become visible after your vote is submitted or once the poll concludes.
            </p>
          </div>
        )}
      </Card>

      {/* Admin Status Controls */}
      {isAdmin && (
        <Card className="p-4 bg-[#F9FAFB] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-4">
          <div className="text-xs">
            <span className="font-bold text-[#111827] dark:text-[#F9FAFB] block">Administrator Poll Controls</span>
            <span className="text-[#6B7280] dark:text-[#D1D5DB]">Manage lifecycle status of this poll.</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={adminStatus}
              onChange={(e) => {
                setAdminStatus(e.target.value);
                handleAdminStatusChange(e.target.value);
              }}
              disabled={updatingStatus}
              className="bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#F9FAFB]"
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </Card>
      )}
    </Container>
  );
}
