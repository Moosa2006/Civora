# Civora &mdash; Authentication, Authorization & User Identity Guide (Module 5)

## 1. Overview & Architecture

Civora implements a secure, modular, role-based authentication and authorization system adhering to OWASP security principles.

### Key Architectural Pillars:
- **Strict Separation of Concerns:**
  - **Authentication:** Verifies identity via cryptographic JWT tokens delivered through secure `HttpOnly` cookies and standard `Authorization: Bearer <token>` headers.
  - **Authorization:** Enforces server-side Role-Based Access Control (RBAC) across three distinct municipal roles: `CITIZEN`, `GOVERNMENT_OFFICIAL`, and `ADMIN`.
- **Zero Trust Role Assignment:** The public registration endpoint (`POST /api/auth/register`) strictly provisions the `CITIZEN` role. Any client-supplied `role`, `accountStatus`, or `departmentId` fields are stripped and ignored by server-side validation to prevent mass-assignment privilege escalation.
- **Account State Verification:** Inactive or `SUSPENDED` accounts are blocked at both login and on every authenticated request with `403 Forbidden` (`ACCOUNT_SUSPENDED`).
- **No Plaintext Passwords:** All user passwords are encrypted using `bcrypt` (10 salt rounds). Password hashes are omitted by default from all Prisma queries and API responses.

---

## 2. Token & Session Strategy

Civora utilizes a **Dual-Delivery JWT Strategy**:

1. **Browser Application (Cookies):**
   - Stored in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie named `civora_auth_token`.
   - Immune to client-side XSS token theft (cannot be read via `document.cookie`).
   - Browser automatically attaches credentials on requests with `credentials: 'include'`.
2. **API & Test Clients (Bearer Header):**
   - Supports `Authorization: Bearer <token>`.
   - Enables headless testing, mobile clients, and developer tooling without cookie emulation.
3. **Session Expiry:** Default token lifetime is 7 days (configurable via `JWT_EXPIRES_IN`).
4. **Session Termination (Logout):** `POST /api/auth/logout` clears the authentication cookie with `Max-Age=0` and invalidates client session state.

---

## 3. Password Security & Policy

- **Hashing Algorithm:** `bcrypt` with work factor 10.
- **Password Strength Rules:**
  - Minimum length: 8 characters.
  - Maximum length: 128 characters (guards against DoS computational attacks on hashing).
  - Silently truncated passwords are never permitted.
- **Protection Against User Enumeration:**
  - Login failure responses return a generic `401 Unauthorized` message: `"Invalid email or password."` regardless of whether the email exists.
  - Non-sensitive validation errors are returned with `400 Bad Request`.

---

## 4. API Endpoints Reference

All authentication endpoints are grouped under `/api/auth`:

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public (Rate-limited) | Registers a new Citizen account. Client role parameters are ignored; `CITIZEN` is strictly assigned. |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Authenticates credentials, verifies account status, sets `civora_auth_token` cookie, and returns safe user data with token. |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current authenticated user profile and assigned department (if official). Rejects unauthenticated with `401`. |
| `POST` | `/api/auth/logout` | Authenticated / Public | Clears the `civora_auth_token` cookie and returns success response. |
| `GET` | `/api/auth/admin-check` | `ADMIN` Role Only | Protected verification endpoint. Returns `200 OK` for administrators; `403 Forbidden` for citizens/officials; `401` for unauthenticated. |

---

## 5. Development Test Dummy Accounts

The reproducible seed script (`npm run db:seed`) provisions the following fictional development accounts:

> **Development Testing Password (All Accounts):** `CivoraDev123!`

| Email Address | Role | Account Status | Department | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `citizen1@example.test` | `CITIZEN` | `ACTIVE` | &mdash; | General citizen testing |
| `official1@example.test` | `GOVERNMENT_OFFICIAL` | `ACTIVE` | `PWD` (Public Works) | Official workflow testing |
| `admin1@example.test` | `ADMIN` | `ACTIVE` | &mdash; | System administrator testing |
| `suspended1@example.test` | `CITIZEN` | `SUSPENDED` | &mdash; | Testing suspension enforcement (`403`) |
| `pending1@example.test` | `CITIZEN` | `PENDING_VERIFICATION` | &mdash; | Testing verification policy (`403`) |
| `aarav.sharma@example.com` | `CITIZEN` | `ACTIVE` | &mdash; | Seeded citizen with filed complaints |
| `rajesh.kumar@example.com` | `GOVERNMENT_OFFICIAL` | `ACTIVE` | `PWD` | Seeded engineer with civic works |
| `admin.meera@civora.local` | `ADMIN` | `ACTIVE` | &mdash; | Primary municipal admin account |

---

## 6. Environment Variables Configuration

Ensure the following variables are defined in `server/.env` (refer to `server/.env.example` for placeholders):

```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/Cevora?schema=public"
JWT_SECRET="<random-secure-signing-key-min-32-characters>"
JWT_EXPIRES_IN=7d
```

> [!IMPORTANT]
> Never commit real secrets or production `JWT_SECRET` strings to source control.

---

## 7. Running & Testing Locally

### 1. Execute Database Seeding:
```bash
# In server/ (or from root)
npm run db:seed
```

### 2. Run Automated Test Suite:
```bash
# In server/
npm test

# From root
npm run test:server
```
Runs 30 integration and unit tests validating:
- Citizen registration and privilege escalation rejection.
- Password hashing and policy enforcement.
- Login validation, generic error messages, and account suspension handling.
- Current-user session resolution via cookies and bearer headers.
- Impersonation prevention on `/api/auth/me`.
- Role-based access control (RBAC) on `/api/auth/admin-check`.

### 3. Start Backend & Frontend Development Servers:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

Navigate to `http://localhost:5173/login` or `http://localhost:5173/register` to test authentication interactively. Convenient 1-click test fill buttons are available on the login card in development mode.
