# Module 13: Civic Search, Interactive Maps, Geographic Insights & Location-Based Discovery

## Civora — Civic Issue Reporting and Public Accountability Platform

### 1. Architectural Overview & Core Principles

Module 13 establishes a location-aware civic discovery and intelligence framework for Civora. It enables citizens to discover nearby civic issues, explore public complaints on an interactive city map, and view ward-level hotspots, while equipping municipal officials with geographic triage tools.

#### Core Principle:
> **"Geographic visibility must strictly respect complaint privacy, authorization rules, and the accuracy of available location data. Exact residential doorsteps and complainant identities are never exposed through public discovery maps."**

The platform enforces strict technical boundaries:
1. **Public Discovery vs. Operational Retain**: Public users see coordinates generalized to ~110m resolution. Exact coordinates are retained privately on the backend solely for authorized municipal engineers during field inspections.
2. **Explicit Geolocation Permission**: Device GPS is requested only after a clear, voluntary citizen interaction ("Use GPS" or "Near Me"). It is never initiated silently or on page load.
3. **Multi-Modal Location Entry**: Citizens can enter an address manually, drop an interactive pin on the map, or use device GPS.
4. **Zero-PII Public Queries**: Map markers and nearby queries exclude citizen names, phone numbers, email addresses, and confidential internal staff notes.

---

### 2. Coordinate Generalization & Privacy Safeguards

To prevent exposing a citizen's private home or residence:
- **Spatial Truncation**: Raw coordinates (`12.9784321, 77.6408123`) are rounded to 3 decimal places ($\approx 110\text{m}$ at equatorial latitudes).
- **Deterministic Micro-Jitter**: A deterministic pseudo-random offset ($\pm 40\text{m}$) keyed by the complaint's unique UUID is applied. This ensures:
  - Markers do not pinpoint a private residential doorstep.
  - The rendered marker position is completely stable across reloads and zoom changes.
- **Opt-Out Flag (`isLocationPublic`)**: Citizens reporting residential issues can uncheck public map display, completely excluding their complaint from public map viewports.

---

### 3. Geographic Algorithms & Distance Computation

#### Great-Circle Haversine Formula:
Distance between user coordinates $(\phi_1, \lambda_1)$ and complaint coordinates $(\phi_2, \lambda_2)$ is calculated server-side:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
where $R = 6,371.0\text{ km}$.

#### Candidate Pre-Filtering:
To avoid expensive table scans, candidates are first bounded by an approximate geographic delta:
$$\Delta\phi = \frac{\text{radiusKm}}{111.0}, \quad \Delta\lambda = \frac{\text{radiusKm}}{111.0 \cdot \cos\phi}$$
Exact Haversine distance is then computed on the candidate subset and sorted ascending by proximity.

---

### 4. Bounding Box & Query Safety

- **Viewport Spans**: Bounding box queries validate that $\text{minLat} \le \text{maxLat}$ and $\text{minLng} \le \text{maxLng}$.
- **Span Limit**: Viewport bounding boxes spanning more than $5.0^\circ$ latitude or longitude ($\approx 555\text{km}$) are rejected with HTTP 400 `VIEWPORT_TOO_LARGE` to prevent denial-of-service memory exhaustion.
- **Pagination**: Viewport queries cap results at 300 markers; nearby queries cap at 100 markers.

---

### 5. Offline Bengaluru Administrative Directory & Geocoding

Civora provides a built-in, zero-dependency offline dictionary of Bengaluru municipal zones, wards, and localities:
- **Localities**: Indira Nagar, HSR Layout, Koramangala, Bellandur, Central Ward (MG Road), Whitefield, Jayanagar, Malleshwaram, Electronic City, BTM Layout, Hebbal, Marathahalli, Domlur, Rajajinagar.
- **Attributes**: Canonical centroid coordinates, BBMP ward numbers, ward names, administrative zones, and aliases.
- **Offline Geocoding (`GET /api/geo/geocode`)**: Matches street or neighborhood names against the local dictionary with confidence scoring, ensuring zero dependence on paid third-party geocoding APIs.

