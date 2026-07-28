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

function createLeafletStub() {
  const state = {
    invalidateCalls: 0,
    layers: [],
    mapCount: 0,
    maps: [],
    panCalls: [],
    setViewCalls: []
  };
  function makeLayer(type, details = {}) {
    const handlers = new Map();
    const layer = {
      ...details,
      type,
      addTo(map) {
        this.map = map;
        map.layers.push(this);
        state.layers.push(this);
        return this;
      },
      bindPopup(content) {
        this.popup = content;
        return this;
      },
      bindTooltip(content) {
        this.tooltip = content;
        return this;
      },
      fire(eventName) {
        (handlers.get(eventName) || []).forEach((handler) => handler({ target: this }));
        return this;
      },
      getBounds() {
        return [[26.8, -80.5], [27.5, -80.0]];
      },
      on(eventName, handler) {
        handlers.set(eventName, [...(handlers.get(eventName) || []), handler]);
        return this;
      },
      once(eventName, handler) {
        const wrapped = (event) => {
          handlers.set(eventName, (handlers.get(eventName) || []).filter((item) => item !== wrapped));
          handler(event);
        };
        return this.on(eventName, wrapped);
      },
      openPopup() {
        this.popupOpened = true;
        return this;
      },
      setOpacity(value) {
        this.opacity = value;
        return this;
      }
    };
    return layer;
  }
  const L = {
    circleMarker: (coordinates, options) => makeLayer("circleMarker", { coordinates, options }),
    divIcon: (options) => ({ ...options, isDivIcon: true }),
    geoJSON: (geometry, options) => makeLayer("geoJSON", { geometry, options }),
    map: (id) => {
      state.mapCount += 1;
      const map = {
        id,
        layers: [],
        fitBounds() { return this; },
        invalidateSize() {
          state.invalidateCalls += 1;
          return this;
        },
        panTo(coordinates) {
          state.panCalls.push(coordinates);
          return this;
        },
        removeLayer(layer) {
          this.layers = this.layers.filter((item) => item !== layer);
          return this;
        },
        setView(coordinates, zoom) {
          state.setViewCalls.push({ coordinates, zoom });
          return this;
        }
      };
      state.maps.push(map);
      return map;
    },
    marker: (coordinates, options) => makeLayer("marker", { coordinates, options }),
    rectangle: (bounds, options) => makeLayer("rectangle", { bounds, options }),
    tileLayer: (url, options) => makeLayer("tileLayer", { options, url })
  };
  return { L, state };
}

async function createApp({
  geolocation = null,
  height = 900,
  leaflet = false,
  online = true,
  radarFrames = [],
  width = 1440,
  youtube = false
} = {}) {
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
  const alerts = [];
  const printCalls = [];
  const geolocationTracker = { calls: 0 };
  const fetchControl = {
    geocode: new Map(),
    geocodeFailure: new Set(),
    radarFailure: false,
    radarFrames: [...radarFrames],
    routeFailure: false
  };
  const leafletStub = leaflet ? createLeafletStub() : null;
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
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.open = (url) => {
    openedUrls.push(String(url));
    return null;
  };
  window.print = () => printCalls.push(new Date().toISOString());
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
  if (leafletStub) window.L = leafletStub.L;
  if (geolocation) {
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success, failure) {
          geolocationTracker.calls += 1;
          if (geolocation.type === "success") {
            window.setTimeout(() => success({
              coords: {
                accuracy: geolocation.accuracy ?? 25,
                latitude: geolocation.lat ?? 27.2,
                longitude: geolocation.lon ?? -80.25
              },
              timestamp: geolocation.timestamp ?? Date.now()
            }), 0);
            return;
          }
          window.setTimeout(() => failure({
            code: geolocation.code ?? 1,
            message: geolocation.message || "Location unavailable"
          }), 0);
        }
      }
    });
  }
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
      if (fetchControl.radarFailure) return { ok: false, status: 503, json: async () => ({}) };
      body = { host: "https://test-radar.local", radar: { past: fetchControl.radarFrames, nowcast: [] } };
    } else if (url.includes("nominatim.openstreetmap.org")) {
      const address = decodeURIComponent(new URL(url).searchParams.get("q") || "");
      if (fetchControl.geocodeFailure.has(address)) {
        body = [];
      } else {
        const point = fetchControl.geocode.get(address) || { lat: 27.21, lon: -80.31 };
        body = [{ lat: String(point.lat), lon: String(point.lon), display_name: address }];
      }
    } else if (url.includes("router.project-osrm.org")) {
      if (fetchControl.routeFailure) return { ok: false, status: 503, json: async () => ({}) };
      const coordinateSource = url.split("/driving/")[1].split("?")[0];
      const coordinates = coordinateSource.split(";").map((item) => item.split(",").map(Number));
      body = {
        code: "Ok",
        routes: [{
          distance: Math.max(1, coordinates.length - 1) * 8046.72,
          duration: Math.max(1, coordinates.length - 1) * 600,
          geometry: { type: "LineString", coordinates }
        }]
      };
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
    alerts,
    close: () => window.close(),
    consoleErrors,
    consoleWarnings,
    document: window.document,
    evaluate: (source) => window.eval(source),
    fetchControl,
    geolocationTracker,
    jsdomErrors,
    leafletState: leafletStub?.state || null,
    openedUrls,
    printCalls,
    window
  };
}

