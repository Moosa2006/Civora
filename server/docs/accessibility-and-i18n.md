# Module 15: Accessibility, Multilingual Support & Inclusive Citizen Experience

## Civora — Civic Issue Reporting and Public Accountability Platform

### 1. Architectural Overview & Core Principles

Module 15 establishes an end-to-end accessibility, internationalization (i18n), and inclusive experience framework for Civora. Its mission is to ensure that every citizen &mdash; regardless of physical ability, primary language, digital literacy level, device form-factor, or network connectivity &mdash; can report civic issues, track municipal actions, and hold public authorities accountable.

#### Foundational Principle:
> **"Public civic accountability must be universally accessible. Civora treats accessibility and multilingual support as core human rights in civic participation, adhering to WCAG 2.2 Level AA standards while ensuring Indian regional scripts (Devanagari, Gurmukhi) and low-connectivity environments are first-class platform citizens."**

---

### 2. Supported Languages & Regional Coverage

Civora currently supports three primary civic languages with complete translation coverage across all public and authenticated workflows:

| Code | Language | Native Name | Script | Direction | Regional Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`en`** | English | English | Latin | LTR | Pan-India / Administrative Standard (Default) |
| **`hi`** | Hindi | हिन्दी | Devanagari | LTR | Official / Northern, Central & Western India |
| **`pa`** | Punjabi | ਪੰਜਾਬੀ | Gurmukhi | LTR | Punjab, Northern Municipalities & Diaspora |

---

### 3. Internationalization (i18n) Architecture

The platform uses a typed, zero-overhead React 19 internationalization system designed for Vite and TypeScript:
- **Location**: `client/src/i18n/` and `client/src/context/I18nContext.tsx`
- **Translation Dictionaries**:
  - `client/src/i18n/locales/en.ts` (Canonical reference dictionary)
  - `client/src/i18n/locales/hi.ts` (Hindi reference dictionary in Devanagari)
  - `client/src/i18n/locales/pa.ts` (Punjabi reference dictionary in Gurmukhi)
- **Namespaces Organized By Domain**:
  - `common`: Action buttons, common labels, dialog confirmations, connectivity status.
  - `status`: Civic complaint lifecycle enums (`SUBMITTED`, `IN_PROGRESS`, `RESOLVED`, etc.).
  - `priority`: Urgency levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - `nav`: Primary desktop and mobile navigation links, role badges, authentication buttons.
  - `home`: Hero headlines, civic value propositions, how-it-works steps, accountability banners.
  - `complaints`: Grievance categories, field labels, placeholders, duplicate warnings, draft notices.
  - `tracking`: Status timeline steps, official notes, SLA countdowns, resolution proof.
  - `transparency`: Metrics, department scorecards, ward distribution, accessible data summaries.
  - `civicMap`: Search filters, radius queries, accessible list view toggle, privacy guarantees.
  - `engagement`: Proposals, polls, voting buttons, community discussions.
  - `moderation`: Report modal, platform rules, non-suppression guarantees for civic criticism.
  - `accessibility`: Preference controls, text scaling, reduced motion, contrast, screen reader help.
  - `errors`: Network failure, offline notice, validation messages, rate limiting.

#### Translation Fallback Strategy:
1. When resolving a key via `t(keyPath, params)`:
   - System checks the active locale's dictionary (`hi` or `pa`).
   - If the key is missing or undefined, it gracefully falls back to canonical English (`en`).
   - If missing in English, returns the key path rather than crashing or rendering blank space.
2. Variable interpolation: Replaces `{{param}}` or `{param}` with supplied dynamic values.
3. DOM Synchronization: Sets `document.documentElement.lang = locale` and `document.documentElement.dir = 'ltr'` on every language change.

---

### 4. Language Preference Persistence Hierarchy

Civora enforces a 4-tier preference resolution hierarchy:
1. **Authenticated Account Preference**: When a signed-in user changes language, the choice is saved to the PostgreSQL database via `PUT /api/accessibility/preferences`. On subsequent sign-ins from any device, their language is automatically restored.
2. **Local Storage Fallback**: For anonymous visitors, the language selection is persisted in `localStorage.getItem('civora_language')`.
3. **Browser Navigator Preference**: If no saved preference exists, `navigator.language` is evaluated (e.g. `'hi-IN'` &rarr; `'hi'`, `'pa-IN'` &rarr; `'pa'`).
4. **Platform Default**: Falls back to English (`en`).

