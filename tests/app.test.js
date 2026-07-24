const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");

const wait = (milliseconds = 80) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function createApp() {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://127.0.0.1/"
  });
  const { window } = dom;
  window.alert = () => {};
  window.confirm = () => true;
  window.open = () => null;
  window.print = () => {};
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  if (!window.crypto.randomUUID) {
    let sequence = 0;
    window.crypto.randomUUID = () => `test-uuid-${++sequence}`;
  }
  await new Promise((resolve) => setImmediate(resolve));
  window.eval(script);
  await wait();
  return {
    close: () => window.close(),
    document: window.document,
    evaluate: (source) => window.eval(source),
    window
  };
}

function metricValue(document, label) {
  const card = [...document.querySelectorAll("#homeMetricCards .intelligence-card")]
    .find((item) => item.querySelector("span")?.textContent === label);
  return card?.querySelector("strong")?.textContent;
}

test("v3.12 identifiers and Billing Center dialog structure agree", () => {
  assert.match(html, /Operations Suite v3\.12 — Stability Repairs/);
  assert.match(html, /style\.css\?v=3\.12\.0/);
  assert.match(html, /script\.js\?v=3\.12\.0/);
  assert.match(script, /Version 3\.12/);
  assert.match(script, /DASHBOARD_VERSION_V39="3\.12"/);
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
