import { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useAuth } from '../context/useAuth';
import { Container } from '../components/layout/Container';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';
import { LightbulbIcon, CheckCircleIcon, InfoIcon } from '../components/ui/icons';
import type { ProposalCategory } from '../types/engagement';

export function ProposalSubmitPage() {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  const [categories, setCategories] = useState<ProposalCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locality, setLocality] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [suggestedSolution, setSuggestedSolution] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success Modal State
  const [submittedProposal, setSubmittedProposal] = useState<{
    id: string;
    trackingId: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/meta/categories');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data);
          if (json.data.length > 0) {
            setCategoryId(json.data[0].id);
          }
        }
      } catch {
        // Handled silently
      } finally {
        setCategoriesLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isAuthenticated) {
      setFormError('You must be signed in to submit a community proposal.');
      return;
    }

    if (title.trim().length < 5) {
      setFormError('Proposal title must be at least 5 characters long.');
      return;
    }

    if (!categoryId) {
      setFormError('Please select a civic category.');
      return;
    }

    if (description.trim().length < 20) {
      setFormError('Please provide a detailed proposal description (at least 20 characters).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/engagement/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          categoryId,
          locality: locality.trim() || undefined,
          problemStatement: problemStatement.trim() || undefined,
          suggestedSolution: suggestedSolution.trim() || undefined,
          description: description.trim(),
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSubmittedProposal({
          id: json.data.proposal.id,
          trackingId: json.data.trackingId,
          title: json.data.proposal.title,
        });
      } else {
        setFormError(json.error?.message || 'Failed to submit proposal. Please verify the form.');
      }
    } catch {
      setFormError('Network error while submitting proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="md" className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate('/engagement')}
          className="text-xs font-semibold text-[#1B5E8A] dark:text-[#78B4DD] hover:underline transition-colors cursor-pointer flex items-center gap-1 mb-2"
        >
          &larr; Back to Civic Engagement Hub
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#202522] dark:text-[#F5F2EA] tracking-tight flex items-center gap-2">
          <LightbulbIcon className="w-7 h-7 text-[#1B5E8A] dark:text-[#78B4DD]" /> Submit a Community Proposal
        </h1>
        <p className="text-[#54625A] dark:text-[#C5D4C9] text-sm leading-relaxed">
          Propose an initiative or civic improvement for your neighborhood. All proposals are reviewed by municipal moderators before publication for public endorsement and community discussion.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            {formError && (
              <div className="mb-6">
                <Alert variant="error" title="Submission Issue">
                  {formError}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField
                id="proposal-title"
                label="Proposal Title"
                required
                helperText="A clear, concise summary of your suggestion (e.g., 'Install Pedestrian Zebra Crossing on 5th Main')."
              >
                <TextInput
                  id="proposal-title"
                  type="text"
                  placeholder="Enter proposal title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  required
                />
              </FormField>

              <FormField
                id="proposal-category"
                label="Civic Category"
                required
                helperText="Select the most relevant municipal department category."
              >
                <Select
                  id="proposal-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  disabled={categoriesLoading}
                  required
                />
              </FormField>

              <FormField
                id="proposal-locality"
                label="Locality / Neighborhood"
                helperText="Area, neighborhood, street, or public landmark."
              >
                <TextInput
                  id="proposal-locality"
                  type="text"
                  placeholder="e.g. Sector 4, Community Garden, Ring Road Crossing"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  maxLength={255}
                />
              </FormField>

              <FormField
                id="proposal-problem"
                label="Existing Problem / Context"
                helperText="What challenge or underutilized opportunity does this proposal address?"
              >
                <TextArea
                  id="proposal-problem"
                  placeholder="Describe the current situation..."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </FormField>

              <FormField
                id="proposal-solution"
                label="Suggested Solution / Action"
                helperText="What specific improvement or intervention do you suggest?"
              >
                <TextArea
                  id="proposal-solution"
                  placeholder="Describe your proposed solution..."
                  value={suggestedSolution}
                  onChange={(e) => setSuggestedSolution(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </FormField>

              <FormField
                id="proposal-description"
                label="Detailed Description"
                required
                helperText="Comprehensive explanation of the community benefit and practical considerations."
              >
                <TextArea
                  id="proposal-description"
                  placeholder="Provide full details, expected community benefits, and suggestions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  required
                />
              </FormField>

              <div className="pt-4 border-t border-[#DED8CB] dark:border-[#283931] flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/engagement')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  disabled={submitting}
                >
                  Submit for Moderation Review
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Sidebar Guidelines (1 col) */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#202522] dark:text-[#F5F2EA] flex items-center gap-2">
              <InfoIcon className="w-4 h-4 text-[#1B5E8A] dark:text-[#78B4DD]" /> Proposal Guidelines
            </h3>
            <ul className="text-xs text-[#54625A] dark:text-[#C5D4C9] space-y-2 list-disc list-inside leading-relaxed">
              <li>
                <strong>Constructive & Public:</strong> Focus on shared community amenities, green spaces, waste reduction, or safety improvements.
              </li>
              <li>
                <strong>Not a Complaint:</strong> For specific broken infrastructure (e.g. an active pothole or water leak), use the standard <em>Report Issue</em> workflow instead.
              </li>
              <li>
                <strong>Moderation Review:</strong> All submissions undergo review to prevent duplicate or out-of-scope entries before publication.
              </li>
              <li>
                <strong>Public Endorsements:</strong> Once published, fellow citizens can endorse and discuss your proposal.
              </li>
              <li>
                <strong>Official Response:</strong> Authorities provide structured public responses indicating feasibility status.
              </li>
            </ul>
          </Card>

          <Card className="p-4 bg-blue-950/20 border-blue-900/30 text-xs text-blue-300">
            Proposals are community suggestions and do not constitute formal budget sanctions or procurement commitments.
          </Card>
        </div>
      </div>

      {/* Success Modal */}
      {submittedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#202522] dark:text-[#F5F2EA]">Proposal Lodged Successfully</h3>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                Your proposal has been queued for moderation review.
              </p>
            </div>

            <div className="p-3 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 rounded-lg border border-[#DED8CB] dark:border-[#283931] space-y-1">
              <span className="text-[11px] font-semibold text-[#54625A] dark:text-[#C5D4C9] block uppercase tracking-wider">
                Tracking Identifier
              </span>
              <span className="font-mono text-base font-bold text-[#1B5E8A] dark:text-[#78B4DD] block">
                {submittedProposal.trackingId}
              </span>
            </div>

            <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
              You will receive an in-app notification when the moderation team completes its review.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/engagement')}
              >
                Return to Hub
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/engagement/proposals/${submittedProposal.id}`)}
              >
                View Proposal
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Container>
  );
}