function metricValue(document, label) {
  const card = [...document.querySelectorAll("#homeMetricCards .intelligence-card")]
    .find((item) => item.querySelector("span")?.textContent === label);
  return card?.querySelector("strong")?.textContent;
}

function setPreferredWithoutLaunch(app, selectId, value) {
  const select = app.document.querySelector(`#${selectId}`);
  select.value = value;
  select.dispatchEvent(new app.window.Event("change", { bubbles: true }));
}

function clickPreferredCard(app, selectId, value) {
  const card = app.document.querySelector(
    `#${selectId} + .preferred-contact-component [data-value="${value}"]`
  );
  assert.ok(card, `${value} card should exist for ${selectId}`);
  card.click();
  return card;
}

test("v3.19 identifiers, cache keys, and Billing Center dialog structure agree", () => {
  assert.match(html, /<title>Paradise Lawn Care Operations Suite v3\.19<\/title>/);
  assert.match(html, /Operations Suite v3\.19 — Preferred Contact &amp; Smoke Signal/);
  assert.match(html, /style\.css\?v=3\.19\.2/);
  assert.match(html, /script\.js\?v=3\.19\.2/);
  assert.match(html, /vendor\/leaflet\/leaflet\.css\?v=1\.9\.4/);
  assert.match(html, /vendor\/leaflet\/leaflet\.js\?v=1\.9\.4/);
  assert.match(script, /Version 3\.19/);
  assert.match(script, /const APP_VERSION = "3\.19"/);
  assert.match(script, /DASHBOARD_VERSION_V39="3\.19"/);
  assert.doesNotMatch(script, /cdn\.jsdelivr\.net\/gh\/TomT-GoldCoast/);
  assert.doesNotMatch(script, /document\.write/);
  assert.doesNotMatch(html, /invoiceSmokeAction|openInvoiceSmokeSignal/);
  assert.doesNotMatch(script, /invoiceSmokeAction|openInvoiceSmokeSignal/);
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
  for (const value of ["Phone", "Text", "Email"]) {
    clickPreferredCard(app, "customerPreferredContact", value);
    assert.equal(customerSource.value, value);
    assert.equal(app.document.querySelector("#smokeSignalOverlay"), null);
  }
  assert.match(style, /\.preferred-contact-card\s*\{[\s\S]*min-height:\s*82px/);
});

test("explicit Invoice Text and Email buttons launch one encoded handoff per actual click", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate("window.__handoffs=[];window.__paradiseDeviceLinkHandler=function(url){window.__handoffs.push(url);};");
  app.document.querySelector("#clientName").value = "Text & Email Customer";
  app.document.querySelector("#phone").value = "(772) 555-0140";
  app.document.querySelector("#email").value = "customer+invoice@example.com";
  app.document.querySelector("#notes").value = "Line one\nLine two & more";

  app.document.querySelector("#invoiceTextAction").click();
  app.document.querySelector("#invoiceEmailAction").click();

  const handoffs = app.evaluate("window.__handoffs");
  assert.equal(handoffs.length, 2);
  assert.match(handoffs[0], /^sms:7725550140\?body=/);
  assert.match(decodeURIComponent(handoffs[0]), /Text & Email Customer/);
  assert.match(handoffs[1], /^mailto:customer%2Binvoice@example\.com\?subject=/);
  assert.match(decodeURIComponent(handoffs[1]), /Paradise Lawn Care Invoice/);
  assert.equal(app.document.querySelectorAll('[id^="invoiceTextAction"]').length, 1);
  assert.equal(app.document.querySelectorAll('[id^="invoiceEmailAction"]').length, 1);

  app.evaluate("window.__handoffs=[]");
  clickPreferredCard(app, "invoicePreferredContact", "Text");
  clickPreferredCard(app, "invoicePreferredContact", "Email");
  assert.equal(app.evaluate("window.__handoffs.length"), 0);

  app.document.querySelector("#phone").value = "";
  app.document.querySelector("#email").value = "invalid";
  app.document.querySelector("#invoiceTextAction").click();
  app.document.querySelector("#invoiceEmailAction").click();
  assert.equal(app.evaluate("window.__handoffs.length"), 0);
  assert.match(app.alerts.join(" "), /phone number/);
  assert.match(app.alerts.join(" "), /email address/);
});

