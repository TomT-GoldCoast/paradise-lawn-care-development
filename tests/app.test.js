const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");

const wait = (milliseconds = 80) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function createApp({ height = 900, online = true, width = 1440, youtube = false } = {}) {
  const jsdomErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => jsdomErrors.push(error));
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://127.0.0.1/",
    virtualConsole
  });
  const { window } = dom;
  const consoleErrors = [];
  const consoleWarnings = [];
  const openedUrls = [];
  let scrollX = 0;
  let scrollY = 0;
  Object.defineProperties(window, {
    innerHeight: { configurable: true, value: height },
    innerWidth: { configurable: true, value: width },
    scrollX: { configurable: true, get: () => scrollX },
    scrollY: { configurable: true, get: () => scrollY }
  });
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
  window.console.error = (...values) => consoleErrors.push(values.map(String).join(" "));
  window.console.warn = (...values) => consoleWarnings.push(values.map(String).join(" "));
  window.alert = () => {};
  window.confirm = () => true;
  window.open = (url) => {
    openedUrls.push(String(url));
    return null;
  };
  window.print = () => {};
  window.scrollTo = (x, y) => {
    if (typeof x === "object") {
      scrollX = Number(x.left || 0);
      scrollY = Number(x.top || 0);
    } else {
      scrollX = Number(x || 0);
      scrollY = Number(y || 0);
    }
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  window.navigator.clipboard = { writeText: async () => {} };
  window.document.execCommand = () => true;
  window.fetch = async (input) => {
    const url = String(input);
    let body = {};
    if (url.includes("/points/")) {
      body = { properties: { forecast: "https://test.local/forecast", observationStations: "https://test.local/stations" } };
    } else if (url === "https://test.local/forecast") {
      body = {
        properties: {
          periods: [{
            name: "Today",
            temperature: 82,
            temperatureUnit: "F",
            windSpeed: "8 mph",
            windDirection: "E",
            shortForecast: "Partly Sunny",
            detailedForecast: "Partly sunny with a light breeze."
          }]
        }
      };
    } else if (url === "https://test.local/stations") {
      body = { features: [] };
    } else if (url.includes("/alerts/active")) {
      body = { features: [] };
    } else if (url.includes("rainviewer")) {
      body = { host: "https://test.local", radar: { past: [], nowcast: [] } };
    }
    return { ok: true, status: 200, json: async () => body };
  };
  if (!window.crypto.randomUUID) {
    let sequence = 0;
    window.crypto.randomUUID = () => `test-uuid-${++sequence}`;
  }
  if (youtube) {
    const tracker = {
      destroyed: 0,
      events: null,
      playCalls: 0,
      player: null,
      seekCalls: 0
    };
    window.__youtubeTracker = tracker;
    window.YT = {
      PlayerState: { ENDED: 0, PLAYING: 1 },
      Player: function Player(_id, options) {
        tracker.videoId = options.videoId;
        const player = {
          destroy: () => { tracker.destroyed += 1; },
          getPlayerState: () => window.YT.PlayerState.PLAYING,
          playVideo: () => { tracker.playCalls += 1; },
          seekTo: () => { tracker.seekCalls += 1; }
        };
        tracker.events = options.events;
        tracker.player = player;
        window.setTimeout(() => options.events.onReady({ target: player }), 0);
        return player;
      }
    };
  }
  await new Promise((resolve) => setImmediate(resolve));
  window.eval(script);
  await wait();
  return {
    close: () => window.close(),
    consoleErrors,
    consoleWarnings,
    document: window.document,
    evaluate: (source) => window.eval(source),
    jsdomErrors,
    openedUrls,
    window
  };
}

function metricValue(document, label) {
  const card = [...document.querySelectorAll("#homeMetricCards .intelligence-card")]
    .find((item) => item.querySelector("span")?.textContent === label);
  return card?.querySelector("strong")?.textContent;
}

