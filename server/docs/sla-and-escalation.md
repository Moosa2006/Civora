# Civora &mdash; Module 11: Service-Level Agreements (SLAs), Escalation Management, Overdue Case Resolution & Department Accountability

## 1. Overview & Core Philosophy

Module 11 introduces a configurable accountability and service commitment engine to Civora. It defines authoritative response and resolution time targets for civic grievances, automatically calculates deadlines, identifies approaching and overdue complaints, facilitates multi-level escalations, supports auditable deadline extensions, and provides public and departmental transparency analytics.

### Core Principle
> **An overdue complaint must not automatically be marked resolved, and escalation must not silently change its status, assignment, or original deadline.**
>
> Escalation is an accountability workflow, not a substitute for complaint resolution. Complaint status (`PENDING`, `IN_PROGRESS`, `RESOLVED`, etc.) is kept strictly decoupled from SLA status (`ON_TRACK`, `APPROACHING_DEADLINE`, `OVERDUE_RESOLUTION`, etc.).

---

## 2. Data Model & Architecture

Module 11 adds 5 core models and 5 enums to the Civora Prisma schema (`schema.prisma`):

### 2.1 Enums
- **`SlaStatus`**: `NOT_CONFIGURED`, `ON_TRACK`, `APPROACHING_DEADLINE`, `OVERDUE_RESPONSE`, `OVERDUE_RESOLUTION`, `RESOLVED_WITHIN_SLA`, `RESOLVED_OVERDUE`, `PAUSED`.
- **`EscalationLevel`**: `LEVEL_1_OFFICIAL`, `LEVEL_2_SUPERVISOR`, `LEVEL_3_HEAD_ADMIN`.
- **`EscalationStatus`**: `PENDING`, `ACKNOWLEDGED`, `IN_REVIEW`, `ACTION_PLANNED`, `RESOLVED`, `CLOSED`.
- **`EscalationTrigger`**: `RESPONSE_OVERDUE`, `RESOLUTION_OVERDUE`, `MANUAL_SUPERVISOR`, `WARNING_THRESHOLD_EXCEEDED`, `UNRESPONSIVE_OFFICIAL`.
- **`ExtensionRequestStatus`**: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.

### 2.2 Models
1. **`SlaPolicy`**:
   - Configurable policy records storing `category`, `priority`, `responseHours`, `resolutionHours`, `warningThresholdHours`, `escalationGraceHours`, `isActive`, `effectiveFrom`, `effectiveTo`, and administrative audit trails (`createdBy`, `updatedBy`).
2. **`ComplaintSla`**:
   - Complaint-specific immutable SLA attachment snapshot storing policy references, `originalResponseDeadline`, `originalResolutionDeadline`, `currentResponseDeadline`, `currentResolutionDeadline`, `respondedAt`, `estimatedCompletionAt`, `slaStatus`, and `warningEmitted`.
3. **`ComplaintEscalation`**:
   - Escalation records tracking `escalationLevel`, `trigger`, `status`, `notes`, `assignedToId`, `supervisorId`, `acknowledgedAt`, `acknowledgedById`, `actionPlanNotes`, `resolvedAt`, and `resolvedById`.
4. **`EscalationActionLog`**:
   - Chronological, non-rewritable audit logs for escalation actions (`TRIGGERED`, `ACKNOWLEDGED`, `ASSIGNED`, `ACTION_PLAN_RECORDED`, `RESOLVED`, `REOPENED`).
5. **`SlaExtensionRequest`**:
   - Auditable requests for deadline extensions recording `currentResolutionDeadline`, `requestedDeadline`, `reason`, `supportingJustification`, `requestedById`, `status`, `decisionNotes`, `decidedById`, and `decidedAt`. Enforces **Separation of Duties**: the requesting official cannot approve their own request.

---

## 3. Deterministic Policy Selection & Precedence Rules

When a complaint is lodged or evaluated, `SlaEngine.selectPolicyForComplaint(category, priority)` selects the applicable policy using deterministic 5-tier precedence:

1. **Exact Match**: An active policy matching both the exact `category` and exact `priority`.
2. **Category Specific**: An active policy matching `category` with `priority = null` (general priority for that category).
3. **Priority Specific**: An active policy matching `priority` with `category = null` (general category for that priority).
4. **Platform Default**: An active fallback policy with both `category = null` and `priority = null`.
5. **No SLA**: If no matching policy is found, the complaint is assigned status `NOT_CONFIGURED`. No artificial deadline is invented, and the case is never incorrectly marked compliant or overdue.

Multiple conflicting policies matching the same specificity level are disambiguated deterministically by `effectiveFrom DESC, createdAt DESC`.

---

## 4. Complaint Deadline Calculation & Clock Rules

