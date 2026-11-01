# Civora &mdash; Module 16: System Administration, Platform Configuration, Audit Reporting & Operational Health

## 1. Overview & Objectives

**Module 16** provides an enterprise-grade, secure, centralized administration and operational management layer for Civora. It gives authorized platform administrators the tools to:

1. Monitor core service health, database connectivity, and runtime metrics without exposing internal implementation details or secrets to citizens.
2. Manage platform configuration across General, Maintenance, Workflow, and Security categories with transactional change history.
3. Enforce a safe, backend-level maintenance mode that gracefully suspends citizen-facing write operations with HTTP 503 while preserving read access, authentication login, deployment health checks, and administrator recovery routes.
4. Review comprehensive, server-side filtered audit logs with sensitive token and credential redaction.
5. Administer user accounts and roles with strict safeguards against self-modification and accidental demotion/suspension of the last remaining administrator.
6. Track operational incidents with Crockford-style collision-resistant identifiers (`INC-YYYY-XXXXX`), status lifecycles, and mandatory resolution documentation.
7. Export administrative audit logs, complaint workflows, and operational incidents to CSV with built-in defenses against CSV formula injection (CWE-1236).

---

## 2. Architecture & Design Principles

### 2.1 Principle of Least Privilege & Strict RBAC
All endpoints under `/api/admin/*` are strictly protected with authentication (`authenticateUser`) and role-based access control (`requireRoles(UserRole.ADMIN)`). Citizens and officials are blocked with HTTP 403 Forbidden.

### 2.2 Strict Separation of Concerns & Diagnostics Isolation
- **Public Liveness Probe (`GET /api/health`)**: Returns minimal status (`healthy` / `degraded`), service name, semantic version, and timestamp. Never exposes connection strings, internal paths, or credentials.
- **Deployment Readiness Probe (`GET /api/health/ready`)**: Verifies active PostgreSQL database connectivity and memory availability. Returns HTTP 200 when ready or HTTP 503 when dependencies are unreachable.
- **Protected Administrator Diagnostics (`GET /api/health/diagnostics`)**: Restricted strictly to authenticated `ADMIN` users. Reports detailed Node.js runtime version, host platform, RSS and heap memory, active database latency in milliseconds, live entity record counts, active SLA policies, and open incidents.

### 2.3 Secret Management & Configuration Categorization
Settings are divided into three strict tiers:
- **Category A — Safe Administrative Settings**: Managed dynamically through the console (e.g., `platform_name`, `support_email`, `public_registration_enabled`, `allowed_locales`).
- **Category B — Restricted Operational Settings**: Impact platform workflow or access (e.g., `maintenance_mode_enabled`, `maintenance_mode_message`, `complaint_sla_hours`, `session_timeout_minutes`). All modifications require an operational reason and are recorded in both `ConfigurationChangeLog` and `AuditEvent`.
- **Category C — Secrets & Deployment Environment Variables**: Database credentials (`DATABASE_URL`), JWT signing secrets (`JWT_SECRET`), encryption keys, and environment files (`.env`) are strictly excluded from the database and console. They cannot be viewed, queried, or modified via any API endpoint.

---

## 3. Database Schema & Data Models

Module 16 introduced the migration `20261019120000_add_system_admin_and_operational_models` with the following Prisma models:

### 3.1 `PlatformSetting`
```prisma
model PlatformSetting {
  id          String                    @id @default(uuid())
  key         String                    @unique
  value       String
  category    SettingCategory           @default(GENERAL) // GENERAL | MAINTENANCE | WORKFLOW | SECURITY
  description String
  isPublic    Boolean                   @default(false)
  updatedAt   DateTime                  @updatedAt
  updatedById String?
  updatedBy   User?                     @relation("UpdatedSettings", fields: [updatedById], references: [id], onDelete: SetNull)
  changeLogs  ConfigurationChangeLog[]

  @@index([category])
  @@index([key])
}
```

