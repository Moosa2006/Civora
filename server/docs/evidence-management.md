# Module 12: Document & Evidence Management, Secure File Uploads, Verification & Resolution Proof

## Civora — Civic Issue Reporting and Public Accountability Platform

### 1. Architectural Overview & Core Principles

Module 12 introduces a robust, secure, verifiable, access-controlled, and auditable evidence management lifecycle for civic complaints in Civora.

#### Core Principle:
> **"A file being uploaded does not mean that it is authentic, verified, publicly visible, or proof that a complaint has been resolved."**

The platform enforces strict technical and business process separation between:
1. **File Upload**: Safe storage outside public roots with cryptographic validation.
2. **Technical Screening**: Magic-byte verification and malware policy checks.
3. **Evidence Review**: Human verification by municipal staff or administrators with an immutable audit log.
4. **Complaint Resolution**: Distinct official action; resolution proof upload does not automatically close complaints.

---

### 2. Supported File Types & Size Limits

| Format | MIME Type | Allowed Extensions | Magic Byte Signature | Max File Size |
|---|---|---|---|---|
| JPEG Image | `image/jpeg` | `.jpg`, `.jpeg` | `0xFF, 0xD8, 0xFF` | 10 MB |
| PNG Image | `image/png` | `.png` | `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A` | 10 MB |
| WebP Image | `image/webp` | `.webp` | `RIFF....WEBP` | 10 MB |
| PDF Document | `application/pdf` | `.pdf` | `0x25, 0x50, 0x44, 0x46` (`%PDF`) | 10 MB |

#### Batch Limits:
- Maximum files per single upload request: **5 files**.
- Maximum total payload per request: **50 MB** (enforced by Multer and body parser limits).
- Rate Limiting: 50 upload requests per 15-minute window per IP (bypassed in test environment).

---

### 3. Upload Validation & Defense-in-Depth

Every file uploaded to `/api/evidence/complaints/:complaintId/upload` undergoes strict multi-tier verification before persisting to disk or database:

1. **Authentication & Authorization**:
   - Citizens can only upload to complaints they personally created.
   - Government Officials can only upload to complaints assigned to their department or assigned directly to them.
   - Administrators have platform-wide upload rights.
2. **Multer Memory Processing**:
   - Files are parsed directly into memory (`Buffer`) using `multer.memoryStorage()`.
   - File extensions are validated against the allowlist.
3. **Magic-Byte Inspection**:
   - Inspects the true file header bytes directly using `StorageService.validateMagicBytes`.
   - Prevents MIME spoofing (e.g. an `.exe` or shell script renamed with a `.jpg` extension).
