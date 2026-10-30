# CIVORA — Master Production Deployment & Environment Variable Guide
**Target Architecture:** Vercel (Frontend) + Render (Node.js/Express Backend) + Supabase (PostgreSQL & Storage)  
**Status:** Production Ready  
**Security Level:** High / Zero-Secret Exposure  

---

## 1. Architecture Overview

Civora is deployed using a decoupled, enterprise cloud architecture designed for high availability, zero cold-start delay for the database, and strict separation of concerns:

```
┌─────────────────────────────────┐
│         Vercel (Edge)           │
│  - React 19 + Vite SPA (Client) │
│  - client/vercel.json Rewrites  │
└────────────────┬────────────────┘
                 │ Same-Origin Proxy (/api/*) & CORS
                 ▼
┌─────────────────────────────────┐
│          Render (Cloud)         │
│  - Express 4.21 API Backend     │
│  - Node.js ESM Engine           │
│  - Persistent Disk (/uploads)   │
└────────────────┬────────────────┘
                 │ Connection Pooling (Port 6543) / Direct (Port 5432)
                 ▼
┌─────────────────────────────────┐
│         Supabase (Cloud)        │
│  - PostgreSQL 15+ Enterprise    │
│  - Supavisor Connection Pooler  │
│  - Prisma ORM 6.19 Runtime      │
└─────────────────────────────────┘
```

---

## Section A: Master Environment Variable Inventory

| Variable Name | Target Platform | Required / Optional | Lifecycle Stage | Secret vs Public | Purpose & Code Reference | Expected Format / Example | Status |
|---|---|---|---|---|---|---|---|
| `PORT` | Render | Optional (Render injects) | Runtime | Public | Express HTTP port binding (`server/src/index.ts:4`) | Integer (`10000` or `5000`) | `AUTO (Render)` |
| `NODE_ENV` | Render | **Required** | Runtime | Public | Sets production optimizations, cookie security, disables stacktraces (`server/src/index.ts:8`) | `production` | `READY` |
| `CLIENT_ORIGIN` | Render | **Required** | Runtime | Public | CORS allowed origin for HTTP credentials/cookies (`server/src/app.ts:22`) | URL (`https://civora-tau.vercel.app`) | `READY (https://civora-tau.vercel.app)` |
| `DATABASE_URL` | Render | **Required** | Runtime | **Secret** | Pooled PostgreSQL connection via Supavisor port 6543 for app queries (`schema.prisma:10`) | `postgresql://postgres.[REF]:[PASS]@[HOST]:6543/postgres?pgbouncer=true` | `PENDING (Supabase Pooler)` |
| `DIRECT_URL` | Render | **Required** | Build/Deploy | **Secret** | Direct PostgreSQL connection via port 5432 for `prisma migrate deploy` (`schema.prisma:11`) | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres` | `PENDING (Supabase Direct)` |
| `JWT_SECRET` | Render | **Required** | Runtime | **Secret** | HMAC-SHA256 signature key for auth cookies/tokens (`server/src/lib/jwt.ts:4`) | 64-character hexadecimal (32 random bytes) | `GENERATED (deployment/.env.production.secrets)` |
| `JWT_EXPIRES_IN` | Render | Optional | Runtime | Public | Token validity duration (`server/src/lib/jwt.ts:5`) | Duration string (`7d`, `24h`) | `READY (Default: 7d)` |
| `STORAGE_PROVIDER` | Render | Optional | Runtime | Public | Storage driver type (`server/src/lib/storageService.ts`) | `local` | `READY (Default: local)` |
| `UPLOAD_DIR` | Render | Optional | Runtime | Public | Target storage directory for evidence (`server/src/lib/storageService.ts:26`) | Path string (`./uploads`) | `READY (Default: ./uploads)` |
| `MAX_FILE_SIZE_MB` | Render | Optional | Runtime | Public | Enforced upload file ceiling | Integer (`10`) | `READY (Default: 10)` |
| `BOOTSTRAP_ADMIN_EMAIL` | Render (One-time) | Optional | One-off CLI | Public / Secret | Bootstrap administrator account email (`server/src/scripts/bootstrapAdmin.ts:23`) | Valid email (`admin@civora.gov`) | `READY` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Render (One-time) | Optional | One-off CLI | **Secret** | Bootstrap administrator initial password (`server/src/scripts/bootstrapAdmin.ts:25`) | Cryptographically strong 24-character string | `GENERATED (deployment/.env.production.secrets)` |
| `BOOTSTRAP_ADMIN_NAME` | Render (One-time) | Optional | One-off CLI | Public | Bootstrap administrator display name (`server/src/scripts/bootstrapAdmin.ts:27`) | String (`Platform Administrator`) | `READY` |
| `BOOTSTRAP_ADMIN_PHONE` | Render (One-time) | Optional | One-off CLI | Public | Bootstrap administrator phone number (`server/src/scripts/bootstrapAdmin.ts:28`) | Phone string (`+10000000000`) | `READY` |
| `SMTP_HOST` | Render | Optional | Runtime | Public | Optional external email service host (`server/src/lib/notificationService.ts:141`) | Hostname (`smtp.sendgrid.net`) | `PENDING (Optional)` |
| `SMTP_PORT` | Render | Optional | Runtime | Public | SMTP port | Integer (`587`) | `PENDING (Optional)` |
| `SMTP_USER` | Render | Optional | Runtime | Secret | SMTP username | String | `PENDING (Optional)` |
| `SMTP_PASSWORD` | Render | Optional | Runtime | Secret | SMTP password / API token | String | `PENDING (Optional)` |
| `EMAIL_FROM` | Render | Optional | Runtime | Public | Outbound sender email address | Email (`notifications@civora.gov`) | `PENDING (Optional)` |
| `VITE_API_URL` | Vercel | Optional | Build-time | Public | API Base URL (only needed if rewrites are NOT used; rewrites are default) | URL (`https://civora-api.onrender.com`) | `NOT NEEDED (Rewrites active)` |