### 4.1 Clock Start
The SLA clock begins authoritatively at the official complaint creation timestamp (`Complaint.createdAt`). It does not wait indefinitely for triage or department assignment, nor does it reset simply because an official opens the complaint.

### 4.2 Deadlines Calculation
$$\text{originalResponseDeadline} = \text{createdAt} + (\text{responseHours} \times 3600 \text{ seconds})$$
$$\text{originalResolutionDeadline} = \text{createdAt} + (\text{resolutionHours} \times 3600 \text{ seconds})$$

Both deadlines are computed in UTC and preserved in the `ComplaintSla` snapshot.

### 4.3 Response vs. Resolution Milestones
- **Response Milestone**: Achieved when an official is assigned, a public progress update is recorded, or an official message is sent. The timestamp is captured in `ComplaintSla.respondedAt`.
- **Resolution Milestone**: Achieved when the complaint status transitions to `RESOLVED` or `VERIFIED`. The timestamp is stored authoritatively in `Complaint.resolvedAt`.
  - If `resolvedAt <= currentResolutionDeadline`, `slaStatus = RESOLVED_WITHIN_SLA`.
  - If `resolvedAt > currentResolutionDeadline`, `slaStatus = RESOLVED_OVERDUE`.

### 4.4 Reopened Complaints
If a citizen disputes a provisional resolution and reopens the complaint (`REOPENED`), the original deadline history is preserved. If the complaint was already overdue, reopening does not erase the historical breach.

---

## 5. SLA Engine & Overdue Detection

### 5.1 Idempotent State Evaluation
`SlaEngine.evaluateComplaintSla(complaintId)` calculates the active state based on real-world time:
- **`NOT_CONFIGURED`**: No active policy matched.
- **`RESOLVED_WITHIN_SLA` / `RESOLVED_OVERDUE`**: Complaint has been resolved.
- **`OVERDUE_RESPONSE`**: Response deadline has passed without a recorded response.
- **`OVERDUE_RESOLUTION`**: Resolution deadline has passed while the complaint remains unresolved.
- **`APPROACHING_DEADLINE`**: Current time is within the warning threshold before the resolution deadline ($\text{deadline} - \text{now} \le \text{warningThresholdHours}$).
- **`ON_TRACK`**: Clocks are running and deadlines are in the future beyond the warning threshold.

### 5.2 Deduplication and Notification Throttling
- Warning notifications (`NotificationType.SLA_WARNING`) are protected by boolean flag `ComplaintSla.warningEmitted`. Once emitted, subsequent runs of the background worker do not resend warnings unless deadlines change.
- Escalations are unique per complaint and active escalation level to prevent flooding officials and supervisors with duplicate escalation tickets on scheduled runs.

---

## 6. Multi-Level Escalation Workflow

### 6.1 Hierarchy
- **Level 1 (`LEVEL_1_OFFICIAL`)**: Handled by the assigned department field official. Triggered on first response breach or initial grace period lapse.
- **Level 2 (`LEVEL_2_SUPERVISOR`)**: Escalated to the department supervisor or field team lead. Triggered when resolution deadline is breached or Level 1 escalation goes unacknowledged.
- **Level 3 (`LEVEL_3_HEAD_ADMIN`)**: Escalated to the municipal department director and system administrators. Triggered for prolonged critical breaches or emergency hazards.

### 6.2 Escalation Actions & Audit Trail
Every lifecycle state change in an escalation is captured in `EscalationActionLog`:
- **`TRIGGERED`**: System or supervisor created escalation.
- **`ACKNOWLEDGED`**: Supervisor or official acknowledges responsibility.
- **`ASSIGNED`**: Responsible official designated.
- **`ACTION_PLAN_RECORDED`**: Corrective steps and departmental estimated completion date recorded.
- **`RESOLVED`**: Escalation concluded with documented justification.

---

## 7. Controlled SLA Extensions & Separation of Duties

### 7.1 Separation of Duties Enforcement
To prevent conflict of interest, field officials can submit extension requests with mandatory justifications (`POST /api/sla/complaints/:id/extensions`), but **cannot approve their own requests**. Approval (`POST /api/sla/extensions/:id/decide`) is strictly restricted to Supervisors and System Administrators who are distinct from the requesting user.

### 7.2 Extension Approval Behavior
When an extension is approved:
1. `ComplaintSla.currentResolutionDeadline` is updated to the approved new timestamp.
2. `ComplaintSla.originalResolutionDeadline` remains strictly untouched to preserve historical auditability.
3. The complaint status is re-evaluated by the `SlaEngine`.
4. A notification (`NotificationType.SLA_EXTENSION_DECIDED`) is dispatched to the assigned official and citizen.

---

