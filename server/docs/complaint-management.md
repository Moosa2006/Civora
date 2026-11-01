# Civora — Modules 6 & 7: Complaint Reporting, Tracking, Department Assignment, Official Progress Tracking, Evidence Management & Resolution Verification

## 1. Overview
Civora establishes a complete, transparent, and auditable civic grievance lifecycle.
- **Module 6**: Established complaint lodging by verified citizens, collision-resistant public tracking identifiers (`CIV-YYYY-XXXXX`), ownership isolation, public privacy masking, and administrative status triage.
- **Module 7**: Extends the platform with:
  1. Department assignment and reassignment preserving complete historical audit trails.
  2. Official progress tracking with milestone events, public/internal visibility classification, and automatic transition to `IN_PROGRESS`.
  3. Site inspection recording with measurable observations, inspector attribution, and structured outcomes.
  4. Evidence metadata registration with path traversal prevention, strict MIME allowlists, and size limitations.
  5. Official resolution submission moving complaints to `RESOLVED`.
  6. Citizen verification enabling complaint owners to confirm satisfactory completion (`VERIFIED`) or demand remediation (`REOPENED`) with a mandatory reason.
  7. Dedicated Government Official Workspace for department field staff.

---

## 2. Tracking ID Architecture & Privacy Enforcement

### Identifier Format
`CIV-YYYY-XXXXX`
- `CIV`: Platform namespace prefix.
- `YYYY`: 4-digit Gregorian calendar year (e.g. `2026`).
- `XXXXX`: 5-character collision-resistant Crockford alphanumeric token (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, excluding ambiguous characters `0`, `O`, `1`, `I`, `L`).

### Privacy Boundary
Public tracking endpoints (`GET /api/complaints/track/:trackingId`) return grievance details, location, department, timeline, public progress logs, and public evidence documents with **ZERO citizen PII** (no `citizenId`, phone, email, or user credentials).

---

## 3. Complaint Status Lifecycle State Machine

The complaint state machine is strictly enforced by backend business logic (`server/src/lib/complaintLifecycle.ts`):

```
       [SUBMITTED]
            │
            ▼
      [UNDER_REVIEW] ───────► [REJECTED] (Mandatory reason required)
       │          │
       ▼          ▼
  [ASSIGNED] ──► [IN_PROGRESS]
                      │
                      ▼
                  [RESOLVED] (Resolution summary recorded)
                   │      │
     Citizen confirms     Citizen requests reopen
                   │      │
                   ▼      ▼
              [VERIFIED] [REOPENED] ──► [IN_PROGRESS]
                   │
                   ▼
                [CLOSED]
```

### Complete Transition Matrix
| From Status | Allowed Next Statuses | Notes / Rules |
|---|---|---|
| `SUBMITTED` | `UNDER_REVIEW`, `REJECTED`, `ASSIGNED` | Initial filing lodged by citizen |
| `UNDER_REVIEW` | `ASSIGNED`, `IN_PROGRESS`, `REJECTED` | Rejection strictly requires a descriptive reason |
| `ASSIGNED` | `IN_PROGRESS`, `UNDER_REVIEW`, `REJECTED` | Department assignment advances status here |
| `IN_PROGRESS` | `RESOLVED`, `UNDER_REVIEW` | Logging official progress automatically moves ASSIGNED complaints here |
| `RESOLVED` | `VERIFIED`, `REOPENED`, `CLOSED` | Awaiting citizen verification |
| `VERIFIED` | `CLOSED`, `REOPENED` | Confirmed by citizen reporter; archived |
| `REOPENED` | `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS` | Citizen demanded remediation; returned to active queue |
| `REJECTED` | `UNDER_REVIEW`, `CLOSED` | Terminal review unless reconsidered |
| `CLOSED` | `REOPENED` | Final archived state |

Illegal transitions (e.g. `SUBMITTED` directly to `RESOLVED` or `VERIFIED`) are strictly rejected with `400 INVALID_TRANSITION`.

---

## 4. Module 7 Workflows & Features

### 4.1 Department Assignment & Reassignment
- **Endpoint**: `PATCH /api/admin/complaints/:id/assign`
- **Role Requirement**: `ADMIN` or `GOVERNMENT_OFFICIAL`
- **Reassignment Handling**: When a complaint already has an assigned department, reassigning to another department preserves the previous department in both `complaint_status_history` and `audit_events` with actor ID, timestamp, and notes.

### 4.2 Official Progress Tracking
- **Endpoints**:
  - `POST /api/complaints/:id/progress`
  - `GET /api/complaints/:id/progress`
- **Authorization**: Only officials assigned to the complaint's department (or `ADMIN`) can create progress entries.
- **Stage Classification**: Supports milestones like `INSPECTION_SCHEDULED`, `INSPECTED`, `WORK_SCHEDULED`, `WORK_STARTED`, `WORK_COMPLETED`, and `FOLLOW_UP_REQUIRED`.
- **Visibility Filtering**: Memos flagged `isInternal: true` are visible only to municipal staff and are filtered out of citizen/public responses.
- **Auto Status Advancement**: If the complaint is currently `ASSIGNED`, recording an official progress update automatically advances status to `IN_PROGRESS`.

### 4.3 Site Inspections & Observations
- **Endpoints**:
  - `POST /api/complaints/:id/inspections`
  - `GET /api/complaints/:id/inspections`
