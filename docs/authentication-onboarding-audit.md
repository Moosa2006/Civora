# Civora — Authentication, Registration & Role-Based Onboarding Audit

## 1. Executive Summary

This document presents a comprehensive, evidence-based audit of the authentication, registration, role management, contractor onboarding, official onboarding, and administrator provisioning mechanisms within the Civora civic issue reporting platform.

The audit was conducted by inspecting actual codebase files, Prisma schema definitions, database migrations, backend routes, controllers, middleware, frontend routing, navigation catalogs, contexts, and automated test suites.

---

## 2. Comprehensive Implementation Audit Table

| Area | Existing implementation | Status | Evidence / files | Required action |
|---|---|---|---|---|
| **Citizen registration** | `POST /api/auth/register` creates accounts with fixed role `CITIZEN` and `accountStatus: ACTIVE`. Passwords hashed with `bcryptjs`. Client has `RegisterPage.tsx` at `/register`. | **Implemented and verified** | `server/src/controllers/auth.controller.ts`<br>`server/src/validation/auth.validation.ts`<br>`client/src/pages/RegisterPage.tsx`<br>`server/test/auth.test.ts` | Preserve existing citizen flow. Add contractor registration tab/toggle in registration UI without breaking citizen signup. |
| **Shared sign-in** | Single shared `POST /api/auth/login` endpoint validates credentials for all roles, checks `SUSPENDED` and `PENDING_VERIFICATION`, returns user and JWT, sets HttpOnly cookie. | **Partially implemented** (redirect defect) | `server/src/controllers/auth.controller.ts`<br>`client/src/pages/LoginPage.tsx`<br>`client/src/config/navigation.ts` | Fix post-login navigation in `LoginPage.tsx`: currently routes `CONTRACTOR` to `/contractor` and all others to `/`. It must use `getRoleLandingPage` so `GOVERNMENT_OFFICIAL` goes to `/official/workspace` and `ADMIN` goes to `/admin/system` or `/admin/complaints`. |
| **Session restoration** | `GET /api/auth/me` returns authenticated user profile with associated department and contractor relations. `authenticateUser` parses cookie or Bearer token and verifies active account status. | **Implemented and verified** | `server/src/middleware/auth.middleware.ts`<br>`server/src/controllers/auth.controller.ts`<br>`client/src/context/AuthContext.tsx`<br>`server/test/auth.test.ts` | Maintain current session restoration mechanism; ensure contractor profile details are populated reliably. |
| **Official onboarding** | No public registration endpoint exists (security requirement met). However, no administrator endpoint or interface exists to create or onboard officials with valid department assignment and credentials. | **Missing** | `server/src/controllers/adminUsers.controller.ts`<br>`server/src/routes/admin.routes.ts`<br>`client/src/pages/AdminSystemPage.tsx` | Implement `POST /api/admin/officials` to create official accounts with validated `departmentId`, name, work email, and initial password. Add official creation modal in Admin management UI. |
| **Contractor application** | `Contractor` model exists in `schema.prisma`. However, no public registration endpoint or form exists for contractor organizations to apply. | **Missing** | `server/prisma/schema.prisma`<br>`server/src/routes/auth.routes.ts`<br>`client/src/pages/RegisterPage.tsx` | Implement `POST /api/auth/register-contractor` validating company name, registration number, PAN/tax ID, business address, license class, operating region, and applicant user credentials. Create `Contractor` record in pending review state (`isVerified: false`) and linked applicant `User` (`PENDING_VERIFICATION`). Add contractor application form on frontend. |
| **Contractor approval** | `Contractor` model includes `isVerified`, `status`, `verifiedAt`, `verifiedById`. However, no admin routes or interfaces exist to list pending applications, approve, or reject them. | **Missing** | `server/src/routes/admin.routes.ts`<br>`server/src/controllers/adminUsers.controller.ts`<br>`client/src/pages/AdminSystemPage.tsx` | Implement `GET /api/admin/contractor-applications`, `POST /api/admin/contractors/:id/approve`, and `POST /api/admin/contractors/:id/reject`. On approval, set `isVerified: true`, activate linked user account (`ACTIVE`), assign `CONTRACTOR` role, and log audit event. Provide review UI in Admin workspace. |
| **Administrator provisioning** | Administrator accounts are seeded via `prisma/seed.ts` (`admin1@example.test`). Public registration rejects role elevation. No standalone CLI bootstrap script exists for operator initialization in fresh deployments without seeding dummy records. | **Partially implemented** | `server/prisma/seed.ts`<br>`server/src/controllers/auth.controller.ts` | Implement standalone bootstrap script (`server/src/scripts/bootstrapAdmin.ts`) supporting secure initial administrator provisioning via CLI/environment variables without silent startup risks or exposing passwords. |
| **Role and permission enforcement** | Canonical roles defined in Prisma `UserRole` (`CITIZEN`, `GOVERNMENT_OFFICIAL`, `ADMIN`, `CONTRACTOR`). Backend uses `requireRoles(...)`. However, frontend `AdminSystemPage.tsx` uses outdated string type `'OFFICIAL'` instead of `'GOVERNMENT_OFFICIAL'` and omitted `'CONTRACTOR'`, causing 400 `INVALID_ROLE` on role change. | **Broken** (frontend enum mismatch) | `server/src/middleware/auth.middleware.ts`<br>`client/src/pages/AdminSystemPage.tsx`<br>`client/src/types/auth.ts` | Fix frontend role enum references in `AdminSystemPage.tsx` to canonical `UserRole` values (`GOVERNMENT_OFFICIAL`, `CONTRACTOR`, `CITIZEN`, `ADMIN`). |
| **Department assignment** | `Department` model defines municipal departments (PWD, WSSB, SAN, ESL, TPI). `User.departmentId` relates to `Department`. Role update in `adminUsers.controller.ts` does not validate whether `departmentId` actually exists. | **Partially implemented** (missing foreign key validation) | `server/src/controllers/adminUsers.controller.ts`<br>`server/prisma/schema.prisma` | Validate `departmentId` against active database departments when assigning or onboarding officials, returning a clear error if invalid. |
| **Contractor profile creation** | `Contractor` database model contains company details, license class, tax ID, verification status, and relations to work orders, bids, and users. Pre-seeded in `seed.ts` but never created dynamically from onboarding. | **Partially implemented** | `server/prisma/schema.prisma`<br>`server/prisma/seed.ts` | Wire contractor profile creation atomically during contractor registration/approval and prevent duplicate registration numbers or tax IDs. |
| **Password security** | Passwords hashed using `bcryptjs` with 10 salt rounds (`server/src/lib/password.ts`). Zod validation enforces minimum 8 characters. Passwords and hashes are excluded from API payloads. | **Implemented and verified** | `server/src/lib/password.ts`<br>`server/src/validation/auth.validation.ts`<br>`server/test/auth.test.ts` | Maintain current password hashing and validation; enforce identical security rules for contractor and official passwords. |
| **Account verification and activation** | `AccountStatus` enum (`ACTIVE`, `PENDING_VERIFICATION`, `SUSPENDED`). Login blocks `PENDING_VERIFICATION` and `SUSPENDED` with 403. | **Partially implemented** (no application status feedback) | `server/src/controllers/auth.controller.ts`<br>`server/test/auth.test.ts` | Add application status feedback endpoint (`GET /api/auth/contractor-status`) and frontend status card so pending contractors receive clear review feedback rather than a generic error. |
| **Protected frontend routes** | `AppContent` in `App.tsx` routes to pages based on URL path. Navigation bar adapts links using `getRolePrimaryNav` and `getRoleSecondaryNav`. Role guard wrapper is absent for direct URL entry. | **Partially implemented** | `client/src/App.tsx`<br>`client/src/components/layout/Navbar.tsx`<br>`client/src/config/navigation.ts` | Add route-level authentication and role checks to redirect unauthorized users to login or their authorized role landing page. |
| **Backend authorization** | `authenticateUser` parses HttpOnly cookie or Authorization Bearer header, validates JWT, fetches user from database, checks account status. `requireRoles` enforces permitted roles. | **Implemented and verified** | `server/src/middleware/auth.middleware.ts`<br>`server/test/auth.test.ts`<br>`server/test/admin.test.ts` | Maintain architecture; apply `authenticateUser` and `requireRoles(UserRole.ADMIN)` to new official and contractor management endpoints. |
| **Tests and documentation** | Test suites in `server/test/` cover auth and admin endpoints. Architecture docs exist in `docs/`. Missing tests for contractor registration, contractor approval, and official creation. | **Partially implemented** | `server/test/auth.test.ts`<br>`server/test/admin.test.ts`<br>`docs/` | Add comprehensive test suite in `server/test/authOnboarding.test.ts` verifying contractor registration, application review/approval/rejection, official onboarding, and role landing redirects. |

