# Civora User Guide
## A Plain-English Manual for Citizens, Officials, Contractors, and Administrators

Welcome to **Civora**, the civic issue reporting and public accountability web platform. This guide explains what Civora is, how it works, and how each type of user can use it to improve local infrastructure, resolve grievances, and maintain transparency in public services.

---

## 1. What is Civora?

Civora is an open civic platform designed to connect residents with local government authorities and municipal service providers.

- **For Citizens:** Civora provides a straightforward way to report infrastructure failures—such as broken streetlights, contaminated drinking water, dangerous potholes, garbage accumulation, or drainage overflow. Citizens receive a unique tracking identifier for every issue and can watch official progress at every stage without having to make repeated office visits or phone calls.
- **For Government Officials:** Civora serves as an operational management workspace. Departments can inspect assigned grievances, track service-level agreement (SLA) deadlines, record on-site field progress, upload photographic proof of work, communicate directly with citizens, and mark verified resolutions.
- **For Contractors:** Civora provides an open window into public tenders, bidding, work orders, milestones, and payment transparency for municipal repair and infrastructure projects.
- **For Administrators:** Civora offers complete operational oversight, system diagnostics, role assignments, audit logs, and content moderation safeguards to protect community integrity.
- **For the Public:** Anyone can access the real-time Transparency Dashboard and Civic Map to see how municipal departments are performing, which wards have the highest resolution rates, and where civic investments are being made.

---

## 2. Main Features

Civora includes the following verified features:

1. **Citizen Issue Reporting:** Submit grievances with category, title, detailed description, locality, ward, and optional GPS coordinates or landmark pinning.
2. **Real-Time Tracking:** Enter any tracking number (such as `CIV-A1B2C3D4`) to view the complete event timeline, assigned department, SLA targets, and official status updates.
3. **My Complaints:** An authenticated dashboard showing all complaints filed by your account, categorized by status (Active, Resolved, Reopened).
4. **Interactive Civic Map:** Explore complaints geographically generalized to ~110m resolution to protect resident doorstep privacy while highlighting civic issue hotspots across municipal wards.
5. **Public Transparency Dashboard:** View live resolution rates, average turnaround days, monthly trend graphs, and department-by-department scorecards without needing to log in.
6. **Community Engagement Hub:** Propose neighborhood improvements, endorse fellow residents' ideas, and participate in official municipal public polls.
7. **Direct Official Messaging:** Exchange clarifications, status inquiries, and progress notes between complainants and assigned government engineers.
8. **Tamper-Evident Evidence Section:** Inspect uploaded photographs and documents with verified MIME types, size bounds, and official verification badges.
9. **Municipal Tenders & Work Orders:** Browse published civic repair contracts, submit bids, track award status, submit work-start notices, and document milestone completion.
10. **Service-Level Agreement (SLA) Escalations:** Automatic tracking of target resolution deadlines with supervisory alerts and transparency logs when deadlines are exceeded.
11. **Notifications & Preferences:** In-app status alerts with customizable notification channels and quiet hours.
12. **Accessibility & Multi-Language Support:** High-contrast text exceeding WCAG 2.2 AA standards, keyboard navigation, screen-reader landmarks, and trilingual support (English, Kannada, Hindi).

---

## 3. Getting Started

### How to Open Civora
Open your modern web browser (Google Chrome, Mozilla Firefox, Apple Safari, or Microsoft Edge) and navigate to the Civora web address:
- In local development / testing: `http://localhost:5173`
- In production: Your organization's configured domain (e.g., `https://civora.city.gov`)

### How to Register an Account
1. Click the **Register** link in the top navigation bar.
2. Choose your account type:
   - **Citizen:** For residents reporting issues and participating in community polls.
   - **Contractor:** For licensed companies seeking to bid on municipal work orders.
3. Fill in your full name, email address, phone number (optional), and create a secure password (minimum 8 characters with at least one uppercase letter, one lowercase letter, and one number).
4. Contractors must also supply their registered company name, trade license number, business address, and primary work category.
5. Click **Create Account**. You will be automatically signed in.

### How to Sign In
1. Click the **Sign In** link in the top navigation bar.
2. Enter your registered email address and password.
3. Click **Sign In to Civora**.

### Identifying Your Current Role
Once signed in, look at the top-right corner of the navigation bar:
- Next to your name, an official badge displays your assigned role:
  - **Citizen** (soft cream badge)
  - **Official** (amber badge)
  - **Contractor** (teal badge)
  - **Admin** (purple badge)
- The navigation bar automatically adapts to your role, displaying only the tools and menus you are authorized to use.

### How to Sign Out Safely
Click your name or the **Sign Out** button in the top-right corner of the navigation bar. Your session will terminate securely.

