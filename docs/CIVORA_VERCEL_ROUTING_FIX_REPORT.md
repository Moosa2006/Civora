# CIVORA — Vercel SPA Routing & Reverse-Proxy Fix Report
**Target Applications:**  
- **Frontend:** `https://civora-tau.vercel.app` (Vercel)  
- **Backend:** `https://civora-l06w.onrender.com` (Render)  
- **Database:** Supabase PostgreSQL  
**Date:** October 30, 2026  
**Status:** RESOLVED & VERIFIED LOCAL BUILD  

---

## 1. Root Cause of the Vercel 404 Error

When a user navigated to `https://civora-tau.vercel.app/login` (or refreshed any nested route like `/tenders`, `/track`, or `/admin`), Vercel returned:
```
404 NOT_FOUND — This page doesn't exist.
```

### Technical Root Cause:
1. **Missing SPA Catch-All Rewrite on Vercel:**
   - In a Single Page Application (SPA) built with Vite and React, the build output produces a single HTML entry point (`dist/index.html`).
   - Browser navigation to `/login` causes the browser to issue an HTTP `GET /login` request to Vercel's edge network.
   - Because no physical static file named `login` or `login.html` exists in the deployed output directory, Vercel returned an HTTP 404 NOT_FOUND error.
2. **Missing `vercel.json` at Git Workspace Root:**
   - If the Vercel project's Root Directory setting is left at default (`.` / root), Vercel ignores files inside `client/vercel.json` and looks strictly for `./vercel.json`.
   - The workspace root lacked a `vercel.json` file.
3. **Negative Lookahead Proxy Separation:**
   - API endpoints (`/api/*`) and SPA routes (`/(.*)`) must be separated cleanly. Without negative lookahead (`/((?!api/).*)`), either API calls fail with 404 or backend endpoints are erroneously intercepted and served `index.html`.

---

## 2. Verification of `/login` in React Router

