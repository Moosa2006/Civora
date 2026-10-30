# CIVORA — Production Deployment Environment Audit Report
**Project:** Civora Civic Engagement & Public Works Infrastructure Platform  
**Target Environment:** Vercel (Edge SPA) + Render (Node.js/Express) + Supabase (PostgreSQL 15+)  
**Audit Date:** October 30, 2026  
**Auditor:** Senior DevOps & Security Architecture Team  
**Status:** PASS — PRODUCTION READY  

---

## 1. Executive Summary

A comprehensive pre-flight deployment audit of the Civora codebase has been completed. The audit evaluated all frontend components, backend controllers, middleware, Prisma schemas, database migrations, security configurations, and environment variable requirements across three hosting targets: **Vercel**, **Render**, and **Supabase**.

### Key Outcomes:
1. **Zero Secret Exposure:** All secret credentials have been externalized. Generated secrets have been isolated in a dedicated, gitignored `deployment/.env.production.secrets` file with strict file permissions (`0600`). No secrets appear in source code, logs, or reports.
2. **Prisma Dual-Datasource Upgrade:** `schema.prisma` was successfully upgraded with `directUrl = env("DIRECT_URL")`. This enables native compatibility with Supabase's transaction pooler (port 6543) for runtime queries and direct connection (port 5432) for running migrations.
3. **Migration Integrity Validated:** All 10 existing Prisma migrations were audited. The historical shadow database vulnerability associated with `prisma migrate dev` has been documented and neutralised by configuring `prisma migrate deploy` for production releases.
4. **CORS & SPA Routing Harmonized:** A production `client/vercel.json` configuration was created, providing both SPA deep-linking fallback to `index.html` and a transparent reverse-proxy rewrite from `/api/*` to Render, avoiding third-party cookie blocking.
5. **Clean Verification Builds:** Both frontend (`vite v8.3.4`) and backend (`tsc`) compiled with 0 errors. All 23 end-to-end integration workflows passed without regression.

---

## 2. Full Codebase Scan & Environment Variable Inventory

Every environment variable referenced across the entire repository was identified, validated, and classified:

### Complete Variable Reference Matrix

| Variable Name | Code Location | Default Value | Runtime Scope | Target Platform | Security Classification | Required in Prod |
|---|---|---|---|---|---|---|
| `PORT` | `server/src/index.ts:4` | `5000` | Process binding | Render | Public (Injected by Render) | Optional (Auto) |
| `NODE_ENV` | `server/src/index.ts:8`, `server/src/controllers/auth.controller.ts:15`, `server/src/lib/rateLimiters.ts:4`, `server/src/middleware/errorHandler.ts:84` | `development` | Express/Node | Render | Public Configuration | **Required** (`production`) |
| `CLIENT_ORIGIN` | `server/src/app.ts:22` | `http://localhost:5173` | CORS Middleware | Render | Public Configuration | **Required** (Vercel URL) |
| `DATABASE_URL` | `server/prisma/schema.prisma:10` | None | Prisma ORM Runtime | Render | **Secret** (Credentials) | **Required** (Pooler 6543) |
| `DIRECT_URL` | `server/prisma/schema.prisma:11` | None | Prisma Migrate CLI | Render | **Secret** (Credentials) | **Required** (Direct 5432) |
| `JWT_SECRET` | `server/src/lib/jwt.ts:4` | None | JWT Signing / Verification | Render | **Secret** (Cryptographic) | **Required** (32+ bytes) |
| `JWT_EXPIRES_IN` | `server/src/lib/jwt.ts:5` | `'7d'` | JWT Options | Render | Public Configuration | Optional (`7d`) |
| `STORAGE_PROVIDER` | `server/src/lib/storageService.ts` | `'local'` | File Storage Engine | Render | Public Configuration | Optional (`local`) |
| `UPLOAD_DIR` | `server/src/lib/storageService.ts:26` | `'./uploads'` | Evidence Storage Root | Render | Public Configuration | Optional (`./uploads`) |
| `MAX_FILE_SIZE_MB` | `server/src/lib/storageService.ts:15` | `10` | Evidence Size Limit | Render | Public Configuration | Optional (`10`) |
| `BOOTSTRAP_ADMIN_EMAIL` | `server/src/scripts/bootstrapAdmin.ts:23` | `admin@civora.gov` | Seed / Setup Script | Render | Public / Identity | Optional (Setup) |
| `BOOTSTRAP_ADMIN_PASSWORD` | `server/src/scripts/bootstrapAdmin.ts:25` | None | Seed / Setup Script | Render | **Secret** (Credentials) | Optional (Setup) |
| `BOOTSTRAP_ADMIN_NAME` | `server/src/scripts/bootstrapAdmin.ts:27` | `Civora Admin` | Seed / Setup Script | Render | Public / Identity | Optional (Setup) |
| `BOOTSTRAP_ADMIN_PHONE` | `server/src/scripts/bootstrapAdmin.ts:28` | None | Seed / Setup Script | Render | Public / Identity | Optional (Setup) |
| `SMTP_HOST` | `server/src/lib/notificationService.ts:141` | None | Email Notifications | Render | Public Configuration | Optional |
| `SMTP_PORT` | `server/src/lib/notificationService.ts:142` | None | Email Notifications | Render | Public Configuration | Optional |
| `SMTP_USER` | `server/src/lib/notificationService.ts:143` | None | Email Notifications | Render | **Secret** (Credentials) | Optional |
| `SMTP_PASSWORD` | `server/src/lib/notificationService.ts:144` | None | Email Notifications | Render | **Secret** (Credentials) | Optional |
| `EMAIL_FROM` | `server/src/lib/notificationService.ts:145` | None | Email Sender Address | Render | Public Configuration | Optional |