---

## 3. Discovered Security & Role Consistency Issues

1. **Frontend Role Enum Mismatch (`AdminSystemPage.tsx`)**:
   - `AdminSystemPage.tsx` defines role states using `'CITIZEN' | 'OFFICIAL' | 'ADMIN'`, whereas the canonical database enum is `GOVERNMENT_OFFICIAL` and also includes `CONTRACTOR`.
   - When an administrator attempts to assign a user the Official role, the request sends `role: "OFFICIAL"`, which the backend validation rejects with HTTP 400 `INVALID_ROLE`.

2. **Missing Post-Login Navigation for Officials and Admins (`LoginPage.tsx`)**:
   - Upon successful login, `LoginPage.tsx` redirects `CONTRACTOR` users to `/contractor`, but all other authenticated users (including `GOVERNMENT_OFFICIAL` and `ADMIN`) are redirected to the public root `/`.
   - The platform already defines `getRoleLandingPage` in `client/src/config/navigation.ts` (`GOVERNMENT_OFFICIAL` → `/official/workspace`, `ADMIN` → `/admin/system`, `CONTRACTOR` → `/contractor`, `CITIZEN` → `/`). This function must be utilized.

3. **Missing Contractor Self-Registration & Approval Workflow**:
   - There is no public endpoint or frontend page for contractors to apply with their company credentials.
   - There is no admin review endpoint or UI to inspect company registration numbers, tax IDs, or license classes, and approve or reject them.