---

## Section B: Vercel Frontend Configuration

### 1. SPA Routing & Reverse-Proxy Rewrites (`client/vercel.json`)
The Civora frontend is configured with a unified `vercel.json` file in `client/` that solves two critical production challenges:
1. **Single-Page Application (SPA) Deep Linking:** Direct access or refreshing paths like `/complaints`, `/tenders`, `/track` are rewritten to `/index.html` to prevent 404 errors.
2. **Same-Origin API Reverse Proxy:** Inbound requests to `/api/*` are transparently proxied to the Render backend. This keeps all frontend `fetch('/api/...')` calls same-origin, preserving HTTP-only `sameSite: 'lax'` cookies and bypassing third-party cookie restrictions in Safari, Chrome, and iOS.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/api",
      "destination": "https://civora-l06w.onrender.com/api"
    },
    {
      "source": "/api/:path*",
      "destination": "https://civora-l06w.onrender.com/api/:path*"
    },
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Vercel Dashboard Setup Step-by-Step
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your Git repository.
4. In the **Project Settings**:
   - **Framework Preset:** Vite
   - **Root Directory:** Edit to select `client`
   - **Build Command:** `tsc -b && vite build` (or leave default `npm run build`)
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Click **Deploy**.
6. Once deployed, note your production Vercel domain (e.g., `https://civora.vercel.app` or your custom domain).
7. Update `client/vercel.json` destination with your actual Render service URL.

---

## Section C: Render Backend Web Service Configuration

### 1. Service Specification
- **Service Type:** Web Service
- **Environment:** Node
- **Region:** Choose the region closest to your Supabase project (e.g., `Oregon (US West)` or `Frankfurt (EU)`).
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** Node.js 20+ (ESM enabled)

