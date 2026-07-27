# Paradise Lawn Care Operations Suite v3.19 Testing Report

Date: July 27, 2026

Branch: `preferred-contact-smoke-signal-v3.19`

Runtime: Node.js 24.14.0, npm 11.9.0

## Automated result

`npm run check` completed successfully.

- JavaScript syntax validation: PASS
- Existing automated regressions: PASS
- v3.19 automated regressions: PASS
- Total: 25 passed, 0 failed, 0 skipped
- Duplicate HTML ID validation: PASS
- Inline `onclick` handler validation: PASS
- Repository-local core asset / GitHub Pages validation: PASS
- Preferred Contact launch tests use actual card clicks rather than direct controller calls: PASS
- v3.19.1 asset cache revision validation: PASS
- Desktop DOM run at 1440 × 900: PASS, no captured console errors
- Mobile DOM run at 390 × 844: PASS, no captured console errors

## Covered workflows

- Home dashboard refresh, cards, alerts, billing summaries, and drag-and-drop order
- Invoice save/reload, Invoice Finder, totals, paid revenue, due states, and PDF preview
- Quote save/reload, customer inheritance, manual Preferred Contact override, and conversion
- Customer save/reload, Customer Finder state, invoice history, property records, and deletion
- Preferred Contact canonical storage and legacy-field migration
- Preservation of customer, quote, job, and invoice identifiers
- Communication Center audiences: All, Residential, Commercial, Weekly, Biweekly, Monthly, and Selected
- Communication Center Phone, Text, Email, and Smoke Signal totals
- One-tap Smoke Signal card launch from Customers, Quotes, and Invoices using actual DOM card clicks
- Explicit individual Smoke Signal action in the Communication Center
- Single-recipient and mixed mass communication behavior without automatic Smoke Signal launch
- Scheduling selection and linked record display
- Route/schedule supporting state
- Employees, payroll, operating expenses, inventory, maintenance, weather, radar supporting state, and alerts
- Demo record installation
- Smoke Signal exact video ID, initial playback, one restart, exactly two completed plays, fade/final message, automatic close, manual close, Escape, offline/API/player error handling, autoplay Play fallback, duplicate-overlay prevention, player destruction, and tab/scroll/focus restoration

## Browser status

The cloud Chrome client was started, but its policy blocked the local
`http://127.0.0.1` test URL with `ERR_BLOCKED_BY_CLIENT`. This attempt is not
reported as a pass. The published feature branch should receive a final Chrome
desktop/mobile visual pass before merge.

## Remaining manual verification before merge

- Confirm the live YouTube IFrame API can autoplay, replay, and destroy the player in the production browser profile.
- Confirm blocked autoplay displays the Play button on iOS Safari and Android Chrome.
- Confirm real Email, Text, and Phone handoffs on target desktop/mobile devices.
- Visually inspect the four Preferred Contact cards and full-screen overlay at common desktop, tablet, and mobile sizes.
- Exercise live Weather, Radar, geocoding, and Route Builder network services.
- Print or save one invoice PDF from the browser print dialog.
- Back up production localStorage, open v3.19 against a copy, and spot-check representative long-lived customer, quote, invoice, schedule, maintenance, and attachment records.
