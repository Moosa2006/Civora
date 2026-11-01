# Civora &mdash; Civic Issue Reporting & Public Accountability

Civora is a web application designed to empower citizens to report local civic issues (such as road damage, uncollected garbage, broken streetlights, waterlogging) and track them through a transparent, verified resolution lifecycle.

---

## Current Status &mdash; Module 5: Authentication, Authorization, Role-Based Access Control & User Identity

Civora is being developed in a structured, module-by-module approach.
- **Completed Modules:**
  - Module 1: Repository Setup & Foundation Skeleton
  - Module 2: Frontend Foundation & Shared UI Components
  - Module 3: Database Design & Migrations
  - Module 4: Backend Foundation, API Structure, Database Integration & Dummy Test Data
  - Module 5: Authentication, Authorization, Role-Based Access Control & User Identity
- **Next Module:** Module 6 (Complaint Submission & Evidence Upload)

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Node.js, Express, TypeScript (ESM)
- **Database:** PostgreSQL with Prisma ORM 6.19.3
- **Test Runner:** Node.js native test runner (`tsx --test`)
- **Version Control:** Git

---

## Project Structure

```text
Civora/
├── client/                 # Frontend React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/     # Reusable layout and UI components
│   │   │   ├── layout/     # AppShell, Navbar, Footer, Container
│   │   │   └── ui/         # Button, Card, FormField, TextInput, TextArea, Select, Badge, Alert, LoadingIndicator, EmptyState, PageHeading, icons
│   │   ├── pages/          # LandingPage, ReportIssuePage, TrackComplaintPage, NotFoundPage
│   │   ├── router/         # History-based router, NavLink, useRouter
│   │   ├── styles/         # tokens.css design system tokens
│   │   ├── types/          # Shared frontend type definitions
│   │   ├── utils/          # Status mapping utilities
│   │   ├── App.tsx         # Route dispatch & AppShell provider
│   │   ├── index.css       # Tailwind CSS v4 styling rules & token imports
│   │   └── main.tsx        # React entry point
│   ├── index.html          # HTML entry point with metadata
│   ├── package.json        # Frontend dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Vite config with Tailwind & /api proxy
├── server/                 # Backend Node.js + Express + TypeScript application
│   ├── prisma/
│   │   ├── schema.prisma   # PostgreSQL database schema (11 core categories + master tables)
│   │   ├── seed.ts         # Idempotent database seeding script
│   │   └── migrations/     # Prisma Migrate SQL migration history
│   │       └── 20261016000000_init_civora_schema/
│   │           └── migration.sql # Clean UTF-8 initial DDL migration
│   ├── src/
│   │   ├── controllers/    # Health and metadata route controllers
│   │   ├── middleware/     # Centralized error handler and 404 handler
│   │   ├── routes/         # Express API router definitions
│   │   ├── lib/
│   │   │   └── prisma.ts   # PrismaClient singleton instance
│   │   ├── app.ts          # Express application factory
│   │   └── index.ts        # Server listener and graceful shutdown
│   ├── test/               # Automated API & DB integration tests
│   │   └── api.test.ts
│   ├── docs/
│   │   └── backend-setup.md # Backend setup & database guide
│   ├── package.json        # Backend dependencies, seed, and test scripts
│   ├── tsconfig.json       # Backend TypeScript configuration
│   └── .env.example        # Backend environment variables template
├── docs/                   # Architectural & planning documentation
│   ├── architecture.md     # High-level system architecture
│   ├── data-model.md       # Comprehensive entity definitions & ERD
│   └── development-roadmap.md # Detailed module-wise development roadmap
├── .env.example            # Root environment template
├── .gitignore              # Git ignore rules
├── package.json            # Root convenience scripts (build, dev, db, test commands)
└── README.md               # Project documentation
```

---

## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher recommended, tested on Node v22)
- npm (v9.0.0 or higher)

### 1. Installation

Install dependencies for both frontend and backend:

```bash
# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
# In server/ or root
cp .env.example .env
```

### 3. Running the Application

You can start the backend and frontend in separate terminals:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
# Running on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Running on http://localhost:5173
```

Alternatively, from the root folder:
```bash
# Start backend
npm run dev:server

# Start frontend
npm run dev:client
```

---

## Verification & Build Checks

To verify compilation and type checks across both modules:

```bash
# Type-check and build frontend
cd client
npm run build

# Type-check and build backend
cd ../server
npm run build
```

Or from the project root:
```bash
npm run build
```

---

## Database Management (Prisma & PostgreSQL)

```bash
# Validate Prisma schema
npm run db:validate

# Generate Prisma Client types
npm run db:generate

# Apply pending migrations (requires configured PostgreSQL credentials in server/.env)
npm run db:migrate

# Launch visual Prisma Studio database GUI
cd server && npm run db:studio
```

---

## Documentation

- [Data Model & ERD](docs/data-model.md)
- [Development Roadmap](docs/development-roadmap.md)
- [System Architecture](docs/architecture.md)