test("Quote, Customer, Scheduling, and Communication individual actions use one-click handoffs", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.evaluate("window.__handoffs=[];window.__paradiseDeviceLinkHandler=function(url){window.__handoffs.push(url);};");

  app.document.querySelector("#quotePhone").value = "772-555-0160";
  app.document.querySelector("#quoteEmail").value = "quote@example.com";
  app.document.querySelector("#quoteScope").value = "Full Service & cleanup";
  app.document.querySelector("#quoteAmount").value = "150.00";
  app.document.querySelector("#quoteTextAction").click();
  app.document.querySelector("#quoteEmailAction").click();

  app.document.querySelector("#customerName").value = "Direct Customer";
  app.document.querySelector("#customerPhone").value = "772-555-0170";
  app.document.querySelector("#customerEmail").value = "direct@example.com";
  app.document.querySelector("#customerTextAction").click();
  app.document.querySelector("#customerEmailAction").click();

  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id:"individual-communication",
      name:"Communication Customer",
      phone:"772-555-0180",
      email:"communication@example.com",
      preferredContact:"Email"
    }]);
    renderCommunicationRecipients();
  `);
  app.document.querySelector('[data-communication-action="Text"][data-customer-id="individual-communication"]').click();
  app.document.querySelector('[data-communication-action="Email"][data-customer-id="individual-communication"]').click();

  const handoffs = app.evaluate("window.__handoffs");
  assert.equal(handoffs.length, 6);
  assert.equal(handoffs.filter((url) => url.startsWith("sms:")).length, 3);
  assert.equal(handoffs.filter((url) => url.startsWith("mailto:")).length, 3);
  assert.match(decodeURIComponent(handoffs[0]), /Full Service & cleanup/);
  assert.match(decodeURIComponent(handoffs[1]), /Paradise Lawn Care Quote/);
});

test("invoice view, preview, and print DOM use the approved local logo and grass artwork", async (t) => {
  const app = await createApp();
  t.after(app.close);
  assert.equal(app.document.querySelector(".header .logo").getAttribute("src"), "images/paradise-logo.svg");
  assert.equal(app.document.querySelector(".header .grass img").getAttribute("src"), "images/grass.svg");
  assert.doesNotMatch(html, /tomt-goldcoast\.github\.io\/paradise-invoice/);

  app.document.querySelector("#clientName").value = "Artwork Customer";
  app.document.querySelector("#email").value = "artwork@example.com";
  app.document.querySelector("#viewInvoicePdfButton").click();
  const preview = app.document.querySelector("#pdfPreview");
  assert.equal(preview.querySelector(".pdf-logo").getAttribute("src"), "images/paradise-logo.svg");
  assert.equal(preview.querySelector(".pdf-grass-art").getAttribute("src"), "images/grass.svg");
  assert.match(preview.querySelector(".pdf-logo").getAttribute("alt"), /Paradise Lawn Care/);
  assert.match(preview.querySelector(".pdf-grass-art").getAttribute("alt"), /grass corner artwork/);
  assert.match(style, /@media print[\s\S]*#pdfPreview img[\s\S]*visibility:\s*visible/);
  assert.match(style, /body\s*>\s*:not\(#pdfModal\)\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.match(style, /body\s*>\s*#pdfModal\s*\{[\s\S]*position:\s*static\s*!important/);

  app.evaluate("waitForInvoiceArtworkV319=function(){return Promise.resolve();}");
  app.document.querySelector("#printInvoicePreviewButton").click();
  await wait(20);
  assert.equal(app.printCalls.length, 1);
});

test("Customer Smoke Signal card launches the reusable controller", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);
  clickPreferredCard(app, "customerPreferredContact", "Smoke Signal");
  await wait(20);

  assert.equal(app.document.querySelector("#customerPreferredContact").value, "Smoke Signal");
  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 1);
  assert.equal(app.window.__youtubeTracker.videoId, "HyRSa7rYSRE");
  assert.equal(app.window.__youtubeTracker.playCalls, 1);
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
});

test("Quote Smoke Signal card launches the reusable controller", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);
  clickPreferredCard(app, "quotePreferredContact", "Smoke Signal");
  await wait(20);

  assert.equal(app.document.querySelector("#quotePreferredContact").value, "Smoke Signal");
  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 1);
  assert.equal(app.window.__youtubeTracker.playCalls, 1);
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
});

test("Invoice Smoke Signal card launches the controller without a duplicate toolbar action", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);
  assert.equal(app.document.querySelector("#invoiceSmokeAction"), null);
  clickPreferredCard(app, "invoicePreferredContact", "Smoke Signal");
  await wait(20);

  assert.equal(app.document.querySelector("#invoicePreferredContact").value, "Smoke Signal");
  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 1);
  assert.equal(app.window.__youtubeTracker.playCalls, 1);
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
});

test("Communication Center explicit individual Smoke Signal action launches the controller", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id: "communication-smoke-launch",
      name: "Communication Launch Customer",
      email: "launch@example.com",
      preferredContact: "Email"
    }]);
    renderCommunicationRecipients();
  `);
  const action = app.document.querySelector('[data-communication-action="Smoke Signal"][data-customer-id="communication-smoke-launch"]');

  assert.ok(action);
  action.click();
  await wait(20);

  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 1);
  assert.equal(app.window.__youtubeTracker.playCalls, 1);
  assert.match(app.document.querySelector("#communicationStatus").textContent, /Opening Smoke Signal/);
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
});

