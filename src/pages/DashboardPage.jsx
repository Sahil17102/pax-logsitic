import { useMemo, useState } from "react";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-demo-users";
const SHIPMENTS_KEY = "pax-demo-shipments";

const starterShipments = [
  { id: "PAX-260731", customer: "Aarav Retail", destination: "Mumbai, MH", amount: 1240, payment: "Prepaid", status: "In transit", date: "31 Jul 2026" },
  { id: "PAX-260728", customer: "Nila Studios", destination: "Bengaluru, KA", amount: 860, payment: "COD", status: "Out for delivery", date: "30 Jul 2026" },
  { id: "PAX-260724", customer: "Kite Office", destination: "Pune, MH", amount: 590, payment: "Prepaid", status: "Delivered", date: "29 Jul 2026" },
  { id: "PAX-260719", customer: "Rohan Mehta", destination: "Chennai, TN", amount: 1720, payment: "COD", status: "Pickup scheduled", date: "28 Jul 2026" },
];

const navItems = [
  ["overview", "home", "Overview"],
  ["dashboard", "grid", "Dashboard"],
  ["shipments", "box", "Shipments"],
  ["exceptions", "alert", "Exceptions"],
  ["finance", "wallet", "Finance"],
  ["audits", "audit", "Audits"],
  ["utilities", "tools", "Utilities"],
  ["insights", "insights", "Insights"],
  ["channels", "store", "Channels"],
  ["workspace", "settings", "Workspace"],
  ["support", "support", "Support"],
];

function Icon({ name }) {
  const paths = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    route: <><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M8.5 16.5c4-2 2-7 7-9" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" /><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" /></>,
    audit: <><path d="M7 20h10M6 7h12M12 4v16" /><path d="m6 7-3 6a3 3 0 0 0 6 0L6 7ZM18 7l-3 6a3 3 0 0 0 6 0l-3-6Z" /></>,
    tools: <><path d="m14 6 4-4 4 4-4 4M2 18l4 4 12-12-4-4L2 18Z" /><path d="m7 3 4 4M3 7l4 4M17 17l4 4" /></>,
    insights: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    store: <><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    support: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.3 2.1c-.8.4-1.1.8-1.1 1.7M12 17h.01" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.box}</svg>;
}

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
    if (!session || session.authVersion !== 2) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function readShipments() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHIPMENTS_KEY) || "null");
    return Array.isArray(saved) ? saved : starterShipments;
  } catch {
    return starterShipments;
  }
}

function goTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function EmptyAuth() {
  return (
    <main className="portal-auth-empty">
      <img src="/assets/pax-logo.png" alt="Pax Logistics" />
      <h1>Your Pax workspace is locked.</h1>
      <p>Create your account first, then log in with your registered email/mobile and password.</p>
      <button className="button button-dark" type="button" onClick={() => goTo("/sign-in")}>Go to sign in <span>→</span></button>
    </main>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

export default function DashboardPage() {
  const [user, setUser] = useState(readSession);
  const [active, setActive] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [shipments, setShipments] = useState(readShipments);
  const [search, setSearch] = useState("");
  const [shipmentModal, setShipmentModal] = useState(false);
  const [toast, setToast] = useState("");
  const [trackId, setTrackId] = useState("PAX-260728");
  const [trackResult, setTrackResult] = useState("PAX-260728");
  const [ticket, setTicket] = useState({ subject: "", message: "" });
  const [newShipment, setNewShipment] = useState({
    customer: "", phone: "", address: "", city: "", pincode: "", weight: "1", payment: "Prepaid", amount: "",
  });

  const filteredShipments = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return shipments;
    return shipments.filter((shipment) =>
      [shipment.id, shipment.customer, shipment.destination, shipment.status].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, shipments]);

  if (!user) return <EmptyAuth />;

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    goTo("/");
  };

  const navigatePanel = (section) => {
    setActive(section);
    setMobileNav(false);
  };

  const createShipment = (event) => {
    event.preventDefault();
    if (!newShipment.customer || !newShipment.phone || !newShipment.address || !newShipment.city || !/^[1-9]\d{5}$/.test(newShipment.pincode)) {
      notify("Complete the receiver details and enter a valid PIN code.");
      return;
    }
    const shipment = {
      id: `PAX-${String(Date.now()).slice(-6)}`,
      customer: newShipment.customer,
      destination: `${newShipment.city}, ${newShipment.pincode}`,
      amount: Number(newShipment.amount) || Math.max(110, Math.round(Number(newShipment.weight) * 78)),
      payment: newShipment.payment,
      status: "Pickup scheduled",
      date: "31 Jul 2026",
    };
    const next = [shipment, ...shipments];
    setShipments(next);
    localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(next));
    setShipmentModal(false);
    setNewShipment({ customer: "", phone: "", address: "", city: "", pincode: "", weight: "1", payment: "Prepaid", amount: "" });
    notify(`${shipment.id} created. Pickup is scheduled.`);
  };

  const submitTracking = (event) => {
    event.preventDefault();
    const normalized = trackId.trim().toUpperCase();
    if (!/^PAX-\d{6,}$/.test(normalized)) {
      notify("Enter a reference such as PAX-260728.");
      return;
    }
    setTrackResult(normalized);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = { ...user, fullName: data.get("fullName"), businessName: data.get("businessName"), phone: data.get("phone"), city: data.get("city") };
    setUser(next);
    const sessionStorageTarget = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    sessionStorageTarget.setItem(SESSION_KEY, JSON.stringify(next));
    try {
      const accounts = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const updatedAccounts = accounts.map((account) =>
        account.email === user.email ? { ...account, ...next } : account,
      );
      localStorage.setItem(USERS_KEY, JSON.stringify(updatedAccounts));
    } catch {
      // Keep the active session usable even if an older browser record is malformed.
    }
    notify("Profile changes saved.");
  };

  const openShipment = () => setShipmentModal(true);

  const renderOverview = () => (
    <>
      <section className="portal-welcome">
        <div>
          <p>Friday, 31 July</p>
          <h1>Good morning, {user.fullName?.split(" ")[0] || "there"}.</h1>
          <span>Here’s what’s moving across your Pax network today.</span>
        </div>
        <button className="portal-primary" type="button" onClick={openShipment}><Icon name="plus" /> Create shipment</button>
      </section>
      <section className="portal-kpis" aria-label="Shipment summary">
        <article className="kpi-card kpi-purple"><span className="kpi-icon"><Icon name="box" /></span><small>TOTAL SHIPMENTS</small><strong>{shipments.length + 34}</strong><p><b>↑ 12%</b> from last month</p></article>
        <article className="kpi-card kpi-yellow"><span className="kpi-icon"><Icon name="route" /></span><small>IN TRANSIT</small><strong>{shipments.filter((item) => item.status.includes("transit") || item.status.includes("delivery")).length + 6}</strong><p>Across 5 active lanes</p></article>
        <article className="kpi-card kpi-green"><span className="kpi-icon"><Icon name="box" /></span><small>DELIVERED TODAY</small><strong>{shipments.filter((item) => item.status === "Delivered").length + 23}</strong><p><b>96.4%</b> first-attempt success</p></article>
        <article className="kpi-card kpi-coral"><span className="kpi-icon"><Icon name="wallet" /></span><small>COD AVAILABLE</small><strong>₹18.4k</strong><p>Next settlement: 03 Aug</p></article>
      </section>
      <section className="portal-main-grid">
        <article className="portal-card movement-card">
          <div className="portal-card-head"><div><small>7-DAY MOVEMENT</small><h2>Shipment activity</h2></div><span className="trend-pill">+18.2%</span></div>
          <div className="chart-wrap">
            <div className="chart-lines"><i></i><i></i><i></i><i></i></div>
            <svg viewBox="0 0 640 190" preserveAspectRatio="none" aria-label="Shipment activity rising over seven days">
              <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6e61e8" stopOpacity=".28" /><stop offset="1" stopColor="#6e61e8" stopOpacity="0" /></linearGradient></defs>
              <path className="area" d="M0 160 C70 150 80 110 140 126 S220 170 280 105 S360 85 410 99 S490 82 535 47 S590 60 640 18 L640 190 L0 190Z" />
              <path className="line" d="M0 160 C70 150 80 110 140 126 S220 170 280 105 S360 85 410 99 S490 82 535 47 S590 60 640 18" />
            </svg>
            <div className="chart-days"><span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
          </div>
        </article>
        <article className="portal-card status-card">
          <div className="portal-card-head"><div><small>LIVE STATUS</small><h2>Delivery mix</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>View all</button></div>
          <div className="donut-row">
            <div className="donut"><div><strong>38</strong><span>Total</span></div></div>
            <div className="donut-legend">
              <span><i className="legend-green"></i><b>Delivered</b><em>24</em></span>
              <span><i className="legend-purple"></i><b>In transit</b><em>8</em></span>
              <span><i className="legend-yellow"></i><b>Scheduled</b><em>4</em></span>
              <span><i className="legend-coral"></i><b>Attention</b><em>2</em></span>
            </div>
          </div>
        </article>
      </section>
      <section className="portal-card shipment-list-card">
        <div className="portal-card-head"><div><small>RECENT ACTIVITY</small><h2>Latest shipments</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>View all <span>→</span></button></div>
        <ShipmentTable shipments={shipments.slice(0, 4)} />
      </section>
    </>
  );

  const renderDashboard = () => (
    <>
      <section className="section-title-row">
        <div><p>OPERATIONS DASHBOARD</p><h1>Today at a glance</h1><span>Dispatch decisions, service health and quick actions in one place.</span></div>
        <button className="portal-primary" type="button" onClick={openShipment}><Icon name="plus" /> Create shipment</button>
      </section>
      <section className="portal-kpis portal-kpis-compact">
        <article className="kpi-card kpi-purple"><span className="kpi-icon"><Icon name="box" /></span><small>READY TO SHIP</small><strong>12</strong><p>Pickup cut-off · 4:30 PM</p></article>
        <article className="kpi-card kpi-yellow"><span className="kpi-icon"><Icon name="route" /></span><small>IN MOVEMENT</small><strong>08</strong><p>5 active destination lanes</p></article>
        <article className="kpi-card kpi-green"><span className="kpi-icon"><Icon name="insights" /></span><small>DELIVERY RATE</small><strong>96.4%</strong><p>First-attempt success</p></article>
        <article className="kpi-card kpi-coral"><span className="kpi-icon"><Icon name="alert" /></span><small>NEEDS ACTION</small><strong>03</strong><p>2 NDR · 1 address issue</p></article>
      </section>
      <section className="dashboard-action-grid">
        {[
          ["box", "Create shipment", "Book a new customer order", openShipment],
          ["alert", "Resolve exceptions", "Review NDR and address issues", () => navigatePanel("exceptions")],
          ["wallet", "Check COD", "View remittance and invoices", () => navigatePanel("finance")],
          ["tools", "Open utilities", "Track, estimate and calculate", () => navigatePanel("utilities")],
        ].map(([icon, title, copy, action]) => (
          <button type="button" onClick={action} key={title}>
            <span><Icon name={icon} /></span><div><strong>{title}</strong><small>{copy}</small></div><b>→</b>
          </button>
        ))}
      </section>
      <section className="portal-card shipment-list-card">
        <div className="portal-card-head"><div><small>DISPATCH QUEUE</small><h2>Orders needing attention</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>All shipments →</button></div>
        <ShipmentTable shipments={shipments.filter((item) => item.status !== "Delivered").slice(0, 4)} />
      </section>
    </>
  );

  const renderShipments = () => (
    <>
      <section className="section-title-row">
        <div><p>SHIPMENT CONTROL</p><h1>All shipments</h1><span>Search, review and create customer orders.</span></div>
        <button className="portal-primary" type="button" onClick={openShipment}><Icon name="plus" /> Create shipment</button>
      </section>
      <section className="portal-card shipment-list-card full-list-card">
        <div className="table-toolbar">
          <label><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ID, customer, city or status" /></label>
          <span>{filteredShipments.length} shipments</span>
        </div>
        <ShipmentTable shipments={filteredShipments} />
      </section>
    </>
  );

  const renderExceptions = () => (
    <>
      <section className="section-title-row"><div><p>EXCEPTION DESK</p><h1>Exceptions</h1><span>Resolve failed attempts, address issues and delayed movement.</span></div><span className="section-count-pill">3 open cases</span></section>
      <section className="exception-grid">
        {[
          ["PAX-260728", "Customer unavailable", "Nila Studios · Bengaluru", "Call customer", "high"],
          ["PAX-260719", "Address needs confirmation", "Rohan Mehta · Chennai", "Update address", "medium"],
          ["PAX-260706", "Movement delayed", "Indigo Home · Pune", "Escalate courier", "low"],
        ].map(([id, issue, customer, action, priority]) => (
          <article className="portal-card exception-card" key={id}>
            <div><span className={`priority-dot priority-${priority}`}></span><small>{priority} priority</small><b>{id}</b></div>
            <h2>{issue}</h2><p>{customer}</p>
            <div className="exception-meta"><span>Last update</span><strong>Today · 10:42 AM</strong></div>
            <button type="button" onClick={() => notify(`${id}: ${action} action saved.`)}>{action} <span>→</span></button>
          </article>
        ))}
      </section>
    </>
  );

  const renderTracking = () => (
    <>
      <section className="section-title-row"><div><p>LIVE MOVEMENT</p><h1>Track a shipment</h1><span>Follow every milestone from pickup to delivery.</span></div></section>
      <section className="tracking-workspace">
        <form className="portal-card track-search-card" onSubmit={submitTracking}>
          <small>SHIPMENT REFERENCE</small><h2>Where is your parcel?</h2>
          <label><input value={trackId} onChange={(event) => setTrackId(event.target.value)} placeholder="PAX-260728" /><button type="submit"><Icon name="search" /> Track</button></label>
          <p>Try the sample reference <button type="button" onClick={() => { setTrackId("PAX-260728"); setTrackResult("PAX-260728"); }}>PAX-260728</button></p>
        </form>
        <article className="portal-card tracking-result-card">
          <div className="tracking-result-head"><div><small>{trackResult}</small><h2>Moving to destination hub</h2></div><StatusBadge status="In transit" /></div>
          <div className="tracking-route-names"><span><small>FROM</small>Hyderabad, TS</span><i>→</i><span><small>TO</small>Bengaluru, KA</span></div>
          <div className="tracking-timeline">
            <div className="is-done"><i>✓</i><span><b>Shipment booked</b><small>29 Jul · 10:20 AM</small></span></div>
            <div className="is-done"><i>✓</i><span><b>Picked up</b><small>29 Jul · 4:45 PM</small></span></div>
            <div className="is-current"><i></i><span><b>In transit to destination hub</b><small>31 Jul · 7:10 AM</small></span></div>
            <div><i></i><span><b>Out for delivery</b><small>Expected by 01 Aug</small></span></div>
          </div>
        </article>
      </section>
    </>
  );

  const renderFinance = () => (
    <>
      <section className="section-title-row"><div><p>MONEY MOVEMENT</p><h1>Finance</h1><span>Your wallet, COD settlements and invoices at a glance.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Statement downloaded in demo mode.")}>Download statement</button></section>
      <section className="finance-grid">
        <article className="finance-hero"><small>AVAILABLE WALLET BALANCE</small><strong>₹12,840</strong><span>Last recharge · ₹5,000 on 28 Jul</span><button type="button" onClick={() => notify("Recharge flow opened in demo mode.")}>+ Add money</button></article>
        <article className="portal-card settlement-card"><small>COD SETTLEMENT</small><h2>₹18,420</h2><p>Available for remittance</p><div><span>Next settlement</span><b>03 Aug 2026</b></div><button type="button" onClick={() => notify("COD remittance requested.")}>Request remittance →</button></article>
        <article className="portal-card invoice-card"><div className="portal-card-head"><div><small>RECENT INVOICES</small><h2>Billing history</h2></div></div>{[["INV-0731","31 Jul 2026","₹4,860","Paid"],["INV-0724","24 Jul 2026","₹3,240","Paid"],["INV-0717","17 Jul 2026","₹5,180","Due"]].map((invoice) => <div className="invoice-row" key={invoice[0]}><span><b>{invoice[0]}</b><small>{invoice[1]}</small></span><strong>{invoice[2]}</strong><em className={invoice[3] === "Paid" ? "paid" : "due"}>{invoice[3]}</em><button type="button" onClick={() => notify(`${invoice[0]} downloaded.`)}>↓</button></div>)}</article>
      </section>
    </>
  );

  const renderAudits = () => (
    <>
      <section className="section-title-row"><div><p>COMPLIANCE CENTRE</p><h1>Audits</h1><span>Keep shipment documents, COD records and account checks organised.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Audit report prepared in demo mode.")}>Export audit report</button></section>
      <section className="audit-layout">
        <article className="portal-card audit-score-card"><small>WORKSPACE HEALTH</small><div className="audit-score"><strong>92</strong><span>/100</span></div><p>All critical checks are complete. Two recommendations remain.</p><div className="audit-progress"><i></i></div></article>
        <article className="portal-card audit-checklist">
          <div className="portal-card-head"><div><small>CHECKLIST</small><h2>Compliance status</h2></div></div>
          {[
            ["✓", "KYC documents", "Verified", "done"],
            ["✓", "GST information", user.gstin ? "Verified" : "Not applicable", "done"],
            ["✓", "COD reconciliation", "Matched through 30 Jul", "done"],
            ["!", "Pickup address proof", "Review recommended", "warn"],
            ["!", "Invoice numbering", "2 gaps detected", "warn"],
          ].map(([mark, title, copy, tone]) => <div className={`audit-row audit-${tone}`} key={title}><span>{mark}</span><div><strong>{title}</strong><small>{copy}</small></div><button type="button" onClick={() => notify(`${title} opened.`)}>Review</button></div>)}
        </article>
      </section>
    </>
  );

  const renderUtilities = () => (
    <>
      <section className="section-title-row"><div><p>SHIPPING TOOLS</p><h1>Utilities</h1><span>Every everyday shipping tool available from one screen.</span></div></section>
      <section className="utility-grid">
        {[
          ["route", "Track shipment", "Open the live movement timeline", () => document.querySelector(".utility-tracker")?.scrollIntoView({ behavior: "smooth" })],
          ["wallet", "Rate calculator", "Estimate a route before booking", () => goTo("/rate-calculator")],
          ["box", "Weight calculator", "Check volumetric chargeable weight", () => goTo("/weight-calculator")],
          ["support", "Serviceability", "Confirm delivery PIN support", () => notify("500029 is serviceable for standard and express delivery.")],
        ].map(([icon, title, copy, action]) => <button type="button" onClick={action} key={title}><span><Icon name={icon} /></span><strong>{title}</strong><small>{copy}</small><b>Open →</b></button>)}
      </section>
      <section className="tracking-workspace utility-tracker">
        <form className="portal-card track-search-card" onSubmit={submitTracking}>
          <small>SHIPMENT TRACKER</small><h2>Where is your parcel?</h2>
          <label><input value={trackId} onChange={(event) => setTrackId(event.target.value)} placeholder="PAX-260728" /><button type="submit"><Icon name="search" /> Track</button></label>
          <p>Try sample reference <button type="button" onClick={() => { setTrackId("PAX-260728"); setTrackResult("PAX-260728"); }}>PAX-260728</button></p>
        </form>
        <article className="portal-card tracking-result-card">
          <div className="tracking-result-head"><div><small>{trackResult}</small><h2>Moving to destination hub</h2></div><StatusBadge status="In transit" /></div>
          <div className="tracking-route-names"><span><small>FROM</small>Hyderabad, TS</span><i>→</i><span><small>TO</small>Bengaluru, KA</span></div>
          <div className="utility-track-steps"><span className="done">Booked</span><span className="done">Picked up</span><span className="current">In transit</span><span>Delivery</span></div>
        </article>
      </section>
    </>
  );

  const renderInsights = () => (
    <>
      <section className="section-title-row"><div><p>SELLER ANALYTICS</p><h1>Insights</h1><span>Use route, payment and delivery patterns to plan better dispatches.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Insights date range refreshed.")}>Last 30 days ▾</button></section>
      <section className="insight-layout">
        <article className="portal-card insight-bars">
          <div className="portal-card-head"><div><small>TOP DESTINATIONS</small><h2>Shipment volume by city</h2></div><span className="trend-pill">+14.8%</span></div>
          {[["Hyderabad",88,42],["Bengaluru",72,34],["Mumbai",58,27],["Chennai",44,21],["Pune",32,15]].map(([city,width,count]) => <div className="insight-bar-row" key={city}><span>{city}</span><div><i style={{ width: `${width}%` }}></i></div><strong>{count}</strong></div>)}
        </article>
        <article className="portal-card insight-summary">
          <small>ORDER QUALITY</small><h2>Delivery performance</h2>
          <div><strong>96.4%</strong><span>Delivered successfully</span></div>
          <ul><li><span>Average delivery</span><b>2.8 days</b></li><li><span>RTO rate</span><b>3.6%</b></li><li><span>Prepaid / COD</span><b>62% / 38%</b></li><li><span>Average order value</span><b>₹1,180</b></li></ul>
        </article>
      </section>
    </>
  );

  const renderChannels = () => (
    <>
      <section className="section-title-row"><div><p>CONNECTED COMMERCE</p><h1>Channels</h1><span>Bring store orders into the Pax dispatch workflow.</span></div><button className="portal-primary" type="button" onClick={() => notify("Channel connection wizard opened.")}><Icon name="plus" /> Connect store</button></section>
      <section className="channel-grid">
        {[
          ["SH", "Shopify", "Connected", "1,248 orders synced", true],
          ["WC", "WooCommerce", "Not connected", "Connect with store URL", false],
          ["AZ", "Amazon", "Not connected", "Import marketplace orders", false],
          ["CS", "CSV orders", "Ready", "Upload an order file", true],
        ].map(([code, title, status, copy, connected]) => <article className="portal-card channel-card" key={title}><div className={`channel-logo channel-${code.toLowerCase()}`}>{code}</div><span className={connected ? "channel-status connected" : "channel-status"}><i></i>{status}</span><h2>{title}</h2><p>{copy}</p><button type="button" onClick={() => notify(`${title} ${connected ? "settings opened" : "connection started"}.`)}>{connected ? "Manage" : "Connect"} →</button></article>)}
      </section>
    </>
  );

  const renderSupport = () => (
    <>
      <section className="section-title-row"><div><p>WE’RE HERE TO HELP</p><h1>Support desk</h1><span>Raise a ticket or talk to the local Pax team.</span></div></section>
      <section className="support-grid">
        <form className="portal-card support-form" onSubmit={(event) => { event.preventDefault(); if (!ticket.subject || !ticket.message) { notify("Add a subject and message."); return; } setTicket({ subject: "", message: "" }); notify("Ticket PAX-SUP-104 created."); }}>
          <small>NEW SUPPORT TICKET</small><h2>What can we solve?</h2>
          <label>Subject<input value={ticket.subject} onChange={(event) => setTicket({ ...ticket, subject: event.target.value })} placeholder="e.g. Pickup not completed" /></label>
          <label>Details<textarea value={ticket.message} onChange={(event) => setTicket({ ...ticket, message: event.target.value })} rows="5" placeholder="Share the shipment ID and what happened..." /></label>
          <button className="portal-primary" type="submit">Create ticket <Icon name="arrow" /></button>
        </form>
        <div className="support-contact-stack">
          <a className="support-contact-card whatsapp" href="https://wa.me/919494338206" target="_blank" rel="noreferrer"><span>WA</span><div><small>FASTEST RESPONSE</small><h2>Chat on WhatsApp</h2><p>Usually replies within business hours.</p></div><b>↗</b></a>
          <a className="support-contact-card" href="tel:+919494338206"><span>☎</span><div><small>LOGISTICS DESK</small><h2>+91 94943 38206</h2><p>Mon–Sat · 9:00 AM–7:00 PM</p></div><b>→</b></a>
        </div>
      </section>
    </>
  );

  const renderWorkspace = () => (
    <>
      <section className="section-title-row"><div><p>WORKSPACE SETTINGS</p><h1>Workspace</h1><span>Manage profile, business identity and primary pickup details.</span></div></section>
      <form className="portal-card profile-form" onSubmit={saveProfile}>
        <div className="profile-avatar">{(user.fullName || "PC").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
        <div className="profile-fields">
          <label>Full name<input name="fullName" defaultValue={user.fullName} required /></label>
          <label>Business name<input name="businessName" defaultValue={user.businessName} required /></label>
          <label>Email address<input value={user.email} readOnly /></label>
          <label>Mobile number<input name="phone" defaultValue={user.phone} required /></label>
          <label>City<input name="city" defaultValue={user.city} required /></label>
          <label>Account type<input value={user.accountType || "Business"} readOnly /></label>
          <label>State<input value={user.state || "Telangana"} readOnly /></label>
          <label>PIN code<input value={user.pincode || "500029"} readOnly /></label>
        </div>
        <div className="profile-actions"><button className="portal-primary" type="submit">Save changes</button><button className="portal-secondary danger" type="button" onClick={logout}>Sign out</button></div>
      </form>
    </>
  );

  const panels = {
    overview: renderOverview,
    dashboard: renderDashboard,
    shipments: renderShipments,
    exceptions: renderExceptions,
    finance: renderFinance,
    audits: renderAudits,
    utilities: renderUtilities,
    insights: renderInsights,
    channels: renderChannels,
    workspace: renderWorkspace,
    support: renderSupport,
  };

  return (
    <div className="portal-shell">
      <aside className={`portal-sidebar${mobileNav ? " is-open" : ""}`}>
        <button className="portal-logo" type="button" onClick={() => goTo("/")} aria-label="Pax Logistics home"><img src="/assets/pax-logo.png" alt="Pax Logistics" /></button>
        <div className="portal-workspace"><span>{(user.businessName || "PX").slice(0, 2).toUpperCase()}</span><div><small>WORKSPACE</small><strong>{user.businessName || "My workspace"}</strong></div></div>
        <nav aria-label="Customer portal">
          <small>MAIN MENU</small>
          {navItems.map(([id, icon, label]) => <button className={active === id ? "is-active" : ""} type="button" onClick={() => navigatePanel(id)} key={id}><Icon name={icon} /><span>{label}</span>{label === "Shipments" && <em>{shipments.length}</em>}</button>)}
        </nav>
        <div className="portal-help"><span>?</span><strong>Need a hand?</strong><p>Our Hyderabad team is ready to help.</p><button type="button" onClick={() => navigatePanel("support")}>Open support</button></div>
        <button className="portal-logout" type="button" onClick={logout}>← <span>Sign out</span></button>
      </aside>
      {mobileNav && <button className="portal-scrim" type="button" aria-label="Close menu" onClick={() => setMobileNav(false)}></button>}
      <div className="portal-body">
        <header className="portal-header">
          <button className="portal-menu" type="button" onClick={() => setMobileNav(true)} aria-label="Open portal menu"><Icon name="menu" /></button>
          <label className="portal-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setActive("shipments")} placeholder="Search shipments..." /><kbd>⌘ K</kbd></label>
          <div className="portal-header-actions">
            <button className="notification-button" type="button" onClick={() => notify("You’re all caught up.")}><Icon name="bell" /><i></i></button>
            <button className="account-button" type="button" onClick={() => navigatePanel("workspace")}><span>{(user.fullName || "PC").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{user.accountType || "Business"} account</small></div><b>⌄</b></button>
          </div>
        </header>
        <main className="portal-content">{panels[active]()}</main>
        <footer className="portal-footer"><span>© 2026 Pax Logistics</span><span>Hyderabad · Telangana · India</span><a href="https://searchcraftdigital.com/" target="_blank" rel="noreferrer">Crafted by SearchCraft Digital</a></footer>
      </div>
      {shipmentModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShipmentModal(false); }}>
          <form className="shipment-modal" onSubmit={createShipment}>
            <div className="modal-head"><div><small>NEW ORDER</small><h2>Create shipment</h2></div><button type="button" onClick={() => setShipmentModal(false)} aria-label="Close">×</button></div>
            <div className="modal-grid">
              <label>Receiver name *<input value={newShipment.customer} onChange={(event) => setNewShipment({ ...newShipment, customer: event.target.value })} placeholder="Full name" autoFocus /></label>
              <label>Mobile number *<input value={newShipment.phone} onChange={(event) => setNewShipment({ ...newShipment, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" placeholder="10-digit number" /></label>
              <label className="span-two">Delivery address *<textarea value={newShipment.address} onChange={(event) => setNewShipment({ ...newShipment, address: event.target.value })} rows="2" placeholder="House/building, street, area" /></label>
              <label>City *<input value={newShipment.city} onChange={(event) => setNewShipment({ ...newShipment, city: event.target.value })} placeholder="Destination city" /></label>
              <label>PIN code *<input value={newShipment.pincode} onChange={(event) => setNewShipment({ ...newShipment, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="6-digit PIN" /></label>
              <label>Weight (kg)<input value={newShipment.weight} onChange={(event) => setNewShipment({ ...newShipment, weight: event.target.value })} type="number" min=".1" step=".1" /></label>
              <label>Payment<select value={newShipment.payment} onChange={(event) => setNewShipment({ ...newShipment, payment: event.target.value })}><option>Prepaid</option><option>COD</option></select></label>
              <label className="span-two">Order value (₹)<input value={newShipment.amount} onChange={(event) => setNewShipment({ ...newShipment, amount: event.target.value })} type="number" min="0" placeholder="Optional" /></label>
            </div>
            <div className="modal-actions"><button className="portal-secondary" type="button" onClick={() => setShipmentModal(false)}>Cancel</button><button className="portal-primary" type="submit">Create & schedule pickup <Icon name="arrow" /></button></div>
          </form>
        </div>
      )}
      {toast && <div className="portal-toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ShipmentTable({ shipments }) {
  return (
    <div className="shipment-table-wrap">
      <table className="shipment-table">
        <thead><tr><th>Shipment</th><th>Customer</th><th>Destination</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id}>
              <td><strong>{shipment.id}</strong><small>{shipment.date}</small></td>
              <td>{shipment.customer}</td><td>{shipment.destination}</td><td>{shipment.payment}</td><td>₹{shipment.amount.toLocaleString("en-IN")}</td><td><StatusBadge status={shipment.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!shipments.length && <div className="table-empty">No shipments match your search.</div>}
    </div>
  );
}