## 8. Role Permissions & Privacy-Safe Citizen Experience

### 8.1 Role Access Matrix

| Role | Policy Admin | View All SLAs | View Dept SLAs | Acknowledge Escalation | Submit Extension | Approve Extension | Run Engine |
|---|---|---|---|---|---|---|---|
| **CITIZEN** | ❌ | ❌ (Own only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **OFFICIAL** | ❌ | ❌ | ✅ (Assigned) | ✅ | ✅ | ❌ (Own forbidden) | ❌ |
| **SUPERVISOR**| ❌ | ❌ | ✅ (Department) | ✅ | ✅ | ✅ | ❌ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.2 Citizen Privacy Protection
In the public tracking view (`TrackComplaintPage.tsx` / `GET /api/complaints/track/:trackingId`):
- **Exposed**: Response deadline, resolution deadline, SLA status pill, department estimated completion date, public escalation alert ("This issue has been escalated to senior department supervision for priority intervention").
- **Strictly Hidden**: Internal supervisor memos, staff names, internal escalation logs, confidential root-cause investigations.

---

## 9. REST API Reference

### 9.1 SLA Policy Management
- `GET /api/sla/policies` &mdash; List all SLA policies (Admin).
- `POST /api/sla/policies` &mdash; Create a new SLA policy (Admin).
- `GET /api/sla/policies/:id` &mdash; Retrieve policy details with performance stats (Admin).
- `PUT /api/sla/policies/:id` &mdash; Update policy settings (Admin).
- `PATCH /api/sla/policies/:id/status` &mdash; Activate or deactivate policy (Admin).

### 9.2 Complaint SLA & Overdue Queues
- `GET /api/sla/complaints/:complaintId` &mdash; Retrieve SLA details for an authorized complaint.
- `GET /api/sla/overdue` &mdash; List approaching and overdue complaints (Staff/Admin).
- `POST /api/sla/complaints/:complaintId/evaluate` &mdash; Force recalculate SLA status for a complaint.
- `POST /api/sla/evaluate-all` &mdash; Run batch SLA evaluation across all active complaints (Admin/Scheduler).

### 9.3 Escalation Management
- `GET /api/sla/escalations` &mdash; List active escalations filtered by status/level (Staff/Admin).
- `GET /api/sla/escalations/:id` &mdash; Retrieve escalation details and full audit log (Staff/Admin).
- `POST /api/sla/complaints/:complaintId/escalate` &mdash; Manually escalate complaint (Supervisor/Admin).
- `POST /api/sla/escalations/:id/acknowledge` &mdash; Acknowledge escalation (Assigned Staff/Supervisor/Admin).
- `POST /api/sla/escalations/:id/action-plan` &mdash; Record corrective action plan & estimated completion (Staff/Supervisor/Admin).
- `POST /api/sla/escalations/:id/resolve` &mdash; Mark escalation resolved with mandatory closure notes (Supervisor/Admin).

### 9.4 SLA Extensions
- `POST /api/sla/complaints/:complaintId/extensions` &mdash; Submit deadline extension request (Staff/Admin).
- `GET /api/sla/complaints/:complaintId/extensions` &mdash; List extension requests for a complaint.
- `POST /api/sla/extensions/:id/decide` &mdash; Approve or reject extension request (Supervisor/Admin with separation of duties).

### 9.5 Accountability & Public Transparency Analytics
- `GET /api/sla/metrics` (or `/accountability`) &mdash; Departmental SLA compliance rates, breach counts, and active escalations.
- `GET /api/sla/transparency` (or `/transparency/overview`) &mdash; Privacy-safe public transparency statistics.

---

## 10. Background Processing & Scheduling

The SLA engine (`SlaEngine.evaluateAllActiveComplaints`) is built to run asynchronously and idempotently.
- **Trigger Methods**:
  1. Automated REST Trigger: `POST /api/sla/evaluate-all` called by external cron or worker service.
  2. Lifecycle Hook: Triggered on complaint submission, triage updates, and resolution events.
- **Idempotency Guarantee**: Running the evaluation multiple times produces identical state transitions without generating duplicate warnings or escalation entries.

---

## 11. Testing & Verification

Module 11 includes 24 automated unit and integration tests in `server/test/sla.test.ts`:
- Deterministic policy selection across exact, category-specific, priority-specific, and fallback levels.
- Calculation of response and resolution deadlines from creation timestamp.
- Warning thresholds and idempotent suppression of duplicate alerts.
- Escalation level progression and audit action logging.
- Extension requests and strict enforcement of separation of duties (rejecting self-approval).
- Citizen tracking privacy boundaries (verifying exclusion of staff notes).
- Department accountability scorecard computations.

All 24 SLA tests and 142 total backend tests across the repository pass with 0 failures.