---

### 5. Adding a New Language Guide

To add a new Indian regional language (e.g., Bengali `bn`, Tamil `ta`, Kannada `kn`):
1. **Define Code**: Add the ISO 639-1 code to `SUPPORTED_LANGUAGES` in `server/src/validation/accessibility.validation.ts` and `client/src/i18n/index.ts`.
2. **Create Translation File**: Duplicate `client/src/i18n/locales/en.ts` to `client/src/i18n/locales/[code].ts` and translate all namespace values into the native script.
3. **Register Metadata**: Add the locale object to `LOCALE_INFO` in `client/src/i18n/index.ts` and `SUPPORTED_LANGUAGES_METADATA` in `server/src/controllers/accessibility.controller.ts`.
4. **Font Stack**: Verify native OS font fallback in `client/src/index.css` (e.g., `'Vrinda'`, `'Latha'`, `'Tunga'`, `'Nirmala UI'`).

---

### 6. WCAG 2.2 Level AA Accessibility Safeguards

#### 6.1 Keyboard Navigation & Focus Management:
- **Skip-to-Main-Content**: A high-visibility skip link (`href="#main-content"`) is the first focusable element on every page.
- **Focus Rings**: All interactive controls (`button`, `a`, `input`, `select`, `textarea`) provide standard focus rings:
  `outline: 2px solid var(--border-focus); outline-offset: 2px;`.
- **Modal Dialog Focus Trapping**: Modals (`AccessibilitySettingsModal`, `ReportAbuseModal`, `LocationPickerModal`) trap keyboard Tab focus within the active dialog, dismiss on `Escape`, and return focus to the triggering element upon closure.
- **No Keyboard Traps**: Users can navigate in and out of all dropdowns, lists, and form elements purely via `Tab`, `Shift+Tab`, `ArrowUp`, `ArrowDown`, `Enter`, and `Space`.

#### 6.2 Screen-Reader Support & Semantic HTML5:
- **Semantic Structure**: Proper usage of `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<form>`, `<fieldset>`, and `<button>`.
- **Live Announcer Region (`LiveAnnouncer.tsx`)**: Invisible `role="status" aria-live="polite"` and `role="alert" aria-live="assertive"` regions announce dynamic state changes (language switches, draft auto-saves, complaint submissions).
- **Form Controls**: Every input is wrapped in `<FormField>` with explicit `htmlFor` matching the input `id`.
- **Error Association**: Validation errors use `role="alert"` and inputs specify `aria-invalid="true"` and `aria-describedby="{id}-error"`.
- **Button Busy States**: Buttons indicate asynchronous loading via `aria-busy="true"` alongside spinning SVGs marked `aria-hidden="true"`.

#### 6.3 Non-Color Status Indicators:
- To comply with WCAG 2.2 SC 1.4.1 (Use of Color), complaint statuses and badges never rely on color alone.
- Every badge includes a distinct SVG icon indicator:
  - `success` (Resolved/Verified): Checkmark icon (✓)
  - `danger` (Rejected/Reopened): Warning triangle icon (⚠)
  - `warning` (In Progress/Under Review): Clock icon (⏳)
  - `info` (Submitted/Lodged): Info circle icon (ℹ)

#### 6.4 Color Contrast Compliance:
- Dark canvas background (`#090e17`) with high-contrast text (`#f8fafc`, ratio $\approx 18:1$, exceeding WCAG 4.5:1 requirement).
- Secondary supporting text (`#94a3b8`, ratio $\approx 7.5:1$).
- Interactive blue buttons (`#2563eb`, ratio $\ge 4.5:1$ against white text).
- Form borders meet the 3:1 non-text contrast threshold (`#334155` and `#1e293b`).

#### 6.5 Indian Script Typography & Text Resizing:
- Native font stack configured in `client/src/index.css`:
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Nirmala UI", "Gurmukhi MN", "Raavi", "Mukta", "Helvetica Neue", Arial, sans-serif`
- Line height set to `1.55` to prevent clipping of Devanagari matras and Gurmukhi vowel diacritics.
- Scalable text sizing:
  - `Standard`: $100\%$ root font size.
  - `Large`: $115\%$ root font size (`html[data-text-size="large"]`).
  - `Extra Large`: $130\%$ root font size (`html[data-text-size="larger"]`).
  - Entire layout reflows dynamically without horizontal clipping or container overflow.

