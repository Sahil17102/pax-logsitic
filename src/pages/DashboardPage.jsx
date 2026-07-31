import { useMemo, useState } from "react";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-demo-users";
const SHIPMENTS_KEY = "pax-demo-shipments";
const NOTIFICATIONS_KEY = "pax-demo-notifications";
const WALLET_KEY = "pax-demo-wallet-balance";

const starterShipments = [
  { id: "PAX-260731", customer: "Aarav Retail", destination: "Mumbai, MH", amount: 1240, payment: "Prepaid", status: "In transit", date: "31 Jul 2026" },
  { id: "PAX-260728", customer: "Nila Studios", destination: "Bengaluru, KA", amount: 860, payment: "COD", status: "Out for delivery", date: "30 Jul 2026" },
  { id: "PAX-260724", customer: "Kite Office", destination: "Pune, MH", amount: 590, payment: "Prepaid", status: "Delivered", date: "29 Jul 2026" },
  { id: "PAX-260719", customer: "Rohan Mehta", destination: "Chennai, TN", amount: 1720, payment: "COD", status: "Pickup scheduled", date: "28 Jul 2026" },
];

const starterNotifications = [
  { id: "shipment-moving", icon: "route", tone: "blue", title: "Shipment is out for delivery", detail: "PAX-260728 reached the Bengaluru delivery centre.", time: "8 min ago", section: "shipments", tool: "shipments-track", unread: true },
  { id: "cod-ready", icon: "wallet", tone: "green", title: "COD settlement is ready", detail: "₹18,420 from 24 orders is available for remittance.", time: "32 min ago", section: "finance", tool: "finance-cod", unread: true },
  { id: "sla-warning", icon: "alert", tone: "amber", title: "2 shipments need attention", detail: "The Hyderabad to Mumbai lane may breach its SLA.", time: "1 hr ago", section: "exceptions", tool: "exceptions-delayed", unread: true },
  { id: "weekly-report", icon: "insights", tone: "purple", title: "Weekly report is available", detail: "Delivery success improved by 2.4% this week.", time: "Yesterday", section: "insights", tool: "insights-shipments", unread: false },
];

const navItems = [
  { id: "overview", icon: "home", label: "Overview", children: [
    ["overview-home", "home", "Overview Home"],
  ] },
  { id: "dashboard", icon: "grid", label: "Dashboard", children: [
    ["dashboard-operations", "grid", "Operations Dashboard"],
    ["dashboard-performance", "insights", "Delivery Performance"],
    ["dashboard-pickups", "route", "Pickup Schedule"],
  ] },
  { id: "shipments", icon: "box", label: "Shipments", children: [
    ["shipments-create", "plus", "Create Shipment"],
    ["shipments-all", "box", "All Shipments"],
    ["shipments-track", "route", "Track Shipment"],
    ["shipments-pickups", "home", "Pickup Requests"],
    ["shipments-manifests", "audit", "Manifests"],
  ] },
  { id: "exceptions", icon: "alert", label: "Exceptions", children: [
    ["exceptions-ndr", "alert", "NDR Management"],
    ["exceptions-rto", "route", "RTO Shipments"],
    ["exceptions-delayed", "box", "Delayed Shipments"],
    ["exceptions-weight", "audit", "Weight Disputes"],
  ] },
  { id: "finance", icon: "wallet", label: "Finance", children: [
    ["finance-wallet", "wallet", "Wallet Transactions"],
    ["finance-cod", "wallet", "COD Settlements"],
    ["finance-invoices", "audit", "Invoices"],
  ] },
  { id: "audits", icon: "audit", label: "Audits", children: [
    ["audits-weight", "audit", "Weight Discrepancies"],
    ["audits-cod", "wallet", "COD Reconciliation"],
    ["audits-billing", "insights", "Billing Audit"],
  ] },
  { id: "utilities", icon: "tools", label: "Utilities", children: [
    ["utilities-rate", "wallet", "Rate Calculator"],
    ["utilities-weight", "box", "Weight Calculator"],
    ["utilities-pincode", "route", "Pincode Serviceability"],
    ["utilities-labels", "audit", "Label Generator"],
  ] },
  { id: "insights", icon: "insights", label: "Insights", children: [
    ["insights-shipments", "insights", "Shipment Analytics"],
    ["insights-courier", "route", "Courier Performance"],
    ["insights-zones", "grid", "Zone Analysis"],
    ["insights-rto", "alert", "RTO Analytics"],
  ] },
  { id: "channels", icon: "store", label: "Channels", children: [
    ["channels-connected", "store", "Connected Channels"],
    ["channels-connect", "plus", "Connect Store"],
    ["channels-sync", "route", "Order Sync"],
  ] },
  { id: "workspace", icon: "settings", label: "Workspace", children: [
    ["workspace-company", "user", "Company Profile"],
    ["workspace-pickups", "home", "Pickup Addresses"],
    ["workspace-team", "user", "Team & Roles"],
    ["workspace-kyc", "audit", "KYC & Billing"],
  ] },
  { id: "support", icon: "support", label: "Support", children: [
    ["support-raise", "plus", "Raise Ticket"],
    ["support-history", "audit", "Ticket History"],
    ["support-contact", "support", "Contact Support"],
  ] },
];