---

### 6. Geographic Hotspots & Ward Analytics

#### Aggregation Methodology:
The `GET /api/geo/hotspots` endpoint groups active grievances by `ward` or `locality`:
- **Total Grievances**: Sum of all logged cases in the boundary.
- **Active Grievances**: `SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `REOPENED`.
- **Resolved Grievances**: `RESOLVED`, `VERIFIED`, `CLOSED`.
- **Overdue Grievances**: Cases exceeding SLA commitments (`RESPONSE_OVERDUE`, `RESOLUTION_OVERDUE`, `BREACHED`).
- **Resolution Rate**: Normalized percentage $\frac{\text{Resolved}}{\text{Total}} \times 100$.
- **Top Category**: Predominant civic issue type (e.g. Road Damage vs. Drainage vs. Garbage).
- **Centroid Coordinates**: Average latitude/longitude of complaints in that area.

---

### 7. Official & Department Geographic Dashboard

#### Endpoint: `GET /api/geo/official-summary`
- **Scope Enforcement**:
  - `GOVERNMENT_OFFICIAL`: Scoped strictly to the official's assigned municipal department (e.g. PWD officials only see road and infrastructure cases in their department jurisdiction).
  - `ADMIN`: Platform-wide city overview.
  - `CITIZEN`: Forbidden (HTTP 403).
- **Metrics Delivered**:
  - Department workload distribution across municipal wards.
  - Urgent priority active complaints requiring immediate dispatch.
  - Overdue clusters requiring supervisory SLA intervention.
  - Unassigned cases pending field inspector allocation.

---

### 8. API Endpoints Reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/geo/complaints` | Optional | Viewport bounding box query with generalized coordinates |
| `GET` | `/api/geo/nearby` | Optional | Nearby complaint discovery within radius (1km - 50km) |
| `GET` | `/api/geo/hotspots` | Public | Ward and locality issue concentration & resolution rates |
| `GET` | `/api/geo/localities` | Public | Municipal localities directory & autocomplete |
| `GET` | `/api/geo/geocode` | Public | Offline landmark and address coordinate lookup |
| `GET` | `/api/geo/official-summary` | Official / Admin | Department-scoped geographic triage dashboard |
| `PATCH` | `/api/geo/complaints/:id/location` | Creator / Official / Admin | Update complaint coordinates with immutable audit event |

---

### 9. Frontend Components & Pages

1. **`CivicMap.tsx`** (`client/src/components/map/CivicMap.tsx`):
   - Leaflet map rendering OpenStreetMap tiles.
   - Custom CSS/SVG pin markers with status color codes (Emerald, Indigo, Amber, Red).
   - Interactive popups with direct links to case tracking.
   - Privacy guarantee indicator badge.
   - Reset view and zoom controls.
2. **`LocationPickerModal.tsx`** (`client/src/components/map/LocationPickerModal.tsx`):
   - Interactive click-to-pin modal for citizens reporting complaints.
   - "Use My Device Location" button with accuracy readout.
   - Quick landmark selector pills (Indira Nagar, HSR Layout, Koramangala, etc.).
3. **`CivicMapPage.tsx`** (`client/src/pages/CivicMapPage.tsx`):
   - Routes: `/map` and `/explore`.
   - Unified search bar, category, status, and locality dropdowns.
   - "Near Me" radius filter (1km, 2km, 5km, 10km).
   - "Hotspots" drawer showcasing top problem wards.
   - Map View vs. Accessible List View switcher.
   - Selected complaint inspector sidebar.

---

### 10. Automated Test Results

- **Suite**: `server/test/geo.test.ts`
- **Result**: 20 tests pass, 0 fail.
- **Full Server Suite**: 184 tests pass across 45 suites, 0 fail.
