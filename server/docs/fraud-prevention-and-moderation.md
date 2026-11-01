# Module 14: Fraud Prevention, Spam Protection, Content Moderation & Abuse Reporting

## Civora — Civic Issue Reporting and Public Accountability Platform

### 1. Architectural Overview & Core Principles

Module 14 establishes a comprehensive abuse-prevention, content moderation, rate limiting, and fairness framework for Civora. Its mission is to protect the platform from automated spam, deceptive submissions, malicious uploads, duplicate manipulation, and abuse of civic engagement mechanisms, while rigorously defending citizens' rights to report civic issues and hold public authorities accountable.

#### Foundational Principle:
> **"Suspicious activity must be investigated using proportionate, explainable, and auditable controls. Civora never treats a citizen as fraudulent merely because their report is unusual, critical of an authority, submitted repeatedly, or difficult to verify. Platform moderation protects public discourse without suppressing civic dissent."**

---

### 2. Threat Model & Abuse Categories

Civora's defense-in-depth model categorizes and responds proportionately to six primary threat profiles:

| Threat Profile | Manifestation | Mitigation Strategy |
| :--- | :--- | :--- |
| **Automated Spam & Flooding** | Machine-generated complaints, bulk comment bots, proposal flooding, credential stuffing. | Layered rate limits (IP and account), request validation with Zod, and token-bucket sliding windows. |
| **Repeated / Duplicate Reports** | Citizens submitting the same complaint multiple times; coordinated campaigns inflating counts. | Real-time non-blocking candidate advisory, multi-factor Jaccard + spatial matching, staff linking without destructive deletion. |
| **Abusive or Prohibited Content** | Doxxing, harassment, threats of violence, malware links, commercial solicitation. | Citizen abuse reporting, automated triage scoring, mandatory-reason moderation queue, content hiding/removal. |
| **Malicious Uploads** | Spoofed file extensions, polyglot files, parser bombs, oversized binaries. | Integrated Module 12 validation (magic-byte inspection, SHA-256 hashing, private disk isolation, administrative quarantine). |
| **Civic Engagement Manipulation** | Sybil voting on public polls, coordinated down-reporting of public proposals. | Transactional database uniqueness constraints (`UNIQUE(pollId, userId)`), rate-limited voting, appeal mechanisms. |
| **Moderation Abuse & Retaliation** | Bad-faith mass reporting targeting whistleblowers or active community members. | Abuse report rate limiting, deduplication of concurrent reports, reporter PII masking, separation of duties in appeals. |

---

### 3. Non-Suppression Guarantee for Civic Criticism

Civora strictly distinguishes between abusive conduct and constitutionally protected civic participation:
- **Protected Civic Conduct**: Criticizing municipal departments, reporting government inefficiency, highlighting official inaction, calling out poor infrastructure, or disputing official explanations. Such reports **CANNOT** be classified as abuse, hidden, or penalized under any circumstance.
- **Prohibited Abuse**: Specific threats against individuals, publishing private residential addresses/phone numbers of officials or citizens without consent (doxxing), automated advertising, or malware distribution.

---

### 4. Layered Rate Limiting & Automation Defenses

Implemented in `server/src/lib/rateLimiters.ts` via Express middleware with standard `Retry-After` headers and `RATE_LIMIT_EXCEEDED` error envelopes.

| Endpoint / Operation | Window | Maximum Requests | Target Key | Enforcement Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Auth & Credentials** (`/api/auth/*`) | 15 min | 10 attempts | Client IP | Blocks brute-force and credential stuffing |
| **Complaint Creation** (`POST /api/complaints`) | 1 hour | 10 submissions | User ID / IP | Prevents automated complaint flooding |
| **Comments & Messaging** (`POST .../messages`) | 15 min | 30 comments | User ID / IP | Mitigates comment spam threads |
| **Proposal Creation** (`POST /api/engagement/proposals`) | 24 hours | 5 proposals | User ID / IP | Guards civic engagement hub from flood |
| **Poll Voting** (`POST /api/engagement/polls/:id/vote`)| 5 min | 15 votes | User ID / IP | Enforces voting rate alongside DB constraint |
| **Abuse Reporting** (`POST /api/moderation/reports`) | 1 hour | 15 reports | User ID / IP | Prevents automated harassment via reports |
| **Search & Discovery** (`GET /api/geo/*`, `/transparency`) | 1 min | 60 queries | Client IP | Protects spatial queries from DoS |

#### Distributed Deployment Considerations:
- The current implementation utilizes an in-memory token-bucket sliding-window store suitable for single-node development and testing.
- For multi-instance, auto-scaling production deployments, the rate limiter is designed to drop-in swap with a Redis-backed store (`ioredis` / `rate-limit-redis`) using the same keying interfaces.

