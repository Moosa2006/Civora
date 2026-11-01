# Civora &mdash; Module 9: Notification System, Real-Time Alerts, Citizen–Official Communication & Notification Preferences

## 1. Overview

Module 9 introduces an integrated, responsive notification and communication layer to Civora. It keeps citizens informed about the lifecycle of their complaints, notifies officials and department field staff of assigned tasks and citizen messages, and provides a persistent, verifiable communication history without compromising citizen privacy.

### Core Capabilities
1. **In-App Notification Center (`/notifications`, `/api/notifications`)**:
   - Centralized inbox for authenticated users.
   - Unread badge counter in desktop navbar and mobile navigation drawer.
   - Read/unread state tracking with individual and bulk "mark all as read" actions.
   - Deep-linking directly to tracking pages (`/track?id=CIV-...`) or staff workspaces (`/official/workspace`).
   - Resilient pagination and query filtering (`all`, `unread`, `read`).
2. **Authoritative Domain Event Catalog**:
   - Notifications triggered exclusively by backend lifecycle actions (complaint lodging, triage status changes, department assignment, public progress updates, resolution submission, citizen verification, reopening).
   - Server-side recipient resolution: routes alerts strictly to the affected citizen or responsible department staff.
   - Deduplication engine preventing repeated alerts for identical events within a configurable time window.
3. **Citizen–Official Direct Communication (`/api/complaints/:id/messages`)**:
   - Complaint-linked messaging thread connecting grievance owners and assigned department staff.
   - Strictly isolated from public transparency pages and external unverified viewers.
   - Support for staff-only internal memos (`isInternal: true`) that are hidden from citizens.
   - Instant notification dispatch to the counterpart upon message publication.
4. **User Notification Preferences (`/settings/notifications`, `/api/notifications/preferences`)**:
   - Granular user-level opt-in/opt-out controls for grievance status transitions, field progress milestones, department assignments, messages, and resolution alerts.
   - Optional external channel configuration (Email).
   - Fallback defaults for newly registered and unconfigured users.
   - Core public accountability guarantee: statutory verification requests and tracking ID generation are always preserved in the in-app audit log.
5. **Real-Time Polling & Unread Counts**:
   - Lightweight, authenticated counter polling (`GET /api/notifications/unread-count`) every 25 seconds.
   - Automatic refresh when the browser tab regains focus.

---

## 2. Notification Event Catalog

| Event Name | Authoritative Trigger | Recipient(s) | Default Preference | Public / Private |
|---|---|---|---|---|
| `COMPLAINT_SUBMITTED` | Citizen lodges complaint via `POST /api/complaints` | Citizen (Complaint Owner) | `statusChangeAlerts: true` | Private (Owner) |
| `STATUS_CHANGED` | Admin/Staff triages complaint in `PATCH /api/admin/complaints/:id/status` | Citizen (Complaint Owner) | `statusChangeAlerts: true` | Private (Owner) |
| `DEPARTMENT_ASSIGNED` | Admin assigns department/official in `PATCH /api/admin/complaints/:id/assign` | Assigned Official & Citizen Owner | `assignmentAlerts: true` | Private (Parties) |
| `PROGRESS_UPDATE` | Official logs milestone in `POST /api/complaints/:id/progress` | Citizen (Complaint Owner) | `progressUpdateAlerts: true` | Public-safe |
| `RESOLUTION_SUBMITTED` | Official marks resolved in `POST /api/complaints/:id/resolution` | Citizen (Complaint Owner) | `resolutionAlerts: true` | Private (Owner) |
| `RESOLUTION_VERIFIED` | Citizen verifies work in `POST /api/complaints/:id/verify-resolution` | Assigned Official / Department | `resolutionAlerts: true` | Private (Staff) |
| `COMPLAINT_REOPENED` | Citizen disputes resolution in `POST /api/complaints/:id/reopen` | Assigned Official / Department | `resolutionAlerts: true` | Private (Staff) |
| `MESSAGE_RECEIVED` | Citizen or Official sends message in `POST /api/complaints/:id/messages` | Counterpart (Official or Citizen) | `messageAlerts: true` | Private (Thread) |
| `SYSTEM_ALERT` | Administrative operational announcement | Affected User(s) | Mandatory (Always delivered) | Private |

### Deduplication Engine
`NotificationService` verifies whether a notification with identical `(userId, type, entityId)` was issued within the deduplication window (default: 15–30 seconds). If found, the existing notification is returned rather than generating duplicate alerts.

---

## 3. REST API Reference