test("v3.19 identifiers, cache keys, and Billing Center dialog structure agree", () => {
  assert.match(html, /<title>Paradise Lawn Care Operations Suite v3\.19<\/title>/);
  assert.match(html, /Operations Suite v3\.19 — Preferred Contact &amp; Smoke Signal/);
  assert.match(html, /style\.css\?v=3\.19\.0/);
  assert.match(html, /script\.js\?v=3\.19\.0/);
  assert.match(script, /Version 3\.19/);
  assert.match(script, /const APP_VERSION = "3\.19"/);
  assert.match(script, /DASHBOARD_VERSION_V39="3\.19"/);
  assert.doesNotMatch(script, /cdn\.jsdelivr\.net\/gh\/TomT-GoldCoast/);
  assert.doesNotMatch(script, /document\.write/);
  assert.match(html, /class="modal-card billing-center-modal"/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="billingCenterTitle"/);
  assert.match(style, /\.modal-card\s*\{[\s\S]*background:\s*white/);
});

test("completed services already represented by invoices are not billed twice", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate("installDemoInvoices()");
  await wait();

  assert.equal(app.evaluate("billingSummaryV38().ready.length"), 0);
  assert.equal(app.document.querySelector("#billingCenterList").textContent.includes("Create Invoice"), false);

  app.evaluate(`
    const testCustomers = readArray("paradise_customers_v2");
    testCustomers.push({
      id: "customer-unbilled",
      customerNumber: "C-TEST-001",
      name: "Unbilled Customer",
      billingMethod: "Per Service",
      billingAnchor: getLocalDateString(),
      properties: [{address: "1 Test Way"}],
      createdAt: new Date().toISOString()
    });
    writeArray("paradise_customers_v2", testCustomers);
    const testQuotes = readArray("paradise_quotes_v2");
    testQuotes.push({
      id: "quote-unbilled",
      number: "Q-TEST-001",
      jobId: "J-TEST-001",
      customerId: "customer-unbilled",
      customerNumber: "C-TEST-001",
      customerName: "Unbilled Customer",
      property: {address: "1 Test Way"},
      scope: "Full Service",
      amount: 75
    });
    writeArray("paradise_quotes_v2", testQuotes);
    const testSchedule = getScheduleData();
    testSchedule[getLocalDateString() + "_1400"] = {
      recordType: "Quote",
      recordId: "quote-unbilled",
      jobId: "J-TEST-001",
      customerId: "customer-unbilled",
      customerNumber: "C-TEST-001",
      workStatus: "Completed",
      completedAt: new Date().toISOString()
    };
    localStorage.setItem("paradise_employee_schedule_v1", JSON.stringify(testSchedule));
  `);

  assert.equal(app.evaluate("billingSummaryV38().ready.length"), 1);
  assert.equal(app.evaluate("billingSummaryV38().ready[0].total"), 75);

  const readyKey = app.evaluate("billingSummaryV38().ready[0].key");
  const invoiceCountBefore = app.evaluate("getSavedInvoices().length");
  app.evaluate(`generateBillingInvoiceV38(${JSON.stringify(readyKey)})`);
  assert.equal(app.evaluate("getSavedInvoices().length"), invoiceCountBefore + 1);
  assert.equal(app.evaluate("completedScheduleServicesV38().length"), 0);
  app.evaluate(`generateBillingInvoiceV38(${JSON.stringify(readyKey)})`);
  assert.equal(app.evaluate("getSavedInvoices().length"), invoiceCountBefore + 1);
});

test("monthly paid revenue uses paidAt and preserves legacy invoice compatibility", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    const currentDate = getLocalDateString();
    const priorMonthDate = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15));
    storeInvoices([
      {id:"paid-this-month",jobNumber:"INV-1",status:"Paid",invoiceDate:priorMonthDate,paidAt:currentDate+"T12:00:00.000Z",total:100},
      {id:"paid-last-month",jobNumber:"INV-2",status:"Paid",invoiceDate:currentDate,paidAt:priorMonthDate+"T12:00:00.000Z",total:200},
      {id:"legacy-paid",jobNumber:"INV-3",status:"Paid",invoiceDate:currentDate,total:50}
    ]);
    refreshHomeDashboard();
  `);

  assert.equal(metricValue(app.document, "Month Revenue"), "$150.00");
  assert.equal(app.evaluate('invoicePaidRevenueDate({paidAt:"2026-07-24T10:00:00.000Z",invoiceDate:"2026-06-01"})'), "2026-07-24");
  assert.equal(app.evaluate('invoicePaidRevenueDate({invoiceDate:"2026-06-01"})'), "2026-06-01");
});

test("due today is an active Due Today reminder but not overdue", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    const today = getLocalDateString();
    const yesterday = getLocalDateString(addDays(new Date(), -1));
    storeInvoices([
      {id:"due-today",jobNumber:"INV-TODAY",status:"Unpaid",dueDate:today,clientName:"Today Customer",total:25},
      {id:"overdue",jobNumber:"INV-LATE",status:"Unpaid",dueDate:yesterday,clientName:"Late Customer",total:50}
    ]);
    refreshHomeDashboard();
  `);

  assert.equal(metricValue(app.document, "Overdue Invoices"), "1");
  assert.match(app.document.querySelector("#activeAlerts").textContent, /INV-TODAY is Due Today/);
  assert.match(app.document.querySelector("#activeAlerts").textContent, /INV-LATE is overdue/);
  assert.equal(app.evaluate('invoiceDueState({status:"Unpaid",dueDate:getLocalDateString()})'), "due-today");
});

