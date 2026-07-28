# Paradise Lawn Care Operations Suite v3.19 Audit and Testing Report

Date: July 28, 2026

Branch: `agent/v3.19-stability-invoice-radar-routing`

Runtime: Node.js 24.14.0, npm 11.9.0, Chromium 149

## Result

The v3.19 repair remains the existing single-page, browser-local application. It
does not replace the navigation, storage model, calculations, record schemas, or
business modules. The requested Text, Email, invoice artwork, radar,
Scheduling, and route-start workflows were repaired in place.

Automated result: **39 passed, 0 failed, 0 skipped**.

A real browser render completed at 1440 × 900 and 390 × 844 with no captured
page errors or console errors. A real Letter-size PDF was generated, rendered
with Poppler, and visually inspected. It is one page and contains the approved
logo and grass artwork.

Live third-party radar, native SMS/email applications, and real-device GPS were
not available in this environment. Those checks remain explicitly listed under
Remaining manual checks.

## Repository audit

### Application structure inspected

| Area | Implementation found | Audit result |
| --- | --- | --- |
| Shell and navigation | `index.html`, tab panels, modal dialogs, inline and programmatic actions | Existing navigation and IDs retained; no duplicate HTML IDs found. |
| Application core | One global `script.js` with the original invoice core and later versioned extensions | Working but layered. Earlier functions are intentionally shadowed by later compatibility extensions. A broad rewrite was not performed. |
| Styling and print | `style.css`, responsive rules, two print rule groups | Existing appearance retained. Print modal positioning was repaired after a real PDF exposed repeated pages. |
| Images | `images/paradise-logo.svg`, `images/grass.svg` | Approved repository assets existed but were not used by every invoice path. They now drive the header, PDF preview, print, and PDF output. |
| Third-party map library | Leaflet previously loaded from unpkg | Leaflet 1.9.4 is now pinned and served from `vendor/leaflet/`. |
| Invoices and attachments | LocalStorage invoice records plus IndexedDB attachment blobs | Calculations, IDs, storage key, attachment database, and attachment references preserved. |
| Customers, Quotes, Scheduling | LocalStorage arrays/objects with linked IDs and compatibility fields | Existing keys and records retained; Scheduling now exposes linked details and map/route actions. |
| Routing | Leaflet map, Nominatim geocoding, OSRM driving route, simple ordering | Starting point was fixed to the business. It is now current/manual/saved/business aware with defensive fallbacks. |
| Weather and radar | Weather.gov, RainViewer, Leaflet/OSM | Radar previously had weak hidden-tab and failure handling. Initialization, resize, retry, status, and tile diagnostics were added. |
| Communications and Smoke Signal | `sms:`, `mailto:`, `tel:`, YouTube IFrame API | Individual actions repaired. Existing Smoke Signal video/controller and mass-send safety retained. |
| Home, Employees, Payroll, Expenses, Inventory, Maintenance, Alerts | Existing DOM and LocalStorage workflows | Regression-tested and otherwise left intact. |
| Caching | Query-string revisions only; no service worker | `style.css` and `script.js` cache revision advanced to `3.19.2`. LocalStorage is not cleared. |
| Historical files | Tracked `3.17.zip` archive | Not referenced by runtime code. Retained because its archival purpose could not be disproved safely. |

### Safe cleanup and defensive repairs performed

- Replaced fragile application-owned remote image URLs with local approved SVGs.
- Replaced the remote Leaflet script/stylesheet with pinned local distribution
  files and license.
- Bound new explicit actions once through an idempotent listener helper instead
  of adding more generated secondary buttons.
- Rebound generated Scheduling job and route-stop buttons after each render,
  preventing stale or missing listeners without duplicating them.
- Preserved unknown schedule fields when the visible schedule is saved. This
  protects route locks, manual order, appointment data, attachment references,
  and future/legacy metadata.
- Preserved `Cancelled` and legacy `Canceled` statuses during schedule
  normalization so canceled jobs cannot silently become Upcoming or enter a
  route.
- Added null checks, coordinate validation, safe JSON parsing, external-service
  catches, map singleton guards, tile error handling, and image-load waiting.
- Prevented a fixed print modal from repeating the same invoice on three pages.