---

### 5. Duplicate Complaint Detection (Advisory & Non-Destructive)

Implemented in `server/src/lib/duplicateDetector.ts`. Civora treats duplicate complaints constructively: multiple citizens reporting the same pothole or water leak is evidence of public impact, not malicious activity.

#### Detection Heuristics:
1. **Category Exact Match**: Candidate must match the incoming complaint category (e.g. `ROADS`, `WATER_SUPPLY`).
2. **Spatial Proximity**:
   - High confidence: Distance $\le 300\text{ meters}$ via Haversine calculation.
   - Medium confidence: Distance $\le 1,000\text{ meters}$.
3. **Locality / Ward Overlap**: Canonical ward or neighborhood match.
4. **Textual Similarity**:
   - Tokenization with stop-word stripping.
   - Jaccard set similarity over n-gram tokens:
     $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
   - Threshold: $J \ge 0.35$ for description overlap.

#### Privacy-Safe Citizen Advisory:
- The pre-submission endpoint (`POST /api/moderation/duplicates/check`) displays existing unresolved complaints to the citizen.
- Private complaints (`isLocationPublic = false` or confidential issues) are **never** included in candidate suggestions.
- The citizen is presented with an informative warning, but has an unrestricted right to proceed if their issue represents a distinct incident or adds new visual evidence.
- Municipal staff can formally link complaints (`POST /api/moderation/duplicates/link`) via `ComplaintDuplicateLink` records, preserving all original tracking IDs and individual audit trails.

---

### 6. Citizen Abuse Reporting Workflow

Citizens can report inappropriate content on any supported user-generated entity:
- Complaint comments and status update messages (`COMPLAINT_MESSAGE`)
- Community proposals (`COMMUNITY_PROPOSAL`)
- Proposal comments (`PROPOSAL_COMMENT`)
- Complaint evidence and documents (`DOCUMENT`)
- Public complaints (`COMPLAINT`)

#### Anti-Abuse Protections for Reporting:
- **Target Verification**: System verifies the target entity exists in the database before accepting the report.
- **Deduplication**: If a user submits duplicate reports against the same target, the system reuses the existing pending report instead of creating redundant database records.
- **Automatic Case Aggregation**: Multiple reports against the same target are consolidated under a single `ModerationCase` to streamline moderator review.
- **Reporter Privacy**: Reporter identity (`reporterId`, name, email) is strictly redacted and never returned to the reported user or visible in public queries.

---

### 7. Staff Moderation Queue & Triage Scoring

Available to authorized staff (`ADMIN` and `DEPARTMENT_OFFICIAL`) at `/admin/moderation` (`GET /api/moderation/queue`).

#### Explainable Triage Scoring (`RiskScoringEngine`):
Moderation cases are ranked by an explainable priority score ($0 - 100$) derived strictly from platform signals:
- Base score: $10$
- Severe abuse category (Harassment, Doxxing, Malicious): $+40$
- High report volume ($>3$ independent reporters): $+25$
- Target has previously been moderated: $+20$
- Author has an active warning or restriction: $+25$
- Target author is an official department representative: $-20$ (protects civic dialogue)

> **Important**: Risk scoring is solely an internal queuing and triage aid for human moderators. It **NEVER** triggers automated content deletion or penalties.

---

### 8. Reason-Based Moderation Actions & Safeguards

Moderators can execute six discrete actions (`POST /api/moderation/cases/:id/action`), all of which require a mandatory documented reason ($\ge 5$ characters):

1. **`NO_ACTION_REQUIRED`**: Case closed with no platform policy violation.
2. **`WARNING_ISSUED`**: Formal warning recorded and citizen notified via in-app alert.
3. **`CONTENT_HIDDEN`**: Target content temporarily hidden from public views while retaining underlying database records and audit history.
4. **`CONTENT_REMOVED`**: Content permanently hidden from public endpoints. The original database record is never deleted.
5. **`CONTENT_RESTORED`**: Content unhidden and returned to active public visibility.
6. **`ACCOUNT_RESTRICTED`**: Temporary restriction applied to citizen account.

---

### 9. Account Restrictions & Expiring Permissions

Implemented in `server/src/lib/restrictionService.ts` and guarded via `server/src/middleware/restriction.middleware.ts`:

- **Granular Restriction Types**:
  - `SUBMISSION_RESTRICTED`: Prevents lodging new complaints or proposals.
  - `COMMENTING_RESTRICTED`: Blocks comments and communication messages.
  - `UPLOAD_RESTRICTED`: Prohibits attaching new evidence files.
  - `TEMPORARY_SUSPENSION`: Restricts interactive participation while preserving read-only complaint tracking access.