test("quote conversion assigns a Net 14 due date and preserves identifiers", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id:"customer-quote",
      customerNumber:"C-QUOTE-001",
      name:"Quote Customer",
      billing:"2 Quote Lane",
      phone:"772-555-0100",
      email:"quote@example.com",
      properties:[{address:"2 Quote Lane"}]
    }]);
    writeArray("paradise_quotes_v2", [{
      id:"quote-1",
      number:"Q-2026-0001",
      jobId:"J-2026-0001",
      customerId:"customer-quote",
      customerNumber:"C-QUOTE-001",
      customerName:"Quote Customer",
      property:{address:"2 Quote Lane"},
      amount:125,
      scope:"Full Service",
      notes:"Test quote"
    }]);
    loadQuote("quote-1");
    convertQuoteToInvoice();
  `);

  const invoiceDate = app.document.querySelector("#todayDate").value;
  assert.equal(app.document.querySelector("#dueDate").value, app.evaluate(`addDaysStringV38("${invoiceDate}",14)`));
  assert.match(app.document.querySelector("#jobNumber").value, /^INV-\d{4}-\d{5}$/);
  assert.equal(app.document.querySelector("#invoiceJobId").value, "J-2026-0001");
  assert.equal(app.document.querySelector("#invoiceCustomerNumber").value, "C-QUOTE-001");
  assert.equal(app.document.querySelector("#total").textContent, "$125.00");
});

test("demo installation synchronizes Dashboard and Alerts immediately", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate("installDemoInvoices()");
  await wait();

  assert.equal(metricValue(app.document, "Active Alerts"), "2");
  assert.match(app.document.querySelector("#alertSummary").textContent, /2 active reminders/);
  assert.equal(app.document.querySelector("#alertCountBadge").textContent, "2");
});

test("schedule assignment immediately refreshes the visible grid and selected record", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate("installDemoInvoices()");
  await wait();
  const targetKey = app.document.querySelector(".schedule-slot").dataset.scheduleKey;

  app.evaluate(`openScheduleRecordFinder("${targetKey}");selectScheduleRecordV37("Invoice","paradise-demo-1")`);

  const refreshedSlot = app.document.querySelector(`.schedule-slot[data-schedule-key="${targetKey}"]`);
  assert.equal(refreshedSlot.querySelector(".sched-job").textContent, "J-DEMO-2026-001");
  assert.equal(app.document.querySelector("#scheduleCustomerCard").hidden, false);
  assert.equal(app.document.querySelector("#scheduleSelectedRecord").textContent, "J-DEMO-2026-001");
});

test("deleting a customer clears all visible customer state", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id:"customer-delete",
      customerNumber:"C-DELETE-001",
      name:"Delete Customer",
      phone:"772-555-0199",
      email:"delete@example.com",
      billing:"3 Delete Drive",
      notes:"Delete me",
      properties:[{name:"Delete Property",address:"3 Delete Drive"}]
    }]);
    loadCustomer("customer-delete");
    byId("customerInvoiceSearch").value="stale search";
    byId("customerInvoiceCount").textContent="3 invoices";
    byId("customerInvoiceHistory").textContent="stale history";
    deleteCurrentCustomer();
  `);

  for (const id of ["customerId", "customerName", "customerBusiness", "customerPhone", "customerEmail", "customerBilling", "customerNotes"]) {
    assert.equal(app.document.querySelector(`#${id}`).value, "");
  }
  assert.equal(app.document.querySelector("#customerNumberDisplay").textContent, "Not assigned");
  assert.equal(app.document.querySelector("#customerInvoiceSearch").value, "");
  assert.equal(app.document.querySelector("#customerInvoiceCount").textContent, "0 invoices");
  assert.match(app.document.querySelector("#customerInvoiceHistory").textContent, /Select a customer/);
  assert.equal(app.document.querySelectorAll("#propertyRows .property-row").length, 1);
});

test("existing invoice, payroll, expense, and dashboard arithmetic workflows remain correct", async (t) => {
  const app = await createApp();
  t.after(app.close);

  const firstServiceRow = app.document.querySelector("#serviceRows .service-row");
  app.document.querySelector("#businessName").value = "Regression Customer";
  firstServiceRow.querySelector(".amount").value = "100";
  app.document.querySelector("#taxRate").value = "0.065";
  app.document.querySelector("#paymentMethod").value = "0.035";
  app.evaluate("calculateTotals()");
  assert.equal(app.document.querySelector("#subtotal").textContent, "$100.00");
  assert.equal(app.document.querySelector("#total").textContent, "$110.23");
  await app.evaluate("saveInvoice()");
  await wait();
  assert.equal(app.evaluate("getSavedInvoices().length"), 1);

  app.document.querySelector("#employeeName").value = "Regression Employee";
  app.document.querySelector("#employeePayRate").value = "20";
  app.evaluate("saveEmployee()");
  const employeeId = app.document.querySelector("#payrollEmployee option:nth-child(2)").value;
  app.document.querySelector("#payrollEmployee").value = employeeId;
  app.document.querySelector("#payrollHours").value = "8";
  app.document.querySelector("#payrollAmount").value = "";
  app.evaluate("savePayrollExpense()");
  assert.equal(app.evaluate('readArray("paradise_payroll_v2")[0].amount'), 160);

  app.document.querySelector("#expenseDescription").value = "Fuel";
  app.document.querySelector("#expenseQuantity").value = "2.5";
  app.document.querySelector("#expenseUnitPrice").value = "4";
  app.evaluate("calculateExpenseTotal()");
  assert.equal(app.document.querySelector("#expenseTotal").value, "10.00");
  app.evaluate("saveOperatingExpense()");
  assert.equal(app.evaluate('readArray("paradise_operating_expenses_v2")[0].total'), 10);
});