### 3.2 `ConfigurationChangeLog`
```prisma
model ConfigurationChangeLog {
  id            String           @id @default(uuid())
  settingId     String
  setting       PlatformSetting  @relation(fields: [settingId], references: [id], onDelete: Cascade)
  key           String
  previousValue String
  newValue      String
  reason        String?
  changedById   String
  changedBy     User             @relation("ConfigChanges", fields: [changedById], references: [id], onDelete: Restrict)
  createdAt     DateTime         @default(now())

  @@index([settingId])
  @@index([key])
  @@index([createdAt])
}
```

### 3.3 `OperationalIncident`
```prisma
model OperationalIncident {
  id              String           @id @default(uuid())
  incidentNumber  String           @unique // Format: INC-YYYY-XXXXX
  title           String
  description     String
  severity        IncidentSeverity @default(MEDIUM) // LOW | MEDIUM | HIGH | CRITICAL
  subsystem       String           @default("Core Platform")
  status          IncidentStatus   @default(OPEN) // OPEN | INVESTIGATING | MONITORING | RESOLVED
  reportedById    String
  reportedBy      User             @relation("ReportedIncidents", fields: [reportedById], references: [id], onDelete: Restrict)
  assignedToId    String?
  assignedTo      User?            @relation("AssignedIncidents", fields: [assignedToId], references: [id], onDelete: SetNull)
  resolutionNotes String?
  resolvedAt      DateTime?
  resolvedById    String?
  resolvedBy      User?            @relation("ResolvedIncidents", fields: [resolvedById], references: [id], onDelete: SetNull)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([status])
  @@index([severity])
  @@index([createdAt])
}
```

---

## 4. Maintenance Mode Implementation

### 4.1 Backend Enforcement (`maintenanceMode.middleware.ts`)
Civora enforces maintenance mode on the backend pipeline before requests reach application routers:
1. When `maintenance_mode_enabled` is set to `"true"`, all incoming state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) from non-admin clients are intercepted and rejected with:
   - HTTP Status: `503 Service Unavailable`
   - Header: `Retry-After: 300`
   - Response Payload:
     ```json
     {
       "success": false,
       "error": {
         "code": "MAINTENANCE_MODE_ACTIVE",
         "message": "Platform is undergoing scheduled maintenance. Write operations are temporarily suspended.",
         "correlationId": "req-1729320000000-xxxx"
       }
     }
     ```
2. **Safe Route Exclusions**:
   - Read-only operations (`GET`, `HEAD`, `OPTIONS`) continue functioning normally.
   - Authentication login (`/api/auth/login`) remains accessible so administrators can log in.
   - Administrative recovery routes (`/api/admin/*`) remain accessible to authenticated administrators.
   - Infrastructure health probes (`/api/health*`) continue serving status.

### 4.2 Caching & In-Memory TTL
The platform configuration service (`server/src/lib/configService.ts`) uses an in-memory cache with a 15-second TTL to avoid database query overhead on every incoming HTTP request. Cache invalidation occurs immediately upon any administrative configuration update.

---

## 5. User & Role Administration Safeguards

The user administration endpoints (`PATCH /api/admin/users/:id/role` and `PATCH /api/admin/users/:id/status`) enforce strict operational safeguards:
1. **Self-Modification Prevention**: An administrator cannot modify their own role or suspend their own account.
2. **Last Administrator Protection**: The system queries active administrators before applying role demotions or suspensions. If only one active administrator exists, attempts to demote or suspend that user are rejected with HTTP 400 (`CANNOT_DEMOTE_LAST_ADMIN` / `CANNOT_SUSPEND_LAST_ADMIN`).
3. **Mandatory Audit Justification**: Account suspensions and reactivations require a non-empty `reason` parameter that is recorded in the platform `AuditEvent` log.

---

## 6. Audit Trail & CSV Export Security