---

## 4. How to Use Civora as a Citizen

### Reporting a Civic Problem
1. Click **Report Issue** in the navigation bar (or visit `/report`).
2. **Category Selection:** Choose the department that best fits your grievance:
   - *Roads & Infrastructure:* Potholes, damaged footpaths, missing manhole covers.
   - *Water Supply & Sewerage:* Pipeline leaks, low water pressure, contaminated supply.
   - *Sanitation & Waste Management:* Missed garbage pickup, overflowing public bins, illegal dumping.
   - *Street Lighting & Electricity:* Broken street lamps, sparking cables, fallen utility poles.
   - *Public Health & Environment:* Stagnant water, mosquito breeding, air/noise pollution.
3. **Problem Title:** Enter a concise, descriptive title (e.g., *"Dangerous open manhole on 5th Cross Road"*).
4. **Detailed Description:** Provide clear details:
   - What is happening?
   - How long has it been broken?
   - Is it causing an immediate safety hazard?
5. **Location Details:**
   - Select your municipal **Locality** from the dropdown (e.g., *Indiranagar*, *Koramangala*, *Whitefield*).
   - Enter the **Ward number** if known.
   - Enter landmark details (e.g., *"Opposite Government Primary School"*).
   - *Optional:* Click **Pin on Map** to drop a precise pin or use your device's GPS.
6. **Upload Evidence (Photos):**
   - Click **Add Photos / Documents** to attach clear pictures of the problem.
   - Allowed formats: JPEG, PNG, WebP, PDF (maximum 10 MB per file).
7. **Submit:** Click **Submit Grievance**.
8. **Save Your Tracking Number:** You will see a success confirmation with your permanent tracking identifier (e.g., `CIV-9B7C1A2F`). Save this identifier or take a screenshot.

> [!TIP]
> **Privacy Tip:** Never include private personal data (such as bank details, government identity card numbers, or family phone numbers) inside public complaint descriptions. Civora automatically protects your doorstep address by generalizing map coordinates to ~110m.

### Tracking an Existing Complaint
1. Click **Track** in the top navigation bar (or visit `/track`).
2. Type or paste your tracking ID into the search box.
3. Click **Search**.
4. You will see:
   - Current status (e.g., `SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`).
   - The department and handling officer.
   - Estimated resolution deadline under municipal SLA policies.
   - The step-by-step progress history.
   - The direct message thread where you can ask the handling official questions.

### Confirming or Reopening a Resolved Issue
- When an official marks your issue as `RESOLVED`, visit `/track?id=YOUR-ID`.
- If the work was completed satisfactorily, click **Verify Resolution** to give a rating and close the issue.
- If the problem was not actually fixed or was done improperly, click **Reopen Complaint**, state the specific reason, and attach a new photo showing the unresolved condition.

---

## 5. How to Use Civora as an Official

Authorized government officers and field engineers use Civora to coordinate timely resolution of municipal grievances.

### Accessing the Official Dashboard
1. Sign in with your official account (`@civora.gov` or authorized email).
2. The navigation bar displays your operational tools:
   - **Official Dashboard** (`/official/workspace`): High-level department overview, overdue alerts, and quick actions.
   - **Complaints Queue** (`/admin/complaints`): Filterable list of all complaints assigned to your jurisdiction.
   - **Tenders & Awards** (`/admin/tenders`): Public works procurement and contractor work order oversight.
   - **SLA Escalations** (`/sla`): Monitoring SLA targets and supervisor review queues.

### Managing Complaints
1. Open the **Complaints Queue** (`/admin/complaints`).
2. Use the filters to find issues:
   - Filter by **Status**: *Submitted*, *Under Review*, *Assigned*, *In Progress*.
   - Filter by **Priority**: *Urgent*, *High*, *Medium*, *Low*.
   - Filter by **Ward** or **Locality**.
3. Click on any complaint row to open its management workspace.
4. **Accepting or Assigning:**
   - Click **Accept Assignment** to take personal operational ownership.
   - Or assign the complaint to a designated junior engineer in your department.
5. **Recording Field Progress:**
   - Change status to `IN_PROGRESS` once physical field work begins.
   - Post progress notes (e.g., *"Excavation completed, replacement pipe arriving Thursday"*).
   - Upload field inspection photographs into the Evidence tab with visibility set to *Public* or *Internal Official*.
6. **Submitting Final Resolution:**
   - When repairs are complete, change status to `RESOLVED`.
   - Provide a mandatory **Resolution Summary** explaining what was done.
   - Upload completion photographs as proof of work.
   - The citizen will be notified automatically to verify the resolution.

---

## 6. How to Use Civora as a Contractor

Licensed contractors use Civora to discover municipal repair tenders, submit bids, accept civic work orders, and submit verified milestone progress for payment processing.