4. **Filename Sanitization & Path Traversal Prevention**:
   - Strip path characters (`../`, `..\`, null bytes) using `StorageService.sanitizeFileName`.
   - Physical disk storage keys use `crypto.randomUUID()`, ensuring user filenames never dictate filesystem layout.
5. **SHA-256 Checksum Calculation**:
   - Cryptographic hash is computed from the binary buffer and recorded in `Document.sha256Checksum` for immutable integrity verification.

---

### 4. Storage Architecture

#### Local Development:
- Base storage path: `server/uploads/evidence/complaints/<complaintId>/<uuid>.<ext>`
- Strictly located outside the public web root (`server/public` or client static roots).
- Directly inaccessible via browser URL.

#### Production Configuration (Cloud Object Storage):
The `StorageService` (`server/src/lib/storageService.ts`) is designed as an abstraction. To use AWS S3 or Google Cloud Storage in production:
1. Configure `STORAGE_PROVIDER=s3` or `gcs` in `server/.env`.
2. Supply bucket credentials (`AWS_S3_BUCKET`, `GCS_BUCKET_NAME`).
3. Replace `writeFile` and `createReadStream` with signed upload/download URLs (`getSignedUrlPromise`).

---

### 5. Evidence Purposes & Lifecycle Statuses

#### Evidence Purposes (`EvidencePurpose`):
- `CITIZEN_SUPPORTING`: Photographic damage or document submitted by citizen during or after lodging.
- `OFFICIAL_PROGRESS`: Intermediate milestone photos/reports from assigned field officials.
- `RESOLUTION_PROOF`: Photographs or formal completion documents showing resolved work.
- `ADMINISTRATIVE`: Internal inspection memos, surveyor records, or audit attachments (never default public).

#### Evidence Review Statuses (`EvidenceReviewStatus`):
- `PENDING_REVIEW`: Newly uploaded file awaiting inspection.
- `UNDER_REVIEW`: Locked into an active staff review session.
- `VERIFIED`: Formally approved by an authorized municipal official or admin.
- `REJECTED`: Rejected with mandatory `rejectionReason`.
- `RESUBMISSION_REQUESTED`: Marked for citizen replacement with mandatory `resubmissionGuidance`.
- `QUARANTINED`: Locked by administrator due to abuse or malicious content.

---

### 6. Review, Rejection & Quarantine Workflow

#### Review Workflow (`POST /api/evidence/:id/review`):
- Authorized for `ADMIN` and `GOVERNMENT_OFFICIAL` (within their department).
- **Approval (`VERIFIED`)**: Records reviewer, timestamp, and optional notes.
- **Rejection (`REJECTED`)**: Requires mandatory `rejectionReason`.
- **Resubmission (`RESUBMISSION_REQUESTED`)**: Requires mandatory `resubmissionGuidance`.
- All decisions append an immutable record to `EvidenceReviewLog`.

#### Quarantine Workflow (`POST /api/evidence/:id/quarantine`):
- Restricted exclusively to `ADMIN`.
- Immediately blocks all citizen and official downloads.
- Flags document as `isQuarantined: true` with a mandatory quarantine justification.
- Emits security audit events.

---

### 7. Resolution Proof Verification Rules

1. **Resolution Proof Upload != Complaint Resolution**:
   - Uploading files with purpose `RESOLUTION_PROOF` does **not** change the complaint status to `RESOLVED` or `VERIFIED`.
   - Resolution proof must go through the independent verification process.
2. **Citizen and Staff Visibility**:
   - Citizens can view resolution proof attached to their case once uploaded.
   - Citizens retain the right to confirm resolution or report dissatisfaction through the Module 7 citizen verification workflow.

---

### 8. Access Control & Privacy Protection

| Role | Access to Own Evidence | Access to Public Verified Evidence | Access to Private / Pending Evidence | Quarantine Override |
|---|---|---|---|---|
| **Citizen (Owner)** | Full view & download | Full view & download | Only their own uploaded files | No |
| **Citizen (Other)** | None | Full view & download | Forbidden (403) | No |
| **Official (Assigned Dept)** | Full view & review | Full view & download | Allowed for department complaints | No |
| **Official (Unrelated Dept)**| Forbidden (403) | Full view & download | Forbidden (403) | No |
| **Administrator** | Full platform access | Full platform access | Full platform access | Yes (Exclusive) |

#### Secure File Streaming:
- `GET /api/evidence/:id/file` (inline preview)
- `GET /api/evidence/:id/download` (attachment download)
- Headers sent:
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: private, max-age=3600`
  - `Content-Disposition: inline` (for images) or `attachment; filename="..."` (for documents)

---

### 9. Notification & Audit Integration

#### Notifications Emitted via `NotificationService`:
- `EVIDENCE_UPLOADED`: Dispatched to assigned officials or citizen owner.
- `EVIDENCE_VERIFIED`: Dispatched to citizen upon evidence acceptance.
- `EVIDENCE_REJECTED`: Dispatched to uploader with rejection justification.
- `EVIDENCE_RESUBMISSION_REQUESTED`: Dispatched to citizen with guidance on required corrections.
- `EVIDENCE_QUARANTINED`: Emitted when administrator flags abusive content.
- `RESOLUTION_PROOF_SUBMITTED`: Alerts citizen and supervisor that work proof is uploaded.
- `RESOLUTION_PROOF_VERIFIED`: Confirms verified proof.

#### Audit Trail (`AuditEvent` & `EvidenceReviewLog`):
- All status transitions, upload events, review decisions, and quarantine actions write immutable audit records with actor attribution, timestamp, and metadata diff.

---

### 10. API Endpoints Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/evidence/complaints/:complaintId/upload` | Bearer Token | Upload up to 5 files with metadata |
| `GET` | `/api/evidence/complaints/:complaintId` | Optional Auth | List visible evidence for a complaint |
| `GET` | `/api/evidence/pending-queue` | Official / Admin | List unverified evidence across assigned scope |
| `GET` | `/api/evidence/:id` | Optional Auth | Detailed metadata, checksum, and review history |
| `GET` | `/api/evidence/:id/file` | Optional Auth | Securely stream binary file for preview |
| `GET` | `/api/evidence/:id/download` | Optional Auth | Download binary file with safe disposition |
| `POST` | `/api/evidence/:id/review` | Official / Admin | Approve, reject, or request resubmission |
| `POST` | `/api/evidence/:id/quarantine` | Admin Only | Quarantine suspicious evidence |

---

### 11. Automated Test Suite

Run evidence test suite:
```bash
npx tsx --test test/evidence.test.ts
```

All 20 tests pass:
1. Citizen A valid JPEG upload as `CITIZEN_SUPPORTING`
2. Valid PDF document upload
3. Spoofed MIME type rejection (plain text disguised as image)
4. Unsupported file extension rejection (`.exe`, `.txt`)
5. Oversized file rejection (> 10MB)
6. Cross-citizen upload prevention (Citizen B cannot upload to Citizen A complaint)
7. Cross-department upload prevention (Sanitation cannot upload to PWD complaint)
8. Assigned official progress evidence upload (`OFFICIAL_PROGRESS`)
9. Resolution proof upload separation (does not auto-resolve complaint)
10. Citizen review queue access blocked (403)
11. Official review queue inspection with status/purpose filters
12. Rejection validation (missing `rejectionReason` returns 400)
13. Admin rejection with mandatory reason and review log creation
14. Resubmission validation (missing `resubmissionGuidance` returns 400)
15. Evidence approval with `VERIFIED` decision
16. Secure streaming headers (`nosniff`, `Content-Type`)
17. Secure download headers (`Content-Disposition: attachment`)
18. Non-admin quarantine blocked (403)
19. Admin quarantine with mandatory reason
20. Quarantined evidence blocked from normal streaming
