# Civora &mdash; Module 8: Public Transparency Dashboard, Civic Project Monitoring & Accountability Analytics

## 1. Overview

Module 8 introduces a comprehensive, public-facing transparency layer to Civora, enabling citizens, journalists, and public administrators to inspect civic issue handling, track registered municipal public works, and evaluate departmental accountability without compromising citizen privacy.

### Core Capabilities
1. **Public Transparency Dashboard (`GET /api/transparency/metrics`, `GET /api/transparency/trends`, `GET /api/transparency/status-distribution`)**:
   - Aggregated system metrics computed directly from PostgreSQL (`Cevora`).
   - Time-series trends of daily complaint intake vs. resolutions over configurable time horizons (7, 30, 90, 180, or 365 days).
   - Lifecycle status distribution with canonical status breakdown.
2. **Public Grievance Explorer (`GET /api/transparency/complaints`)**:
   - Filterable, searchable public complaint catalogue.
   - Strict server-side projection stripping all citizen Personally Identifiable Information (PII).
3. **Department Accountability Scorecards (`GET /api/transparency/departments`)**:
   - Departmental workload share, active backlog, resolved count, resolution rate %, and average turnaround hours.
   - Fair comparison safeguards: context on volume, active backlog, and no artificial composite ranking scores.
   - Zero double-counting of reassigned complaints.
4. **Formal Civic Works Monitoring (`GET /api/projects`, `GET /api/projects/:id`)**:
   - Public registry of formally planned and ongoing municipal engineering projects (`CivicWork`).
   - Strict separation between civic complaints and public engineering works (M:N relationship via `CivicWorkComplaint`).
   - Milestone progress tracking (0–100%), work orders, contractor attribution, and budget transparency.

---

## 2. Analytics Definitions & Mathematical Formats

All metrics are dynamically aggregated from live database records; zero mock or hardcoded statistics are returned.

### Status Groupings
- **Total Complaints**: All records recorded in `Complaint`.
- **Open Backlog**: Active complaints requiring initial triage or pending reassignment (`SUBMITTED`, `UNDER_REVIEW`, `REOPENED`).
- **In Progress**: Complaints currently assigned to a department or actively undergoing remediation (`ASSIGNED`, `IN_PROGRESS`).
- **Resolved**: Complaints marked as completed by officials awaiting citizen verification (`RESOLVED`).
- **Verified**: Complaints confirmed satisfactorily resolved by citizens (`VERIFIED`).
- **Closed**: Grievances formally archived after verified completion (`CLOSED`).
- **Rejected**: Grievances rejected during triage with documented justification (`REJECTED`).

### Mathematical Formulations

#### 1. Resolution Rate (%)
$$\text{Resolution Rate} = \frac{\text{Resolved} + \text{Verified} + \text{Closed}}{\text{Total Complaints} - \text{Rejected}} \times 100$$
*Note: Rejected complaints are excluded from the denominator so departments are evaluated strictly against valid, actionable civic grievances.*

#### 2. Average & Median Resolution Time (Hours)
$$\text{Resolution Time} = t_{\text{resolution}} - t_{\text{submission}}$$
- Calculated for all complaints in `RESOLVED`, `VERIFIED`, or `CLOSED` states.
- Submission timestamp: `Complaint.createdAt`.
- Resolution timestamp: Timestamp of transition to `RESOLVED` recorded in `ComplaintStatusHistory` (or `Complaint.updatedAt` as fallback).
- **Average Turnaround**: Arithmetic mean of elapsed hours across resolved complaints.
- **Median Turnaround**: 50th percentile (middle value) of sorted elapsed hours, resilient to historical outliers.

#### 3. Department Workload & Backlog Integrity
- Department analytics query `currentDepartmentId = department.id` on the canonical `Complaint` record.
- **Single-attribution invariant**: A complaint reassigned across departments is assigned to exactly one department at any given moment. Reassigned complaints are never counted multiple times in active backlog metrics.
- **Workload Share (%)**:
  $$\text{Workload Share} = \frac{\text{Department Active Backlog}}{\text{Total System Active Backlog}} \times 100$$

---

## 3. Privacy Boundary & Public Data Sanitization

Public transparency endpoints do not require authentication but enforce strict server-side redactions:

| Field / Asset | Public API Status | Internal / Auth Status |
|---|---|---|
| `citizenId` | **REDACTED** (never selected) | Visible to complaint owner & Admin |
| Citizen Name / Email / Phone | **REDACTED** (never joined) | Visible to Admin & verified owner |
| Password Hash | **REDACTED** | Strictly excluded across entire app |
| Tracking ID (`CIV-YYYY-XXXXX`) | **PUBLIC** | Publicly accessible for lookup |
| Public Title & Description | **PUBLIC** | Publicly accessible |
| Location / Ward / Coordinates | **PUBLIC** | General area / ward published |
| Assigned Department | **PUBLIC** | Published for public accountability |
| Status Audit History | **PUBLIC** | Public timestamps & public status notes |
| Internal Staff Memos | **REDACTED** | Restricted to authorized officials |

---

## 4. REST API Reference

### 4.1 Public Overview Metrics
- **Route**: `GET /api/transparency/metrics`
- **Auth**: None (Public)
- **Response `200 OK`**:
```json
{
  "totalComplaints": 42,
  "openComplaints": 8,
  "inProgressComplaints": 14,
  "resolvedComplaints": 12,
  "verifiedComplaints": 6,
  "reopenedComplaints": 2,
  "closedComplaints": 0,
  "rejectedComplaints": 0,
  "resolutionRate": 47.6,
  "avgResolutionTimeHours": 38.4,
  "medianResolutionTimeHours": 32.0,
  "activeProjectsCount": 2,
  "completedProjectsCount": 0,
  "totalProjectsCount": 2
}
```

### 4.2 Public Complaint Intake & Resolution Trends
- **Route**: `GET /api/transparency/trends?days=30`
- **Auth**: None (Public)
- **Query Parameters**:
  - `days`: Integer between 1 and 365 (Default: `30`). Invalid inputs return `400 Bad Request`.
- **Response `200 OK`**:
```json
{
  "periodDays": 30,
  "startDate": "2026-09-17T00:00:00.000Z",
  "endDate": "2026-10-17T13:49:00.000Z",
  "trends": [
    {
      "date": "2026-10-15",
      "submitted": 4,
      "resolved": 1
    },
    {
      "date": "2026-10-16",
      "submitted": 7,
      "resolved": 3
    }
  ]
}
```

### 4.3 Public Status Distribution
- **Route**: `GET /api/transparency/status-distribution`
- **Auth**: None (Public)
- **Response `200 OK`**:
```json
{
  "total": 42,
  "distribution": [
    { "status": "IN_PROGRESS", "label": "In Progress", "count": 14, "percentage": 33.3 },
    { "status": "RESOLVED", "label": "Resolved", "count": 12, "percentage": 28.6 },
    { "status": "OPEN", "label": "Open", "count": 8, "percentage": 19.0 },
    { "status": "VERIFIED", "label": "Verified", "count": 6, "percentage": 14.3 },
    { "status": "REOPENED", "label": "Reopened", "count": 2, "percentage": 4.8 }
  ]
}
```

### 4.4 Department Accountability Scorecards
- **Route**: `GET /api/transparency/departments`
- **Auth**: None (Public)
- **Response `200 OK`**:
```json
[
  {
    "departmentId": "dept-roads-01",
    "departmentName": "Roads & Infrastructure",
    "departmentCode": "ROADS",
    "totalAssigned": 18,
    "activeBacklog": 8,
    "resolvedCount": 10,
    "resolutionRate": 55.6,
    "avgTurnaroundHours": 42.5,
    "workloadShare": 33.3
  }
]
```

### 4.5 Public Complaints Explorer
- **Route**: `GET /api/transparency/complaints?page=1&limit=15&search=pothole&status=IN_PROGRESS`
- **Auth**: None (Public)
- **Query Parameters**:
  - `page`: Positive integer (Default: `1`).
  - `limit`: Integer between 1 and 50 (Default: `15`).
  - `search`: Keyword string (matches tracking ID, title, locality, or address).
  - `status`: Lifecycle enum filter (`SUBMITTED`, `IN_PROGRESS`, `RESOLVED`, etc.).
  - `departmentId`: Department UUID / ID filter.
  - `categoryId`: Complaint Category UUID / ID filter.
