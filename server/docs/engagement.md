# Civora &mdash; Module 10: Civic Engagement, Community Proposals, Public Polls & Community Feedback

## 1. Overview

Module 10 evolves Civora from a civic grievance tracking platform into an interactive, participatory civic engagement system. It allows citizens to propose community amenities, endorse and discuss neighbors' suggestions, participate in authenticated public advisory polls, and receive authoritative public responses from municipal authorities.

### Core Capabilities
1. **Community Proposals & Suggestions (`/engagement/proposals/new`, `/api/engagement/proposals`)**:
   - Structured submission form for civic improvements, neighborhood initiatives, and amenities.
   - Distinct from grievance complaints: proposals suggest forward-looking improvements rather than reporting broken infrastructure.
   - Crockford Base32 tracking identifiers (`PROP-YYYY-XXXXX`).
   - Server-side validation of title, description, category, locality, and problem/solution statements.
2. **Proposal Moderation & Lifecycle Management (`/api/engagement/admin/proposals`)**:
   - Strict review lifecycle: `SUBMITTED` &rarr; `UNDER_REVIEW` &rarr; `NEEDS_CLARIFICATION` &rarr; `PUBLISHED` &rarr; `ACCEPTED_FOR_CONSIDERATION` / `DECLINED` / `ARCHIVED`.
   - Unpublished proposals remain private to the submitter and authorized reviewers (`ADMIN`, `GOVERNMENT_OFFICIAL`).
   - Internal staff memos (`internalModerationNotes`) are strictly segregated from public moderator explanations (`publicExplanation`).
   - Authoritative official responses (`officialResponse`) can be recorded by municipal officers to announce feasibility assessments without falsely implying project sanction.
3. **Public Polls & Controlled Voting (`/engagement/polls/:id`, `/api/engagement/polls`)**:
   - Creation of structured single-choice or multi-choice community polls by municipal administrators.
   - Time-bounded voting windows enforced server-side (`startDate` and `endDate`).
   - Results visibility policies: `ALWAYS_VISIBLE`, `AFTER_VOTE`, or `AFTER_CLOSE`.
   - Concurrency-safe voting integrity: backed by a hard database-level unique constraint on `(pollId, userId)` in `PollParticipation`, strictly preventing duplicate votes.
   - Transparent advisory notices clarifying that public polls reflect respondent preferences and are advisory rather than binding statutory approvals.
4. **Community Endorsement & Discussion (`/api/engagement/proposals/:id/support`, `/comments`)**:
   - Citizens can toggle endorsement support (1 vote per citizen per proposal).
   - Moderated public discussion thread for constructive citizen dialogue.
5. **Module 9 Notification Integration**:
   - Automated alerts dispatched to proposal owners upon submission, review status updates, and official responses.
   - Alerts dispatched to citizens upon successful poll vote registration.
6. **Engagement Analytics & Transparency (`/api/engagement/analytics/overview`)**:
   - Aggregate statistics on submitted/published proposals, total community endorsements, open/closed polls, and total votes.

---

## 2. Civic Domain Separation

Civora maintains a strict boundary between distinct concepts:

| Concept | Purpose | Nature | Lifecycle / Outcome |
|---|---|---|---|
| **Civic Complaint** (Mod 6–7) | Reports active, broken municipal infrastructure (e.g. potholes, water leak, garbage accumulation). | Operational grievance | Triaged, assigned to department, inspected, resolved with evidence, verified by citizen. |
| **Community Proposal** (Mod 10) | Suggests future improvements or community initiatives (e.g. zebra crossing, park lighting, waste bins). | Constructive suggestion | Moderated, published for community endorsement, evaluated by authorities for feasibility. Never automatically creates a complaint or budget allocation. |
| **Public Poll / Survey** (Mod 10) | Solicits public preferences on defined community options or civic priorities. | Advisory consultation | Fixed time window, 1 response per account, advisory to municipal planning. Never automatically triggers contract tenders or policy changes. |
| **Civic Project** (Mod 8) | Formally approved, funded capital infrastructure projects registered in municipal planning. | Statutory capital work | Official milestones, contractor records, budget expenditure monitoring. |

---

## 3. Proposal Lifecycle State Machine