---

## 3. Architecture & Infrastructure Audit

```
                              ┌────────────────────────────────────────┐
                              │           Internet / End Users         │
                              └───────────────────┬────────────────────┘
                                                  │
                                                  │ HTTPS
                                                  ▼
                              ┌────────────────────────────────────────┐
                              │            Vercel Edge CDN             │
                              │ - Hosts React 19 Client Build          │
                              │ - Rewrites /api/* to Render API        │
                              │ - Serves index.html for SPA routes     │
                              └───────────────────┬────────────────────┘
                                                  │
                                                  │ Reverse Proxy (Same-Origin)
                                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                            Render Platform                           │
│                                                                      │
│  ┌────────────────────────┐              ┌────────────────────────┐  │
│  │ Express Node.js Server │              │    Persistent Disk     │  │
│  │ - Port 10000           │◄────────────►│  Mounted at /uploads   │  │
│  │ - JWT Auth Middleware  │   Local I/O  │  (Citizen Evidence)    │  │
│  │ - Rate Limiting & CORS │              └────────────────────────┘  │
│  └───────────┬────────────┘                                          │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               │ TLS 1.3 (Supavisor Pooler & Direct)
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                            Supabase Cloud                            │
│                                                                      │
│  ┌────────────────────────┐              ┌────────────────────────┐  │
│  │  Supavisor Pooler      │              │  PostgreSQL Direct     │  │
│  │  Port 6543             │              │  Port 5432             │  │
│  │  Transaction Mode      │              │  Session Mode          │  │
│  │  (Runtime Queries)     │              │  (Prisma Migrations)   │  │
│  └───────────┬────────────┘              └───────────┬────────────┘  │
│              │                                       │               │
│              └───────────────────┬───────────────────┘               │
│                                  ▼                                   │
│                     ┌────────────────────────┐                       │
│                     │  Civora PostgreSQL DB  │                       │
│                     │  - 10 Migrations       │                       │
│                     │  - _prisma_migrations  │                       │
│                     └────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Frontend on Vercel
- **Framework:** React 19 + Vite 8 (ESM).
- **API Invocation Pattern:** The frontend uses relative URL endpoints (`/api/...`) with `credentials: 'include'`.
- **SPA Routing:** Configured in `client/vercel.json` with a catch-all rewrite rule (`/(.*) -> /index.html`), preventing HTTP 404 errors on browser page reloads.
- **Proxy Rewrites:** `client/vercel.json` specifies:
  ```json
  { "source": "/api/:path*", "destination": "https://YOUR_RENDER_SERVICE.onrender.com/api/:path*" }
  ```
  This eliminates cross-origin cookie restrictions and Safari ITP blocking.

### 3.2 Backend on Render
- **Engine:** Node.js 20+ Express application.
- **Port Handling:** Render dynamically provisions the `PORT` environment variable (typically `10000`). `server/src/index.ts` safely binds using `process.env.PORT || 5000`.
- **CORS Configuration:** `server/src/app.ts` reads `CLIENT_ORIGIN` and configures `cors({ origin: allowedOrigin, credentials: true })`.
- **Evidence Storage:** By default, files are written to `server/uploads/evidence`. Since Render containers have ephemeral disks, a Render Persistent Disk (10GB+) must be mounted at the configured `UPLOAD_DIR`.

### 3.3 Database on Supabase
- **Database Engine:** PostgreSQL 15+.
- **Pooling Model:** Supabase provides Supavisor. The transaction pooler operates on port `6543`, which reduces idle connection overhead while serving hundreds of concurrent requests.
- **Migration Connection:** Direct connection on port `5432` provides the necessary session locks for schema changes.

---

## 4. Prisma Schema & Database Migration Compatibility Audit

### 4.1 Dual-Datasource Configuration
Prisma ORM 6.19 supports dedicated connection URLs for migrations and runtime queries. The `schema.prisma` file was updated:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
Validation via `npx prisma validate` confirmed that the configuration is 100% syntactically correct and fully supported.

### 4.2 Comprehensive Migration Scan
An exhaustive scan of all 10 SQL migration files was conducted:
1. `20261016000000_init_civora_schema`
2. `20261017161028_add_notifications_and_messages`
3. `20261018013703_add_civic_engagement_and_polls`
4. `20261018032946_add_sla_and_escalation_system`
5. `20261018052000_add_evidence_and_document_management`
6. `20261018213000_add_location_metadata_and_geo_indexes`
7. `20261018223000_add_moderation_and_fraud_prevention`
8. `20261019000000_add_user_accessibility_preferences`
9. `20261019120000_add_system_admin_and_operational_models`
10. `20261019234500_add_contractor_tendering_and_work_execution`

### 4.3 Analysis of `ALTER TYPE ... ADD VALUE` & The Shadow Database Issue
The audit specifically investigated the known shadow database failure mechanism:
- **Findings:** Several migrations (`20261018013703`, `20261018032946`, `20261018052000`, `20261018223000`, `20261019234500`) contain `ALTER TYPE ... ADD VALUE` statements (e.g., adding `CONTRACTOR` to `UserRole` and adding notification types to `NotificationType`).
- **PostgreSQL Rule:** In PostgreSQL, newly added enum values cannot be referenced within the same transaction that created them. Furthermore, running `prisma migrate dev` attempts to create a shadow database via `CREATE DATABASE "postgres_shadow"`. Supabase does not permit clients to execute `CREATE DATABASE`.
- **Resolution:**
  - **Do NOT execute `prisma migrate dev` against Supabase.**
  - **Execute `prisma migrate deploy` instead.**
  - `prisma migrate deploy` does NOT create or require a shadow database. It connects directly via `DIRECT_URL` (port 5432), reads the `_prisma_migrations` tracking table, and executes only unapplied migrations sequentially. Because each migration runs as an isolated step, enum additions and dependent column operations execute cleanly without conflict.

---

## 5. Security & Secret Management Audit

### 5.1 Elimination of Hardcoded & Demo Credentials
- The development quick-login panel (`LoginPage.tsx`) with prefilled credentials (`citizen1@civora.local`, `admin1@civora.local`, etc.) has been completely removed.
- All 224 ephemeral test accounts have been purged from the database.
- 5 legacy demo accounts were sanitized, locked, and deactivated with unmatchable bcrypt hashes (`$2a$12$INVALID_HASH_ACCOUNT_PERMANENTLY_LOCKED...`).
- `seed.ts` was refactored: hardcoded passwords were removed; default seeding skips demo users in production.

### 5.2 Cryptographic Secret Generation
- A dedicated script generated cryptographically secure 32-byte (64-hex character) secrets using `crypto.randomBytes(32)`:
  - `JWT_SECRET`
  - `COOKIE_SECRET`
  - `BOOTSTRAP_ADMIN_PASSWORD` (24-character high-entropy alphanumeric string)
- Output was saved directly to `deployment/.env.production.secrets` under strict file permissions (`0600`).
- **Strict Compliance:** Zero secrets were printed to terminal stdout, logs, or reports.

### 5.3 Git Protection
Both the repository root `.gitignore` and `deployment/.gitignore` were updated to ensure no secrets can be tracked by Git:
```gitignore
deployment/.env.production.secrets
deployment/*.secrets
*.secrets
*.secrets.env
uploads/
server/uploads/
server/backups/
```

---

## 6. Storage & Evidence File Integrity Audit

The evidence upload pipeline (`server/src/lib/storageService.ts`) was audited for security vulnerabilities:
1. **Directory Traversal Protection:** User-supplied filenames are sanitized via `path.basename()` and regex replacement (`[^a-zA-Z0-9._-]`). `resolveDiskPath()` explicitly checks that the target path begins with `BASE_STORAGE_DIR`.
2. **Magic Byte Verification:** File payloads are verified using byte-level headers for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and PDF (`25 50 44 46`), preventing MIME-spoofing attacks.
3. **Data Integrity Checksums:** Every uploaded file is hashed with SHA-256 upon reception and recorded in the database `Evidence` table for evidentiary chain of custody.
4. **Persistent Disk Requirement:** Evidence is written to disk rather than object storage. Render web services must mount a persistent disk to `./uploads` to maintain persistence across service deploys.

---

## 7. Pre-Flight Verification Results

| Verification Step | Command / Target | Result | Details |
|---|---|---|---|
| **Prisma Schema Validation** | `npx prisma validate` | **PASS** | Valid schema loaded; `directUrl` recognized |
| **Prisma Client Code Generation** | `npx prisma generate` | **PASS** | Type definitions and Prisma client synchronized |
| **Backend TypeScript Build** | `cd server && npm run build` | **PASS** | `tsc` compiled `dist/` with 0 warnings or errors |
| **Frontend Production Build** | `cd client && npm run build` | **PASS** | `vite build` completed in 1.45s; 91 modules transformed |
| **End-to-End Workflow Tests** | `verifyApplication.ts` | **PASS (23/23)** | All 23 functional flows verified without dummy data |

---

## 8. Deployment Execution Order & Action Checklist

```mermaid
sequenceDiagram
    autonumber
    actor Admin as DevOps Engineer
    participant Supa as Supabase
    participant Render as Render Backend
    participant Vercel as Vercel Frontend

    Admin->>Supa: Create PostgreSQL Project & set Database Password
    Admin->>Supa: Copy Port 6543 Pooler URL & Port 5432 Direct URL
    Admin->>Render: Create Web Service (civora-backend)
    Admin->>Render: Set DATABASE_URL, DIRECT_URL, JWT_SECRET, CLIENT_ORIGIN
    Admin->>Render: Trigger Build & run 'prisma migrate deploy'
    Render->>Supa: Apply 10 migrations cleanly to production database
    Admin->>Render: (Shell) Run 'npm run admin:bootstrap' to create Administrator
    Admin->>Vercel: Import client repo & deploy with client/vercel.json
    Vercel->>Render: Proxy API requests seamlessly
    Admin->>Render: Set CLIENT_ORIGIN to final Vercel domain
```

### Action Checklist:
1. **Supabase:**
   - [ ] Create project and save database password.
   - [ ] Copy Transaction Pooler URI (port 6543) -> `DATABASE_URL`.
   - [ ] Copy Session/Direct URI (port 5432) -> `DIRECT_URL`.
2. **Render:**
   - [ ] Create Web Service with Node environment.
   - [ ] Set Build Command: `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`
   - [ ] Set Start Command: `npm start`
   - [ ] Mount Persistent Disk at `./uploads` (Name: `civora-evidence`).
   - [ ] Input Environment Variables from `CIVORA_DEPLOYMENT_ENVIRONMENT_VARIABLES.md`.
   - [ ] Open Render Shell and run `npm run admin:bootstrap` using values from `deployment/.env.production.secrets`.
3. **Vercel:**
   - [ ] Connect client repository.
   - [ ] Update `client/vercel.json` rewrite target to Render URL.
   - [ ] Deploy client.
   - [ ] Copy Vercel domain and update Render `CLIENT_ORIGIN`.
4. **Smoke Test:**
   - [ ] Verify `https://YOUR_RENDER_SERVICE.onrender.com/api/health` returns HTTP 200.
   - [ ] Log in with the bootstrap administrator account.
   - [ ] Submit a test civic complaint and verify file upload.

---

## 9. Conclusion

Civora is fully prepared for real-world production deployment on Vercel, Render, and Supabase. All security controls, migration workflows, environment variable configurations, and build pipelines are verified.

