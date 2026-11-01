# Civora &mdash; Module 17: Contractor Portal, Public Tendering, Bidding & Work-Order Execution

This document details the functional specifications, database additions, API endpoints, role-based security controls, and operational workflows implemented for **Module 17**.

---

## 1. Executive Summary

Module 17 completes the government-contractor public works lifecycle in Civora. It seamlessly connects public civic works projects with competitive municipal tendering, contractor qualification checks, transparent bidding, atomic contract awarding, formal mobilization declarations, daily physical progress logs, milestone verification, financial disbursement records, and post-completion defect/warranty management.

---

## 2. Role-Based Access & Identity

### 2.1 The `CONTRACTOR` Role
- Added `CONTRACTOR` to `UserRole` enum in PostgreSQL & Prisma schema.
- Extended the `User` model with optional 1-to-1 relation to the `Contractor` model (`User.contractorId`).
- Updated authentication token hydration (`authenticateUser`, `optionalAuthenticateUser`) so that all authenticated contractor requests automatically expose `req.user.contractorId` and their verified business profile.
- Provided a single-click demo credential button on the login screen (`contractor1@example.test` / `CivoraDev123!`) linked to the synthetic company **Apex Urban Infrastructure Ltd** (License: `CLASS_A`).

### 2.2 Security Separation Matrix

| Capability / Endpoint | Public | Citizen | Contractor | Official | Admin |
|:---|:---:|:---:|:---:|:---:|:---:|
| Browse Published Tenders |  |  |  |  |  |
| View Tender Specs & Criteria |  |  |  |  |  |
| Check Automated Eligibility |  |  |  |  |  |
| Submit / Withdraw Tender Bids |  |  |  (Assigned/Self only) |  |  |
| Create / Publish Tenders |  |  |  |  (Dept scoped) |  |
| Inspect All Competitor Bids |  |  |  |  |  |
| Evaluate Bids & Award Tender |  |  |  |  |  |
| Submit Work-Start Declaration |  |  |  (Awardee only) |  |  |
| Engineering Verify Work-Start |  |  |  |  |  |
| Log Daily Physical Progress |  |  |  (Awardee only) |  |  |
| Submit Milestone Completion Claim |  |  |  (Awardee only) |  |  |
| Review & Certify Milestone |  |  |  |  |  |
| View Audited Payment Ledger |  |  |  (Read-only, Own work orders) |  |  |
| Record Payment Disbursement |  |  |  |  |  |
| Report Site Defect / Warranty |  |  |  |  |  |
| Submit Rectification Action |  |  |  (Awardee only) |  |  |
| Verify Rectification & Close |  |  |  |  |  |

---

## 3. Database Schema Architecture

Module 17 leverages existing domain models (`Contractor`, `WorkOrder`, `CivicWork`, `ExecutionProgressUpdate`, `FinancialTransaction`) while adding 4 specialized tables and 5 lifecycle enums via migration `20261019234500_add_contractor_tendering_and_work_execution`.

### 3.1 New Tables

1. **`Tender` (`tenders`)**
   - Tracks public procurement notices, reference numbers (`TND-YYYY-XXXX`), estimated budgets, submission deadlines, technical qualification criteria, and minimum contractor license classes (`CLASS_A`, `CLASS_B`, `CLASS_C`).
   - Statuses: `DRAFT`, `PUBLISHED`, `UNDER_EVALUATION`, `AWARDED`, `CLOSED`, `CANCELLED`.

2. **`TenderBid` (`tender_bids`)**
   - Stores competitive proposals, bid amounts, proposed durations, technical methodology texts, and official evaluation remarks.
   - Guarded by a unique compound constraint `@@unique([tenderId, contractorId])` to mathematically prevent duplicate bid spamming.
   - Statuses: `SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`.

3. **`WorkStartDeclaration` (`work_start_declarations`)**
   - Enforces formal site mobilization notice before commencement of physical works. Captures GPS coordinates, physical mobilization notes, and engineering verification records.
   - Statuses: `SUBMITTED`, `VERIFIED`, `REJECTED`.

4. **`ContractMilestone` (`contract_milestones`)**
   - Breakdowns work orders into staged deliverables with physical percentage targets and financial allocation percentages.
   - Tracks contractor submission notes, engineer site verification remarks, and rejection audit trails.
   - Statuses: `PENDING`, `SUBMITTED_FOR_REVIEW`, `APPROVED`, `REJECTED_REVISION_REQUIRED`, `COMPLETED`.

5. **`DefectWarrantyRequest` (`defect_warranty_requests`)**
   - Enforces post-construction defect liability periods (DLP) and maintenance obligations.
   - Tracks micro-fissures, structural faults, contractor rectification evidence, and official sign-off closure.
   - Statuses: `REPORTED`, `INSPECTED`, `RECTIFICATION_IN_PROGRESS`, `RECTIFIED_VERIFIED`, `CLOSED`, `DISPUTED`.