test("customer Preferred Contact saves canonically and reloads without losing identifiers", async (t) => {
  const app = await createApp();
  t.after(app.close);

  app.document.querySelector("#customerName").value = "Signal Customer";
  app.document.querySelector("#customerPhone").value = "772-555-0144";
  app.document.querySelector("#customerEmail").value = "signal@example.com";
  app.document.querySelector("#customerBilling").value = "19 Signal Trail";
  setPreferredWithoutLaunch(app, "customerPreferredContact", "Smoke Signal");
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
  setPreferredWithoutLaunch(app, "quotePreferredContact", "Smoke Signal");
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
  assert.equal(app.document.querySelector("#invoiceSmokeAction"), null);
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

test("protected legacy records retain identifiers, attachments, schedule metadata, and unrelated module data", async (t) => {
  const app = await createApp();
  t.after(app.close);
  const result = app.evaluate(`(()=>{
    const customer = {
      id:"protected-customer",
      customerNumber:"C-PROTECTED",
      name:"Protected Customer",
      properties:[{id:"property-1",address:"1 Protected Lane",gateCode:"7890",customPropertyField:"keep"}],
      attachmentIds:["customer-file-1"],
      customCustomerField:"keep"
    };
    const quote = {
      id:"protected-quote",
      number:"Q-PROTECTED",
      jobId:"J-PROTECTED",
      customerId:customer.id,
      property:customer.properties[0],
      attachmentIds:["quote-file-1"],
      customQuoteField:"keep"
    };
    const invoice = {
      id:"protected-invoice",
      invoiceNumber:"INV-PROTECTED",
      jobNumber:"INV-PROTECTED",
      jobId:"J-PROTECTED",
      customerId:customer.id,
      quoteId:quote.id,
      attachmentIds:["invoice-file-1"],
      customInvoiceField:"keep",
      services:[{address:"1 Protected Lane",service:"Full Service",amount:90}]
    };
    writeArray("paradise_customers_v2",[customer]);
    writeArray("paradise_quotes_v2",[quote]);
    storeInvoices([invoice]);
    writeArray("paradise_employees_v2",[{id:"employee-keep",name:"Employee Keep",customField:"keep"}]);
    writeArray("paradise_payroll_v2",[{id:"payroll-keep",employeeId:"employee-keep",amount:120,customField:"keep"}]);
    writeArray("paradise_operating_expenses_v2",[{id:"expense-keep",total:45,customField:"keep"}]);
    writeArray("paradise_inventory_v2",[{id:"stock-keep",name:"String",quantity:3,customField:"keep"}]);
    localStorage.setItem("paradise_maintenance_records_v1",JSON.stringify({mower:{notes:"keep"}}));
    const scheduleKey=getLocalDateString()+"_0830";
    localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
      [scheduleKey]:{
        recordType:"Invoice",
        recordId:invoice.id,
        jobId:invoice.jobId,
        jobNumber:invoice.jobNumber,
        customerId:customer.id,
        customerNumber:customer.customerNumber,
        routeLocked:true,
        manualOrder:2,
        appointmentWindow:"8:00–9:00",
        attachmentIds:["schedule-file-1"],
        customScheduleField:"keep",
        workStatus:"Upcoming"
      }
    }));
    migratePreferredContactsV319();
    renderSchedule();
    saveSchedule();
    return {
      customer:readArray("paradise_customers_v2")[0],
      quote:readArray("paradise_quotes_v2")[0],
      invoice:getSavedInvoices()[0],
      schedule:getScheduleData()[scheduleKey],
      employee:readArray("paradise_employees_v2")[0],
      payroll:readArray("paradise_payroll_v2")[0],
      expense:readArray("paradise_operating_expenses_v2")[0],
      inventory:readArray("paradise_inventory_v2")[0],
      maintenance:JSON.parse(localStorage.getItem("paradise_maintenance_records_v1"))
    };
  })()`);

  assert.equal(result.customer.id, "protected-customer");
  assert.equal(result.customer.customerNumber, "C-PROTECTED");
  assert.equal(result.customer.properties[0].customPropertyField, "keep");
  assert.equal(result.customer.attachmentIds[0], "customer-file-1");
  assert.equal(result.quote.id, "protected-quote");
  assert.equal(result.quote.jobId, "J-PROTECTED");
  assert.equal(result.quote.attachmentIds[0], "quote-file-1");
  assert.equal(result.invoice.id, "protected-invoice");
  assert.equal(result.invoice.quoteId, "protected-quote");
  assert.equal(result.invoice.attachmentIds[0], "invoice-file-1");
  assert.equal(result.schedule.routeLocked, true);
  assert.equal(result.schedule.manualOrder, 2);
  assert.equal(result.schedule.appointmentWindow, "8:00–9:00");
  assert.equal(result.schedule.attachmentIds[0], "schedule-file-1");
  assert.equal(result.schedule.customScheduleField, "keep");
  assert.equal(result.employee.customField, "keep");
  assert.equal(result.payroll.customField, "keep");
  assert.equal(result.expense.customField, "keep");
  assert.equal(result.inventory.customField, "keep");
  assert.equal(result.maintenance.mower.notes, "keep");
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
  app.evaluate("preparePreferredCommunications(byId('communicationStatus'))");
  assert.equal(app.document.querySelectorAll("#smokeSignalOverlay").length, 0);
  assert.match(app.document.querySelector("#communicationStatus").textContent, /mass communications never launch it automatically/);
});

test("Smoke Signal uses the requested YouTube video and plays exactly twice before auto-closing", async (t) => {
  const app = await createApp({ youtube: true });
  t.after(app.close);

  clickPreferredCard(app, "invoicePreferredContact", "Smoke Signal");
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
  app.evaluate('switchTab("customersTab");window.scrollTo(35, 640)');
  const card = app.document.querySelector('#customerPreferredContact + .preferred-contact-component [data-value="Smoke Signal"]');
  card.focus();
  card.click();
  await wait(20);
  app.evaluate('switchTab("homeTab")');
  app.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
  await wait(20);

  assert.equal(app.document.querySelector("#smokeSignalOverlay"), null);
  assert.equal(app.document.querySelector("#customersTab").classList.contains("active"), true);
  assert.equal(app.window.scrollX, 35);
  assert.equal(app.window.scrollY, 640);
  assert.equal(app.document.activeElement, card);
  assert.equal(app.window.__youtubeTracker.destroyed, 1);
});

test("Smoke Signal handles offline/API failure, autoplay denial, Escape, and duplicate launch", async (t) => {
  const offlineApp = await createApp({ online: false });
  t.after(offlineApp.close);
  clickPreferredCard(offlineApp, "invoicePreferredContact", "Smoke Signal");
  clickPreferredCard(offlineApp, "invoicePreferredContact", "Smoke Signal");
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
  clickPreferredCard(autoplayApp, "invoicePreferredContact", "Smoke Signal");
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
  autoplayApp.document.querySelector("#smokeSignalOverlay .smoke-signal-close").click();
});

test("Radar initializes after its tab is visible, resizes, retries, and never duplicates its map", async (t) => {
  const app = await createApp({
    leaflet: true,
    radarFrames: [
      { path: "/v2/radar/100", time: 100 },
      { path: "/v2/radar/200", time: 200 }
    ]
  });
  t.after(app.close);
  const weatherButton = app.document.querySelector('[data-tab="weatherTab"]');
  weatherButton.click();
  await wait(180);

  assert.equal(app.leafletState.mapCount, 1);
  assert.ok(app.leafletState.invalidateCalls > 0);
  assert.equal(app.evaluate("getRadarStateV319().frameCount"), 2);
  assert.match(app.document.querySelector("#radarStatus").textContent, /Radar loaded|Radar ready/);
  weatherButton.click();
  await wait(120);
  assert.equal(app.leafletState.mapCount, 1);

  const radarTile = app.leafletState.layers.find((layer) => layer.type === "tileLayer" && layer.url.includes("test-radar"));
  assert.ok(radarTile);
  radarTile.fire("tileerror");
  assert.match(app.document.querySelector("#radarStatus").textContent, /blocked or unavailable/);
  assert.equal(app.document.querySelector("#radarStatus").classList.contains("is-error"), true);
});

test("Radar failure leaves Weather usable and the visible Refresh Radar action recovers", async (t) => {
  const app = await createApp({ leaflet: true });
  t.after(app.close);
  app.fetchControl.radarFailure = true;
  app.document.querySelector('[data-tab="weatherTab"]').click();
  await wait(150);
  assert.match(app.document.querySelector("#radarStatus").textContent, /could not be reached/);
  assert.equal(app.document.querySelector("#radarRefreshButton").hidden, false);
  assert.match(app.document.querySelector("#weatherStatus").textContent, /Live weather loaded/);

  app.fetchControl.radarFailure = false;
  app.fetchControl.radarFrames = [{ path: "/v2/radar/retry", time: 300 }];
  app.document.querySelector("#radarRefreshButton").click();
  await wait(100);
  assert.equal(app.evaluate("getRadarStateV319().frameCount"), 1);
  assert.match(app.document.querySelector("#radarStatus").textContent, /Radar loaded/);
  assert.deepEqual(app.consoleErrors.filter((message) => !message.includes("Radar provider failure")), []);
});

test("missing map-library startup fails visibly without breaking live Weather", async (t) => {
  const app = await createApp();
  t.after(app.close);
  app.document.querySelector('[data-tab="weatherTab"]').click();
  await wait(120);
  assert.match(app.document.querySelector("#radarStatus").textContent, /map library did not load/i);
  assert.match(app.document.querySelector("#weatherStatus").textContent, /Live weather loaded/);
  assert.equal(app.document.querySelector("#radarRefreshButton").hidden, false);
  assert.equal(app.document.querySelector("#invoiceTab").classList.contains("tab-panel"), true);
  assert.equal(app.consoleErrors.length, 0);
});

test("one click on a populated Scheduling job shows the linked customer, property, actions, and map pin", async (t) => {
  const app = await createApp({ leaflet: true });
  t.after(app.close);
  app.evaluate(`
    installDemoInvoices();
    const customers = readArray("paradise_customers_v2");
    const customer = customers.find(item => item.id === "demo-customer-1");
    customer.properties[0].lat = 27.22;
    customer.properties[0].lon = -80.24;
    writeArray("paradise_customers_v2", customers);
    renderSchedule();
    window.__handoffs=[];
    window.__paradiseDeviceLinkHandler=function(url){window.__handoffs.push(url);};
  `);
  const jobButton = [...app.document.querySelectorAll(".job-number-button")]
    .find((button) => button.textContent.includes("J-DEMO-2026-001"));
  assert.ok(jobButton);
  jobButton.click();

  assert.equal(app.document.querySelector("#scheduleCustomerCard").hidden, false);
  assert.match(app.document.querySelector("#scheduleSelectedCustomer").textContent, /Maria Santos/);
  assert.match(app.document.querySelector("#scheduleSelectedAddress").textContent, /Ocean Blvd/);
  assert.match(app.document.querySelector("#scheduleSelectedDetails").textContent, /maria\.santos@example\.com/);
  assert.match(app.document.querySelector("#scheduleSelectedDetails").textContent, /Dog in fenced rear yard/);
  assert.match(app.document.querySelector("#scheduleSelectedDetails").textContent, /Full Service/);

  app.document.querySelector("#scheduleTextCustomerButton").click();
  app.document.querySelector("#scheduleEmailCustomerButton").click();
  assert.equal(app.evaluate("window.__handoffs.length"), 2);
  assert.match(app.evaluate("decodeURIComponent(window.__handoffs[0])"), /Maria Santos/);

  app.document.querySelector("#scheduleShowMapButton").click();
  await wait(30);
  assert.ok(app.leafletState.layers.some((layer) => layer.type === "marker" && layer.popup?.includes("Maria Santos")));
  app.document.querySelector("#scheduleOpenMapsButton").click();
  assert.match(app.openedUrls.at(-1), /google\.com\/maps\/search/);

  const scheduleType = jobButton.closest(".schedule-slot").querySelector(".sched-type");
  scheduleType.value = scheduleType.value === "BP" ? "RS" : "BP";
  scheduleType.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  assert.ok(["BP", "RS"].includes(scheduleType.value));
});

test("Scheduling still shows the correct customer when its property address is missing and map actions fail safely", async (t) => {
  const app = await createApp({ leaflet: true });
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id:"missing-address-customer",
      customerNumber:"C-NO-ADDRESS",
      name:"Customer Without Address",
      phone:"7725550199",
      properties:[{name:"Address Pending",gateCode:"CALL"}]
    }]);
    storeInvoices([{
      id:"missing-address-invoice",
      jobNumber:"J-NO-ADDRESS",
      jobId:"J-NO-ADDRESS",
      customerId:"missing-address-customer",
      customerNumber:"C-NO-ADDRESS",
      clientName:"Customer Without Address",
      services:[{service:"Full Service",amount:50}],
      total:50
    }]);
    localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
      [getLocalDateString()+"_1030"]:{
        recordType:"Invoice",
        recordId:"missing-address-invoice",
        jobId:"J-NO-ADDRESS",
        jobNumber:"J-NO-ADDRESS",
        customerId:"missing-address-customer",
        customerNumber:"C-NO-ADDRESS",
        workStatus:"Upcoming"
      }
    }));
    renderSchedule();
  `);
  app.document.querySelector('[data-schedule-details$="_1030"]').click();
  assert.match(app.document.querySelector("#scheduleSelectedCustomer").textContent, /Customer Without Address/);
  assert.match(app.document.querySelector("#scheduleSelectedAddress").textContent, /Address incomplete/);
  app.document.querySelector("#scheduleShowMapButton").click();
  app.document.querySelector("#scheduleOpenMapsButton").click();
  assert.match(app.alerts.join(" "), /complete service address/i);
  assert.equal(app.openedUrls.length, 0);
});

test("current-location routing requests permission only on click and synchronizes numbered pins with the route list", async (t) => {
  const app = await createApp({
    geolocation: { type: "success", lat: 27.19, lon: -80.28, accuracy: 18 },
    leaflet: true
  });
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [
      {id:"route-customer-1",customerNumber:"C-ROUTE-1",name:"First Route Customer",phone:"7725550101",email:"first@example.com",properties:[{name:"First Property",address:"10 First Street, Stuart, FL",lat:27.21,lon:-80.29,gateCode:"1234"}]},
      {id:"route-customer-2",customerNumber:"C-ROUTE-2",name:"Second Route Customer",phone:"7725550102",email:"second@example.com",properties:[{name:"Second Property",address:"20 Second Street, Stuart, FL",lat:27.24,lon:-80.22}]}
    ]);
    storeInvoices([
      {id:"route-invoice-1",invoiceNumber:"INV-ROUTE-1",jobNumber:"INV-ROUTE-1",jobId:"J-ROUTE-1",customerId:"route-customer-1",customerNumber:"C-ROUTE-1",clientName:"First Route Customer",phone:"7725550101",email:"first@example.com",services:[{address:"10 First Street, Stuart, FL",service:"Full Service",amount:80}],total:80},
      {id:"route-invoice-2",invoiceNumber:"INV-ROUTE-2",jobNumber:"INV-ROUTE-2",jobId:"J-ROUTE-2",customerId:"route-customer-2",customerNumber:"C-ROUTE-2",clientName:"Second Route Customer",phone:"7725550102",email:"second@example.com",services:[{address:"20 Second Street, Stuart, FL",service:"Hedge Trim",amount:120}],total:120}
    ]);
    const today=getLocalDateString();
    localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
      [today+"_0800"]:{recordType:"Invoice",recordId:"route-invoice-1",jobId:"J-ROUTE-1",jobNumber:"J-ROUTE-1",customerId:"route-customer-1",customerNumber:"C-ROUTE-1",workStatus:"Upcoming"},
      [today+"_0900"]:{recordType:"Invoice",recordId:"route-invoice-2",jobId:"J-ROUTE-2",jobNumber:"J-ROUTE-2",customerId:"route-customer-2",customerNumber:"C-ROUTE-2",workStatus:"Upcoming",routeLocked:true}
    }));
    renderSchedule();
  `);
  assert.equal(app.geolocationTracker.calls, 0);

  app.document.querySelector("#buildTodayRouteButton").click();
  await wait(180);

  assert.equal(app.geolocationTracker.calls, 1);
  assert.equal(app.evaluate("getRouteStateV319().start.source"), "current");
  assert.equal(app.document.querySelector("#routeJobCount").textContent, "2");
  assert.equal(app.document.querySelectorAll("#routeStopList .route-stop").length, 2);
  assert.equal(app.evaluate("getRouteStateV319().stopMarkerCount"), 2);
  assert.ok(app.leafletState.layers.some((layer) => layer.type === "marker" && layer.popup?.includes("Current Location")));
  assert.match(app.document.querySelector("#routeStartStatus").textContent, /Current location detected/);
  assert.equal(app.window.localStorage.getItem("paradise_route_start_v319"), null);

  const secondStop = app.document.querySelectorAll("#routeStopList .route-stop")[1];
  secondStop.click();
  assert.equal(secondStop.classList.contains("is-selected"), true);
  assert.equal(app.document.querySelector("#scheduleCustomerCard").hidden, false);
  assert.match(app.document.querySelector("#scheduleSelectedCustomer").textContent, /Second Route Customer/);
  app.leafletState.layers.find((layer) => layer.type === "marker" && layer.popup?.includes("First Route Customer")).fire("click");
  assert.match(app.document.querySelector("#scheduleSelectedCustomer").textContent, /First Route Customer/);

  const preserved = app.evaluate(`
    renderSchedule();
    saveSchedule();
    getScheduleData()[getLocalDateString()+"_0900"].routeLocked
  `);
  assert.equal(preserved, true);
});

