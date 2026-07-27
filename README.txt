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
to the browser profile.