#### 6.6 Reduced Motion:
- Respects OS-level `prefers-reduced-motion: reduce`.
- Includes explicit user toggle in Accessibility settings (`html[data-reduced-motion="true"]`).
- Disables animations, smooth transitions, and pulsing effects for motion-sensitive users.

#### 6.7 Mobile & Touch Accessibility:
- Minimum touch target heights: Primary buttons set to `min-h-[40px]` (medium) and `min-h-[44px]` (large & mobile controls).
- Fully responsive mobile navigation drawer with touch-friendly language and accessibility controls.
- Touch action optimization: `touch-action: manipulation;` preventing unintended 300ms mobile tap delays.

---

### 7. Low-Bandwidth & Offline Resilience

Civora protects citizens reporting in low-connectivity or degraded network environments:
1. **Local Draft Auto-Persistence**:
   - In `ReportIssuePage.tsx`, non-sensitive form inputs (title, category, priority, locality, address, description, ward, coordinates) are automatically saved to `localStorage` under `'civora_complaint_draft'`.
   - If connection drops, the browser refreshes, or the user navigates away accidentally, their input is automatically restored on return with a prominent advisory banner and a "Discard Draft" option.
2. **Graceful Network Error Recovery**:
   - When network failure occurs during complaint filing, form inputs are **never** cleared.
   - The user is presented with a clear message: *"Unable to reach the municipal server. Please check your connection and retry. Your form inputs remain safely preserved."* with a direct "Retry Submission" button.
3. **No False Offline Claims**:
   - The system does not falsely promise offline filing; it preserves entered drafts locally until an active connection is established.

---

### 8. Accessible Geographic & Analytics Alternatives

- **Accessible Civic Map Explorer (Module 13 Integration)**:
  - Citizens who cannot use mouse-driven interactive maps can toggle the **Accessible List View** (`listViewToggle`), providing a searchable, screen-reader-friendly table of nearby public complaints.
- **Accessible Transparency Analytics (Module 8 Integration)**:
  - Chart cards provide accessible text summaries and structured data breakdowns for non-visual consumers.

---

### 9. Database & Prisma Schema Impact

- **Model Added**: `UserAccessibilityPreference`
  ```prisma
  model UserAccessibilityPreference {
    id            String   @id @default(uuid()) @db.Uuid
    userId        String   @unique @db.Uuid
    user          User     @relation("UserAccessibilityPreferences", fields: [userId], references: [id], onDelete: Cascade)
    language      String   @default("en") @db.VarChar(10)
    textSize      String   @default("normal") @db.VarChar(20)
    reducedMotion Boolean  @default(false)
    highContrast  Boolean  @default(false)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@map("user_accessibility_preferences")
  }
  ```
- **Migration**: `server/prisma/migrations/20261019000000_add_user_accessibility_preferences/migration.sql`
- **Migration Status**: Verified and deployed cleanly to `Cevora` database with `npx prisma migrate deploy`.

---

### 10. Automated Test Results

Automated test suite in `server/test/accessibility.test.ts` (11 dedicated tests) executed against live database:
- `GET /api/accessibility/languages` returns directory of Indian regional languages &mdash; **PASS**
- `GET /api/accessibility/preferences` returns standard defaults for unauthenticated visitor &mdash; **PASS**
- `GET /api/accessibility/preferences` returns defaults when user has no saved record &mdash; **PASS**
- `PUT /api/accessibility/preferences` rejects unauthenticated requests with HTTP 401 &mdash; **PASS**
- `PUT /api/accessibility/preferences` rejects unsupported language code with HTTP 400 &mdash; **PASS**
- `PUT /api/accessibility/preferences` rejects invalid text size with HTTP 400 &mdash; **PASS**
- `Citizen updates preferences to Hindi, large text, and reduced motion` &mdash; **PASS**
- `GET /api/accessibility/preferences` retrieves persisted Hindi preferences &mdash; **PASS**
- `Audit event is created upon updating accessibility preferences` &mdash; **PASS**
- `Citizen updates preference to Punjabi and extra large text` &mdash; **PASS**
- `Citizen B maintains independent preferences without being affected by Citizen A` &mdash; **PASS**

**Full Regression Verification**:
- **Total Backend Tests**: 217 tests passing across 59 suites (0 failures).
- **Server Compilation**: `tsc` exit code 0.
- **Client Compilation**: `tsc -b && vite build` exit code 0 (84 modules transformed).