4. **Missing Official Account Onboarding Flow**:
   - Official accounts could only be created by manually editing database records or seeding.
   - Administrators lack a secure API and UI to provision official accounts linked to active departments.

5. **Unvalidated Department Assignment**:
   - In `adminUsers.controller.ts`, updating `departmentId` does not check if the department exists in the database.

---

## 4. Implementation Plan

1. **Backend Validation & Routes**:
   - Add contractor registration schema (`registerContractorSchema`) in `server/src/validation/auth.validation.ts`.
   - Add official creation schema (`createOfficialSchema`) in `server/src/validation/auth.validation.ts`.
   - Add `POST /api/auth/register-contractor` in `server/src/controllers/auth.controller.ts`.
   - Add `GET /api/auth/contractor-status` in `server/src/controllers/auth.controller.ts` for applicants to track review status.
   - Add `POST /api/admin/officials` in `server/src/controllers/adminUsers.controller.ts` with department verification.
   - Add `GET /api/admin/contractor-applications`, `POST /api/admin/contractors/:id/approve`, and `POST /api/admin/contractors/:id/reject` in `server/src/controllers/adminUsers.controller.ts`.
   - Create standalone CLI bootstrap script `server/src/scripts/bootstrapAdmin.ts`.

2. **Frontend Pages & Integration**:
   - Update `client/src/pages/RegisterPage.tsx` to include tabs for "Citizen Registration" and "Contractor Registration".
   - Update `client/src/pages/LoginPage.tsx` to use `getRoleLandingPage` and provide helpful contractor status feedback.
   - Add contractor status page/view (`/contractor/application-status`).
   - Update `client/src/pages/AdminSystemPage.tsx` with:
     - Fixed `UserRole` enum values (`GOVERNMENT_OFFICIAL`, `CONTRACTOR`, `CITIZEN`, `ADMIN`).
     - "Create Official Account" modal with department selector.
     - "Contractor Applications" review tab to inspect and approve/reject applications.

3. **Automated Verification**:
   - Add comprehensive tests in `server/test/authOnboarding.test.ts`.
   - Run type checks and existing test suites to prevent regressions.

---

## 5. Post-Implementation Verification & Final Status

All implementation items and security repairs have been executed and verified:

1. **Public Citizen Registration**: Preserved and verified. Enforces `CITIZEN` role, `ACTIVE` account status, password hashing, and cookie issuance.
2. **Contractor Registration & Application Tracking**: Implemented via `POST /api/auth/register-contractor` and `GET /api/auth/contractor-application-status`. Creates `Contractor` record (`isVerified: false`, `INACTIVE`) and linked applicant `User` (`role: CONTRACTOR`, `accountStatus: PENDING_VERIFICATION`) with audit event logging.
3. **Admin Official Onboarding**: Implemented via `POST /api/admin/officials` with department foreign key validation, creating active `GOVERNMENT_OFFICIAL` accounts with audit events.
4. **Admin Contractor Review & Approval**: Implemented via `GET /api/admin/contractor-applications`, `POST /api/admin/contractors/:id/approve`, and `POST /api/admin/contractors/:id/reject`. Approving an application verifies the contractor entity and activates linked applicant users; rejecting sets status to `INACTIVE`, suspends users, and logs the mandatory documented reason.
5. **Admin CLI Provisioning**: Implemented in `server/src/scripts/bootstrapAdmin.ts` with CLI argument and environment variable parsing, password hashing, role assignment, and audit event recording. Accessible via `npm run admin:bootstrap`.
6. **Frontend Experience & Role Redirects**:
   - `LoginPage.tsx` redirects each role to its dedicated workspace via `getRoleLandingPage` (`GOVERNMENT_OFFICIAL` -> `/official/workspace`, `ADMIN` -> `/admin/system`, `CONTRACTOR` -> `/contractor`, `CITIZEN` -> `/`). Unverified contractors receive clear application pending feedback and direct status lookup links.
   - `RegisterPage.tsx` provides accessible tabs for Citizen Account, Contractor Application, and Track Status.
   - `AdminSystemPage.tsx` includes canonical `UserRole` enums, an `Onboard Official` modal with department selection, and a `Contractor Apps` review tab with approval and rejection actions.
7. **Automated Test Results**:
   - `server/test/authOnboarding.test.ts`: 19/19 tests passing.
   - Core regression suite (`auth.test.ts`, `admin.test.ts`, `contractor.test.ts`, `officialWorkflow.test.ts`): 76/76 tests passing.
   - Client build (`npm run build`): Successfully compiled with 0 TypeScript or bundle errors.