test("Preferred Contact cards are reusable, touch-oriented, and keyboard accessible", async (t) => {
  const app = await createApp();
  t.after(app.close);

  for (const id of ["customerPreferredContact", "quotePreferredContact", "invoicePreferredContact"]) {
    const source = app.document.querySelector(`#${id}`);
    const component = source.nextElementSibling;
    assert.equal(component.getAttribute("role"), "radiogroup");
    assert.equal(component.querySelectorAll(".preferred-contact-card").length, 4);
    assert.deepEqual(
      [...component.querySelectorAll(".preferred-contact-card")].map((card) => card.dataset.value),
      ["Phone", "Text", "Email", "Smoke Signal"]
    );
  }

  const customerSource = app.document.querySelector("#customerPreferredContact");
  const phoneCard = customerSource.nextElementSibling.querySelector('[data-value="Phone"]');
  phoneCard.focus();
  phoneCard.dispatchEvent(new app.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
  assert.equal(customerSource.value, "Text");
  assert.equal(app.document.activeElement.dataset.value, "Text");
  assert.equal(app.document.activeElement.getAttribute("aria-checked"), "true");
  assert.match(style, /\.preferred-contact-card\s*\{[\s\S]*min-height:\s*82px/);
});

test("customer Preferred Contact saves canonically and reloads without losing identifiers", async (t) => {
  const app = await createApp();
  t.after(app.close);

  app.document.querySelector("#customerName").value = "Signal Customer";
  app.document.querySelector("#customerPhone").value = "772-555-0144";
  app.document.querySelector("#customerEmail").value = "signal@example.com";
  app.document.querySelector("#customerBilling").value = "19 Signal Trail";
  app.document.querySelector('#customerPreferredContact + .preferred-contact-component [data-value="Smoke Signal"]').click();
  app.evaluate("saveCustomer()");

  const saved = app.evaluate('readArray("paradise_customers_v2")[0]');
  assert.equal(saved.preferredContact, "Smoke Signal");
  assert.match(saved.customerNumber, /^C-\d{6}$/);
  const savedId = saved.id;
  const customerNumber = saved.customerNumber;

  app.evaluate("newCustomer()");
  app.evaluate(`loadCustomer(${JSON.stringify(savedId)})`);
  assert.equal(app.document.querySelector("#customerPreferredContact").value, "Smoke Signal");
  assert.equal(
    app.document.querySelector('#customerPreferredContact + .preferred-contact-component [data-value="Smoke Signal"]').getAttribute("aria-checked"),
    "true"
  );
  assert.equal(app.document.querySelector("#customerNumberDisplay").textContent, customerNumber);

  app.document.querySelector("#customerNotes").value = "Preserve the same customer record.";
  app.evaluate("saveCustomer()");
  const updated = app.evaluate('readArray("paradise_customers_v2")[0]');
  assert.equal(updated.id, savedId);
  assert.equal(updated.customerNumber, customerNumber);
  assert.equal(updated.preferredContact, "Smoke Signal");
});

test("quotes inherit, override, save, and reload Preferred Contact while preserving identity", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id: "customer-contact-quote",
      customerNumber: "C-CONTACT-001",
      name: "Quote Contact Customer",
      phone: "772-555-0101",
      email: "quote-contact@example.com",
      preferredContact: "Email",
      billing: "100 Quote Avenue",
      properties: [{name: "Main", address: "100 Quote Avenue"}]
    }]);
    renderCustomerList();
    newQuote();
    selectQuoteCustomerV318("customer-contact-quote");
  `);
  assert.equal(app.document.querySelector("#quotePreferredContact").value, "Email");

  app.document.querySelector('#quotePreferredContact + .preferred-contact-component [data-value="Text"]').click();
  app.document.querySelector("#quoteScope").value = "Weekly lawn service";
  app.document.querySelector("#quoteAmount").value = "145.00";
  app.evaluate("saveQuote()");
  const saved = app.evaluate('readArray("paradise_quotes_v2")[0]');
  assert.equal(saved.preferredContact, "Text");
  assert.equal(saved.customerId, "customer-contact-quote");
  assert.equal(saved.customerNumber, "C-CONTACT-001");
  assert.match(saved.number, /^Q-\d{4}-\d{4}$/);
  assert.match(saved.jobId, /^J-\d{4}-\d{6}$/);

  const identity = { id: saved.id, jobId: saved.jobId, number: saved.number };
  app.evaluate("newQuote()");
  app.evaluate(`loadQuote(${JSON.stringify(saved.id)})`);
  assert.equal(app.document.querySelector("#quotePreferredContact").value, "Text");
  app.document.querySelector('#quotePreferredContact + .preferred-contact-component [data-value="Smoke Signal"]').click();
  app.document.querySelector("#quoteNotes").value = "Manual quote override";
  app.evaluate("saveQuote()");

  const updated = app.evaluate('readArray("paradise_quotes_v2")[0]');
  assert.equal(updated.id, identity.id);
  assert.equal(updated.jobId, identity.jobId);
  assert.equal(updated.number, identity.number);
  assert.equal(updated.customerId, "customer-contact-quote");
  assert.equal(updated.preferredContact, "Smoke Signal");
});

test("quote conversion transfers Preferred Contact and all record identifiers into invoices", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id: "customer-conversion",
      customerNumber: "C-CONVERSION-001",
      name: "Conversion Customer",
      phone: "772-555-0110",
      email: "conversion@example.com",
      preferredContact: "Phone",
      billing: "10 Conversion Court",
      properties: [{name: "Main", address: "10 Conversion Court"}]
    }]);
    writeArray("paradise_quotes_v2", [{
      id: "quote-conversion",
      number: "Q-2026-0199",
      jobId: "J-2026-0199",
      customerId: "customer-conversion",
      customerNumber: "C-CONVERSION-001",
      customerName: "Conversion Customer",
      phone: "772-555-0110",
      email: "conversion@example.com",
      preferredContact: "Smoke Signal",
      property: {name: "Main", address: "10 Conversion Court"},
      amount: 199,
      scope: "Full Service",
      frequency: "Weekly",
      status: "Accepted"
    }]);
    loadQuote("quote-conversion");
    convertQuoteToInvoice();
  `);

  assert.equal(app.document.querySelector("#invoicePreferredContact").value, "Smoke Signal");
  assert.equal(app.document.querySelector("#invoiceJobId").value, "J-2026-0199");
  assert.equal(app.document.querySelector("#invoiceCustomerNumber").value, "C-CONVERSION-001");
  assert.equal(app.document.querySelector("#invoiceQuoteLink").value, "quote-conversion");
  assert.equal(app.document.querySelector("#invoiceSmokeAction").hidden, false);
  app.evaluate("saveInvoice()");
  await wait();

  const invoice = app.evaluate("getSavedInvoices()[0]");
  assert.equal(invoice.customerId, "customer-conversion");
  assert.equal(invoice.customerNumber, "C-CONVERSION-001");
  assert.equal(invoice.quoteId, "quote-conversion");
  assert.equal(invoice.jobId, "J-2026-0199");
  assert.equal(invoice.preferredContact, "Smoke Signal");
  assert.match(invoice.invoiceNumber, /^INV-\d{4}-\d{5}$/);
  const identity = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    jobId: invoice.jobId,
    quoteId: invoice.quoteId
  };

  app.evaluate(`loadInvoice(${JSON.stringify(invoice.id)})`);
  assert.equal(app.document.querySelector("#invoicePreferredContact").value, "Smoke Signal");
  app.document.querySelector('#invoicePreferredContact + .preferred-contact-component [data-value="Text"]').click();
  app.evaluate("saveInvoice()");
  await wait();
  const updated = app.evaluate("getSavedInvoices()[0]");
  assert.equal(updated.id, identity.id);
  assert.equal(updated.invoiceNumber, identity.invoiceNumber);
  assert.equal(updated.jobId, identity.jobId);
  assert.equal(updated.quoteId, identity.quoteId);
  assert.equal(updated.preferredContact, "Text");
});

