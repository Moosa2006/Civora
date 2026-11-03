# CIVORA

<p align="center">
  <img src="client/public/civora_icon.jpeg" alt="Civora Logo" width="120" style="border-radius: 20%;" />
</p>

<h2 align="center">Your Voice. Your City.</h2>
<p align="center"><em>People First. Public Accountability Always.</em></p>

<p align="center">
  <a href="https://civora-tau.vercel.app"><img src="https://img.shields.io/badge/Production%20Web-civora--tau.vercel.app-164e63?style=for-the-badge&logo=vercel" alt="Vercel Deployment" /></a>
  <a href="https://civora-l06w.onrender.com/api/health"><img src="https://img.shields.io/badge/Production%20API-civora--l06w.onrender.com-115e59?style=for-the-badge&logo=render" alt="Render API" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19.2-61dafb?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma%206-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [The Problem We Solve](#-the-problem-we-solve)
- [Civora's Lifecycle Solution](#-civoras-lifecycle-solution)
- [Platform Architecture](#-platform-architecture)
- [Core Portals & Implemented Features](#-core-portals--implemented-features)
  - [1. Citizen Portal](#1-citizen-portal)
  - [2. Government Official Portal](#2-government-official-portal)
  - [3. Contractor Workspace](#3-contractor-workspace)
  - [4. Public Transparency & Civic Map](#4-public-transparency--civic-map)
  - [5. System Administration & Governance](#5-system-administration--governance)
- [User Role Matrix](#-user-role-matrix)
- [Technology Stack](#-technology-stack)
- [Live Deployments](#-live-deployments)
- [Developer Installation & Setup Guide](#-developer-installation--setup-guide)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup (`server/`)](#2-backend-setup-server)
  - [3. Frontend Setup (`client/`)](#3-frontend-setup-client)
  - [4. Verification & Testing](#4-verification--testing)
- [Environment Configuration](#-environment-configuration)
- [Git & Contribution Workflow](#-git--contribution-workflow)
- [Security & Governance](#-security--governance)
- [Project Vision](#-project-vision)

---

## 🌟 Overview

**Civora** is an enterprise-grade civic issue reporting and public accountability platform. It establishes a direct, transparent, and auditable bridge between **Citizens**, **Government Officials**, **Civic Contractors**, and **System Administrators**. 

By digitizing and connecting the entire municipal resolution pipeline—from photographic field reporting to departmental triage, SLA tracking, tendering, contractor milestone verification, and defect liability management—Civora ensures public service delivery remains verifiable, transparent, and strictly accountable to the public.

---

## 🛑 The Problem We Solve

In conventional municipal governance, civic grievance systems frequently suffer from systemic operational bottlenecks:

- **The Information Black Hole**: Citizens file grievances through portals or telephone helplines but receive zero real-time visibility into departmental handoffs, assigned officials, or operational decisions.
- **Fragmented Departmental Coordination**: Complaints bounce ambiguously between departments (e.g., Public Works, Water Board, Electrical) with no single source of truth or shared service level agreements (SLAs).
- **Unverified Resolutions**: Tickets are prematurely marked "Resolved" on administrative dashboards without objective photographic or location-verified proof.
- **Contractor Accountability Deficit**: Civic repair works contracted to third parties lack public tracking for work orders, milestone deliverables, financial disbursements, and warranty periods.
- **Duplicate Grievance Overhead**: Multiple citizens reporting the same pothole, burst pipe, or streetlight failure flood the system with separate tickets rather than consolidating community impact.

> ### 💡 The Core Reality
> **Registering a complaint is not the same as resolving it.**
> True civic governance requires end-to-end operational visibility, physical verification, and public accountability at every step.

---

## 🔄 Civora's Lifecycle Solution

Civora replaces isolated ticketing with a continuous, 7-stage accountability lifecycle:

```
  1. Citizen Report       2. Intelligent Triage     3. Official Assignment    4. Tender & Work Order
 ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
 │ Photo Evidence    │───▶│ Duplicate Cluster │───▶│ Department Routing  │───▶│ Public Bidding      │
 │ Geolocation & Ward│    │ AI Verification   │    │ SLA Timers & Priority│    │ Contractor Award    │
 └───────────────────┘    └───────────────────┘    └─────────────────────┘    └─────────────────────┘
                                                                                         │
  7. Public Audit         6. Citizen Verification   5. Execution & Milestones            │
 ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────────┐               │
 │ Open Data Portal  │◀───│ Feedback & Reopen │◀───│ Work Start Notice   │◀──────────────┘
 │ Financial Ledgers │    │ 2-Step Sign-off   │    │ Photographic Proof  │
 └───────────────────┘    └───────────────────┘    └─────────────────────┘
```

1. **Citizen Reporting**: Citizens report issues with photos, municipal ward selection, exact geocoding, and problem duration assessment.
2. **Intelligent Triage**: The system performs cryptographic (SHA-256) and perceptual (dHash) image matching, flags duplicates, clusters reports, and applies AI verification to filter spam and evaluate visual consistency.
3. **Official Review & SLA Tracking**: Department officers receive prioritized queues with automated SLA countdown clocks and escalation triggers.
4. **Tendering & Contractor Mobilization**: When civic works require outsourced execution, municipal tenders are published, bids are evaluated, and formal work orders are issued.
5. **Execution & Milestone Evidence**: Contractors submit formal work start declarations, daily progress updates, and photographic milestone evidence before payment release.
6. **Multi-Tier Verification**: Completed works require dual verification—technical inspection by municipal engineers followed by citizen confirmation (with one-click ticket reopening if the issue persists).
7. **Public Transparency**: All project costs, departmental performance indices, and civic resolution histories are surfaced on open public dashboards.

---

## 🏛 Platform Architecture

Civora is architected as a high-performance decoupled system with strict separation of concerns, enterprise role-based access control, and resilient database connectivity.

```mermaid
flowchart TD
    subgraph Users ["Actors & Portals"]
        C["Citizens"]
        O["Government Officials"]
        K["Contractors"]
        A["Administrators"]
    end

    subgraph ClientApp ["Frontend Layer (Vercel)"]
        Vite["React 19 + Vite 8 SPA"]
        I18n["Trilingual Localization (EN / HI / PA)"]
        LMap["Leaflet GIS Civic Map"]
        AuthContext["Cross-Device Auth & JWT Storage"]
    end

    subgraph ServerApp ["Backend Layer (Render)"]
        Express["Express.js REST API (Node 22 / TS)"]
        AuthMid["JWT & RBAC Middleware"]
        TriageEngine["Consolidation & Duplicate Detector"]
        StorageEngine["Evidence & Multer File Processor"]
        AuditLog["Tamper-Evident Audit Logger"]
    end

    subgraph Intelligence ["AI & Computer Vision Services"]
        Gemini["Google Gemini AI API (@google/genai)"]
        DHash["Perceptual Image Hash (dHash 64-bit)"]
        CryptoSHA["Cryptographic SHA-256 Digest"]
        EXIF["EXIF Metadata & Geo-Validator"]
    end

    subgraph DatabaseLayer ["Data & Persistence Layer"]
        Prisma["Prisma ORM (v6.19.3)"]
        Supavisor["Supabase Transaction Pooler (Port 6543, pgbouncer=true)"]
        SupabaseDB[("PostgreSQL Database")]
        Uploads[("Evidence Object Storage")]
    end

    Users --> ClientApp
    ClientApp -->|"HTTPS / JSON REST"| Express

    Express --> AuthMid
    AuthMid --> TriageEngine
    AuthMid --> StorageEngine
    AuthMid --> AuditLog

    StorageEngine --> DHash
    StorageEngine --> CryptoSHA
    StorageEngine --> EXIF
    TriageEngine --> Gemini

    Express --> Prisma
    Prisma -->|"Prepared Statement Compatible"| Supavisor
    Supavisor --> SupabaseDB
    StorageEngine --> Uploads
```

---

## 🚀 Core Portals & Implemented Features

### 1. Citizen Portal
- **Streamlined Issue Reporting (`/report`)**: Intuitive reporting form with image upload, municipal ward selector, GPS geocoding, and problem duration assessment.
- **Live Complaint Tracking (`/track`)**: Instant lookup via unique tracking tokens (e.g., `CIV-2026-XXXXX`) displaying complete chronological milestone timelines.
- **My Complaints Hub (`/my-complaints`)**: Personal dashboard for tracking open and resolved complaints, reviewing official inspection notes, and rating resolutions.
- **Civic Engagement Hub (`/engagement`)**: Interactive community module allowing citizens to participate in municipal polls, review civic proposals, vote, and submit grassroots project proposals (`/engagement/proposals/new`).
- **Trilingual Accessibility**: Instant, live language switching across English, Hindi (हिन्दी), and Punjabi (ਪੰਜਾਬੀ).
- **Personalized Notification Inbox (`/notifications`)**: Real-time alerts for status updates, official assignments, and resolution notifications with fine-grained delivery preferences (`/notifications/preferences`).

### 2. Government Official Portal
- **Triage & Department Workspace (`/official/workspace`)**: Centralized workspace for department heads and field engineers with filtered queues (`SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`).
- **Department Routing**: Intelligent routing across Public Works (PWD), Water Supply & Sewerage (DJB), Sanitation, Electrical Services, and Urban Planning.
- **SLA Countdown & Escalation (`/sla`)**: Real-time deadline tracking enforcing municipal citizen charter timelines (e.g., 24h for urgent hazards, 72h for standard repairs).
- **Inspection Reporting & Work Orders**: Field inspection outcome logging (`SATISFACTORY`, `WORK_REQUIRED`, `RESOLVED_ON_SITE`) and administrative work order generation.
- **Resolution Proof Submission**: Enforces mandatory photographic proof and closing remarks before any complaint status can transition to `RESOLVED`.

### 3. Contractor Workspace
- **Public Tender Board (`/tenders`)**: Municipal tender discovery with downloadable specifications, estimated contract values, eligibility criteria, and submission deadlines.
- **Electronic Bid Submission (`/tenders/:id`)**: Formal bid proposal submission including financial quotes, technical execution plans, and equipment declarations.
- **Contractor Workspace (`/contractor`)**: Dedicated portal for awarded contractors with specialized workflow tabs:
  - **Overview**: Active contract summaries, total work order valuations, and upcoming deadlines.
  - **Bids**: Track submitted proposals (`SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`).
  - **Work Orders**: Formal municipal contracts with scope, timelines, and sanction numbers.
  - **Work Start Declarations**: Formal notice of commencement with site preparation verification.
  - **Milestone Progress**: Staged execution reporting with before/after photos for engineering sign-off.
  - **Defect Liability Rectification**: Track warranty-period defect notices and submit rectification proof.

### 4. Public Transparency & Civic Map
- **Civic Map (`/map`)**: Full-screen interactive Leaflet GIS visualization mapping municipal issues across wards with color-coded priority clusters.
- **Open Accountability Dashboard (`/transparency`)**: Public metrics on total grievances, municipal budget allocations, active contracts, average resolution turnarounds, and departmental performance scores.
- **Public Verification**: Complete transparency into public works expenditures, contractor awards, and verified completion certificates.

### 5. System Administration & Governance
- **Platform Health & Metrics (`/admin/system`)**: Real-time monitoring of server health, database connectivity, memory utilization, API latency, and registered user counts.
- **Complaint Governance & Consolidation (`/admin/complaints`)**: Master complaint administration with tools to review AI duplicate clusters, merge child tickets into primary incidents, and adjust priority levels.
- **Tender Administration (`/admin/tenders`)**: Drafting, publishing, evaluating, and awarding municipal public tenders.
- **Community Moderation Queue (`/admin/moderation`)**: Review and moderate citizen proposals, community poll discussions, and flagged content.
- **Tamper-Evident Audit Log**: Append-only log stream recording every sensitive system action, IP address, user agent, and timestamp.

---

## 👥 User Role Matrix

Civora enforces strict, server-validated Role-Based Access Control (RBAC):

| Role | Database Enum | Core Responsibilities | Primary Portal Routes |
| :--- | :--- | :--- | :--- |
| **Citizen** | `CITIZEN` | File grievances, submit photographic evidence, track status, vote on community proposals, verify resolutions. | `/report`, `/my-complaints`, `/track`, `/engagement`, `/map`, `/transparency` |
| **Government Official** | `GOVERNMENT_OFFICIAL` | Triage complaints, coordinate departmental actions, perform on-site inspections, track SLA deadlines, verify work. | `/official/workspace`, `/sla` |
| **Contractor** | `CONTRACTOR` | Discover municipal tenders, submit competitive bids, execute sanctioned works, submit milestone evidence. | `/contractor`, `/tenders`, `/tenders/:id` |
| **Administrator** | `ADMIN` | Oversee system health, manage users, supervise duplicate consolidation, manage tenders, audit system actions. | `/admin/system`, `/admin/complaints`, `/admin/tenders`, `/admin/moderation`, `/sla` |

---

## 💻 Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.8` | High-performance, concurrent UI component hierarchy |
| **Build Tool** | Vite | `^8.3.0` | Ultra-fast HMR and optimized production bundling |
| **Language** | TypeScript | `~6.0.2` (Client) / `^5.7.3` (Server) | End-to-end static typing and contract safety |
| **Styling** | Tailwind CSS | `^4.3.3` | Responsive, modern civic-styled design tokens |
| **Mapping & GIS** | Leaflet | `^1.9.4` | Interactive municipal map visualization and geocoding |
| **Backend Runtime** | Node.js | `>=20.0.0` (v22 tested) | Enterprise asynchronous server runtime |
| **Web Server** | Express.js | `^4.21.2` | RESTful API routing, rate limiting, and middleware |
| **ORM** | Prisma ORM | `^6.19.3` | Type-safe database queries and automated migrations |
| **Database** | PostgreSQL / Supabase | 15+ | Relational persistence with connection pooling |
| **AI Integration** | Google Gemini API | `@google/genai` `^2.32.0` | Multimodal complaint analysis, fraud scoring, relevance check |
| **Computer Vision** | Custom dHash & SHA-256 | Native | Perceptual hashing (Hamming distance) and file deduplication |
| **Authentication** | JWT & BcryptJS | `jsonwebtoken` `^9.0.3`, `bcryptjs` `^3.0.3` | Dual cookie & Bearer token auth with salt hashing |
| **File Processing** | Multer | `^2.4.0` | Secure multipart/form-data upload validation |
| **Validation** | Zod | `^4.6.7` | Strict runtime schema parsing and request sanitization |
| **Frontend Hosting** | Vercel | Production | Global edge CDN, SPA routing rewrites, security headers |
| **Backend Hosting** | Render | Production | Managed cloud web service with auto-scaling |

---

## 🌐 Live Deployments

The Civora production application is actively deployed and accessible at the following verified endpoints:

| Service | Environment | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Production (Vercel) | **https://civora-tau.vercel.app** | 🟢 Live & Operational |
| **Backend API** | Production (Render) | **https://civora-l06w.onrender.com** | 🟢 Live & Operational |
| **API Health Check** | Production Monitoring | **https://civora-l06w.onrender.com/api/health** | 🟢 Returns HTTP 200 `connected` |

---

## 🛠 Developer Installation & Setup Guide

Follow this guide to set up a full local development environment for Civora on your machine.

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **PostgreSQL**: A local PostgreSQL instance or a free cloud database (e.g., [Supabase](https://supabase.com))
- **Git**: Installed and configured

---

### 1. Clone Repository

```bash
git clone https://github.com/Moosa2006/Civora.git
cd Civora
```

---

### 2. Backend Setup (`server/`)

Open a **dedicated terminal window** for the server:

```bash
# Navigate to the server directory
cd server

# Install backend dependencies
npm install

# Create your local environment file
cp .env.example .env
```

Edit `server/.env` with your preferred editor and provide your database credentials:

```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Local PostgreSQL Example
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/civora_dev?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/civora_dev?schema=public"

# Authentication Secret (min 32 characters)
JWT_SECRET=local_development_jwt_secret_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# File Storage Configuration
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

# Optional: Google Gemini API Key for AI verification features
# GEMINI_API_KEY=your_gemini_api_key_here
```

Initialize your database schema and seed essential metadata:

```bash
# Validate Prisma schema
npm run db:validate

# Generate Prisma Client
npm run db:generate

# Apply database migrations
npm run db:migrate

# Bootstrap production metadata and departments
npm run metadata:bootstrap

# (Optional) Bootstrap an initial Administrator account
npm run admin:bootstrap
```

Start the backend development server:

```bash
npm run dev
```

The backend API will start at: `http://localhost:5000`  
Health check endpoint: `http://localhost:5000/api/health`

---

### 3. Frontend Setup (`client/`)

Open a **second dedicated terminal window** for the frontend:

```bash
# Navigate to the client directory
cd client

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend application will start at: `http://localhost:5173`

> [!NOTE]
> Vite automatically proxies all API requests matching `/api/*` to `http://localhost:5000` via its built-in reverse proxy configured in `client/vite.config.ts`. No manual CORS configuration is necessary for standard local development.

---

### 4. Verification & Testing

Civora includes a comprehensive test and verification suite:

```bash
# Run complete end-to-end application verification (23 automated test scenarios)
npm run test:verify --prefix server

# Run AI verification & computer vision test suite (24 automated test scenarios)
npm run test:ai --prefix server

# Run cross-device authentication and reliability suite (6 test scenarios)
npm run test:reliability --prefix server

# Verify frontend production build
npm run build --prefix client

# Verify backend production build
npm run build --prefix server
```

---

## ⚙ Environment Configuration

### Server Environment Variables (`server/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5000` | Port for Express HTTP listener |
| `NODE_ENV` | Yes | `development` | Environment mode (`development` / `production`) |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5173` | Allowed CORS origin (set to Vercel URL in production) |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (use `?pgbouncer=true` if using Supabase pooler on port 6543) |
| `DIRECT_URL` | Yes | - | Direct PostgreSQL connection for Prisma migrations (port 5432) |
| `JWT_SECRET` | Yes | - | Cryptographically secure secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration |
| `STORAGE_PROVIDER` | No | `local` | Upload handler (`local`) |
| `UPLOAD_DIR` | No | `./uploads` | Relative storage directory for complaint and milestone evidence |
| `MAX_FILE_SIZE_MB` | No | `10` | Maximum upload size limit per file in megabytes |
| `GEMINI_API_KEY` | No | - | Google Gemini API key for multimodal duplicate/fraud analysis |
| `ADMIN_SETUP_SECRET` | No | - | Temporary one-time secret for bootstrapping admin accounts without terminal access |

> [!IMPORTANT]
> **Supabase Connection Pooling Notice**: When using Supabase in production, always append `?pgbouncer=true` to your pooled `DATABASE_URL` on port 6543. This instructs Prisma to disable prepared statements, preventing PostgreSQL error `42P05: prepared statement already exists`.

---

## 🔀 Git & Contribution Workflow

To pull upstream updates and collaborate safely:

### 1. Check Working Tree Status
Before pulling changes, inspect your local repository state to avoid overwriting uncommitted progress:

```bash
git status
git branch --show-current
```

### 2. Safely Stash or Commit Local Changes
If you have uncommitted changes you wish to preserve:

```bash
# Temporarily stash your local changes
git stash save "work-in-progress"

# Pull the latest changes from the main branch
git pull origin main

# Re-apply your stashed changes
git stash pop
```

### 3. Resolving Conflicts
If a merge conflict occurs during `git pull`:
1. Open the repository in your IDE (VS Code / Antigravity).
2. Look for conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`).
3. Select **"Accept Current Change"**, **"Accept Incoming Change"**, or **"Accept Both Changes"**.
4. Test the build (`npm run build --prefix client` and `npm run build --prefix server`).
5. Stage the resolved files: `git add <resolved-file>`.

---

## 🔒 Security & Governance

Civora incorporates defense-in-depth principles across every architectural layer:

1. **Dual Cross-Device Authentication**: Implements simultaneous support for HTTP-only Secure SameSite Cookies (desktop browsers) and `Authorization: Bearer <token>` headers (iOS Safari, partitioned storage, and embedded web views), eliminating session dropouts.
2. **Strict Server-Side RBAC**: Every sensitive endpoint explicitly verifies user roles (`CITIZEN`, `GOVERNMENT_OFFICIAL`, `CONTRACTOR`, `ADMIN`) via express middleware before executing controller logic.
3. **Tamper-Evident Audit Trails**: Administrative, official, and contractor actions automatically create immutable audit log entries recording actor ID, IP address, user agent, action type, and JSON payload diffs.
4. **Photographic Cryptography**: Evidence files generate both cryptographic SHA-256 hashes (for byte-for-byte duplicate detection) and 64-bit dHash perceptual hashes (for visual similarity detection regardless of compression or resizing).
5. **Input Sanitization & Validation**: All incoming requests are strictly validated using Zod schemas with regex constraints on municipal ward codes, tracking tokens, and sanitization against injection attacks.
6. **Zero Hardcoded Secrets**: Secrets, credentials, and connection strings are strictly managed via environment variables and excluded from source control through `.gitignore`.

---

## 👁 Project Vision

> *"A complaint should not end with a registration number. It should lead to visible action, accountable execution, and a verifiable outcome."*

**CIVORA — People First. Public Accountability Always.**

---

<p align="center">
  <sub>Built with dedication for transparent civic governance and public accountability.</sub>
</p>

