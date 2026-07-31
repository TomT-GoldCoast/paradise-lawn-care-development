# Paradise Lawn Care Operations Suite
## v3.20 Development Roadmap

> **Permanent project reference**
>
> This file is the canonical roadmap for the Paradise Lawn Care Operations Suite. It should remain in the repository and be updated as phases are completed, revised, or expanded.
>
> **Project philosophy:** Preserve existing functionality first. Improve second. Expand third.

---

## Production Baseline

- **Production branch:** `main`
- **Current stable release:** v3.19
- **Status:** Stable production baseline

## Current Development Branch

- **Branch:** `phase-1-customer-property-v3.20`
- **Status:** Phase One in development

---

# Phase Tracker

## Phase 0 - Baseline Preservation

**Status:** Complete

- Preserve stable v3.19 on `main`.
- Perform all upgrade work on separate development branches.
- Do not merge into `main` until testing and owner approval are complete.

---

## Phase 1 - Customer and Property Modernization

**Status:** In progress

### Customer Record

- Reorganize the Customer Record card in this order:
  1. Customer Name
  2. Business Name
  3. Street Address
  4. City, State, ZIP
  5. Phone with embedded Preferred checkbox
  6. Email with embedded Preferred checkbox
  7. Billing Schedule, Billing Method, Billing Day / Start Date
  8. Customer Notes
  9. Phone, Text, Email, and Smoke Signal action buttons
  10. Save Customer, Create Invoice, and Delete buttons
- Remove duplicate dark-green Text Customer and Email Customer buttons.
- Keep direct Phone, Text, Email, and Smoke Signal action cards.
- Use compact, purpose-sized fields.
- Keep email adaptive so longer addresses remain fully visible without disrupting the layout.

### Shared Preferred Contact

- Store one customer-level preferred contact value.
- Synchronize preferred contact across Customer, Quote, Invoice, Communications, Scheduling, and PDFs.
- Changing the preference in one module updates all other modules.
- Preserve backward compatibility with existing preferred-contact records.

### Property / Job Site Information

- Keep Residential, Commercial, and HOA classification in Property / Job Site Information, not the Customer Record.
- Use separate Property Name and Property Type fields.
- Property Type options:
  - Residential
  - Commercial
  - HOA
- Show HOA-specific fields only when HOA is selected.
- Support one simple primary property by default.
- Allow additional properties for landlords, rental owners, commercial accounts, and HOA-managed locations.
- Preferred Mowing Height must be a dropdown from 1.0 inches through 6.0 inches in 0.5-inch increments.
- Keep mowing height, gate code, HOA restrictions, state, ZIP, and similar short-data fields compact.

### Visual Standards

- Maintain uniform button height, shape, border radius, typography, spacing, hover states, and selected states.
- Use darker green borders around individual cards.
- Keep the interface clean and consistent so no feature looks bolted on.
- Preserve mobile and desktop usability.

### Phase 1 Regression Requirements

- Existing customer records load correctly.
- New customer records save correctly.
- Multiple properties continue to work.
- Quotes inherit customer and property information correctly.
- Invoices inherit customer and property information correctly.
- Scheduling links to the correct customer and property.
- Communications target the correct recipient.
- Preferred contact remains synchronized everywhere.
- Smoke Signal remains functional.
- PDF generation remains functional.
- Existing localStorage keys and saved data remain compatible.

---

## Phase 2 - Shared Customer Data Engine

**Status:** Pending

- Establish one source of truth for shared customer information.
- Synchronize preferred contact, preferred payment, billing schedule, billing method, customer data, and property data.
- Fix preferred payment reverting to Cash in saved PDFs.
- Confirm PDF data matches the application.

---

## Phase 3 - Scheduling 2.0

**Status:** Pending

- Keep Employee Scheduling and Selected Record cards.
- Move Today's Schedule directly below Selected Record and keep it always open.
- Move Route & Schedule Center to the bottom and make it collapsible.
- Add a collapsible Smart Optimization / AI Route Assistant card.
- Preserve the existing user-created schedule and routing workflow.

---

## Phase 4 - Smart Route Optimization

**Status:** Pending

- Use the current device location as the route start when available.
- Use the saved Paradise Lawn Care business address as the default route end.
- Optimize the full order of jobs for the day, not merely directions through the user's existing order.
- Respect locked jobs, appointment windows, priorities, crew assignments, equipment, service duration, traffic, and weather when available.
- Provide a separate temporary suggested schedule.
- Provide a dedicated suggested-route map.
- Compare current and suggested mileage, drive time, fuel, wear, and projected return time.
- Never modify the official schedule until Apply Suggested Schedule is confirmed.

---

## Phase 5 - Routing and Mapping Reliability

**Status:** Pending

- Validate addresses before sending them to Google Maps.
- Use the selected job-site address first.
- Build addresses consistently from street, city, state, and ZIP.
- Prevent customer names from being treated as route addresses.
- Improve fallback logic for older or incomplete records.
- Show clear warnings for incomplete or invalid addresses.

---

## Phase 6 - Final Polish and Full Regression Testing

**Status:** Pending

- Review all cards, fields, buttons, colors, borders, spacing, typography, and responsive layouts.
- Verify Customer, Property, Quote, Invoice, Scheduling, Communications, Mapping, Weather, Employees, Maintenance, Expenses, Inventory, Payroll, Alerts, PDFs, and Smoke Signal.
- Record completed tests, functions preserved, bugs fixed, and known issues.

---

# Permanent Regression Checklist

Every phase must verify:

- Customer Records
- Property / Job Site Records
- Quotes
- Invoices
- Scheduling
- Communications
- Preferred Contact Synchronization
- Preferred Payment Persistence
- Smoke Signal
- PDF Generation
- Mapping and Route Actions
- Local Storage Compatibility
- Existing User Data
- Desktop Layout
- Mobile Layout

---

# Release History

| Version | Status | Notes |
|---|---|---|
| v3.19 | Stable | Current production baseline |
| v3.20 Phase 1 | In development | Customer and property modernization |
| v3.20 | Planned | Complete multi-phase release |

---

# Change Log Template

For every completed phase, add:

- **Date completed**
- **Branch**
- **Features added**
- **Functions preserved**
- **Bugs fixed**
- **Regression tests passed**
- **Known issues**
- **Approval status**

---

# File Retention Rule

`DEVELOPMENT_ROADMAP.md` is a permanent project document. Do not delete it during cleanup, packaging, release preparation, branch work, or future upgrades. Update it whenever the project scope, status, or phase plan changes.