The route `/login` **already existed** in the application and was never missing:
- File: [`client/src/App.tsx`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/src/App.tsx#L102)
- Definition:
  ```tsx
  case '/login':
    return <LoginPage />;
  ```
- Component: [`client/src/pages/LoginPage.tsx`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/src/pages/LoginPage.tsx)

Furthermore, the client uses an HTML5 History API router ([`client/src/router/Router.tsx`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/src/router/Router.tsx)) that reads `window.location.pathname`. Once `index.html` is served by Vercel, the router reads `/login` and renders `<LoginPage />`.

---

## 3. Files Modified

| File | Modification Description |
|---|---|
| [`client/vercel.json`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/vercel.json) | Configured production reverse-proxy for Render backend (`https://civora-l06w.onrender.com/api`) and negative lookahead SPA fallback to `/index.html`. |
| [`vercel.json`](file:///c:/Users/Asus/Desktop/Zinnovatio/vercel.json) | Created identical root-level Vercel configuration to ensure rules apply regardless of whether Vercel Root Directory is set to `.` or `client`. |
| [`client/src/App.tsx`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/src/App.tsx) | Sanitized trailing slashes (`cleanPath`), added route aliases for `/dashboard`, `/admin`, and `/official`, preventing false 404s on browser bookmarks. |
| [`CIVORA_DEPLOYMENT_ENVIRONMENT_VARIABLES.md`](file:///c:/Users/Asus/Desktop/Zinnovatio/CIVORA_DEPLOYMENT_ENVIRONMENT_VARIABLES.md) | Synchronized live production domain URLs (`https://civora-tau.vercel.app` and `https://civora-l06w.onrender.com`). |

---

## 4. Exact Vercel Configuration Applied

Configured in both [`client/vercel.json`](file:///c:/Users/Asus/Desktop/Zinnovatio/client/vercel.json) and [`vercel.json`](file:///c:/Users/Asus/Desktop/Zinnovatio/vercel.json):

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

### Explanation of Rules:
1. **Rule 1 & 2 (`/api` and `/api/:path*`):**
   - Directs any API call (e.g. `/api/health`, `/api/auth/login`) directly to the Render backend at `https://civora-l06w.onrender.com/api/...`.
   - Keeps browser requests same-origin, preserving HTTP-only `SameSite=Lax` cookies and bypassing third-party cookie blocking in modern browsers.
2. **Rule 3 (`/((?!api/).*)`):**
   - Uses negative lookahead regex to match any frontend path that is *not* an API request (e.g. `/login`, `/register`, `/tenders`, `/track`).
   - Serves `dist/index.html` with HTTP 200, enabling client-side routing.

---

## 5. Build Validation Results

The frontend production build was verified locally using Vite 8 + TypeScript:

```bash
cd client && npm run build
```

**Output:**
```
> client@0.0.0 build
> tsc -b && vite build

vite v8.3.4 building client environment for production...
transforming...
✓ 91 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        1.06 kB │ gzip:   0.56 kB
dist/assets/CivicMap-vh-t_kPv.css                     15.09 kB │ gzip:   6.36 kB
dist/assets/index-Cnrau5NG.css                       108.43 kB │ gzip:  17.91 kB
dist/assets/LoginPage-BQeEFZ5U.js                      5.61 kB │ gzip:   2.12 kB
dist/assets/index-D0LFIVNJ.js                        356.22 kB │ gzip: 101.88 kB
✓ built in 877ms
```

- **Compilation Errors:** 0
- **TypeScript Type Checks:** PASS
- **Bundle Integrity:** Valid HTML and chunk entrypoints emitted.

---

## 6. Comprehensive Routes Verification Matrix

| Route Path | Route Component | Access Level | Behavior on Direct Load & Refresh |
|---|---|---|---|
| `/` | `LandingPage` | Public | Loads hero, statistics, civic issue categories |
| `/login` | `LoginPage` | Public | Renders login form (email, password toggle) |
| `/register` | `RegisterPage` | Public | Citizen registration & contractor onboarding |
| `/dashboard` | `LandingPage` | Public / Shared | Aliased to primary landing / overview |
| `/report` | `ReportIssuePage` | Protected (Citizen) | Civic complaint reporting form |
| `/track` | `TrackComplaintPage` | Public | Complaint tracking search by reference ID |
| `/my-complaints` | `MyComplaintsPage` | Protected (Citizen) | User's grievance submission history |
| `/transparency` | `TransparencyPage` | Public | Public works expenditure & SLA metrics |
| `/tenders` | `TendersPage` | Public / Contractor | Public works tender board |
| `/tenders/:id` | `TenderDetailPage` | Public / Contractor | Detailed tender specs and bid submission |
| `/contractor` | `ContractorWorkspacePage` | Protected (Contractor) | Bidding and active contract management |
| `/official` | `OfficialWorkspacePage` | Protected (Official/Admin) | Department triage & grievance action queue |
| `/official/workspace` | `OfficialWorkspacePage` | Protected (Official/Admin) | Official assignment workspace |
| `/admin` | `AdminComplaintsPage` | Protected (Admin/Staff) | Master platform triage and management |
| `/admin/complaints` | `AdminComplaintsPage` | Protected (Admin/Staff) | Administrative grievance resolution table |
| `/admin/moderation` | `ModerationQueuePage` | Protected (Admin/Staff) | Content moderation & duplicate report queue |
| `/admin/system` | `AdminSystemPage` | Protected (Admin) | Platform health & diagnostic controls |
| `/rules` | `PlatformRulesPage` | Public | Civic participation code of conduct |
| `/notifications` | `NotificationsPage` | Protected (All) | In-app notification center |
| `/settings/notifications` | `NotificationPreferencesPage` | Protected (All) | Email & push notification toggles |
| `/sla` | `SlaManagementPage` | Protected (Official/Admin) | Service Level Agreement monitor |
| `/engagement` | `EngagementHubPage` | Public | Community proposals & participatory polls |
| `/engagement/proposals/new` | `ProposalSubmitPage` | Protected (Citizen) | Citizen civic proposal submission |
| *(unknown path)* | `NotFoundPage` | Public | Custom 404 screen with "Return to Overview" |

---

## 7. Remaining Deployment Step for the User

Because Git pushes are managed by the repository owner, push these changes to GitHub so Vercel can trigger a fresh build:

1. **Commit & Push to GitHub:**
   - Ensure `client/vercel.json`, `vercel.json`, and `client/src/App.tsx` are committed and pushed to your deployment branch (`main`).
2. **Vercel Automatic Deployment:**
   - Once pushed, Vercel will automatically detect the commit, run `vite build`, and apply the new `vercel.json` rewrites.
3. **Verify:**
   - Visit `https://civora-tau.vercel.app/login` in an incognito window.
   - Verify that the page loads directly with HTTP 200 without returning 404.

