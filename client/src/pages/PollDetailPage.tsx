import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Card } from '../components/ui/Card';
import { Container } from '../components/layout/Container';
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
      <Container size="sm" className="py-12 space-y-4">
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
    <Container size="sm" className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate('/engagement')}
        className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1"
      >
        &larr; Back to Civic Engagement Hub
      </button>

      <Card className="p-6 sm:p-8 space-y-6">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#DED8CB] dark:border-[#283931]">
          <div className="flex items-center gap-2">
            <Badge variant={poll.status === 'OPEN' ? 'success' : 'neutral'}>
              {poll.status}
            </Badge>
            {poll.category && (
              <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded">
                {poll.category.name}
              </span>
            )}
            <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded">
              {poll.pollType === 'SINGLE_CHOICE' ? 'Single Choice' : `Multi Choice (Max ${poll.maxSelections})`}
            </span>
          </div>

          <span className="text-xs text-[#C5D4C9] dark:text-[#54625A] flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            {isClosed ? 'Closed' : `Deadline: ${new Date(poll.endDate).toLocaleDateString()}`}
          </span>
        </div>

        {/* Title & Question */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#1B5E8A] dark:text-[#78B4DD] uppercase tracking-wider block">
            {poll.title}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#202522] dark:text-[#F5F2EA] tracking-tight">
            {poll.question}
          </h1>
          {poll.description && (
            <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed pt-1">
              {poll.description}
            </p>
          )}
        </div>

        {/* Advisory Statement */}
        <div className="p-3.5 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] flex items-start gap-2.5 text-xs text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
          <InfoIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
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
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
            <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
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
                        ? 'bg-[#E8F1EC] dark:bg-[#1D3E37] border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#F5F2EA] font-semibold shadow-xs'
                        : 'bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border-[#DED8CB] dark:border-[#283931] text-[#3E4B44] dark:text-[#C5D4C9] hover:border-[#173D32]/50 dark:hover:border-[#7BC4B2]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-${
                          poll.pollType === 'SINGLE_CHOICE' ? 'full' : 'md'
                        } border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C]'
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
              <span className="text-xs text-[#C5D4C9] dark:text-[#54625A]">
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
            <div className="flex items-center justify-between text-xs font-bold text-[#54625A] dark:text-[#C5D4C9] uppercase tracking-wider">
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
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 border-[#DED8CB] dark:border-[#283931]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">{opt.text}</span>
                        {wasVoted && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                            Your Vote
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#202522] dark:text-[#F5F2EA]">
                        {opt.voteCount} votes ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-[#ECE7DB] dark:bg-[#1D2A25] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          wasVoted ? 'bg-[#173D32] dark:bg-[#7BC4B2]' : 'bg-[#A8BFAE]'
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
          <div className="p-6 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] text-center space-y-2">
            <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
              Results for this poll will become visible after your vote is submitted or once the poll concludes.
            </p>
          </div>
        )}
      </Card>

      {/* Admin Status Controls */}
      {isAdmin && (
        <Card className="p-4 bg-purple-950/20 border-purple-900/40 flex items-center justify-between gap-4">
          <div className="text-xs">
            <span className="font-bold text-purple-300 block">Administrator Poll Controls</span>
            <span className="text-[#54625A] dark:text-[#C5D4C9]">Manage lifecycle status of this poll.</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={adminStatus}
              onChange={(e) => {
                setAdminStatus(e.target.value);
                handleAdminStatusChange(e.target.value);
              }}
              disabled={updatingStatus}
              className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-lg px-2.5 py-1 text-xs text-[#202522] dark:text-[#E8F0EC]"
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