### 2. Build & Start Commands
- **Build Command:**
  ```bash
  npm install --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy
  ```
  *(Note: `--include=dev` ensures TypeScript and type declarations are installed even when `NODE_ENV=production` is set in Render's environment).*
- **Start Command:**
  ```bash
  npm start
  ```
  *(Executes `node dist/index.js`)*

### 3. Persistent Disk for Evidence Storage
Evidence files (photos, PDFs, documents) are stored in `server/uploads/evidence`. Render web services run on ephemeral containers that discard newly written files upon redeployment or restart.
To preserve citizen and contractor evidence:
1. In the Render Dashboard for your service, navigate to **Disks**.
2. Click **Add Disk**.
3. Configure:
   - **Name:** `civora-evidence-storage`
   - **Mount Path:** `/opt/render/project/src/uploads` (or specify absolute `UPLOAD_DIR`)
   - **Size:** 10 GB (or scale as needed)

### 4. Health Check
- In the **Health Check Path** setting, enter: `/api/health`
- Expected response: HTTP 200 `{"status":"ok","timestamp":"..."}`

### 5. Render Environment Variables Tab
Enter each of the following in Render Dashboard -> **Environment**:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables secure cookies and production error handling |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` | Must match your Vercel deployment domain |
| `DATABASE_URL` | `[SUPABASE_TRANSACTION_POOLER_URL]` | Port 6543 (see Section D) |
| `DIRECT_URL` | `[SUPABASE_DIRECT_SESSION_URL]` | Port 5432 (see Section D) |
| `JWT_SECRET` | `[SECURE_64_CHAR_HEX]` | Retrieved from `deployment/.env.production.secrets` |
| `JWT_EXPIRES_IN` | `7d` | Token expiration period |

---

## Section D: Supabase Database Configuration

### 1. Supavisor Connection Pooling Architecture
Civora uses Prisma ORM with PostgreSQL. In serverless and containerized deployments, connecting directly to PostgreSQL can quickly exhaust maximum connection limits. Supabase provides Supavisor connection pooling.

Civora's `server/prisma/schema.prisma` is configured with dual datasources:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 2. URL Roles & Distinction
1. **`DATABASE_URL` (Port 6543 — Transaction Mode):**
   - **Purpose:** Used by the live Express application at runtime.
   - **Format:**
     ```
     postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Crucial Parameter:** `?pgbouncer=true` tells Prisma to disable prepared statements, which are incompatible with transaction-level connection pooling.
2. **`DIRECT_URL` (Port 5432 — Session Mode / Direct Connection):**
   - **Purpose:** Used exclusively by Prisma CLI when running `npx prisma migrate deploy`.
   - **Format:**
     ```
     postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```
   - **Why required:** Migration operations require advisory locks and table-level modifications that cannot execute in transaction pooler mode.

### 3. Migration Safety: `migrate deploy` vs `migrate dev`
> [!IMPORTANT]
> **NEVER run `prisma migrate dev` or `prisma db push` on Supabase Production.**
> - `prisma migrate dev` attempts to create a temporary shadow database (`CREATE DATABASE postgres_shadow`). Cloud-managed PostgreSQL services like Supabase do not grant permission to create arbitrary databases on the shared cluster, causing shadow database failures.
> - **Correct Command:** `npx prisma migrate deploy`. This command reads already applied migrations from `_prisma_migrations` and safely executes only pending, unapplied migrations against the existing database schema without touching shadow databases.

---

## Section E: Secret Generation & Management

### 1. Generated Secrets
High-entropy cryptographic secrets have been safely generated and stored locally in:
`deployment/.env.production.secrets`

```
File Location: deployment/.env.production.secrets
Permissions: 0600 (Restricted to local user)
Status: Strictly Gitignored via root .gitignore and deployment/.gitignore
```

### 2. What is inside `deployment/.env.production.secrets`
- **`JWT_SECRET`**: 32 cryptographically secure random bytes formatted as a 64-character hexadecimal string (`crypto.randomBytes(32).toString('hex')`).
- **`COOKIE_SECRET`**: 32 cryptographically secure random bytes for session signing.
- **`BOOTSTRAP_ADMIN_PASSWORD`**: 24-character URL-safe high-entropy random password for initial administrator provisioning.

### 3. Secret Rotation Command
If you ever need to generate fresh secrets in the future, run this command from the project root:
```bash
node -e "const c=require('crypto'); console.log('JWT_SECRET=' + c.randomBytes(32).toString('hex')); console.log('ADMIN_PASS=' + c.randomBytes(18).toString('base64url'));"
```

---

## Section F: Pending External Credentials & Dashboard Navigation

Use the exact navigation paths below to retrieve your external credentials from service provider dashboards:

### 1. Supabase Dashboard Click-Path
1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your Civora project (or click **New Project**).
3. **Database Password:**
   - Set during project creation. If forgotten, navigate to **Project Settings** (gear icon bottom left) -> **Database** -> scroll to **Database password** -> click **Reset database password**.
4. **Connection Strings:**
   - Navigate to **Project Settings** -> **Database**.
   - Under **Connection string**, select the **URI** tab.
   - For **`DATABASE_URL`**:
     - Toggle **Mode:** select `Transaction`.
     - Select Port: `6543`.
     - Ensure `?pgbouncer=true` is appended to the connection string.
     - Replace `[YOUR-PASSWORD]` with your real database password.
   - For **`DIRECT_URL`**:
     - Toggle **Mode:** select `Session` (or uncheck Use connection pooling to use port `5432`).
     - Replace `[YOUR-PASSWORD]` with your real database password.

### 2. Render Dashboard Click-Path
1. Navigate to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your repository.
4. Name the service: `civora-backend`.
5. Under **Environment Variables**, click **Add Environment Variable** for each key from Section C.
6. Once deployed, copy your service URL: `https://civora-backend.onrender.com`.

### 3. Vercel Dashboard Click-Path
1. Navigate to [Vercel Dashboard](https://vercel.com).
2. Select your `civora` project.
3. Under **Settings** -> **Domains**, find your production domain (`https://<project-name>.vercel.app`).
4. Copy this domain into Render's `CLIENT_ORIGIN` environment variable.

---

## Section G: Deployment Execution Order

Follow this strict chronological order to avoid service dependency failures:

```mermaid
flowchart TD
    Step1["Step 1: Supabase<br/>1. Create PostgreSQL Project<br/>2. Retrieve Port 6543 Pooler URL<br/>3. Retrieve Port 5432 Direct URL"]
    Step2["Step 2: Secrets Extraction<br/>1. Open deployment/.env.production.secrets<br/>2. Prepare JWT_SECRET & Admin credentials"]
    Step3["Step 3: Render Backend<br/>1. Create Web Service<br/>2. Set DATABASE_URL, DIRECT_URL, JWT_SECRET, CLIENT_ORIGIN<br/>3. Run Build & 'prisma migrate deploy'<br/>4. Verify /api/health responds HTTP 200"]
    Step4["Step 4: Initial Admin Setup<br/>1. Open Render Shell (SSH/Console)<br/>2. Execute: npm run admin:bootstrap<br/>3. Confirm bootstrap admin creation"]
    Step5["Step 5: Vercel Frontend<br/>1. Update client/vercel.json rewrite destination<br/>2. Deploy client project on Vercel<br/>3. Verify SPA routing and API proxying"]
    Step6["Step 6: CORS Synchronization<br/>1. Set Render CLIENT_ORIGIN to exact Vercel domain<br/>2. Trigger fast redeploy on Render"]

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
    Step5 --> Step6
```

---

## Section H: Production Verification Checklist

Run these smoke tests immediately after deployment to guarantee 100% operational readiness:

- [ ] **Health Endpoint:**
  ```bash
  curl -i https://YOUR_RENDER_SERVICE.onrender.com/api/health
  # Expected: HTTP 200 {"status":"ok", ...}
  ```
- [ ] **Database Connection:**
  Verify backend logs on Render. Look for clean startup: `Civora server running on port 10000`.
- [ ] **Frontend Loading:**
  Visit your Vercel URL in an incognito window. Verify the Civic Dashboard loads without console errors.
- [ ] **CORS Verification:**
  Open browser developer tools Network tab on the Vercel site. Ensure API requests to `/api/*` return `Access-Control-Allow-Origin` matching your Vercel URL or run via transparent reverse proxy without CORS blocks.
- [ ] **Authentication Flow:**
  Log in using the bootstrap administrator account credentials from `deployment/.env.production.secrets`. Verify session cookie `civora_token` is attached with `HttpOnly` and `SameSite=Lax`.
- [ ] **Citizen Issue Reporting & File Upload:**
  Submit a test complaint with an attached image (JPG/PNG). Verify the record is saved to PostgreSQL and the image is stored in persistent disk storage.

