# Paradise Lawn Care Operations Suite v3.13 — Phase A

## Included
- Quote intake redesigned to capture customer, business, phone, email, preferred contact method, property type, and property address.
- Saving a quote now creates or updates the customer and property record automatically.
- Quote statuses changed to Draft, Sent, Follow Up, Expiring Soon, Expired, and Converted.
- Active Saved Quotes excludes converted quotes and supports search.
- Quote-to-invoice conversion preserves customer contact preference and marks the quote Converted.
- Preferred Contact Method added to customer, quote, and invoice contact areas.
- Smoke Signal animation added anywhere the preferred-contact selector is used.
- Communication Center added with audience filtering, reusable templates, recipient selection, email preparation, text preparation, and copy-message support.

## Validation
- `node --check script.js`: PASSED.
- Existing automated test command could not complete in the sandbox because the `fake-indexeddb` package was unavailable after dependency installation timed out. This is an environment/dependency issue, not a JavaScript syntax failure.

## Manual tests recommended
1. Create a quote for a brand-new customer and confirm the customer and property appear in Customers.
2. Save, reopen, edit, and convert a quote.
3. Confirm converted quotes disappear from Active Saved Quotes.
4. Select Smoke Signal in Customer, Quote, and Invoice screens.
5. Open Communications and test filters, templates, recipient selection, email preparation, text preparation, and copy message.
6. Verify mobile layout on iPhone/iPad-sized browser widths.