### 3.1 Get User Notifications
- **Route**: `GET /api/notifications?page=1&limit=15&isRead=false`
- **Auth**: Authenticated User (Bearer Token / Cookie)
- **Query Parameters**:
  - `page`: Integer $\ge 1$ (Default: `1`).
  - `limit`: Integer between 1 and 50 (Default: `15`).
  - `isRead`: `'true'`, `'false'`, or `'all'` (Default: `'all'`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "e9b2...",
        "userId": "c71a...",
        "type": "STATUS_CHANGED",
        "title": "Status Update: CIV-2026-ABCDE",
        "message": "Status updated to IN_PROGRESS. Remarks: Field crew deployed.",
        "entityType": "COMPLAINT",
        "entityId": "a1f8...",
        "actionUrl": "/track?id=CIV-2026-ABCDE",
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-10-17T16:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 15,
      "total": 1,
      "totalPages": 1,
      "unreadCount": 1
    }
  }
}
```

### 3.2 Get Unread Notification Count
- **Route**: `GET /api/notifications/unread-count`
- **Auth**: Authenticated User
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

### 3.3 Mark Individual Notification as Read
- **Route**: `PATCH /api/notifications/:id/read`
- **Auth**: Authenticated User (Strict ownership enforced: returns `403 FORBIDDEN` if notification belongs to another user)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Notification marked as read.",
  "data": {
    "notification": {
      "id": "e9b2...",
      "isRead": true,
      "readAt": "2026-10-17T16:20:00.000Z"
    }
  }
}
```

### 3.4 Mark All Notifications as Read
- **Route**: `POST /api/notifications/mark-all-read`
- **Auth**: Authenticated User
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "All notifications marked as read.",
  "data": {
    "count": 3
  }
}
```

### 3.5 Get Notification Preferences
- **Route**: `GET /api/notifications/preferences`
- **Auth**: Authenticated User
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "preferences": {
      "userId": "c71a...",
      "emailNotifications": false,
      "statusChangeAlerts": true,
      "progressUpdateAlerts": true,
      "assignmentAlerts": true,
      "messageAlerts": true,
      "resolutionAlerts": true,
      "isDefault": false
    }
  }
}
```

### 3.6 Update Notification Preferences
- **Route**: `PUT /api/notifications/preferences`
- **Auth**: Authenticated User
- **Body**:
```json
{
  "emailNotifications": true,
  "statusChangeAlerts": false
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Notification preferences updated successfully.",
  "data": {
    "preferences": { ... }
  }
}
```

### 3.7 Get Complaint Communication Thread
- **Route**: `GET /api/complaints/:id/messages`
- **Auth**: Authenticated Citizen (Complaint owner), Assigned Official, or Administrator
- **Path Parameter**: `:id` &mdash; Complaint UUID or Crockford tracking ID (`CIV-YYYY-XXXXX`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "complaintId": "a1f8...",
    "trackingId": "CIV-2026-ABCDE",
    "title": "Severe pothole near Ring Road junction",
    "messages": [
      {
        "id": "m1...",
        "complaintId": "a1f8...",
        "senderId": "c71a...",
        "message": "Has the field inspection been scheduled?",
        "isInternal": false,
        "isRead": true,
        "readAt": "2026-10-17T16:25:00.000Z",
        "createdAt": "2026-10-17T16:20:00.000Z",
        "sender": {
          "id": "c71a...",
          "name": "Aarav Sharma",
          "role": "CITIZEN"
        }
      }
    ]
  }
}
```

### 3.8 Send Complaint Message
- **Route**: `POST /api/complaints/:id/messages`
- **Auth**: Authenticated Complaint Owner, Assigned Official, or Administrator
- **Body**:
```json
{
  "message": "Field inspection has been scheduled for tomorrow morning.",
  "isInternal": false
}
```
- **Response `201 Created`**: Returns created message record and dispatches `MESSAGE_RECEIVED` notification to the counterpart.

---

## 4. Security, Access Boundaries & Privacy

1. **Strict Session Isolation**: Every notification lookup, unread count check, and read status change scopes its query strictly by `userId: req.user.id`. Guessing another user's UUID returns HTTP 403 or HTTP 404.
2. **Citizen-Official Scope**:
   - Citizens can only read and post messages to complaints they lodged (`complaint.citizenId === req.user.id`).
   - Officials can only read and post messages to complaints within their assigned department or where they are the designated official.
3. **Internal Note Masking**: Staff notes marked with `isInternal: true` are completely excluded from database queries performed by citizens.
4. **Input Sanitization**: Messages are trimmed and validated with Zod (min 1, max 2000 characters). HTML is safely rendered as plain text in the React frontend, preventing cross-site scripting (XSS).
5. **Graceful External Delivery Fallback**: The core grievance workflow and in-app alert generation never depend on third-party email uptime. If SMTP is unconfigured or transiently fails, the transaction completes successfully and in-app notifications remain fully intact.

---

## 5. External Email Delivery Configuration

To enable external email delivery for users who have opted into `emailNotifications`, configure the following environment variables in `server/.env`:

```env
# Optional External Email Provider
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Civora Notifications <notifications@civora.local>"
```

*Note: If these variables are omitted, Civora runs safely in in-app notification mode without raising runtime exceptions.*

---

## 6. Developer Verification & Test Execution

### Run All Automated Tests
```bash
cd server
npm test
```
*Executes all 97 automated tests across 29 test suites, including the 14 Module 9 integration tests in `server/test/notifications.test.ts`.*

### Run Monorepo Build
```bash
npm run build
```
*Validates TypeScript compilation across both client (`tsc -b && vite build`) and server (`tsc`).*