const featureDetails = {
  "dashboard-performance": ["DELIVERY CONTROL", "Delivery Performance", "Review service success, delivery speed and destination health.", ["96.4% success rate", "2.8 day average", "3.6% RTO", "24 delivered today"]],
  "dashboard-pickups": ["PICKUP CONTROL", "Pickup Schedule", "Plan today’s handovers and confirm what the courier desk will collect.", ["4 pickups today", "12 parcels ready", "Next run 2:30 PM", "1 address pending"]],
  "shipments-create": ["NEW ORDER", "Create Shipment", "Add a receiver, parcel and payment mode to schedule a pickup.", ["Receiver details", "Delivery address", "Parcel weight", "Payment mode"]],
  "shipments-track": ["LIVE MOVEMENT", "Track Shipment", "Search a Pax reference and review its latest movement milestone.", ["Booked", "Picked up", "In transit", "Out for delivery"]],
  "shipments-pickups": ["PICKUP REQUESTS", "Pickup Requests", "Manage pending, scheduled and completed pickup handovers.", ["4 scheduled", "1 pending", "8 completed today", "0 missed"]],
  "shipments-manifests": ["DISPATCH DOCUMENTS", "Manifests", "Create and download courier-wise shipment manifests.", ["Manifest PAX-M-731", "12 orders assigned", "2 couriers", "Last closed 4:20 PM"]],
  "exceptions-rto": ["RETURN CONTROL", "RTO Shipments", "Review return-to-origin parcels and plan the reverse journey.", ["3 in return transit", "1 address issue", "₹2,450 value", "2 actions due"]],
  "exceptions-delayed": ["DELAY MONITOR", "Delayed Shipments", "Find shipments beyond their expected movement milestone.", ["2 hub delays", "1 weather delay", "0 lost", "Oldest 18 hours"]],
  "exceptions-weight": ["WEIGHT REVIEW", "Weight Disputes", "Compare declared and courier-measured parcel weight.", ["2 open disputes", "₹184 at risk", "1 accepted", "1 under review"]],
  "finance-wallet": ["WALLET LEDGER", "Wallet Transactions", "Review credits, shipping debits, refunds and adjustments.", ["₹12,840 balance", "₹5,000 last recharge", "₹860 debited today", "₹240 refunded"]],
  "finance-invoices": ["BILLING RECORDS", "Invoices", "Review, filter and download weekly shipping invoices.", ["3 recent invoices", "₹13,280 billed", "2 paid", "1 due"]],
  "audits-cod": ["COD CONTROL", "COD Reconciliation", "Match collected COD against remittance and order records.", ["₹18,420 matched", "24 COD orders", "0 mismatches", "Next close 03 Aug"]],
  "audits-billing": ["CHARGE REVIEW", "Billing Audit", "Review shipping charges, taxes and invoice-level adjustments.", ["42 orders checked", "₹184 adjustment", "2 recommendations", "92/100 health"]],
  "utilities-rate": ["SHIPPING TOOL", "Rate Calculator", "Estimate indicative shipping charges for a route and parcel.", ["Pickup PIN", "Delivery PIN", "Chargeable weight", "Service speed"]],
  "utilities-weight": ["SHIPPING TOOL", "Weight Calculator", "Compare actual and volumetric weight before booking.", ["Length × width × height", "Actual weight", "Volumetric divisor", "Chargeable result"]],
  "utilities-pincode": ["SERVICEABILITY", "Pincode Serviceability", "Check whether a destination supports standard, express and COD.", ["Standard delivery", "Express delivery", "COD availability", "Expected timeline"]],
  "utilities-labels": ["DOCUMENT TOOL", "Label Generator", "Prepare shipping labels for booked customer orders.", ["A6 shipping label", "Invoice copy", "Barcode", "Download PDF"]],
  "insights-courier": ["COURIER ANALYTICS", "Courier Performance", "Compare delivery success, speed and RTO across courier partners.", ["Pax Express 97.2%", "Partner North 95.8%", "Partner South 94.9%", "Best SLA 2.1 days"]],
  "insights-zones": ["ROUTE ANALYTICS", "Zone Analysis", "Understand shipment mix and cost by delivery zone.", ["Local 22%", "Regional 31%", "Metro 28%", "National 19%"]],
  "insights-rto": ["RETURN ANALYTICS", "RTO Analytics", "Identify return patterns by city, payment and exception reason.", ["3.6% RTO", "COD 68% of RTO", "Top reason unavailable", "Down 0.8%"]],
  "channels-connect": ["STORE CONNECTION", "Connect Store", "Connect a commerce channel and start importing orders.", ["Shopify", "WooCommerce", "Amazon", "CSV upload"]],
  "channels-sync": ["ORDER AUTOMATION", "Order Sync", "Review imports, mapping rules and sync failures.", ["Last sync 6 mins ago", "36 orders imported", "2 skipped", "0 failed"]],
  "workspace-pickups": ["ORIGIN SETTINGS", "Pickup Addresses", "Manage warehouses, offices and recurring pickup origins.", ["Himayat Nagar", "Kukatpally", "2 active origins", "Default origin set"]],
  "workspace-team": ["ACCESS CONTROL", "Team & Roles", "Invite teammates and decide what each role can manage.", ["3 team members", "1 administrator", "2 operators", "0 pending invites"]],
  "workspace-kyc": ["BUSINESS VERIFICATION", "KYC & Billing", "Review KYC, GST and billing identity for the workspace.", ["KYC verified", "GST active", "Billing address set", "PAN verified"]],
  "support-history": ["SUPPORT RECORDS", "Ticket History", "Track open and resolved conversations with the Pax team.", ["1 open ticket", "8 resolved", "12 min avg response", "Latest PAX-SUP-104"]],
  "support-contact": ["CONTACT DESK", "Contact Support", "Reach the local logistics team by WhatsApp, phone or email.", ["WhatsApp support", "+91 94943 38206", "Email support", "Mon–Sat 9 AM–7 PM"]],
};