- **Response `200 OK`**:
```json
{
  "complaints": [
    {
      "id": "cm2...",
      "trackingId": "CIV-2026-ABCDE",
      "title": "Severe pothole near Ring Road junction",
      "category": { "id": "cat-roads", "name": "Roads & Footpaths" },
      "department": { "id": "dept-roads", "name": "Roads & Infrastructure", "code": "ROADS" },
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "locality": "Sector 4",
      "createdAt": "2026-10-15T08:30:00.000Z",
      "updatedAt": "2026-10-16T11:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 15,
    "total": 1,
    "totalPages": 1
  }
}
```

### 4.6 Civic Works Registry & Monitoring
- **Route**: `GET /api/projects`
- **Auth**: None (Public)
- **Query Parameters**: `status`, `departmentId`, `search`, `page`, `limit`.
- **Response `200 OK`**:
```json
{
  "projects": [
    {
      "id": "work-001",
      "workCode": "CW-2026-001",
      "title": "Main Boulevard Stormwater Drainage Overhaul",
      "description": "Comprehensive underground drain widening and culvert replacement.",
      "status": "IN_PROGRESS",
      "stage": "CONSTRUCTION",
      "department": { "id": "dept-drainage", "name": "Stormwater & Drainage", "code": "DRAINAGE" },
      "estimatedCost": "1500000.00",
      "sanctionedCost": "1450000.00",
      "progressPercentage": 45,
      "linkedComplaintsCount": 3,
      "targetEndDate": "2026-12-31T00:00:00.000Z",
      "createdAt": "2026-09-01T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 15, "total": 1, "totalPages": 1 }
}
```

- **Route**: `GET /api/projects/:id`
- **Auth**: None (Public)
- **Response `200 OK`**: Returns full project specification, linked complaint tracking IDs (without citizen PII), work orders, contractor name, execution milestones, and progress update timeline.

---

## 5. Frontend Architecture & Visual Analytics

The frontend transparency suite is mounted at `/transparency` and provides 4 operational tabs:
1. **Overview Analytics**:
   - Metric highlight cards (`Total Grievances`, `Active Resolution Rate`, `Avg Turnaround`, `Active Civic Works`).
   - Pure, accessible SVG charts:
     - `TrendAreaChart`: Responsive SVG area/line chart rendering intake vs. resolution trends with gradient fills and data point tooltips.
     - `DonutChart`: Interactive SVG ring chart displaying lifecycle status distributions with legend and percentage breakdowns.
     - `HorizontalBarChart`: Proportional comparative workload distribution across municipal departments.
2. **Public Grievances Explorer**:
   - Live debounced keyword search across tracking IDs and titles.
   - Dynamic category, department, and lifecycle status filters.
   - PII-free complaint card view with direct navigation to public tracking view (`/track/:trackingId`).
3. **Department Scorecards**:
   - Comprehensive comparative grid of municipal agencies.
   - Indicators: Active backlog count, resolution %, average turnaround in hours, and total system workload share.
   - Contextual notices preventing misleading ranking comparisons.
4. **Civic Works Projects Registry**:
   - Dedicated explorer for formal municipal engineering projects.
   - Accessible visual progress bars (0–100%) reflecting validated execution milestones.
   - Detailed inspection modal showing linked complaint tracking IDs, budget allocation, contractor details, and progress logs.

---

## 6. Verification & Test Suite

The Module 8 backend implementation is verified by 13 dedicated automated tests in `server/test/transparency.test.ts`.

### Test Execution Command
```bash
npm test
```

### Coverage Highlights
- `GET /api/transparency/metrics`: Validates real aggregation formulas, integer counts, and float resolution rates.
- `GET /api/transparency/trends`: Verifies day-horizon parameter parsing (7, 30, 90 days), date boundaries, and rejection of invalid horizons with `400 Bad Request`.
- `GET /api/transparency/status-distribution`: Validates 100% total distribution sum and accurate status counts.
- `GET /api/transparency/departments`: Verifies single-attribution workload allocation, zero double-counting of reassigned complaints, and turnaround calculations.
- `GET /api/transparency/complaints`: Verifies pagination, search filters, and strict exclusion of `citizenId`, `user`, or citizen PII.
- `GET /api/projects` & `GET /api/projects/:id`: Verifies separation of civic works from complaints, progress percentage calculations, linked complaint tracking IDs, and `404 Not Found` handling for non-existent projects.

**Overall Test Results:** 83 / 83 tests passing across 25 test suites with zero failures.