- **Model**: Linked to PostgreSQL `site_inspections`.
- **Data Captured**: `inspectionDate`, `findings`, `measurementsOrReadings`, `outcome`, `notes`, inspector ID.
- **Outcomes**: `ISSUE_VERIFIED`, `REPAIR_SCHEDULED`, `REPAIR_COMPLETED`, `NO_DEFECT_FOUND`.

### 4.4 Evidence Management & Upload Security
- **Endpoints**:
  - `POST /api/complaints/:id/evidence`
  - `GET /api/complaints/:id/evidence`
- **Model**: Linked to PostgreSQL `documents`.
- **Security Protections**:
  - **Path Traversal Prevention**: Filenames containing `..`, `/`, `\`, or null bytes are rejected.
  - **MIME Type Allowlist**: Restricted to `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`.
  - **Size Limit**: Maximum 10MB per document (rejected if `fileSizeBytes > 10485760`).
  - **Visibility**: Supports `isPublic` flag; private documents are excluded from unauthenticated responses.

### 4.5 Resolution Submission & Citizen Verification
- **Official Submission**:
  - `POST /api/complaints/:id/resolution`
  - Requires comprehensive `resolutionNotes`.
  - Transitions complaint to `RESOLVED` and sets `resolvedAt`.
- **Citizen Verification**:
  - `POST /api/complaints/:id/verify-resolution`
  - **Ownership Restriction**: Only the citizen who lodged the grievance (or `ADMIN`) can confirm resolution. Citizen B cannot verify Citizen A's complaint.
  - Transitions complaint to `VERIFIED` and sets `verifiedAt`.
- **Citizen Reopening**:
  - `POST /api/complaints/:id/reopen`
  - Requires mandatory `reopenReason`.
  - Transitions complaint to `REOPENED` while preserving previous resolution notes and audit history.

### 4.6 Official Department Workspace
- **Backend Route**: `GET /api/official/complaints`
- **Frontend Page**: `OfficialWorkspacePage.tsx` (`/official/workspace`)
- Filters grievances by the logged-in official's department.
- Provides interactive modal interfaces to log progress, record inspections, register evidence, and submit resolutions.

---

## 5. API Reference Summary

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/complaints` | Authenticated | Lodge civic grievance |
| `GET` | `/api/complaints/my` | Authenticated | List citizen's filed complaints |
| `GET` | `/api/complaints/:id` | Owner / Staff | View full grievance detail |
| `GET` | `/api/complaints/track/:trackingId` | Public | Track grievance status without PII |
| `GET` | `/api/admin/complaints` | Admin / Official | Triage complaints queue |
| `GET` | `/api/admin/complaints/unassigned` | Admin / Official | List complaints awaiting assignment |
| `PATCH` | `/api/admin/complaints/:id/status` | Admin / Official | Update lifecycle status |
| `PATCH` | `/api/admin/complaints/:id/assign` | Admin / Official | Assign / reassign department |
| `POST` | `/api/complaints/:id/progress` | Assigned Official / Admin | Record official progress update |
| `GET` | `/api/complaints/:id/progress` | Public / Authenticated | List progress updates (internal filtered) |
| `POST` | `/api/complaints/:id/inspections` | Assigned Official / Admin | Record site inspection |
| `GET` | `/api/complaints/:id/inspections` | Public / Authenticated | List site inspections |
| `POST` | `/api/complaints/:id/evidence` | Assigned Official / Admin | Register evidence metadata |
| `GET` | `/api/complaints/:id/evidence` | Public / Authenticated | List evidence metadata |
| `POST` | `/api/complaints/:id/resolution` | Assigned Official / Admin | Submit official resolution |
| `POST` | `/api/complaints/:id/verify-resolution` | Complaint Owner / Admin | Confirm resolution (VERIFIED) |
| `POST` | `/api/complaints/:id/reopen` | Complaint Owner / Admin | Request reopening (REOPENED) |
| `GET` | `/api/official/complaints` | Official / Admin | Workspace queue for department |

---

## 6. Frontend Pages & Components

1. **`TrackComplaintPage.tsx`** (`/track`):
   - Tracking ID lookup with URL param support.
   - Prominent **Citizen Verification Banner** when status is `RESOLVED`, enabling the complaint owner to confirm resolution or open the reopening modal.
   - Verified / Reopened status callouts.
   - Official Progress Feed, Site Inspections Card, and Supporting Evidence documents list.
   - Cryptographic public audit timeline.
2. **`MyComplaintsPage.tsx`** (`/my-complaints`):
   - List of citizen complaints with status badges.
   - Highlights complaints awaiting verification (`RESOLVED`) with direct "Verify Resolution" button.
   - Filter tabs: All, Submitted, Under Review, Assigned, In Progress, Resolved, Verified, Reopened, Rejected.
3. **`OfficialWorkspacePage.tsx`** (`/official/workspace`):
   - Dedicated dashboard for field officials showing department complaints.
   - Action controls for "Log Progress", "Log Inspection", "Add Evidence", and "Submit Resolution".
4. **`Navbar.tsx`**:
   - Navigation links adapted based on authenticated role (`Staff Triage` and `Field Operations` for municipal staff).

---

## 7. How to Run Locally

### Start Backend
```powershell
# In server/
npm run dev
```

### Start Frontend
```powershell
# In client/
npm run dev
```

### Run Automated Tests
```powershell
# In server/
npm test
```
All **70 test assertions** pass across 18 test suites covering authentication, RBAC, complaint reporting, tracking, department assignment & reassignment, progress tracking, inspections, evidence validation, and citizen resolution verification.