test("legacy preferred-contact fields migrate without losing customer, quote, or invoice data", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id: "legacy-customer",
      customerNumber: "C-LEGACY-001",
      name: "Legacy Customer",
      preferredContactMethod: "sms",
      legacyMarker: "customer-data",
      properties: [{address: "1 Legacy Lane"}]
    }, {
      id: "legacy-smoke-customer",
      name: "Legacy Smoke",
      contactPreference: "smoke_signal",
      legacyMarker: "smoke-data"
    }]);
    writeArray("paradise_quotes_v2", [{
      id: "legacy-quote",
      number: "Q-LEGACY",
      jobId: "J-LEGACY",
      customerId: "legacy-customer",
      legacyMarker: "quote-data"
    }]);
    storeInvoices([{
      id: "legacy-invoice",
      jobNumber: "INV-LEGACY",
      quoteId: "legacy-quote",
      customerId: "legacy-customer",
      legacyMarker: "invoice-data"
    }]);
    migratePreferredContactsV319();
  `);

  const customer = app.evaluate('readArray("paradise_customers_v2").find(x => x.id === "legacy-customer")');
  const smokeCustomer = app.evaluate('readArray("paradise_customers_v2").find(x => x.id === "legacy-smoke-customer")');
  const quote = app.evaluate('readArray("paradise_quotes_v2")[0]');
  const invoice = app.evaluate("getSavedInvoices()[0]");
  assert.equal(customer.preferredContact, "Text");
  assert.equal(customer.preferredContactMethod, "sms");
  assert.equal(customer.legacyMarker, "customer-data");
  assert.equal(smokeCustomer.preferredContact, "Smoke Signal");
  assert.equal(smokeCustomer.legacyMarker, "smoke-data");
  assert.equal(quote.preferredContact, "Text");
  assert.equal(quote.number, "Q-LEGACY");
  assert.equal(quote.jobId, "J-LEGACY");
  assert.equal(quote.legacyMarker, "quote-data");
  assert.equal(invoice.preferredContact, "Text");
  assert.equal(invoice.jobNumber, "INV-LEGACY");
  assert.equal(invoice.legacyMarker, "invoice-data");
});

test("Communication Center supports every audience, totals every method, and never mass-launches Smoke Signal", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [
      {id:"comm-phone",name:"Phone Home",phone:"7725550101",preferredContact:"Phone",billingMethod:"Per Service"},
      {id:"comm-text",name:"Text Home",phone:"7725550102",preferredContact:"Text",billingMethod:"Bi-Weekly"},
      {id:"comm-email",name:"Email Home",email:"email@example.com",preferredContact:"Email",billingMethod:"Monthly"},
      {id:"comm-smoke",name:"Smoke Business",business:"Smoke LLC",phone:"7725550104",preferredContact:"Smoke Signal",billingMethod:"Per Service"}
    ]);
    writeArray("paradise_quotes_v2", [
      {id:"comm-weekly-quote",customerId:"comm-phone",frequency:"Weekly"}
    ]);
    byId("communicationAudience").value = "all";
    renderCommunicationRecipients();
  `);

  assert.equal(app.document.querySelectorAll("[data-communication-row]").length, 4);
  assert.equal(app.document.querySelector("#communicationPhoneCount").textContent, "1 Phone");
  assert.equal(app.document.querySelector("#communicationTextCount").textContent, "1 Text");
  assert.equal(app.document.querySelector("#communicationEmailCount").textContent, "1 Email");
  assert.equal(app.document.querySelector("#communicationSmokeCount").textContent, "1 Smoke Signal");
  assert.equal(app.evaluate('communicationVisibleCustomers().length'), 4);
  assert.equal(app.evaluate('byId("communicationAudience").value="residential";communicationVisibleCustomers().length'), 3);
  assert.equal(app.evaluate('byId("communicationAudience").value="commercial";communicationVisibleCustomers().length'), 1);
  assert.equal(app.evaluate('byId("communicationAudience").value="weekly";communicationVisibleCustomers().length'), 1);
  assert.equal(app.evaluate('byId("communicationAudience").value="biweekly";communicationVisibleCustomers().length'), 1);
  assert.equal(app.evaluate('byId("communicationAudience").value="monthly";communicationVisibleCustomers().length'), 1);
  app.evaluate('byId("communicationAudience").value="all";renderCommunicationRecipients();preparePreferredCommunications(byId("communicationStatus"))');
  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 0);
  assert.match(app.document.querySelector("#communicationStatus").textContent, /Smoke Signal was not launched/);

  app.evaluate('byId("communicationAudience").value = "selected";renderCommunicationRecipients()');
  const smokeCheckbox = app.document.querySelector('[data-communication-customer="comm-smoke"]');
  smokeCheckbox.checked = true;
  smokeCheckbox.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  assert.equal(app.document.querySelectorAll("[data-communication-row]").length, 4);
  assert.equal(app.document.querySelectorAll("[data-communication-customer]:checked").length, 1);
});

