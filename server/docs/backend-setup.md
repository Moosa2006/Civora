# Civora Backend Setup & Database Guide

## 1. Overview & Technology Stack

The Civora backend provides the civic issue reporting API and public accountability data layer.

- **Runtime:** Node.js (v20+ or v22 LTS tested)
- **Framework:** Express 4.21+ with TypeScript (NodeNext ESM)
- **Database:** PostgreSQL 15+ (Database name: `Cevora`)
- **ORM:** Prisma 6.19.3
- **Test Runner:** Node.js built-in test runner (`tsx --test`)
- **Development Server:** `tsx watch`

---

## 2. Environment Configuration

1. In the `server/` directory, copy `.env.example` to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure local variables in `server/.env` without committing secrets:
   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_ORIGIN=http://localhost:5173
   DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5432/Cevora?schema=public"
   JWT_SECRET="development_jwt_secret_min_32_characters_here"
   JWT_EXPIRES_IN=7d
   STORAGE_PROVIDER=local
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE_MB=5
   ```
3. Never commit or push `.env` to version control.

---

## 3. Database Schema, Migration & Diagnostics

### Initial Migration Fix (`20261016000000_init_civora_schema`)
- **Resolved Issue:** Prisma error `P3006` occurred when applying the initial migration to the shadow database due to a UTF-8 Byte Order Mark (BOM: `0xEF 0xBB 0xBF`) prepended during Windows PowerShell generation.
- **Correction Applied:** The BOM header was stripped, leaving clean UTF-8 text without modifying the schema or dropping existing tables. The migration successfully applied to both the shadow database and the live `Cevora` database.

### Useful Database Commands
Run these commands from `server/` (or via root package shortcuts):

- **Validate Prisma Schema:**
  ```bash
  npm run db:validate
  # or: npx prisma validate
  ```
- **Generate Prisma Client:**
  ```bash
  npm run db:generate
  # or: npx prisma generate
  ```
- **Apply Migrations in Development:**
  ```bash
  npm run db:migrate
  # or: npx prisma migrate dev
  ```
- **Deploy Migrations in CI/Production:**
  ```bash
  npm run db:deploy
  # or: npx prisma migrate deploy
  ```
- **Launch Prisma Studio (GUI):**
  ```bash
  npm run db:studio
  # or: npx prisma studio
  ```

---

## 4. Seeding Test Dummy Data

Civora includes an idempotent database seeding script that populates 11 core categories with relational integrity:

```bash
# From server/
npm run db:seed

# Or from project root
npm run db:seed
```

### Seeded Development Entities:
1. **Departments (5):**
   - `PWD`: Public Works Department
   - `WSSB`: Water Supply & Sewerage Board
   - `SAN`: Solid Waste Management & Sanitation
   - `ESL`: Electrical & Street Lighting
   - `TPI`: Town Planning & Public Infrastructure
2. **Complaint Categories (5):**
   - `ROADS_POTHOLES` (Roads, Footpaths & Potholes)
   - `DRAINAGE_OVERFLOW` (Drainage & Waterlogging)
   - `GARBAGE_DUMPING` (Garbage & Waste Disposal)
   - `STREETLIGHT_OUTAGE` (Streetlights & Electrical Hazards)
   - `INFRASTRUCTURE_DAMAGE` (Parks & Public Property)
3. **Fictional Test Accounts (6):**
   - **Citizens:** `aarav.sharma@example.com`, `priya.patel@example.com`, `rahul.verma@example.com`
   - **Officials:** `rajesh.kumar@example.com` (PWD), `sunita.rao@example.com` (SAN)
   - **Admin:** `admin.meera@civora.local` (System Admin)
   - *Note: Passwords use a development-only mock hash and are never valid for production.*
4. **Fictional Complaints (6):**
   - `CIV-2026-00101`: Deep pothole on 4th Main Road (Status: `ASSIGNED`)
   - `CIV-2026-00102`: Overflowing community garbage bin (Status: `IN_PROGRESS`)
   - `CIV-2026-00103`: Broken streetlights (Status: `SUBMITTED`)
   - `CIV-2026-00104`: Burst water pipeline (Status: `UNDER_REVIEW`)
   - `CIV-2026-00105`: Broken footpath slabs (Status: `RESOLVED`)
   - `CIV-2026-00106`: Construction debris in park (Status: `CLOSED`)
5. **Municipal Civic Works, Inspections & Execution:**
   - Civic Work: `CW-2026-0042` (Road Resurfacing & Drainage Restoration on 4th Main Road)
   - Complaint-to-Project M:N Link connecting `CIV-2026-00101` to `CW-2026-0042`
   - Site Inspection & Technical Assessment by Engineer Rajesh Kumar
   - Estimate: `EST-2026-0089` with 2 detailed line items
   - Technical Sanction Approval: `APV-2026-0034`
   - Contractor: `Apex Urban Infrastructure Ltd` (`REG-2024-KA-8810`)
   - Work Order: `WO-2026-0012` with Physical Progress Update (65.5%)
   - Treasury Financial Transaction: `TREASURY-2026-Q3-0914`
   - Document metadata and audit logs

The seed script is safe to rerun multiple times without duplicating records or throwing constraint errors.

---

## 5. Starting the Backend Server

```bash
# In server/
npm run dev
```

The server starts on port `5000` (or `PORT` from `.env`).

---

## 6. API Endpoints

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Description:** Verifies Express server status and executes an active database ping (`SELECT 1`) to report PostgreSQL connectivity and query latency.
- **Response Example (200 OK):**
  ```json
  {
    "success": true,
    "status": "ok",
    "service": "civora-backend",
    "version": "0.1.0",
    "timestamp": "2026-10-16T16:32:00.000Z",
    "data": {
      "api": "ok",
      "database": "connected",
      "latencyMs": 14
    },
    "database": {
      "status": "connected",
      "latencyMs": 14
    }
  }
  ```

### 2. Metadata Endpoints
- `GET /api/meta/departments`: List active municipal departments.
- `GET /api/meta/categories`: List complaint categories with assigned department metadata.
- `GET /api/meta/stats`: Returns live counts of active departments, categories, complaints, and civic works.

### 3. Error Responses
Unmatched routes or errors return structured JSON:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found on endpoint: /api/invalid"
  }
}
```

---

## 7. Running Tests

To run the automated test suite using Node's native test runner:

```bash
# In server/
npm test

# From root
npm run test:server
```