No runtime-compatible function or tracked historical archive was removed merely
because it appeared old.

### Review-only findings not changed

- `script.js` contains versioned function wrappers and later function
  reassignments. Consolidating them could improve maintainability, but dynamic
  inline references and old LocalStorage compatibility make that a risky,
  production-wide refactor.
- The single global namespace has collision risk. Moving to ES modules or a
  framework was deliberately out of scope.
- LocalStorage and IndexedDB remain the production persistence system. They were
  not replaced or renamed.
- The tracked `3.17.zip` appears archival and unused at runtime, but was not
  deleted without owner confirmation.
- Existing yard animation, screen layout, navigation, invoice calculations,
  billing logic, and business data structures were not redesigned.

### Protected systems preserved

The following existing keys remain unchanged:

- `paradise_invoices_v1_2`
- `paradise_employee_schedule_v1`
- `paradise_maintenance_records_v1`
- `paradise_alert_history_v1`
- `paradise_customers_v2`
- `paradise_employees_v2`
- `paradise_operating_expenses_v2`
- `paradise_inventory_v2`
- `paradise_quotes_v2`
- `paradise_payroll_v2`
- `paradise_dashboard_order_v3`
- `paradise_maintenance_calendar_v3`
- `paradise_invoice_damages_v1`
- IndexedDB database `paradise_lawncare_files_v1`

The repair adds only:

- `paradise_route_start_v319` for an explicitly remembered **manual** starting
  address/point.
- `paradise_geocode_cache_v319` for successful address lookup results.

Fresh current-location coordinates are not written to either key.

## Confirmed root causes

| Problem | Root cause | Repair |
| --- | --- | --- |
| Initial Text click only selected/highlighted | Phone/Text/Email Preferred Contact cards are an ARIA radio group. Their click handler intentionally calls `setValue`; invoice preference changes only toggled the toolbar highlight. Quote, Customer, and Scheduling lacked equally clear explicit action buttons. | Kept preference selection separate and added explicit one-click Text actions with the correct active record and friendly missing-phone handling. |
| Initial Email click only selected/highlighted | Same preference/action ambiguity as Text; selection was not a send action, and several screens had no dedicated Email action. | Added explicit one-click Email actions with encoded recipient, subject, body, line breaks, and missing-email handling. |
| Missing invoice logo | The normal header referenced an external GitHub Pages PNG even though the approved SVG was already in the repository. The generated PDF preview contained no logo element. | All invoice-facing paths use `images/paradise-logo.svg`; PDF/print uses a real `<img>` and waits for artwork readiness. |
| Missing grass artwork | The normal header depended on an external URL and the PDF preview generated no grass element. Print visibility rules could not print an element that was absent. | All paths use `images/grass.svg`; PDF/print includes a real positioned `<img>` with alt text. |
| Radar differed between computers | Best-supported diagnosis: the core map library depended on a CDN that may be blocked or cached differently; radar initialized around a hidden tab without consistently resizing; provider/tile failures had no visible recovery or useful diagnostics. The live user-specific failure was not reproduced here. | Vendored Leaflet, initializes after tab visibility, calls `invalidateSize()`, prevents duplicate maps, reports library/API/tile failures, and exposes Refresh Radar while keeping Weather usable. |
| Scheduling required extra navigation | The job-number control could identify a record but the visible selected card was minimal and had no direct Text/Email/map/route actions. | One job click now fills the linked customer, property, access, service, schedule, notes, contact, and record information and exposes map, external maps, communication, and route actions. |
| Routing ignored current position | Route order always started from the hard-coded Paradise Lawn Care business point and repeatedly geocoded addresses. There was no permission, accuracy, freshness, manual-start, or denial path. | Added intentional one-time geolocation, manual/saved/business fallbacks, cached geocoding, numbered start/job pins, and synchronized map/list selection. |
| Canceled jobs could enter routes | The schedule normalizer converted every status except Completed into Upcoming. | `Cancelled` and legacy `Canceled` now survive normalization and are excluded from active route jobs. |
| Saved PDF repeated pages | The print modal stayed `position: fixed` while hidden body content still defined multiple printed pages, repeating the visible invoice on each page. | Print CSS removes non-PDF body children from layout and converts the PDF modal/card/preview to static print flow. |