test("Smoke Signal uses the requested YouTube video and plays exactly twice before auto-closing", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);

  await app.evaluate('openSmokeSignal(byId("invoiceSmokeAction"))');
  await wait(20);
  assert.equal(app.window.__youtubeTracker.videoId, "HyRSa7rYSRE");
  app.window.__youtubeTracker.events.onStateChange({
    data: app.window.YT.PlayerState.PLAYING,
    target: app.window.__youtubeTracker.player
  });
  assert.equal(app.document.querySelector("#smokeSignalOverlay .smoke-signal-status").textContent, "Smoke signal transmission in progress...");
  assert.equal(app.window.__youtubeTracker.playCalls, 1);

  app.window.__youtubeTracker.events.onStateChange({
    data: app.window.YT.PlayerState.ENDED,
    target: app.window.__youtubeTracker.player
  });
  assert.equal(app.window.__youtubeTracker.seekCalls, 1);
  assert.equal(app.window.__youtubeTracker.playCalls, 2);
  assert.equal(app.document.querySelector(".smoke-signal-final").classList.contains("is-visible"), false);

  app.window.__youtubeTracker.events.onStateChange({
    data: app.window.YT.PlayerState.ENDED,
    target: app.window.__youtubeTracker.player
  });
  assert.equal(app.window.__youtubeTracker.playCalls, 2);
  assert.equal(app.document.querySelector(".smoke-signal-final").classList.contains("is-visible"), true);
  assert.equal(
    app.document.querySelector("#smokeSignalOverlay .smoke-signal-final").textContent.replace(/\s+/g, " ").trim(),
    "No response received.Try Text or Phone instead."
  );

  await wait(2500);
  assert.equal(app.document.querySelector("#smokeSignalOverlay"), null);
  assert.equal(app.window.__youtubeTracker.destroyed, 1);
});