const defaultTools = {
  overview: "overview-home",
  dashboard: "dashboard-operations",
  shipments: "shipments-all",
  exceptions: "exceptions-ndr",
  finance: "finance-wallet",
  audits: "audits-weight",
  utilities: "utilities-rate",
  insights: "insights-shipments",
  channels: "channels-connected",
  workspace: "workspace-company",
  support: "support-raise",
};

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

function readNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "null");
    if (!Array.isArray(saved)) return starterNotifications;
    return starterNotifications.map((notification) => ({
      ...notification,
      unread: saved.find((item) => item.id === notification.id)?.unread ?? notification.unread,
    }));
  } catch {
    return starterNotifications;
  }
}

function readWalletBalance() {
  const saved = Number(localStorage.getItem(WALLET_KEY));
  return Number.isFinite(saved) && saved >= 0 ? saved : 12840;
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
  const [activeTool, setActiveTool] = useState("overview-home");
  const [openMenu, setOpenMenu] = useState(null);
  const [submenuTop, setSubmenuTop] = useState(110);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(readNotifications);
  const [walletBalance, setWalletBalance] = useState(readWalletBalance);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletModal, setWalletModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("1000");
  const [rechargeMethod, setRechargeMethod] = useState("UPI");
  const [overviewRange, setOverviewRange] = useState("7D");
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
  const unreadNotificationCount = notifications.filter((notification) => notification.unread).length;
  const walletBalanceLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(walletBalance);

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

  const navigatePanel = (section, tool = defaultTools[section]) => {
    setActive(section);
    setActiveTool(tool);
    setOpenMenu(null);
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
    setWalletMenuOpen(false);
    setMobileNav(false);
  };

  const openNotification = (notification) => {
    setNotifications((current) => {
      const next = current.map((item) => item.id === notification.id ? { ...item, unread: false } : item);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
    navigatePanel(notification.section, notification.tool);
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, unread: false }));
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
    notify("All notifications marked as read.");
  };

  const addWalletMoney = (event) => {
    event.preventDefault();
    const amount = Number(rechargeAmount);
    if (!Number.isFinite(amount) || amount < 100 || amount > 50000) {
      notify("Enter an amount between ₹100 and ₹50,000.");
      return;
    }
    const nextBalance = walletBalance + amount;
    setWalletBalance(nextBalance);
    localStorage.setItem(WALLET_KEY, String(nextBalance));
    setWalletModal(false);
    setRechargeAmount("1000");
    notify(`${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)} added through ${rechargeMethod}.`);
  };

  const toggleSubmenu = (event, item) => {
    if (item.children.length === 1) {
      navigatePanel(item.id, item.children[0][0]);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedHeight = item.children.length * 54 + 28;
    const availableTop = Math.max(12, window.innerHeight - estimatedHeight - 12);
    setSubmenuTop(Math.min(rect.top - 3, availableTop));
    setOpenMenu((current) => current === item.id ? null : item.id);
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
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  const overviewAnalytics = {
    "7D": {
      label: "Last 7 days",
      shipments: shipments.length + 34,
      revenue: "₹84.6K",
      cost: "₹46.2K",
      aov: "₹642",
      growth: "+18.2%",
      bars: [48, 61, 52, 76, 68, 88, 96],
      labels: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    "30D": {
      label: "Last 30 days",
      shipments: shipments.length + 176,
      revenue: "₹3.42L",
      cost: "₹1.86L",
      aov: "₹688",
      growth: "+24.8%",
      bars: [42, 57, 69, 64, 78, 83, 94],
      labels: ["01", "05", "10", "15", "20", "25", "30"],
    },
    "90D": {
      label: "Last 90 days",
      shipments: shipments.length + 538,
      revenue: "₹10.8L",
      cost: "₹5.72L",
      aov: "₹704",
      growth: "+31.4%",
      bars: [36, 48, 55, 67, 72, 86, 98],
      labels: ["May", "W2", "Jun", "W2", "Jul", "W3", "Now"],
    },
  };

  const renderOverview = () => {
    const analytics = overviewAnalytics[overviewRange];
    return (
      <>
        <section className="portal-welcome overview-welcome">
          <div>
            <p>{todayLabel} · CONTROL TOWER</p>
            <h1>{greeting}, {user.fullName?.split(" ")[0] || "there"}.</h1>
            <span>Every shipment, rupee and delivery signal in one intelligent view.</span>
          </div>
          <div className="overview-welcome-actions">
            <div className="overview-range-tabs" aria-label="Analytics date range">
              {["7D", "30D", "90D"].map((range) => (
                <button className={overviewRange === range ? "is-active" : ""} key={range} type="button" onClick={() => setOverviewRange(range)}>{range}</button>
              ))}
            </div>
            <button className="portal-primary" type="button" onClick={openShipment}><Icon name="plus" /> Create shipment</button>
          </div>
        </section>

        <section className="overview-quick-panel" aria-label="Quick actions">
          <div className="overview-quick-heading">
            <div><small>WORK FASTER</small><h2>Quick actions</h2><p>Start your most-used shipping tasks directly from Overview.</p></div>
            <span>6 shortcuts</span>
          </div>
          <div className="overview-quick-grid">
            <button type="button" onClick={openShipment}>
              <span className="quick-tone-blue"><Icon name="plus" /></span>
              <div><strong>Create shipment</strong><small>Book a new customer order</small></div>
              <b>→</b>
            </button>
            <button type="button" onClick={() => navigatePanel("shipments", "shipments-track")}>
              <span className="quick-tone-purple"><Icon name="route" /></span>
              <div><strong>Track shipment</strong><small>Check live parcel movement</small></div>
              <b>→</b>
            </button>
            <button type="button" onClick={() => navigatePanel("utilities", "utilities-rate")}>
              <span className="quick-tone-green"><Icon name="wallet" /></span>
              <div><strong>Rate calculator</strong><small>Estimate shipping charges</small></div>
              <b>→</b>
            </button>
            <button type="button" onClick={() => navigatePanel("utilities", "utilities-pincode")}>
              <span className="quick-tone-amber"><Icon name="home" /></span>
              <div><strong>Check PIN code</strong><small>Verify delivery serviceability</small></div>
              <b>→</b>
            </button>
            <button type="button" onClick={() => navigatePanel("finance", "finance-cod")}>
              <span className="quick-tone-cyan"><Icon name="wallet" /></span>
              <div><strong>COD settlement</strong><small>Review available remittance</small></div>
              <b>→</b>
            </button>
            <button type="button" onClick={() => navigatePanel("support", "support-raise")}>
              <span className="quick-tone-coral"><Icon name="support" /></span>
              <div><strong>Raise ticket</strong><small>Get help from the Pax team</small></div>
              <b>→</b>
            </button>
          </div>
        </section>

        <section className="overview-signal-bar" aria-label="Network health">
          <div><span className="signal-live"><i></i> Live network</span><strong>All systems operational</strong></div>
          <div><small>ACTIVE LANES</small><strong>12</strong><span>5 priority routes</span></div>
          <div><small>AVG. DELIVERY</small><strong>2.8 days</strong><span>0.4 day faster</span></div>
          <div><small>FIRST ATTEMPT</small><strong>96.4%</strong><span>Top 8% benchmark</span></div>
          <div><small>RTO RATE</small><strong>3.6%</strong><span>↓ 0.8% this month</span></div>
        </section>

        <section className="portal-kpis overview-kpis" aria-label="Shipment summary">
          <article className="kpi-card kpi-purple"><span className="kpi-icon"><Icon name="box" /></span><small>TOTAL SHIPMENTS</small><strong>{analytics.shipments}</strong><p><b>↑ 12%</b> from previous period</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-yellow"><span className="kpi-icon"><Icon name="route" /></span><small>IN TRANSIT</small><strong>{shipments.filter((item) => item.status.includes("transit") || item.status.includes("delivery")).length + 6}</strong><p>Across 5 active lanes</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-green"><span className="kpi-icon"><Icon name="box" /></span><small>DELIVERED TODAY</small><strong>{shipments.filter((item) => item.status === "Delivered").length + 23}</strong><p><b>96.4%</b> first-attempt success</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-coral"><span className="kpi-icon"><Icon name="wallet" /></span><small>COD AVAILABLE</small><strong>₹18.4K</strong><p>Next settlement: 03 Aug</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
        </section>

        <section className="overview-finance-strip" aria-label="Commercial analytics">
          <article><span><Icon name="wallet" /></span><div><small>GROSS REVENUE</small><strong>{analytics.revenue}</strong></div><b>{analytics.growth}</b></article>
          <article><span><Icon name="insights" /></span><div><small>SHIPPING COST</small><strong>{analytics.cost}</strong></div><b className="is-neutral">54.6% of revenue</b></article>
          <article><span><Icon name="box" /></span><div><small>AVG. ORDER VALUE</small><strong>{analytics.aov}</strong></div><b>+7.2%</b></article>
          <article><span><Icon name="route" /></span><div><small>COD SHARE</small><strong>38.2%</strong></div><b className="is-neutral">24 orders</b></article>
        </section>

        <section className="portal-main-grid overview-primary-grid">
          <article className="portal-card movement-card overview-movement-card">
            <div className="portal-card-head">
              <div><small>SHIPMENT INTELLIGENCE · {analytics.label.toUpperCase()}</small><h2>Network movement</h2></div>
              <div className="overview-chart-legend"><span><i></i> Shipments</span><b>{analytics.growth}</b></div>
            </div>
            <div className="chart-wrap overview-chart-wrap">
              <div className="chart-lines"><i></i><i></i><i></i><i></i></div>
              <svg viewBox="0 0 640 190" preserveAspectRatio="none" aria-label="Shipment activity trend">
                <defs><linearGradient id="areaOverview" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3157c8" stopOpacity=".3" /><stop offset="1" stopColor="#3157c8" stopOpacity="0" /></linearGradient></defs>
                <path className="area overview-area" d="M0 160 C70 150 80 110 140 126 S220 170 280 105 S360 85 410 99 S490 82 535 47 S590 60 640 18 L640 190 L0 190Z" />
                <path className="line overview-line" d="M0 160 C70 150 80 110 140 126 S220 170 280 105 S360 85 410 99 S490 82 535 47 S590 60 640 18" />
              </svg>
              <div className="chart-days">{analytics.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </div>
            <div className="overview-chart-summary"><span><small>PEAK VOLUME</small><strong>42 orders</strong></span><span><small>DAILY AVERAGE</small><strong>27 orders</strong></span><span><small>BEST LANE</small><strong>HYD → BLR</strong></span></div>
          </article>
          <article className="portal-card status-card overview-status-card">
            <div className="portal-card-head"><div><small>LIVE STATUS</small><h2>Delivery mix</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>View all</button></div>
            <div className="donut-row">
              <div className="donut"><div><strong>{analytics.shipments}</strong><span>Total</span></div></div>
              <div className="donut-legend">
                <span><i className="legend-green"></i><b>Delivered</b><em>63%</em></span>
                <span><i className="legend-purple"></i><b>In transit</b><em>21%</em></span>
                <span><i className="legend-yellow"></i><b>Scheduled</b><em>11%</em></span>
                <span><i className="legend-coral"></i><b>Attention</b><em>5%</em></span>
              </div>
            </div>
            <div className="overview-delivery-note"><span>✓</span><div><strong>Healthy delivery mix</strong><small>Attention shipments are below your 8% threshold.</small></div></div>
          </article>
        </section>

        <section className="overview-analytics-grid">
          <article className="portal-card overview-revenue-card">
            <div className="portal-card-head"><div><small>COMMERCIAL PERFORMANCE</small><h2>Revenue vs shipping cost</h2></div><button type="button" onClick={() => notify("Finance report prepared for export.")}>Export report ↗</button></div>
            <div className="overview-revenue-head"><div><small>NET CONTRIBUTION</small><strong>₹38.4K</strong><span>45.4% margin</span></div><p>Revenue is growing faster than shipping spend across the selected period.</p></div>
            <div className="overview-bars">
              {analytics.bars.map((height, index) => <div key={`${overviewRange}-${index}`}><span style={{ height: `${height}%` }}><i style={{ height: `${Math.max(25, height * .55)}%` }}></i></span><small>{analytics.labels[index]}</small></div>)}
            </div>
            <div className="overview-bar-legend"><span><i></i> Revenue</span><span><i></i> Shipping cost</span></div>
          </article>

          <article className="portal-card overview-sla-card">
            <div className="portal-card-head"><div><small>SERVICE QUALITY</small><h2>SLA health</h2></div><span className="trend-pill">Excellent</span></div>
            <div className="overview-sla-score"><div className="sla-gauge"><span><strong>94.8</strong><small>/100</small></span></div><div><strong>On-time performance</strong><p>3.2 points above your 30-day average.</p></div></div>
            <div className="overview-sla-list">
              <div><span>Pickup SLA</span><b>98.2%</b><i><em style={{ width: "98.2%" }}></em></i></div>
              <div><span>In-transit SLA</span><b>94.8%</b><i><em style={{ width: "94.8%" }}></em></i></div>
              <div><span>First attempt</span><b>96.4%</b><i><em style={{ width: "96.4%" }}></em></i></div>
              <div><span>NDR resolution</span><b>88.6%</b><i><em style={{ width: "88.6%" }}></em></i></div>
            </div>
          </article>
        </section>

        <section className="overview-operations-grid">
          <article className="portal-card overview-courier-card">
            <div className="portal-card-head"><div><small>PARTNER SCORECARD</small><h2>Courier performance</h2></div><button type="button" onClick={() => navigatePanel("insights", "insights-courier")}>Deep analysis →</button></div>
            <div className="overview-courier-table">
              <div className="is-heading"><span>Courier partner</span><span>Volume</span><span>On-time</span><span>Avg. TAT</span><span>Health</span></div>
              {[
                ["PX", "Pax Express", "46%", "97.2%", "2.1 days", 97],
                ["PN", "Partner North", "28%", "95.8%", "2.5 days", 91],
                ["PS", "Partner South", "18%", "94.9%", "2.7 days", 86],
                ["PL", "Partner Local", "8%", "91.4%", "1.4 days", 74],
              ].map(([code, name, volume, onTime, tat, health]) => (
                <div key={name}><span><i>{code}</i><b>{name}</b></span><span>{volume}</span><span>{onTime}</span><span>{tat}</span><span><i className="courier-health"><em style={{ width: `${health}%` }}></em></i></span></div>
              ))}
            </div>
          </article>

          <article className="portal-card overview-insight-card">
            <div className="portal-card-head"><div><small>SMART INSIGHTS</small><h2>Needs your attention</h2></div><span className="overview-ai-pill">PAX SIGNAL</span></div>
            <div className="overview-insight-list">
              <button type="button" onClick={() => navigatePanel("exceptions", "exceptions-delayed")}><span className="is-warning"><Icon name="alert" /></span><div><strong>2 shipments may breach SLA</strong><small>HYD → Mumbai lane · act within 3 hours</small></div><b>→</b></button>
              <button type="button" onClick={() => navigatePanel("finance", "finance-cod")}><span className="is-success"><Icon name="wallet" /></span><div><strong>₹18,420 ready to settle</strong><small>24 COD orders are fully reconciled</small></div><b>→</b></button>
              <button type="button" onClick={() => navigatePanel("insights", "insights-rto")}><span className="is-info"><Icon name="insights" /></span><div><strong>RTO improved by 0.8%</strong><small>Bengaluru and Pune are your best routes</small></div><b>→</b></button>
            </div>
          </article>
        </section>

        <section className="overview-zone-section">
          <div className="overview-section-heading"><div><small>DESTINATION INTELLIGENCE</small><h2>Zone performance</h2></div><button type="button" onClick={() => navigatePanel("insights", "insights-zones")}>Explore all zones →</button></div>
          <div className="overview-zone-grid">
            {[
              ["Local", "22%", "98.4%", "1.2 days", "is-blue"],
              ["Regional", "31%", "96.8%", "2.1 days", "is-green"],
              ["Metro", "28%", "95.2%", "2.6 days", "is-purple"],
              ["National", "19%", "92.7%", "3.8 days", "is-amber"],
            ].map(([zone, share, success, tat, tone]) => <article className={`overview-zone-card ${tone}`} key={zone}><span>{zone.slice(0, 1)}</span><small>{zone.toUpperCase()} ZONE</small><strong>{success}</strong><p>Delivery success</p><div><b>{share} volume</b><em>{tat}</em></div></article>)}
          </div>
        </section>

        <section className="portal-card shipment-list-card overview-latest-card">
          <div className="portal-card-head"><div><small>RECENT ACTIVITY</small><h2>Latest shipments</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>View all <span>→</span></button></div>
          <ShipmentTable shipments={shipments.slice(0, 4)} />
        </section>
      </>
    );
  };

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
        <article className="finance-hero"><small>AVAILABLE WALLET BALANCE</small><strong>{walletBalanceLabel}</strong><span>Ready for shipping charges and adjustments</span><button type="button" onClick={() => setWalletModal(true)}>+ Add money</button></article>
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

  const runFeatureAction = (toolId, label) => {
    if (toolId === "shipments-create") {
      openShipment();
      return;
    }
    if (toolId === "utilities-rate") {
      goTo("/rate-calculator");
      return;
    }
    if (toolId === "utilities-weight") {
      goTo("/weight-calculator");
      return;
    }
    if (toolId === "shipments-track") {
      setTrackId("PAX-260728");
      setTrackResult("PAX-260728");
      return;
    }
    if (toolId === "finance-wallet" && (label.includes("Add money") || label.includes("balance"))) {
      setWalletModal(true);
      return;
    }
    if (toolId === "support-contact") {
      window.open("https://wa.me/919494338206", "_blank", "noopener,noreferrer");
      return;
    }
    notify(`${label} opened successfully.`);
  };

  const renderFeatureWorkspace = (toolId) => {
    const details = featureDetails[toolId];
    if (!details) return renderOverview();
    const [eyebrow, title, copy, baseFeatures] = details;
    const features = toolId === "finance-wallet"
      ? [`${walletBalanceLabel} balance`, "Add money instantly", "₹860 debited today", "₹240 refunded"]
      : baseFeatures;
    return (
      <>
        <section className="section-title-row feature-title-row">
          <div><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>
          <button className="portal-primary" type="button" onClick={() => runFeatureAction(toolId, title)}>
            Open {title} <Icon name="arrow" />
          </button>
        </section>
        <section className="feature-function-grid">
          {features.map((feature, index) => (
            <button type="button" onClick={() => runFeatureAction(toolId, feature)} key={feature}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{feature}</strong><small>View details and manage this workflow</small></div>
              <b>→</b>
            </button>
          ))}
        </section>
        <section className="feature-workspace-grid">
          <article className="portal-card feature-activity-card">
            <div className="portal-card-head"><div><small>RECENT ACTIVITY</small><h2>{title} activity</h2></div><span className="trend-pill">Live</span></div>
            {features.map((feature, index) => (
              <div className="feature-activity-row" key={feature}>
                <span className={index < 2 ? "is-complete" : ""}>{index < 2 ? "✓" : index + 1}</span>
                <div><strong>{feature}</strong><small>{index < 2 ? "Updated today" : "Ready for review"}</small></div>
                <button type="button" onClick={() => runFeatureAction(toolId, feature)}>Open</button>
              </div>
            ))}
          </article>
          <article className="portal-card feature-help-card">
            <span><Icon name="support" /></span>
            <small>NEED HELP?</small>
            <h2>Work through {title.toLowerCase()} with the Pax desk.</h2>
            <p>Contact the Hyderabad operations team when an order needs a manual review.</p>
            <button type="button" onClick={() => navigatePanel("support", "support-contact")}>Contact support →</button>
          </article>
        </section>
      </>
    );
  };

  const toolRenderers = {
    "overview-home": renderOverview,
    "dashboard-operations": renderDashboard,
    "shipments-all": renderShipments,
    "shipments-track": renderTracking,
    "exceptions-ndr": renderExceptions,
    "finance-cod": renderFinance,
    "audits-weight": renderAudits,
    "insights-shipments": renderInsights,
    "channels-connected": renderChannels,
    "workspace-company": renderWorkspace,
    "support-raise": renderSupport,
  };

  const renderActiveTool = () => (toolRenderers[activeTool] || (() => renderFeatureWorkspace(activeTool)))();
  const openNavItem = navItems.find((item) => item.id === openMenu);

  return (
    <div className="portal-shell">
      <aside className={`portal-sidebar${mobileNav ? " is-open" : ""}`}>
        <button className="portal-logo" type="button" onClick={() => goTo("/")} aria-label="Pax Logistics home"><img src="/assets/pax-logo.png" alt="Pax Logistics" /></button>
        <div className="portal-workspace"><span>{(user.businessName || "PX").slice(0, 2).toUpperCase()}</span><div><small>WORKSPACE</small><strong>{user.businessName || "My workspace"}</strong></div></div>
        <nav aria-label="Customer portal">
          <small>MAIN MENU</small>
          {navItems.map((item) => (
            <button
              className={`${active === item.id ? "is-active" : ""}${openMenu === item.id ? " is-open" : ""}`}
              type="button"
              onClick={(event) => toggleSubmenu(event, item)}
              aria-expanded={openMenu === item.id}
              aria-haspopup="menu"
              key={item.id}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Shipments" && <em>{shipments.length}</em>}
            </button>
          ))}
        </nav>
        <div className="portal-help"><span>?</span><strong>Need a hand?</strong><p>Our Hyderabad team is ready to help.</p><button type="button" onClick={() => navigatePanel("support")}>Open support</button></div>
        <button className="portal-logout" type="button" onClick={logout}>← <span>Sign out</span></button>
      </aside>
      {openNavItem && (
        <>
          <button className="portal-submenu-scrim" type="button" aria-label="Close submenu" onClick={() => setOpenMenu(null)}></button>
          <div className="portal-submenu" style={{ top: `${submenuTop}px` }} role="menu" aria-label={`${openNavItem.label} options`}>
            <p>{openNavItem.label}</p>
            {openNavItem.children.map(([toolId, icon, label]) => (
              <button
                className={activeTool === toolId ? "is-active" : ""}
                type="button"
                role="menuitem"
                onClick={() => navigatePanel(openNavItem.id, toolId)}
                key={toolId}
              >
                <span><Icon name={icon} /></span>
                <b>{label}</b>
                <i>→</i>
              </button>
            ))}
          </div>
        </>
      )}
      {mobileNav && <button className="portal-scrim" type="button" aria-label="Close menu" onClick={() => setMobileNav(false)}></button>}
      <div className="portal-body">
        <header className="portal-header">
          <div className="portal-header-start">
            <button className="portal-menu" type="button" onClick={() => setMobileNav(true)} aria-label="Open portal menu"><Icon name="menu" /></button>
            <label className="portal-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => navigatePanel("shipments", "shipments-all")} placeholder="Search shipments, orders and customers..." /><kbd>⌘ K</kbd></label>
            <span className="portal-live-pill"><i></i> Network live</span>
          </div>
          <div className="portal-header-actions">
            <div className="portal-notification-menu-wrap">
              <button
                className={`notification-button${unreadNotificationCount ? " has-unread" : ""}`}
                type="button"
                onClick={() => { setNotificationsOpen((open) => !open); setAccountMenuOpen(false); setWalletMenuOpen(false); }}
                aria-label={`Open notifications, ${unreadNotificationCount} unread`}
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
              >
                <Icon name="bell" />
                {unreadNotificationCount > 0 && <i>{unreadNotificationCount}</i>}
              </button>
              {notificationsOpen && (
                <div className="portal-notification-dropdown" role="menu" aria-label="Notifications">
                  <div className="notification-dropdown-head">
                    <div><span>NOTIFICATION CENTRE</span><h2>What’s new</h2></div>
                    {unreadNotificationCount > 0 && <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>}
                  </div>
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <button
                        className={notification.unread ? "is-unread" : ""}
                        type="button"
                        role="menuitem"
                        onClick={() => openNotification(notification)}
                        key={notification.id}
                      >
                        <span className={`notification-tone-${notification.tone}`}><Icon name={notification.icon} /></span>
                        <div><strong>{notification.title}</strong><p>{notification.detail}</p><small>{notification.time}</small></div>
                        {notification.unread && <b aria-label="Unread"></b>}
                      </button>
                    ))}
                  </div>
                  <button className="notification-view-all" type="button" onClick={() => navigatePanel("overview", "overview-home")}>View notification overview <span>→</span></button>
                </div>
              )}
            </div>
            <div className="portal-wallet-menu-wrap">
              <button
                className="wallet-header-button"
                type="button"
                onClick={() => { setWalletMenuOpen((open) => !open); setNotificationsOpen(false); setAccountMenuOpen(false); }}
                aria-label={`Wallet balance ${walletBalanceLabel}`}
                aria-expanded={walletMenuOpen}
                aria-haspopup="menu"
              >
                <span><Icon name="wallet" /></span>
                <div><small>WALLET</small><strong>{walletBalanceLabel}</strong></div>
                <b>{walletMenuOpen ? "⌃" : "⌄"}</b>
              </button>
              {walletMenuOpen && (
                <div className="portal-wallet-dropdown" role="menu" aria-label="Wallet">
                  <div className="wallet-dropdown-balance">
                    <span><Icon name="wallet" /></span>
                    <small>AVAILABLE BALANCE</small>
                    <strong>{walletBalanceLabel}</strong>
                    <p>Use this balance for shipment charges and adjustments.</p>
                  </div>
                  <button className="wallet-add-button" type="button" onClick={() => { setWalletModal(true); setWalletMenuOpen(false); }}><span>+</span> Add money</button>
                  <div className="wallet-mini-stats"><span><small>THIS MONTH</small><b>₹8,640 spent</b></span><span><small>LAST RECHARGE</small><b>₹5,000</b></span></div>
                  <button className="wallet-transactions-link" type="button" onClick={() => navigatePanel("finance", "finance-wallet")}>View wallet transactions <span>→</span></button>
                </div>
              )}
            </div>
            <div className="portal-account-menu-wrap">
              <button className="account-button" type="button" onClick={() => { setAccountMenuOpen((open) => !open); setNotificationsOpen(false); setWalletMenuOpen(false); }} aria-expanded={accountMenuOpen} aria-haspopup="menu">
                <span>{(user.fullName || "PC").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                <div><strong>{user.fullName}</strong><small>{user.accountType || "Business"} account</small></div>
                <b>{accountMenuOpen ? "⌃" : "⌄"}</b>
              </button>
              {accountMenuOpen && (
                <div className="portal-account-dropdown" role="menu">
                  <div className="account-dropdown-head"><span>{(user.fullName || "PC").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{user.email}</small></div></div>
                  <button type="button" role="menuitem" onClick={() => navigatePanel("workspace", "workspace-company")}><Icon name="user" /><span>Company profile</span><b>→</b></button>
                  <button type="button" role="menuitem" onClick={() => navigatePanel("workspace", "workspace-pickups")}><Icon name="settings" /><span>Account settings</span><b>→</b></button>
                  <button type="button" role="menuitem" onClick={() => navigatePanel("support", "support-contact")}><Icon name="support" /><span>Help & support</span><b>→</b></button>
                  <button className="account-logout-action" type="button" role="menuitem" onClick={logout}><span>←</span><span>Log out</span></button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={`portal-content portal-content--${active}`}>
          <div className="portal-view" key={activeTool}>{renderActiveTool()}</div>
        </main>
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
      {walletModal && (
        <div className="modal-backdrop wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWalletModal(false); }}>
          <form className="wallet-recharge-modal" onSubmit={addWalletMoney}>
            <div className="wallet-modal-head">
              <div><span><Icon name="wallet" /></span><div><small>SECURE RECHARGE</small><h2>Add money to wallet</h2></div></div>
              <button type="button" onClick={() => setWalletModal(false)} aria-label="Close">×</button>
            </div>
            <div className="wallet-current-balance"><span>Current balance</span><strong>{walletBalanceLabel}</strong></div>
            <fieldset className="wallet-amount-field">
              <legend>Select amount</legend>
              <div>
                {["500", "1000", "2000", "5000"].map((amount) => <button className={rechargeAmount === amount ? "is-active" : ""} type="button" onClick={() => setRechargeAmount(amount)} key={amount}>₹{Number(amount).toLocaleString("en-IN")}</button>)}
              </div>
              <label>Custom amount<div><span>₹</span><input value={rechargeAmount} onChange={(event) => setRechargeAmount(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="Enter ₹100–₹50,000" autoFocus /></div></label>
            </fieldset>
            <fieldset className="wallet-method-field">
              <legend>Payment method</legend>
              <div>
                {["UPI", "Card", "Net banking"].map((method) => <button className={rechargeMethod === method ? "is-active" : ""} type="button" onClick={() => setRechargeMethod(method)} key={method}><span>{method === "UPI" ? "UPI" : method === "Card" ? "▣" : "⌂"}</span>{method}</button>)}
              </div>
            </fieldset>
            <div className="wallet-recharge-summary"><span>Balance after recharge</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(walletBalance + (Number(rechargeAmount) || 0))}</strong></div>
            <p className="wallet-secure-note"><span>✓</span> Payment is simulated securely for this customer portal demo.</p>
            <div className="wallet-modal-actions"><button className="portal-secondary" type="button" onClick={() => setWalletModal(false)}>Cancel</button><button className="portal-primary" type="submit">Add {Number(rechargeAmount) >= 100 ? `₹${Number(rechargeAmount).toLocaleString("en-IN")}` : "money"} <Icon name="arrow" /></button></div>
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
