import { useState } from 'react';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import { Alert } from '../ui/Alert';
import type { ReportTargetType, AbuseReportReason } from '../../types/moderation';

export interface ReportAbuseModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  contentTitle?: string;
  onReportSubmitted?: (trackingId: string) => void;
}

const REASON_OPTIONS: Array<{ value: AbuseReportReason; label: string; description: string }> = [
  {
    value: 'SPAM',
    label: 'Automated Spam / Commercial Flooding',
    description: 'Machine-like repeated complaints, ads, or promotional content.',
  },
  {
    value: 'HARASSMENT',
    label: 'Harassment / Threats of Violence',
    description: 'Targeted hostility or intimidation directed at individuals.',
  },
  {
    value: 'PERSONAL_DATA_EXPOSURE',
    label: 'Personal Data Exposure (Doxxing)',
    description: 'Private phone numbers, personal addresses, or confidential details posted without consent.',
  },
  {
    value: 'IMPERSONATION',
    label: 'Impersonation of Official / Citizen',
    description: 'Falsely claiming authority or representing another real person.',
  },
  {
    value: 'MALICIOUS_OR_SUSPICIOUS',
    label: 'Malicious Links / Security Hazard',
    description: 'Suspicious hyperlinks, phishing attempts, or unsafe uploads.',
  },
  {
    value: 'MISINFORMATION',
    label: 'Misinformation / Deceptive Submissions',
    description: 'Demonstrably fabricated emergency or false official claims.',
  },
  {
    value: 'OTHER',
    label: 'Other Policy Violation',
    description: 'Violates platform guidelines not captured above.',
  },
];

export function ReportAbuseModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  contentTitle,
  onReportSubmitted,
}: ReportAbuseModalProps) {
  const [reason, setReason] = useState<AbuseReportReason>('SPAM');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/moderation/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          explanation: explanation.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to submit report.');
      }

      setSubmittedTrackingId(data.data.trackingId);
      if (onReportSubmitted) {
        onReportSubmitted(data.data.trackingId);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while registering your report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSubmittedTrackingId(null);
    setExplanation('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 id="report-modal-title" className="text-xl font-bold text-[#202522] dark:text-[#F5F2EA] mb-1">
          Report Content for Moderation Review
        </h2>
        <p className="text-sm text-[#54625A] dark:text-[#C5D4C9] mb-4">
          Reporting flag: <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">{targetType.replace(/_/g, ' ')}</span>
          {contentTitle && (
            <span className="block text-xs text-[#3E4B44] dark:text-[#C5D4C9] mt-1 italic truncate">
              &ldquo;{contentTitle}&rdquo;
            </span>
          )}
        </p>

        {submittedTrackingId ? (
          <div className="space-y-4">
            <Alert variant="success" title="Report Registered">
              Thank you for keeping Civora safe. Your report reference is{' '}
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{submittedTrackingId}</span>.
              Our human moderation team will inspect the item against platform rules.
            </Alert>
            <div className="flex justify-end pt-2">
              <Button onClick={handleClose} variant="primary">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="error" title="Submission Error">
                {error}
              </Alert>
            )}

            <div>
              <label htmlFor="abuse-reason" className="block text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] mb-1.5">
                Reason Category *
              </label>
              <Select
                id="abuse-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as AbuseReportReason)}
                options={REASON_OPTIONS.map((r) => ({
                  value: r.value,
                  label: `${r.label}`,
                }))}
              />
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">
                {REASON_OPTIONS.find((r) => r.value === reason)?.description}
              </p>
            </div>

            <div>
              <label htmlFor="abuse-explanation" className="block text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] mb-1.5">
                Additional Details (Optional)
              </label>
              <TextArea
                id="abuse-explanation"
                rows={3}
                placeholder="Explain why this content violates platform guidelines..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                maxLength={1000}
              />
              <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] float-right mt-1">
                {explanation.length}/1000
              </span>
            </div>

            <div className="p-3 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 rounded-xl border border-[#DED8CB] dark:border-[#283931] text-xs text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
              <span className="font-semibold text-[#3E4B44] dark:text-[#C5D4C9] block mb-1">
                Civic Integrity Safeguard:
              </span>
              Reports are reviewed by authorized human moderators with a documented audit record.
              Content is never silently deleted. Criticism of government authorities or public policy
              is lawful and will not be removed.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#DED8CB] dark:border-[#283931]">
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={submitting}>
                {submitting ? 'Submitting Report...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