test("Smoke Signal manual close restores tab, scroll, focus, and destroys the player", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);
  app.evaluate('switchTab("customersTab");window.scrollTo(35, 640);byId("customerName").focus()');
  await app.evaluate('openSmokeSignal(byId("customerName"))');
  await wait(20);
  app.evaluate('switchTab("homeTab")');
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
  await wait(20);

  assert.equal(app.document.querySelector("#smokeSignalOverlay"), null);
  assert.equal(app.document.querySelector("#customersTab").classList.contains("active"), true);
  assert.equal(app.window.scrollX, 35);
  assert.equal(app.window.scrollY, 640);
  assert.equal(app.document.activeElement.id, "customerName");
  assert.equal(app.window.__youtubeTracker.destroyed, 1);
});

test("Smoke Signal handles offline/API failure, autoplay denial, Escape, and duplicate launch", async (t) => {
  const offlineApp = await createApp({ online: false });
  t.after(offlineApp.close);
  const firstOpen = await offlineApp.evaluate('openSmokeSignal(byId("invoiceSmokeAction"))');
  const duplicateOpen = await offlineApp.evaluate('openSmokeSignal(byId("invoiceSmokeAction"))');
  assert.equal(firstOpen, true);
  assert.equal(duplicateOpen, false);
  assert.equal(offlineApp.document.querySelectorAll("#smokeSignalOverlay").length, 1);
  assert.equal(
    offlineApp.document.querySelector(".smoke-signal-status").textContent.replace(/\s+/g, " ").trim(),
    "The smoke signal could not be delivered.Try Text or Phone instead."
  );
  offlineApp.document.dispatchEvent(new offlineApp.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  await wait(10);
  assert.equal(offlineApp.document.querySelector("#smokeSignalOverlay"), null);

  const autoplayApp = await createApp({ youtube: true });
  t.after(autoplayApp.close);
  await autoplayApp.evaluate('openSmokeSignal(byId("invoiceSmokeAction"))');
  await wait(20);
  autoplayApp.window.__youtubeTracker.events.onAutoplayBlocked();
  const playButton = autoplayApp.document.querySelector("#smokeSignalOverlay .smoke-signal-play");
  assert.equal(playButton.hidden, false);
  assert.match(autoplayApp.document.querySelector(".smoke-signal-status").textContent, /Autoplay was blocked/);
  playButton.click();
  assert.equal(autoplayApp.window.__youtubeTracker.playCalls, 2);
  autoplayApp.window.__youtubeTracker.events.onError({ data: 100 });
  assert.equal(
    autoplayApp.document.querySelector(".smoke-signal-status").textContent.replace(/\s+/g, " ").trim(),
    "The smoke signal could not be delivered.Try Text or Phone instead."
  );
  autoplayApp.evaluate("closeSmokeSignal()");
});

test("static validation finds no duplicate IDs or missing inline click handlers", async (t) => {
  const staticDom = new JSDOM(html);
  const ids = [...staticDom.window.document.querySelectorAll("[id]")].map((element) => element.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  staticDom.window.close();
  assert.deepEqual([...new Set(duplicates)], []);

  const app = await createApp();
  t.after(app.close);
  const handlerNames = new Set();
  app.document.querySelectorAll("[onclick]").forEach((element) => {
    const source = element.getAttribute("onclick");
    for (const match of source.matchAll(/(?:^|;)\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (match[1] !== "this") handlerNames.add(match[1]);
    }
  });
  const missing = [...handlerNames].filter((name) => app.evaluate(`typeof ${name}`) !== "function");
  assert.deepEqual(missing, []);
});

test("single-page modules, dashboard drag-and-drop, finders, history, PDF, weather, and maintenance remain operational", async (t) => {
  const app = await createApp();
  t.after(app.close);
  const tabIds = [
    "homeTab",
    "invoiceTab",
    "quoteTab",
    "scheduleTab",
    "customersTab",
    "communicationTab",
    "employeesTab",
    "maintenanceTab",
    "weatherTab",
    "alertsTab"
  ];
  for (const tabId of tabIds) {
    app.evaluate(`switchTab(${JSON.stringify(tabId)})`);
    assert.equal(app.document.querySelector(`#${tabId}`).classList.contains("active"), true);
  }

  const dashboardCards = [...app.document.querySelectorAll("#homeDashboardGrid .dashboard-card")];
  assert.ok(dashboardCards.length >= 8);
  assert.equal(dashboardCards.every((card) => card.draggable), true);
  const transfer = {
    dropEffect: "",
    effectAllowed: "",
    getData: () => "",
    setData: () => {}
  };
  const dragStart = new app.window.Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(dragStart, "dataTransfer", { value: transfer });
  dashboardCards[0].dispatchEvent(dragStart);
  const dragOver = new app.window.Event("dragover", { bubbles: true, cancelable: true });
  Object.defineProperties(dragOver, {
    clientX: { value: 10 },
    clientY: { value: 10 },
    dataTransfer: { value: transfer }
  });
  dashboardCards[1].dispatchEvent(dragOver);
  const drop = new app.window.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: transfer });
  dashboardCards[1].dispatchEvent(drop);
  dashboardCards[0].dispatchEvent(new app.window.Event("dragend", { bubbles: true }));
  const savedOrder = JSON.parse(app.window.localStorage.getItem("paradise_dashboard_order_v3"));
  assert.equal(savedOrder[0], dashboardCards[1].dataset.cardId);
  assert.equal(savedOrder[1], dashboardCards[0].dataset.cardId);

  app.evaluate("installDemoInvoices()");
  await wait(120);
  app.evaluate("openInvoiceFinder()");
  assert.equal(app.document.querySelector("#invoiceFinderModal").hidden, false);
  assert.equal(app.document.querySelectorAll("#invoiceList .invoice-row").length, 5);
  app.evaluate('loadInvoice("paradise-demo-4");viewInvoicePdf()');
  assert.equal(app.document.querySelector("#pdfModal").hidden, false);
  assert.match(app.document.querySelector("#pdfPreview").textContent, /Preferred Contact:\s*Smoke Signal/);
  app.evaluate('loadCustomer("demo-customer-4")');
  await wait(120);
  assert.match(app.document.querySelector("#customerInvoiceHistory").textContent, /INV-DEMO-004/);
  assert.equal(app.document.querySelector("#customerInvoiceCount").textContent, "1 invoice");

  assert.ok(app.document.querySelectorAll("#maintenanceEquipment .equipment-type").length > 0);
  assert.ok(app.document.querySelectorAll("#inventoryTable .inventory-row").length > 0);
  assert.ok(app.document.querySelectorAll("#scheduleBody .schedule-slot").length > 0);
  assert.ok(app.document.querySelectorAll("#quoteList .record-card").length >= 5);
  assert.match(app.document.querySelector("#weatherStatus").textContent, /Live weather loaded for Stuart/);
  assert.ok(app.document.querySelectorAll("#weatherForecastList .weather-period").length > 0);
  assert.ok(app.document.querySelector("#alertSummary").textContent.length > 0);
  assert.deepEqual(app.consoleErrors, []);
  assert.deepEqual(app.jsdomErrors, []);
});

test("GitHub Pages assets are repository-local and startup is clean at desktop and mobile viewports", async (t) => {
  const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1].split("?")[0])
    .filter((reference) => !/^(?:https?:|mailto:|tel:|sms:|#)/.test(reference));
  const missingAssets = localReferences.filter((reference) => !fs.existsSync(path.join(root, reference)));
  assert.deepEqual(missingAssets, []);
  assert.doesNotMatch(script, /jsdelivr|raw\.githubusercontent|756755a7/);

  const desktop = await createApp({ height: 900, width: 1440 });
  t.after(desktop.close);
  const mobile = await createApp({ height: 844, width: 390 });
  t.after(mobile.close);
  assert.equal(desktop.window.innerWidth, 1440);
  assert.equal(mobile.window.innerWidth, 390);
  assert.equal(desktop.document.querySelectorAll(".preferred-contact-card").length, 12);
  assert.equal(mobile.document.querySelectorAll(".preferred-contact-card").length, 12);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
  assert.match(style, /@media\s*\(max-width:\s*760px\)[\s\S]*\.preferred-contact-component/);
  assert.deepEqual(desktop.consoleErrors, []);
  assert.deepEqual(mobile.consoleErrors, []);
  assert.deepEqual(desktop.jsdomErrors, []);
  assert.deepEqual(mobile.jsdomErrors, []);
});