---

## 4. API Specification

### 4.1 Public & Tender Discovery Routes (`/api/tenders`)
- `GET /api/tenders` &mdash; Filterable public tender catalog (status, category, search, department).
- `GET /api/tenders/:id` &mdash; Detailed scope, criteria, and dynamic server-side eligibility check for authenticated contractors.
- `POST /api/tenders` &mdash; Official/Admin creation of draft tenders.
- `PATCH /api/tenders/:id/publish` &mdash; Official/Admin publishing tender to public.
- `POST /api/tenders/:id/bids` &mdash; Contractor submits competitive bid.
- `GET /api/tenders/:id/bids` &mdash; Official/Admin review of all received proposals.
- `POST /api/tenders/:id/bids/:bidId/evaluate` &mdash; Official technical scoring and notes.
- `POST /api/tenders/:id/award` &mdash; Atomic contract award transaction (updates tender to `AWARDED`, generates `WorkOrder`, sets winning bid to `ACCEPTED`, other bids to `REJECTED`, creates 3 staged `ContractMilestone`s).

### 4.2 Contractor Workspace Routes (`/api/contractor`)
- `GET /api/contractor/dashboard` &mdash; Summary KPI metrics, active contracts, pending claims, and defect counts.
- `GET /api/contractor/profile` &mdash; Organization credentials, license class, registration details.
- `GET /api/contractor/bids` &mdash; Contractor's personal bidding history and evaluation outcomes.
- `POST /api/contractor/bids/:id/withdraw` &mdash; Self-service bid retraction before deadline.
- `GET /api/contractor/work-orders` &mdash; List of awarded contracts and execution statuses.
- `GET /api/contractor/work-orders/:id` &mdash; Detailed contract view including milestones, progress updates, and payment ledger.
- `POST /api/contractor/work-orders/:id/work-start` &mdash; Formal mobilization and site-start submission.
- `POST /api/contractor/work-orders/:id/progress` &mdash; Log physical progress percentages and materials used.
- `POST /api/contractor/work-orders/:id/milestones/:milestoneId/claim` &mdash; Submit milestone completion claim for engineering audit.
- `GET /api/contractor/defects` &mdash; Warranty and defect punch-list queue.
- `POST /api/contractor/defects/:id/rectify` &mdash; Submit rectification proof and action notes.

### 4.3 Official Engineering & Finance Routes (`/api/official`)
- `POST /api/official/work-orders/:id/work-start/verify` &mdash; Site verification approving mobilization and advancing work order to `IN_PROGRESS`.
- `POST /api/official/work-orders/:id/milestones/:milestoneId/review` &mdash; Engineer site inspection approval or rejection with remarks.
- `POST /api/official/work-orders/:id/payments` &mdash; Record official financial disbursement linked to work order.
- `POST /api/official/work-orders/:id/defects` &mdash; Log defect non-conformance during warranty period.
- `POST /api/official/defects/:id/verify` &mdash; Verify physical rectification on-site and mark closed.
- `GET /api/official/contractors` &mdash; Municipal contractor directory and accreditation list.
- `PATCH /api/official/contractors/:id/verify` &mdash; Accredit/verify contractor license credentials.

---

## 5. Automated Test Coverage

The module is verified via `server/test/contractor.test.ts` across 9 comprehensive lifecycle subtests:
1. **Contractor Access & Role Separation**: Verifies authentication, profile hydration, and strict denial of citizen/official privilege escalation.
2. **Tender Creation & Publication**: Verifies drafting, department scoping, and publication state transitions.
3. **Public Tender Discovery & Server-Side Eligibility**: Verifies public listing, search filters, and server-side evaluation of license class rank, category match, account standing, and deadline validity.
4. **Contractor Bidding & Integrity Constraints**: Verifies validation rejection for negative/zero amounts, duplicate submission conflict handling (409), and isolated bidder visibility.
5. **Official Bid Evaluation & Atomic Contract Award**: Verifies official bid review and atomic creation of `WorkOrder` and staged `ContractMilestone`s in PostgreSQL.
6. **Work Execution: Work-Start Declaration & Site Verification**: Verifies mobilization notice, official approval, and execution state transitions.
7. **Daily Progress Logging & Milestone Verification Workflow**: Verifies contractor physical progress logs, milestone claims, and official engineer review.
8. **Financial Disbursements & Traceable Payment Ledger**: Verifies official disbursement recording, contractor read-only access, and immutable audit event creation.
9. **Warranty & Defect Liability Lifecycle**: Verifies defect punch-list logging, contractor rectification submission, and official closure.