### Discovering Tenders
1. Sign in with your contractor account and visit **Find Tenders** (`/tenders`).
2. Browse through published tenders issued by municipal departments.
3. Each tender card clearly shows:
   - Project title and scope of work.
   - Sponsoring department.
   - Estimated budget (e.g., `₹4,50,000`).
   - Submission deadline date and time.
   - Mandatory eligibility criteria (e.g., *Class 2 Civil License*).
4. Click **View Details** to read the full specifications and download official tender documents.

### Submitting a Bid
1. On the tender details page, check that your registration class meets the tender criteria.
2. Click **Submit Tender Bid**.
3. Enter your proposed total cost and estimated completion duration in days.
4. Attach your technical proposal and cost schedule breakdown.
5. Confirm that your bid adheres to platform anti-collusion rules.
6. Click **Submit Bid**.
7. Once submitted, your bid status will show `SUBMITTED` and you can track evaluation updates from the **My Bids** tab on your Contractor Dashboard (`/contractor?tab=bids`).

### Executing Awarded Work Orders
When your bid is accepted and officially awarded by the department:
1. Open **Work Orders** on your Contractor Workspace (`/contractor?tab=work_orders`).
2. **Work-Start Declaration:** Submit your commencement date, safety protocol compliance, and on-site supervisor contact details.
3. **Milestone Submissions:** As work progresses, submit milestone claims (e.g., *Phase 1: 30% Foundation Completed*) with on-site timestamped photographs.
4. **Payment Ledger:** Track approved milestone certificates and payment status under `/contractor?tab=payments`.
5. **Warranty & Defects:** Review any defect rectification notices issued during the statutory warranty period under `/contractor?tab=defects`.

---

## 7. How to Use Civora as an Administrator

System Administrators maintain platform security, configure governance rules, onboard staff, and monitor operational health.

### Accessing Administration Tools
1. Sign in with an account having the `ADMIN` role.
2. Click **Governance** in the top navigation bar to access:
   - **System & Health** (`/admin/system`): Database latency, backend diagnostics, and real-time entity volume.
   - **Complaints Governance** (`/admin/complaints`): Universal complaint overview across all departments.
   - **Tender Governance** (`/admin/tenders`): Reviewing and approving published tenders and contract awards.
   - **Moderation Queue** (`/admin/moderation`): Reviewing reported abuse, citizen appeals, and spam prevention.
   - **Platform Configuration** (`/admin/system` -> Configuration Tab): Adjusting operational parameters.

### User & Official Onboarding
1. Navigate to `/admin/system` and select the **User Directory** tab.
2. To onboard a new Government Official:
   - Click **Onboard Official**.
   - Enter their full name, official government email address, phone number, and assign their specific department.
   - Set an initial password meeting platform security standards.
   - Click **Confirm Onboarding**.
3. To approve a Contractor registration:
   - Open the **Contractor Applications** tab.
   - Review the business registration and license documents.
   - Click **Approve Application** to grant bidding access, or **Reject** with a documented reason.

### Moderation & Community Standards
1. Open the **Moderation Queue** (`/admin/moderation`).
2. Review flags submitted by citizens regarding inappropriate photos or policy violations.
3. Choose an action: *Hide Content*, *Restore Content*, *Issue Warning*, or *Account Restriction*.
4. All moderation decisions require a mandatory public audit reason to prevent arbitrary censorship.

---

## 8. Understanding Statuses and Notifications

### Complaint Statuses
| Status | Meaning | What You Should Do |
| :--- | :--- | :--- |
| **SUBMITTED** | Grievance received by Civora; awaiting department intake review. | Note your tracking ID; no action required. |
| **UNDER_REVIEW** | Department is assessing jurisdiction and verifying coordinates. | Monitor for clarification requests. |
| **ASSIGNED** | A specific engineer or field team has been designated. | Check the timeline to see assigned officer. |
| **IN_PROGRESS** | Active repair work or site remediation is underway. | Track progress updates and field notes. |
| **RESOLVED** | Field team has completed repairs and submitted proof of work. | Visit `/track` to verify and confirm closure. |
| **VERIFIED** | Citizen or supervisor has inspected and confirmed resolution. | Complaint successfully completed and archived. |
| **REOPENED** | Citizen reported that repairs were incomplete or unsatisfactory. | Official will re-inspect and resume work. |
| **REJECTED** | Issue was duplicate, invalid, or outside municipal jurisdiction. | Review rejection note for explanation. |