- **Time-Bounded & Auto-Expiring**: Every temporary restriction specifies an expiration timestamp (`expiresAt`). Active queries automatically evaluate whether the restriction has expired and update status without manual intervention.
- **Reversibility**: Authorized staff can lift active restrictions with a documented reason (`POST /api/moderation/restrictions/:id/lift`).

---

### 10. Appeals Workflow & Separation of Duties

Citizens have an unalienable right to appeal any moderation decision that affects their content or account status.

#### Key Architectural Guarantees:
1. **Ownership Enforcement**: Only the author of the moderated content or the restricted user can lodge an appeal.
2. **One Active Appeal**: Prevents infinite concurrent appeal spamming.
3. **Separation of Duties (Reviewer $\ne$ Originator)**:
   > The staff member adjudicating an appeal **MUST NOT** be the same moderator who imposed the original penalty.
   > Attempting self-review returns HTTP 403 `SEPARATION_OF_DUTIES_VIOLATION`.
4. **Automatic Content Restoration**: If an appeal is marked `UPHELD`, the platform automatically restores the associated content and notifies the citizen.

---

### 11. Platform Integration Touchpoints

- **Module 9 (Notifications)**: Emits real-time notifications for warnings (`MODERATION_WARNING`), content actions (`CONTENT_MODERATED`), account restrictions (`ACCOUNT_RESTRICTED`), restriction lifts (`RESTRICTION_LIFTED`), and appeal determinations (`APPEAL_DECISION`).
- **Module 10 (Civic Engagement & Polls)**: Preserves proposal comment integrity and enforces 1-vote-per-citizen poll constraints at the transaction and rate-limit layers.
- **Module 12 (Secure Uploads & Quarantine)**: Reuses `StorageService` magic-byte scanning, SHA-256 verification, and evidence quarantine. Moderation reports against documents trigger immediate staff inspection.
- **Module 13 (Civic Search & Maps)**: Ensures moderated complaints (`isModerated = true`) are filtered from public search indices and map marker viewports.

---

### 12. Database Schema Impact & Prisma Migrations

Migration: `server/prisma/migrations/20261018223000_add_moderation_and_fraud_prevention/migration.sql`

- **Enums Added**:
  - `AbuseReportReason`, `AbuseReportStatus`, `ReportTargetType`
  - `ModerationCaseStatus`, `ModerationPriority`, `ModerationActionType`
  - `AppealStatus`, `UserRestrictionType`
- **Models Created**:
  - `AbuseReport`: Stores incoming citizen reports with reason, explanation, and target reference.
  - `ModerationCase`: Aggregated staff triage entity tracking priority, risk score, and review status.
  - `ModerationAction`: Audit log of moderator decisions with mandatory justification.
  - `ModerationAppeal`: Formal citizen contestation records with decision notes.
  - `UserRestriction`: Scoped, time-bounded account restrictions.
  - `ComplaintDuplicateLink`: Official relationships between co-incident complaints.
- **Fields Added**:
  - `Complaint.isModerated`, `Complaint.moderationReason`
  - `ComplaintMessage.isModerated`, `ComplaintMessage.moderationReason`
  - `CommunityProposal.isModerated`, `CommunityProposal.moderationReason`

---

### 13. Automated Test Suite Verification

Comprehensive test suite in `server/test/moderation.test.ts` (22 dedicated tests) executing against the live database:

1. **Rate Limiting Tests**: Normal requests pass; threshold breach triggers HTTP 429 with retry indicator.
2. **Duplicate Detection Tests**: Submissions with identical categories, nearby coordinates, and matching descriptions generate advisory candidates.
3. **Abuse Reporting Tests**: Valid report creation, nonexistent target rejection (HTTP 404), and report deduplication.
4. **Staff Queue & Security**: Unauthorized citizen access rejected (HTTP 403); staff access permitted with pagination.
5. **Reason-Based Actions**: Enforces $\ge 5$ character justification; target content flagged as moderated.
6. **Appeals & Separation of Duties**: Content owner lodges appeal; original moderator blocked from self-review; alternate administrator upholds appeal and restores content.
7. **User Restrictions**: Scoped action blocking (e.g. `requireNoRestriction`), reason logging, and explicit lift handling.

**Overall System Verification**:
- **Total Tests**: 206 tests passing across 54 suites (0 failures).
- **TypeScript & Vite Builds**: Server build (`tsc`) and Client build (`vite build`) complete with zero errors.