### 6.1 Audit Log Explorer
- Endpoints: `GET /api/admin/audit` and `GET /api/admin/audit/:id`.
- Server-side filtering by `action`, `entityType`, and free-text search.
- Pagination bounds: Default 25 items per page (maximum 100).
- Sensitive fields (passwords, tokens, cookies, secrets) are redacted from event detail payloads.

### 6.2 CSV Export Endpoints & Formula Injection Defense (CWE-1236)
- **Endpoints**:
  - `GET /api/admin/reports/audit-logs/export`
  - `GET /api/admin/reports/workflow/export`
  - `GET /api/admin/reports/incidents/export`
- **Security Defense**: When exporting CSV records, spreadsheet applications (Microsoft Excel, LibreOffice Calc, Google Sheets) can execute malicious code if a cell starts with `=`, `+`, `-`, or `@`.
  Civora enforces cell sanitization via `sanitizeCsvCell()`:
  ```ts
  function sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();
    if (str.length > 0 && ['=', '+', '-', '@'].includes(str.charAt(0))) {
      str = "'" + str; // Prefix with apostrophe to force plain text rendering
    }
    return `"${str.replace(/"/g, '""')}"`;
  }
  ```
- **Performance & Sizing**: Exports are bounded to the 5,000 most recent records per request, with streamed or buffered generation preventing memory exhaustion.

---

## 7. Frontend Administration Console

The frontend provides a multi-tabbed administration suite in `client/src/pages/AdminSystemPage.tsx` accessible to `ADMIN` users at `/admin/system` (or `/admin/health`):

1. **System Overview & Health Tab (`overview`)**:
   - Real summary metrics (Total Registered Users, Active Accounts, Total Complaints, Awaiting Action, Overdue Cases, Open Incidents).
   - Core health banner displaying backend service version, database connectivity, latency, and readiness status.
   - Quick action to trigger SLA Batch Evaluation.
   - Recent administrative audit actions and open incidents preview.
2. **Platform Configuration Tab (`config`)**:
   - Settings grouped by General, Maintenance, Workflow, and Security.
   - Modal for updating settings with required justification reasons.
   - High-impact confirmation modal for toggling Maintenance Mode.
   - Configuration Change History table showing setting keys, previous values, new values, reasons, actors, and timestamps.
3. **User & Role Administration Tab (`users`)**:
   - User table with role and status badges, complaint counts, and registration dates.
   - Role and status filters, name/email search, and pagination.
   - Role change modal with safeguard warnings.
   - Account suspension / reactivation modal requiring mandatory operational reason.
4. **Operational Health Tab (`health`)**:
   - Server uptime, database latency, Node.js runtime, OS platform, memory RSS and heap usage.
   - Live database record counts (Complaints, Users, Departments, SLA policies, Escalations, Open Incidents).
   - Security disclosure explaining diagnostic data isolation.
5. **Audit Trail Explorer Tab (`audit`)**:
   - Filterable, searchable, and paginated table of administrative actions.
   - "Inspect" modal displaying formatted JSON details and correlation ID.
   - One-click CSV export button.
6. **Operational Incidents Tab (`incidents`)**:
   - Incident list with severity badges (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and status badges (`OPEN`, `INVESTIGATING`, `MONITORING`, `RESOLVED`).
   - "Log Operational Incident" modal with Crockford identifier generation.
   - Status update and resolution modal requiring resolution notes for resolved incidents.
   - One-click CSV export button.
7. **Reports & Exports Tab (`reports`)**:
   - Three dedicated export cards for Audit Logs, Complaint Workflow, and Incidents.
   - Explanation of CWE-1236 Formula Injection defense.

---

## 8. Verification & Test Execution

Automated test suite: `server/test/admin.test.ts` (24 dedicated tests covering RBAC, health, configuration, maintenance mode, user management, incidents, audit logs, and CSV exports).

### Test Results
```
# tests 241
# suites 68
# pass 241
# fail 0
# cancelled 0
# skipped 0
# duration_ms 14572.9903
```
Full server build (`npm run build` in `server/`) and client build (`npm run build` in `client/`) succeed with zero TypeScript or bundling errors.
