# CIVORA — PRODUCTION SECURITY & COMPLIANCE CHECKLIST

**Project**: Civora Civic Issue Reporting and Public Accountability Platform  
**Target Environments**:  
- Frontend: Vercel (`https://civora-tau.vercel.app`)  
- Backend API: Render (`https://civora-l06w.onrender.com`)  
- Database: Supabase PostgreSQL (Managed Postgres, Port 6543 Supavisor Pooler & Direct Port 5432)  
**Document Reference**: CIVORA-PROD-SEC-2026-11-02  
**Classification**: Production Operational Security Standards  

---

## 1. Network & Origin Security Boundary

- [x] **CORS Configuration**:
  - `allowedOrigins` strictly configured in `server/src/app.ts`.
  - Permitted origins:
    - Production: `https://civora-tau.vercel.app`
    - Vercel Preview Deployments: `https://civora-*-tau.vercel.app` (validated via regex `^https:\/\/civora(-[a-z0-9-]+)?\.vercel\.app$`)
    - Local Development: `http://localhost:5173`, `http://localhost:3000` (when `NODE_ENV !== 'production'`)
  - Wildcard `*` origins with credentials explicitly disallowed.
- [x] **CSRF Origin Validation**:
  - State-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) verified against origin allowlist via middleware.
  - Foreign origin headers rejected with HTTP 403 `CSRF_ORIGIN_DENIED`.
- [x] **HTTP Strict Transport Security (HSTS)**:
  - Enforced in `vercel.json`: `max-age=31536000; includeSubDomains; preload`.
  - Enforced on Render via reverse proxy and HTTPS redirects.
- [x] **Content Security Policy (CSP)**:
  - Configured in `vercel.json` with restricted `default-src 'self'`.
  - `connect-src` limited to `'self'`, `https://civora-l06w.onrender.com`, `https://*.tile.openstreetmap.org`.
  - `img-src` allows data URIs and trusted blob URLs for photographic evidence previews.
- [x] **Permissions Policy**:
  - Configured in `vercel.json` and Express middleware:
    `camera=(self), geolocation=(self), microphone=(), payment=(), usb=()`.

---

## 2. Authentication, Session & Access Control (RBAC)

- [x] **Dual Authentication Support**:
  - Desktop Chrome / standard environments: Secure HttpOnly SameSite cookie (`civora_auth_token`).
  - iOS Safari / Private Browsing / Partitioned Storage: `Authorization: Bearer <token>` fallback supported seamlessly.
  - Tokens strictly stripped from cross-origin requests by the frontend fetch interceptor.
- [x] **Password Hashing**:
  - Bcrypt hashing with cost factor ≥ 10 for all stored passwords.
  - Salt auto-generated per user record; plaintext passwords never logged or persisted.
- [x] **Privileged Role Separation**:
  - User roles enforced via Prisma enum: `CITIZEN`, `GOVERNMENT_OFFICIAL`, `CONTRACTOR`, `ADMIN`.
  - Route-level middleware (`requireRoles`) blocks unauthorized access with HTTP 403 `FORBIDDEN`.
  - Privileged actions (triage, department reassignment, tender award, sanction approvals) restricted to `ADMIN` and `GOVERNMENT_OFFICIAL`.
- [x] **Privileged Audit Logging**:
  - Successful logins for `ADMIN` and `GOVERNMENT_OFFICIAL` accounts emit `ADMIN_PRIVILEGED_LOGIN` and `OFFICIAL_PRIVILEGED_LOGIN` audit records in the database.
- [x] **Contractor Application Protection**:
  - `GET /api/auth/contractor-application-status` requires authenticated session or signed `statusToken`.
  - Unauthenticated queries by email or registration number strictly rejected with HTTP 401.

---

## 3. Data Privacy & Citizen Confidentiality