### Tender & Bidding Statuses
| Status | Meaning |
| :--- | :--- |
| **DRAFT** | Tender is being drafted by department; not yet open to bidders. |
| **PUBLISHED** | Active tender open for contractor bid submissions. |
| **UNDER_EVALUATION** | Bidding closed; department evaluation committee is reviewing bids. |
| **AWARDED** | Contract officially granted to the winning qualified bidder. |
| **CLOSED** | Tender period ended; work order created. |

### Milestone Statuses
- **PENDING:** Milestone defined in contract schedule; work not yet claimed.
- **SUBMITTED_FOR_REVIEW:** Contractor has submitted completion claim with photographic evidence.
- **APPROVED:** Department technical sanctioning officer has verified field completion.
- **REJECTED_REVISION_REQUIRED:** Verification failed; contractor must address defects and resubmit.

---

## 9. Common Problems & Solutions

### 1. I Forgot or Lost My Complaint Tracking ID
- **If you were signed in:** Visit **My Complaints** (`/my-complaints`). All grievances submitted under your account are listed there.
- **If you filed without signing in:** Check your confirmation email or notification history. You can also search the **Civic Map** (`/map`) in your locality to locate your complaint pin.

### 2. Photo Upload Fails
- Ensure your image file is in **JPEG, PNG, WebP, or PDF** format.
- Ensure the file size is under **10 MB**.
- If uploading from a mobile device on a slow network connection, try taking a standard photo rather than an ultra-high-resolution RAW image.

### 3. "Access Denied" or "Restricted Workspace"
- You are attempting to access a page reserved for a different role (e.g., trying to open the Official Workspace with a Citizen account).
- Sign out and sign in with the appropriate authorized account.

### 4. Contractor Bid Submission Is Blocked
- Ensure the tender submission deadline has not passed. Bids are strictly locked after the posted deadline.
- Ensure your company registration status is `ACTIVE` and your contractor class meets the minimum requirement specified in the tender notice.

### 5. My Complaint Has Exceeded Its Target Resolution Date
- When a complaint exceeds its statutory SLA time, Civora automatically flags it as **Overdue** and notifies the department supervisor.
- You can post a message in the complaint's **Discussion Thread** asking the assigned engineer for an update.

---

## 10. Privacy, Ethics & Responsible Platform Use

Civora is built upon mutual trust between citizens, public authorities, and civic contractors:

1. **Submit Accurate Information:** File grievances for genuine infrastructure issues. Fabricated reports waste public funds and delay real emergencies.
2. **Protect Sensitive Personal Information:** Do not upload photographs showing un-consenting bystanders' faces, vehicle registration plates, or residential door numbers.
3. **Lawful Civic Criticism:** Respectful criticism of government policy, infrastructure quality, or administrative delays is fully protected on Civora. Defamation, hate speech, or harassment directed at individual workers is strictly prohibited.
4. **Contractor Integrity:** Anti-collusion and transparent pricing rules are strictly enforced. Bids submitted by blacklisted entities or featuring coordinated pricing will be disqualified and reported to municipal audit bodies.

---

## 11. Quick-Reference Role Matrix

| User Role | Primary Purpose | Most Important Pages | Key Actions |
| :--- | :--- | :--- | :--- |
| **Citizen** | Report and track civic issues; community voting. | `/report`<br>`/track`<br>`/my-complaints`<br>`/engagement` | Report issue, check timeline, verify resolution, vote on community polls. |
| **Official** | Inspect, resolve, and document public grievances. | `/official/workspace`<br>`/admin/complaints`<br>`/admin/tenders`<br>`/sla` | Accept complaints, update progress, post evidence, issue resolutions, evaluate bids. |
| **Contractor** | Discover public tenders, submit bids, track work orders. | `/tenders`<br>`/contractor`<br>`/contractor?tab=bids`<br>`/contractor?tab=work_orders` | Browse tenders, submit bids, submit work-start notices, file milestone proof. |
| **Administrator** | Platform governance, user onboarding, health diagnostics. | `/admin/system`<br>`/admin/moderation`<br>`/admin/complaints`<br>`/sla` | Onboard officials, approve contractors, moderate abuse, download audit CSVs. |
| **Public Visitor** | Monitor municipal accountability and transparency. | `/`<br>`/transparency`<br>`/map`<br>`/rules` | Inspect citywide resolution rates, view regional hotspots, track progress. |

---

## 12. Known Limitations & Future Roadmap

- **Simulated Notifications:** In local development environments without an active SMTP server, email notifications are logged to the database and displayed in the in-app notification bell rather than dispatched via external email gateways.
- **Offline Mode:** Civora currently requires an active internet connection to submit grievances and sync map pins. An offline progressive web application (PWA) cache mode is planned for remote field workers.
- **Automated AI Triage:** Issue categorization is currently selected by the citizen and confirmed by the department officer. Multi-modal automated image recognition for pothole severity estimation is under development.