test("routing falls back after location denial, supports a saved/manual start, and degrades without OSRM", async (t) => {
  const app = await createApp({ geolocation: { type: "error", code: 1 }, leaflet: true });
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{id:"fallback-customer",name:"Fallback Customer",properties:[{address:"30 Fallback Road, Stuart, FL",lat:27.25,lon:-80.2}]}]);
    storeInvoices([{id:"fallback-invoice",jobNumber:"INV-FALLBACK",jobId:"J-FALLBACK",customerId:"fallback-customer",clientName:"Fallback Customer",services:[{address:"30 Fallback Road, Stuart, FL",service:"Full Service",amount:75}],total:75}]);
    localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
      [getLocalDateString()+"_1000"]:{recordType:"Invoice",recordId:"fallback-invoice",jobId:"J-FALLBACK",jobNumber:"J-FALLBACK",customerId:"fallback-customer",workStatus:"Upcoming"}
    }));
    localStorage.setItem("paradise_route_start_v319",JSON.stringify({address:"Saved Start, Stuart, FL",lat:27.18,lon:-80.27,savedAt:new Date().toISOString()}));
    renderSchedule();
  `);
  app.fetchControl.routeFailure = true;
  app.document.querySelector("#buildTodayRouteButton").click();
  await wait(160);
  assert.equal(app.evaluate("getRouteStateV319().start.source"), "saved");
  assert.match(app.document.querySelector("#routeStartStatus").textContent, /permission was denied.*saved preferred/i);
  assert.match(app.document.querySelector("#routeMiles").textContent, /\*/);
  assert.match(app.document.querySelector("#routeStatus").textContent, /straight-line estimates/);

  app.document.querySelector("#routeStartMode").value = "manual";
  app.document.querySelector("#routeStartAddress").value = "44 Manual Start, Stuart, FL";
  app.document.querySelector("#routeSaveStart").checked = true;
  app.fetchControl.routeFailure = false;
  app.document.querySelector("#routeRefreshLocationButton").click();
  await wait(120);
  assert.equal(app.evaluate("getRouteStateV319().start.source"), "manual");
  assert.equal(app.geolocationTracker.calls, 1);
  assert.equal(JSON.parse(app.window.localStorage.getItem("paradise_route_start_v319")).address, "44 Manual Start, Stuart, FL");

  const order = app.evaluate(`
    phaseCNearestOrder([
      {id:"flex-a",key:"2026-01-01_0800",lat:27.5,lon:-80.5,item:{}},
      {id:"locked",key:"2026-01-01_0900",lat:27.4,lon:-80.4,item:{routeLocked:true}},
      {id:"appointment",key:"2026-01-01_0930",lat:27.45,lon:-80.45,item:{appointmentWindow:"9:30–10:00"}},
      {id:"manual-first",key:"2026-01-01_1000",lat:27.3,lon:-80.3,item:{manualOrder:1}}
    ],{lat:27.2,lon:-80.2}).map(item=>item.id)
  `);
  assert.equal(order[0], "manual-first");
  assert.equal(order[1], "locked");
  assert.equal(order[2], "appointment");
});

test("position unavailable, timeout, invalid, and stale current locations each fall back to the business for a one-job route", async () => {
  const cases = [
    {
      geolocation: { type: "error", code: 2 },
      expected: /Current location is unavailable.*business location/i
    },
    {
      geolocation: { type: "error", code: 3 },
      expected: /request timed out.*business location/i
    },
    {
      geolocation: { type: "success", lat: 999, lon: -80 },
      expected: /invalid coordinates.*business location/i
    },
    {
      geolocation: { type: "success", lat: 27.2, lon: -80.25, timestamp: Date.now() - (10 * 60 * 1000) },
      expected: /old location.*business location/i
    }
  ];

  for (const [index, scenario] of cases.entries()) {
    const app = await createApp({ geolocation: scenario.geolocation, leaflet: true });
    try {
      app.evaluate(`
        writeArray("paradise_customers_v2", [{
          id:"business-fallback-${index}",
          name:"Business Fallback ${index}",
          properties:[{address:"${index + 1} Fallback Way, Stuart, FL",lat:27.2,lon:-80.2}]
        }]);
        storeInvoices([{
          id:"business-fallback-invoice-${index}",
          jobNumber:"J-BUSINESS-${index}",
          jobId:"J-BUSINESS-${index}",
          customerId:"business-fallback-${index}",
          clientName:"Business Fallback ${index}",
          services:[{address:"${index + 1} Fallback Way, Stuart, FL",service:"Full Service",amount:60}],
          total:60
        }]);
        localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
          [getLocalDateString()+"_1100"]:{
            recordType:"Invoice",
            recordId:"business-fallback-invoice-${index}",
            jobId:"J-BUSINESS-${index}",
            jobNumber:"J-BUSINESS-${index}",
            customerId:"business-fallback-${index}",
            workStatus:"Upcoming"
          }
        }));
        renderSchedule();
      `);
      app.document.querySelector("#buildTodayRouteButton").click();
      await wait(130);
      assert.equal(app.geolocationTracker.calls, 1);
      assert.equal(app.evaluate("getRouteStateV319().start.source"), "business");
      assert.equal(app.evaluate("getRouteStateV319().stopCount"), 1);
      assert.equal(app.document.querySelector("#routeJobCount").textContent, "1");
      assert.match(app.document.querySelector("#routeStartStatus").textContent, scenario.expected);
      assert.equal(app.window.localStorage.getItem("paradise_route_start_v319"), null);
    } finally {
      app.close();
    }
  }
});

test("completed and canceled jobs are excluded while duplicate addresses and a partial geocode failure route safely", async (t) => {
  const app = await createApp({ geolocation: { type: "success", lat: 27.19, lon: -80.28 }, leaflet: true });
  t.after(app.close);
  app.evaluate(`
    writeArray("paradise_customers_v2", [{
      id:"filter-customer",
      name:"Filter Customer",
      properties:[{address:"50 Filter Road, Stuart, FL",lat:27.23,lon:-80.24}]
    }]);
    storeInvoices([
      {id:"filter-active",jobNumber:"J-ACTIVE",jobId:"J-ACTIVE",customerId:"filter-customer",clientName:"Filter Customer",services:[{address:"50 Filter Road, Stuart, FL",service:"Full Service",amount:75}],total:75},
      {id:"filter-duplicate",jobNumber:"J-DUPLICATE",jobId:"J-DUPLICATE",customerId:"filter-customer",clientName:"Filter Customer",services:[{address:"50 Filter Road, Stuart, FL",service:"Hedge Trim",amount:55}],total:55},
      {id:"filter-missing",jobNumber:"J-MISSING",jobId:"J-MISSING",clientName:"Missing Address",services:[{address:"Unlocatable Test Address, Stuart, FL",service:"Full Service",amount:40}],total:40}
    ]);
    const today=getLocalDateString();
    localStorage.setItem("paradise_employee_schedule_v1",JSON.stringify({
      [today+"_0800"]:{recordType:"Invoice",recordId:"filter-active",jobId:"J-ACTIVE",jobNumber:"J-ACTIVE",customerId:"filter-customer",workStatus:"Upcoming"},
      [today+"_0830"]:{recordType:"Invoice",recordId:"filter-active",jobId:"J-COMPLETE",jobNumber:"J-COMPLETE",customerId:"filter-customer",workStatus:"Completed"},
      [today+"_0900"]:{recordType:"Invoice",recordId:"filter-active",jobId:"J-CANCEL",jobNumber:"J-CANCEL",customerId:"filter-customer",workStatus:"Cancelled"},
      [today+"_0930"]:{recordType:"Invoice",recordId:"filter-missing",jobId:"J-MISSING",jobNumber:"J-MISSING",workStatus:"Upcoming"},
      [today+"_1000"]:{recordType:"Invoice",recordId:"filter-duplicate",jobId:"J-DUPLICATE",jobNumber:"J-DUPLICATE",customerId:"filter-customer",workStatus:"Upcoming"}
    }));
    renderSchedule();
  `);
  app.fetchControl.geocodeFailure.add("Unlocatable Test Address, Stuart, FL");
  app.document.querySelector("#buildTodayRouteButton").click();
  await wait(150);
  assert.equal(app.evaluate("getRouteStateV319().stopCount"), 2);
  assert.equal(app.document.querySelector("#routeJobCount").textContent, "2");
  assert.match(app.document.querySelector("#routeStatus").textContent, /1 job was omitted/);
  assert.doesNotMatch(app.document.querySelector("#routeStopList").textContent, /COMPLETE|CANCEL/);
});

test("no-job routing avoids unnecessary location permission and leaves unrelated modules usable", async (t) => {
  const app = await createApp({ geolocation: { type: "success", lat: 999, lon: -80 }, leaflet: true });
  t.after(app.close);
  app.document.querySelector("#buildTodayRouteButton").click();
  await wait(30);
  assert.equal(app.geolocationTracker.calls, 0);
  assert.match(app.document.querySelector("#routeStatus").textContent, /No incomplete, active jobs/);
  assert.equal(app.document.querySelector("#routeJobCount").textContent, "0");
  assert.equal(app.document.querySelector("#invoiceTab").classList.contains("tab-panel"), true);
  assert.equal(app.document.querySelector("#weatherTab").classList.contains("tab-panel"), true);
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