- [x] **GPS & Coordinate Redaction (S01)**:
  - Anonymous tracking endpoint (`/api/complaints/track/:trackingId`) strictly excludes `captureLatitude`, `captureLongitude`, and `captureAccuracy`.
  - Exact coordinates only returned to the complaint author or assigned municipal staff.
- [x] **Photographic EXIF Stripping**:
  - Public JPEG evidence downloads automatically stripped of APP1 EXIF/GPS segments using in-memory parsing.
- [x] **Private Location Masking**:
  - Complaints marked `isLocationPublic: false` display street address as `[Private Location in <Ward/Locality>]` to public viewers.
- [x] **PII Concealment**:
  - Public tracking and transparency views expose zero citizen contact info (no reporter name, email, or telephone number).

---

## 4. Complaint Lifecycle & Integrity Safeguards

- [x] **Idempotency Enforcement (L01 & L02)**:
  - Client generates a stable session idempotency key per filing draft.
  - Backend verifies `idempotencyKey` on `POST /api/complaints`, returning existing complaint on duplicate submissions.
- [x] **Evidence Upload Recovery**:
  - If photo upload encounters network or server errors, complaint record is preserved, draft is kept, and the UI provides a direct photo re-upload retry without creating duplicate complaints.
- [x] **Consolidated Issue State Reflection (L03)**:
  - Child complaints in public transparency lists reflect the effective status and assigned department of their consolidated master complaint.
- [x] **SLA Policy Transparency (L04)**:
  - Complaints without an SLA policy are explicitly represented as `NO_SLA` with "No Configured SLA", preventing `Invalid Date` and misleading "On Track" displays.
- [x] **Municipal Jurisdiction Declaration (L05)**:
  - Canonical municipality `Bruhat Bengaluru Mahanagara Palike (BBMP)` declared across client and server configurations.

---

## 5. Procurement & Contractor Execution Safeguards

- [x] **Tender Award Window Enforcement (L07)**:
  - `awardTender` rejects attempts to award contracts while `now < tender.submissionDeadline` with HTTP 400 `BIDDING_WINDOW_ACTIVE`.
  - Awards require active, verified contractors (`status === 'ACTIVE'`, `isVerified === true`) and matching work categories.
- [x] **Milestone Execution Prerequisites (L08)**:
  - Milestone completion claims require official physical work-start verification (`status === 'VERIFIED'`).
  - Predecessor milestones must be `APPROVED` or `COMPLETED` before subsequent milestones can be claimed.
- [x] **Workflow Action Availability**:
  - Official workspace hides action buttons on terminal `REJECTED` and `CLOSED` complaints.
  - Contractor workspace disables milestone claims with explanatory tooltips when prerequisites are unmet.

---

## 6. Infrastructure, Database & Cache Management

- [x] **Supabase Database Connection**:
  - Transaction pooling port 6543 with `?pgbouncer=true` used for runtime queries.
  - Direct connection port 5432 reserved for migrations and schema tooling.
  - Prepared statement naming conflicts prevented under pooling.
- [x] **Cache Control on Authenticated Routes**:
  - Enforced `Cache-Control: private, no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0` on all authenticated endpoints.
- [x] **Rate Limiting**:
  - Express rate limiting active on public auth, registration, and complaint filing routes to prevent brute-force attacks and volumetric abuse.
- [x] **Image Asset Optimization**:
  - Public hero graphic optimized to WebP format (`202 KB` vs original `1.54 MB`), reducing mobile data overhead and LCP.

---

## 7. Emergency Incident Response & Monitoring

1. **Database Degradation Detection**:
   - Database latency dynamically monitored in `AdminSystemPage.tsx`. Latencies > 1000ms flag `Connection degraded (High Latency)` in real time.
2. **Audit Trail Immutability**:
   - All state transitions, role assignments, tender awards, and milestone approvals record append-only `AuditEvent` rows with actor ID, timestamp, and metadata payload.
3. **Rollback Readiness**:
   - Zero destructive schema changes executed. Application builds compile cleanly (`client` 0 errors, `server` 0 errors).