```
              ┌───────────────┐
              │   SUBMITTED   │ (Private to submitter & staff)
              └───────┬───────┘
                      │ Staff review
                      ▼
              ┌───────────────┐
       ┌───── │  UNDER_REVIEW │ ─────┐
       │      └───────┬───────┘      │
       │              │              │
       ▼              ▼              ▼
┌──────────────┐ ┌─────────┐ ┌───────────────┐
│    NEEDS_    │ │PUBLISHED│ │   DECLINED    │
│CLARIFICATION │ └────┬────┘ └───────────────┘
└──────────────┘      │
                      ▼
         ┌─────────────────────────┐
         │ACCEPTED_FOR_CONSIDERATION│
         └────────────┬────────────┘
                      ▼
               ┌──────────────┐
               │   ARCHIVED   │
               └──────────────┘
```

- **`SUBMITTED`**: Initial state upon citizen submission. Private to author and staff.
- **`UNDER_REVIEW`**: Assigned reviewer is evaluating content and jurisdiction.
- **`NEEDS_CLARIFICATION`**: Reviewer requests additional details from citizen.
- **`PUBLISHED`**: Approved for public listing, community endorsement, and comments.
- **`ACCEPTED_FOR_CONSIDERATION`**: Municipal department accepts the concept for engineering or budgetary feasibility assessment.
- **`DECLINED`**: Deemed out-of-scope, infeasible, or duplicate.
- **`ARCHIVED`**: Concluded engagement activity.

---

## 4. Database Models & Schema Extensions

The module extends the PostgreSQL schema via migration `20261018013703_add_civic_engagement_and_polls`:

### 4.1 Enums
- **`ProposalStatus`**: `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_CLARIFICATION`, `PUBLISHED`, `ACCEPTED_FOR_CONSIDERATION`, `DECLINED`, `ARCHIVED`
- **`PollStatus`**: `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `ARCHIVED`
- **`PollType`**: `SINGLE_CHOICE`, `MULTI_CHOICE`
- **`PollVisibilityRule`**: `ALWAYS_VISIBLE`, `AFTER_VOTE`, `AFTER_CLOSE`
- **`NotificationType`**: Added `PROPOSAL_SUBMITTED`, `PROPOSAL_STATUS_CHANGED`, `PROPOSAL_RESPONSE`, `POLL_CREATED`

### 4.2 Tables
1. **`community_proposals`**:
   - `id`: UUID Primary Key
   - `trackingId`: Unique Crockford Base32 (`PROP-YYYY-XXXXX`)
   - `title`, `description`, `locality`, `problemStatement`, `suggestedSolution`
   - `categoryId` &rarr; foreign key to `complaint_categories`
   - `submitterId` &rarr; foreign key to `users`
   - `status`: `ProposalStatus` (default `SUBMITTED`)
   - `internalModerationNotes`: Text (confidential to staff)
   - `publicExplanation`: Text (moderator public note)
   - `officialResponse`: Text (formal department note)
   - `officialResponseById` &rarr; foreign key to `users`
   - `officialResponseAt`: Timestamp
   - Indexes: `status`, `categoryId`, `submitterId`, `createdAt`
2. **`proposal_supports`**:
   - `id`: UUID Primary Key
   - `proposalId` &rarr; foreign key to `community_proposals`
   - `userId` &rarr; foreign key to `users`
   - **Unique constraint**: `[proposalId, userId]` (enforces 1 endorsement per citizen)
3. **`proposal_comments`**:
   - `id`: UUID Primary Key
   - `proposalId`, `authorId`, `content`, `createdAt`, `updatedAt`
4. **`public_polls`**:
   - `id`: UUID Primary Key
   - `title`, `question`, `description`, `categoryId`
   - `pollType`: `SINGLE_CHOICE` | `MULTI_CHOICE`
   - `maxSelections`: Int (default 1)
   - `status`: `PollStatus` (default `OPEN`)
   - `resultsVisibility`: `PollVisibilityRule`
   - `startDate`, `endDate`: Timestamps
   - `createdById` &rarr; foreign key to `users`
5. **`poll_options`**:
   - `id`: UUID Primary Key
   - `pollId` &rarr; foreign key to `public_polls`
   - `text`: String
   - `orderIndex`: Int
6. **`poll_votes`**:
   - `id`: UUID Primary Key
   - `pollId`, `optionId`, `userId`, `createdAt`
   - Unique constraint: `[pollId, optionId, userId]`
7. **`poll_participations`**:
   - `id`: UUID Primary Key
   - `pollId`, `userId`, `createdAt`
   - **Unique constraint**: `[pollId, userId]` (guarantees atomic single participation per poll)

---

## 5. REST API Reference

### 5.1 Proposals

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/engagement/proposals` | Authenticated Citizen | Submit new community proposal |
| `GET` | `/api/engagement/proposals` | Public | List published proposals with filters & pagination |
| `GET` | `/api/engagement/proposals/my` | Authenticated Citizen | List user's own submissions (all states) |
| `GET` | `/api/engagement/proposals/:id` | Public / Author / Staff | Get proposal details (privacy-controlled) |
| `POST` | `/api/engagement/proposals/:id/support` | Authenticated Citizen | Toggle endorsement support |
| `GET` | `/api/engagement/proposals/:id/comments` | Public | List comments for published proposal |
| `POST` | `/api/engagement/proposals/:id/comments` | Authenticated Citizen | Add comment to published proposal |

