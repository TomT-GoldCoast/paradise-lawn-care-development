PARADISE LAWN CARE OPERATIONS SUITE
Version 3.19

Header:
Operations Suite v3.19 — Preferred Contact & Smoke Signal

This repository contains the complete browser application. Core application code
is stored in script.js and does not load from an earlier GitHub commit.

Version 3.19 includes:
- One canonical preferredContact field across Customers, Quotes, and Invoices
- Backward-compatible migration for existing localStorage records
- Touch-friendly Phone, Text, Email, and Smoke Signal selection cards, with the
  Smoke Signal card launching the shared controller from Customers, Quotes,
  and Invoices
- Quote preference inheritance and manual override
- Invoice preference display, override, and highlighted communication actions
- Restored Communication Center audience filters, customer selection, totals,
  Email/Text overrides, Phone actions, an explicit per-customer Smoke Signal
  action, and preference-aware preparation that never auto-launches Smoke
  Signal during mass communication
- Full-screen Smoke Signal controller using the official YouTube IFrame API
- Two-play handling, manual Play fallback, Escape/manual close, API/offline
  handling, duplicate-overlay prevention, and interface-state restoration
- Explicit one-click individual Text and Email actions on Invoice, Quote,
  Customer, Scheduling, and Communication Center screens, with validation for
  missing recipient details
- Repository-local approved logo and grass artwork in the application header,
  invoice PDF preview, browser print, and Save as PDF output
- Repository-local Leaflet 1.9.4 assets, hidden-tab map resizing, radar
  diagnostics, visible refresh/retry, and graceful provider/tile failure states
- One-click Scheduling job details with linked customer, property, access,
  service, contact, map, and route actions
- Current-location-aware route starts requested only when Build/Refresh Route
  is selected, plus manual, saved-preference, and business-location fallbacks
- Numbered route pins synchronized with the stop list; locked, appointment,
  manual-order, completed, and canceled schedule state preserved
- Cached address lookup and straight-line mileage/time fallback when the
  external driving-route service is unavailable
- Existing dashboards, invoices, quotes, customers, scheduling, routing,
  weather/radar, employees, payroll, maintenance, expenses, inventory, alerts,
  PDF preview, attachments, demo records, and localStorage keys retained

Development checks:
1. Run npm ci.
2. Run npm run check.
3. Open index.html through a local web server for final Chrome desktop/mobile
   verification.
4. Review TESTING_REPORT_v3.19.md before merging.

Production note:
Do not clear browser site data without a backup. Customer, quote, invoice,
schedule, maintenance, expense, inventory, payroll, and alert data remain local
to the browser profile. Browser location is requested once only for an
intentional route build/refresh and is not stored unless the user explicitly
selects Remember for a manually entered starting address.