## Routing design

### Permission and privacy

- `navigator.geolocation.getCurrentPosition()` is called only after the user
  selects Build Today’s Route, Build Route from a selected job, or Refresh
  Location & Route.
- No `watchPosition()`, background task, location analytics, or location history
  was added.
- Latitude/longitude ranges, timestamp, age, and accuracy are checked.
- A browser result older than five minutes is rejected.
- The status displays the time obtained and the browser-reported approximate
  accuracy.
- A detected point more than 150 miles from the business requires confirmation.
- Current coordinates are used in memory for that route only.

### Start fallback order

1. Fresh current location when Current Location is selected and permission
   succeeds.
2. Entered manual address when Manual is selected, or when a current-location
   attempt fails and an address has been entered.
3. Previously saved preferred manual route start.
4. Paradise Lawn Care business location.

The legacy route remains usable from the business fallback. A manual point is
stored only when Remember this manual address is checked.

### Ordering method

- Completed, canceled, and unlocatable jobs are excluded from the routed stops;
  an omitted-address count is shown.
- Saved coordinates are preferred. Missing coordinates use cached Nominatim
  lookup results or a rate-limited lookup.
- Manual `routeOrder`/`manualOrder`, `routeLocked`, lock flags, and appointment
  window fields hold their scheduled positions.
- Urgent flexible jobs are selected before other flexible jobs.
- Remaining flexible stops use conservative nearest-neighbor ordering beginning
  at the selected route start.
- OSRM supplies driving geometry, mileage, and time.
- If OSRM fails, the same ordered stops remain visible with straight-line
  mileage/time marked by an asterisk.
- The route start has a labeled pin. Jobs have numbered pins. Clicking a pin or
  list entry selects the same record and opens its customer/property details.

This is intentionally not a new paid optimization engine. Appointment windows
are protected as fixed scheduled positions; the code does not claim to solve a
full time-window optimization problem.

## External dependencies

| Dependency | Classification | Handling |
| --- | --- | --- |
| Leaflet 1.9.4 | Required, replaceable with local copy | Pinned and vendored locally with its BSD-2-Clause license. |
| OpenStreetMap tiles | Required for visible base maps; external | Map/list details remain usable if tiles fail; warnings are diagnostic only. |
| RainViewer public radar | Required for animated radar; external/fragile | HTTPS API, visible failure status, tile error status, and retry. |
| Weather.gov | Required for live forecast/alerts; external | Existing HTTPS source retained with caught failures. |
| Nominatim | Required only for missing coordinates; external/rate-sensitive | Successful results cached; requests spaced by at least 1.05 seconds; saved coordinates preferred. |
| OSRM public router | Required for driving estimates; external/fragile | Straight-line route fallback preserves the workflow. |
| Google Maps URL | User-initiated external map handoff | Complete address/coordinates encoded; missing addresses rejected. |
| YouTube IFrame API | Required by protected Smoke Signal behavior | Existing video, two-play controller, overlay, error handling, and cleanup retained. |
| Logo and grass | Application-owned | Local repository SVGs; no external dependency. |

No private API key was added.

## Files changed

- `index.html`: local Leaflet/logo/grass paths, cache revision `3.19.2`,
  explicit individual actions, expanded Scheduling details, route-start
  controls, radar refresh/status, and stable button IDs.
- `script.js`: action validation/handoffs, PDF artwork readiness, Scheduling
  details/actions, radar singleton/retry/diagnostics, geolocation-aware routing,
  coordinate cache, order/fallback logic, synchronized map/list controls,
  metadata-preserving schedule save, and canceled-status preservation.
- `style.css`: narrowly scoped action, Scheduling, routing, radar, numbered-pin,
  PDF artwork, responsive, and single-page print rules.
- `tests/app.test.js`: DOM-click, asset, print CSS, radar, Scheduling, map,
  geolocation, route, status filtering, fallback, privacy, and protected-data
  regressions.
- `package.json`, `package-lock.json`: exact Leaflet 1.9.4 development/source
  dependency.
- `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`,
  `vendor/leaflet/images/*`, `vendor/leaflet/LICENSE`: repository-local Leaflet
  runtime.
