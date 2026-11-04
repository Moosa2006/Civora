import { useEffect, useState } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { PlatformRulesData } from '../types/moderation';

export function PlatformRulesPage() {
  const [rulesData, setRulesData] = useState<PlatformRulesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/moderation/rules')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRulesData(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container size="xl" className="space-y-10">
      <PageHeading
        title="Platform Content Standards & Moderation Policy"
        description="Civora protects transparent public problem reporting while preventing spam, deceptive manipulation, and harassment. Civic criticism of authorities is lawful, protected, and never suppressed."
        className="mb-0"
        eyebrow={
          <div className="flex items-center gap-2">
            <Badge variant="info">Civic Governance & Trust</Badge>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {loading
                ? 'Loading policy...'
                : `Policy v${rulesData?.version || '1.0'} • Updated ${rulesData?.lastUpdated || '2026-10-18'}`}
            </span>
          </div>
        }
      />

      {/* Core Principles */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0B3D2E] dark:bg-[#34D399] inline-block" />
          Core Principles of Civic Fairness
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
              1. Protection of Public & Political Criticism
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Criticism of government departments, municipal performance, controversial public works, or official actions is a legitimate foundation of public accountability. Moderators are strictly forbidden from hiding or penalizing reports merely because they are critical or uncomfortable for an authority.
            </p>
          </Card>
          <Card className="p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
              2. Explainable, Non-Destructive Duplicate Handling
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              When multiple citizens report the same pothole or broken streetlight, this provides vital evidence of public impact. Civora links related complaints as shared incidents while preserving each citizen&rsquo;s tracking ID, submission evidence, and audit history.
            </p>
          </Card>
          <Card className="p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
              3. Mandatory Reasons & Full Auditability
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              No content can be hidden or user restricted without a documented, mandatory reason of at least 5 characters. Every decision is permanently logged in immutable audit records with moderator attribution.
            </p>
          </Card>
          <Card className="p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
              4. Separation of Duties in Appeals
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Any citizen affected by a moderation action has the right to appeal. By system enforcement, appeals cannot be reviewed by the same moderator who enacted the original penalty; a different supervisor or administrator must evaluate the case.
            </p>
          </Card>
        </div>
      </section>

      {/* Prohibited Content Categories */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          Prohibited Content & Abuse Definitions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 space-y-2">
            <Badge variant="danger">SPAM</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Automated Spam & Flooding</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Submitting automated reports at machine-like frequency, spamming public comment threads, commercial advertising, or repeated copy-paste proposals.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Badge variant="danger">HARASSMENT</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Targeted Harassment</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Threats of physical harm, hate speech, or targeted intimidation directed against any citizen or public servant.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Badge variant="warning">DOXXING</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Personal Data Exposure</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Posting unconsented private phone numbers, home addresses, personal bank details, or private identification documents.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Badge variant="warning">IMPERSONATION</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Impersonation</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Falsely claiming to be a municipal engineer, government official, contractor, or another citizen to deceive the public.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Badge variant="danger">MALICIOUS</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Malicious Links & Uploads</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Uploading executable payloads, spoofed file headers, phishing URLs, or files designed to exploit media parsers.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Badge variant="info">DECEPTION</Badge>
            <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Fabricated Emergencies</h4>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
              Knowingly manufacturing false disaster reports or coordinated false report attacks to divert critical public emergency resources.
            </p>
          </Card>
        </div>
      </section>

      {/* Upload Security & Rate Limiting Integration */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          Technical Safeguards & Rate Limiting
        </h2>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-[#374151] dark:text-[#D1D5DB]">
            <div className="space-y-1.5">
              <span className="font-semibold text-[#111827] dark:text-[#F9FAFB] block">Rate Limiting</span>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Authentication, complaint creation, proposal submission, commenting, and abuse reporting are protected by layered, configurable rate limiters to prevent resource exhaustion and credential stuffing.
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="font-semibold text-[#111827] dark:text-[#F9FAFB] block">File Upload Security (Module 12)</span>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Strict MIME-type validation, SHA-256 checksums, randomized safe storage keys, quarantine isolation, and file-size caps prevent malicious payload execution.
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="font-semibold text-[#111827] dark:text-[#F9FAFB] block">Poll & Proposal Integrity (Module 10)</span>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Database transactional uniqueness constraints enforce one participation per eligible citizen account, stopping ballot box stuffing and voting manipulation.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Appeals Process */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0B6640] dark:bg-[#6EE7B7] inline-block" />
          How Appeals Work
        </h2>
        <Card className="p-6 space-y-3">
          <p className="text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
            If your content was restricted or your account received a warning, you will receive an in-app notification stating the exact reason and policy violation. You may file an appeal directly from the platform. A supervisory official who was not involved in the original decision will evaluate the appeal and may uphold the appeal to immediately restore your content.
          </p>
        </Card>
      </section>
    </Container>
  );
}