### 5.2 Staff Moderation & Authority Tools

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/engagement/admin/proposals` | Admin / Official | Review queue (all statuses, internal notes) |
| `PATCH` | `/api/engagement/admin/proposals/:id/status` | Admin / Official | Update status, internal notes, public explanation |
| `POST` | `/api/engagement/admin/proposals/:id/response` | Admin / Official | Record authoritative official response |

### 5.3 Public Polls & Voting

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/engagement/polls` | Public | List open & closed published polls |
| `GET` | `/api/engagement/polls/:id` | Public | Get poll detail, options, user participation, and results |
| `POST` | `/api/engagement/polls/:id/vote` | Authenticated Citizen | Submit option selections |
| `POST` | `/api/engagement/admin/polls` | Admin / Official | Create new public civic poll |
| `PATCH` | `/api/engagement/admin/polls/:id/status` | Admin / Official | Update poll lifecycle status |

### 5.4 Civic Engagement Analytics

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/engagement/analytics/overview` | Public | Aggregate participation, proposal counts, and poll response metrics |

---

## 6. Voting Integrity, Security & Privacy

1. **Concurrency-Safe Duplicate Prevention**:
   - Double-barrier protection: the backend controller checks `pollParticipation.findUnique` first, and creates the record within an ACID transaction against a database-level `UNIQUE(pollId, userId)` constraint.
   - If concurrent requests race, the database rejects the second write with a unique constraint violation, mapped to HTTP `409 Conflict`.
2. **Server-Side Voting Window Enforcement**:
   - Votes submitted before `startDate` or after `endDate` are rejected with HTTP `400 Bad Request`.
   - Votes on non-`OPEN` polls are rejected.
3. **Choice Limits & Option Validation**:
   - `SINGLE_CHOICE` enforces `optionIds.length === 1`.
   - `MULTI_CHOICE` enforces `1 <= optionIds.length <= maxSelections`.
   - Every submitted `optionId` is verified to belong to the target poll.
4. **Result Visibility Enforcement**:
   - `AFTER_VOTE` suppresses aggregate percentages and vote counts from unauthenticated users or users who have not yet voted while the poll is active.
   - `AFTER_CLOSE` strictly hides results until the poll status becomes `CLOSED`.
   - Individual user ballot options are never exposed in public listing endpoints.
5. **Staff Note Segregation**:
   - `internalModerationNotes` are stripped from all public endpoints.
   - Unauthenticated or non-owner citizens attempting to fetch unpublished proposals receive HTTP `404 Not Found`.

---

## 7. Developer Instructions

### Start Services Locally
```bash
# Frontend
npm --prefix client run dev

# Backend
npm --prefix server run dev
```

### Build & Typecheck
```bash
# Frontend build
npm --prefix client run build

# Backend build
npm --prefix server run build

# Full build
npm run build
```

### Run Tests
```bash
# Run Module 10 tests
npm --prefix server test test/engagement.test.ts

# Run entire backend test suite (118 tests across 35 suites)
npm --prefix server test
```