- `README.txt`: repaired workflow, privacy, and production notes.
- `TESTING_REPORT_v3.19.md`: this audit and evidence.

## Verification performed

### Automated

Command:

```text
npm run check
```

Result:

- JavaScript syntax: PASS
- Automated tests: 39 passed
- Failed: 0
- Skipped: 0
- Duplicate IDs: PASS
- Missing inline function references: PASS
- Local/GitHub Pages asset paths: PASS
- Desktop and mobile JSDOM startup: PASS
- Text/Email actual button clicks and one handoff per click: PASS
- Preferred Contact selection remains selection-only: PASS
- Smoke Signal direct launch and mass-send protection: PASS
- Logo/grass local and print DOM checks: PASS
- Radar visible-tab initialization, resize, singleton, failure, and retry: PASS
- Scheduling correct-record, map pin, map URL, edit, and missing-address paths: PASS
- Current, manual, saved, and business route starts: PASS
- Permission denied, position unavailable, timeout, invalid, and stale location
  fallbacks: PASS
- One-job and no-job routes: PASS
- Canceled/completed filtering and partial address omission: PASS
- Locked, appointment-window, manual-order, and unknown schedule metadata
  preservation: PASS
- Route pin/list/customer synchronization: PASS
- OSRM straight-line fallback: PASS
- Legacy/current IDs, properties, attachments, and unrelated module records:
  PASS

### Real browser and visual

A locally served build was exercised in headless Chromium using actual DOM
clicks. Third-party responses and geolocation were deterministic fixtures; this
is not represented as a live-provider or real-GPS test.

- Desktop 1440 × 900: PASS
- Mobile 390 × 844: PASS
- Normal invoice view: PASS
- Preferred Contact and explicit Text/Email interactions: PASS
- Invoice PDF preview: PASS
- Weather/radar screen initialization and reopen: PASS with fixture
- Scheduling job details and map action: PASS
- Current-location route UI, start pin, numbered job pins, metrics, and route
  list: PASS with browser geolocation override and routing fixture
- Captured page errors: 0
- Captured console errors: 0

### Actual PDF

Chromium produced `/tmp/plc-qa/invoice.pdf`. It was inspected with `pdfinfo`,
`pdftotext`, and a 150-DPI Poppler render.

- Format: Letter, 612 × 792 points
- Pages: 1
- Approved logo visible: PASS
- Approved grass artwork visible: PASS
- Customer/service/total text present and legible: PASS
- External artwork URL required: NO

The first PDF attempt revealed three repeated pages and was not accepted. The
print-flow repair was applied, the PDF was regenerated, and the one-page result
was inspected.

## Remaining manual checks before merge

- Back up Thomas’s production browser LocalStorage and IndexedDB.
- Open a copy of long-lived customer, invoice, quote, schedule, route,
  maintenance, inventory, payroll, expense, alert, damage, and attachment data.
- Confirm native Invoice/Quote/Customer/Scheduling/Communication Center SMS
  handoffs on the intended mobile and desktop operating systems.
- Confirm native email drafts, encoded subjects, line breaks, and special
  characters in the intended email clients.
- Confirm the live browser print dialog and Save as PDF on Thomas’s computer
  and his son’s computer.
- Confirm live radar renders and Refresh Radar recovers on both computers,
  including their privacy extensions, tracking protection, firewall, DNS, and
  cache conditions.
- Confirm live Weather.gov, RainViewer, OpenStreetMap, Nominatim, and OSRM
  access from the production network.
- Test location permission granted, denied, unavailable, and timeout on a real
  mobile device and at least one desktop browser.
- Compare real GPS accuracy and the actual local driving order against Stuart
  area geography.
- Verify manual and saved route starts, locked jobs, appointment windows,
  canceled/completed jobs, mileage/time, pin/list synchronization, and a route
  rebuild after physically changing location.
- Exercise Safari/iOS and the specific non-working browser because this
  environment verified Chromium only.
- Reconfirm the protected Smoke Signal YouTube playback/autoplay behavior on
  the production network and devices.

Do not merge the draft pull request until these real-device checks and the
manual acceptance checklist in the pull request are complete.
