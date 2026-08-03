import { useEffect, useMemo, useRef, useState } from "react";
import { cacheControlState, DEFAULT_CONTROL_STATE, readControlState, subscribeToLocalControl, subscribeToRemoteUpdates } from "../services/sharedControl.js";
import { createClientPickupRequest, createClientShipment, getClientBootstrap, getClientExpectedTat, getClientHeavyServiceability, getClientNdrStatus, getClientServiceability, getClientShipmentDocument, getClientShippingCost, getClientShippingLabel, logoutClient, submitClientNdrAction } from "../services/clientApi.js";
import { ENABLE_PREVIEW_MODE } from "../config.js";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-cache-users-v1";
const SHIPMENTS_KEY = "pax-cache-shipments-v1";
const NOTIFICATIONS_KEY = "pax-cache-notifications-v1";
const WALLET_KEY = "pax-cache-wallet-balance-v1";

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
  "dashboard-performance": ["DELIVERY CONTROL", "Delivery Performance", "Review service success, delivery speed and destination health."],
  "dashboard-pickups": ["PICKUP CONTROL", "Pickup Schedule", "Plan today’s handovers and confirm what the courier desk will collect."],
  "shipments-create": ["NEW ORDER", "Create Shipment", "Add a receiver, parcel and payment mode to schedule a pickup."],
  "shipments-track": ["LIVE MOVEMENT", "Track Shipment", "Search a Pax reference and review its latest movement milestone."],
  "shipments-pickups": ["PICKUP REQUESTS", "Pickup Requests", "Manage pending, scheduled and completed pickup handovers."],
  "shipments-manifests": ["DISPATCH DOCUMENTS", "Manifests", "Create and download courier-wise shipment manifests."],
  "exceptions-rto": ["RETURN CONTROL", "RTO Shipments", "Review return-to-origin parcels and plan the reverse journey."],
  "exceptions-delayed": ["DELAY MONITOR", "Delayed Shipments", "Find shipments beyond their expected movement milestone."],
  "exceptions-weight": ["WEIGHT REVIEW", "Weight Disputes", "Compare declared and courier-measured parcel weight."],
  "finance-wallet": ["WALLET LEDGER", "Wallet Transactions", "Review credits, shipping debits, refunds and adjustments."],
  "finance-invoices": ["BILLING RECORDS", "Invoices", "Review, filter and download weekly shipping invoices."],
  "audits-cod": ["COD CONTROL", "COD Reconciliation", "Match collected COD against remittance and order records."],
  "audits-billing": ["CHARGE REVIEW", "Billing Audit", "Review shipping charges, taxes and invoice-level adjustments."],
  "utilities-rate": ["SHIPPING TOOL", "Rate Calculator", "Estimate indicative shipping charges for a route and parcel."],
  "utilities-weight": ["SHIPPING TOOL", "Weight Calculator", "Compare actual and volumetric weight before booking."],
  "utilities-pincode": ["SERVICEABILITY", "Pincode Serviceability", "Check whether a destination supports standard, express and COD."],
  "utilities-labels": ["DOCUMENT TOOL", "Label Generator", "Prepare shipping labels for booked customer orders."],
  "insights-courier": ["COURIER ANALYTICS", "Courier Performance", "Compare delivery success, speed and RTO across courier partners."],
  "insights-zones": ["ROUTE ANALYTICS", "Zone Analysis", "Understand shipment mix and cost by delivery zone."],
  "insights-rto": ["RETURN ANALYTICS", "RTO Analytics", "Identify return patterns by city, payment and exception reason."],
  "channels-connect": ["STORE CONNECTION", "Connect Store", "Connect a commerce channel and start importing orders."],
  "channels-sync": ["ORDER AUTOMATION", "Order Sync", "Review imports, mapping rules and sync failures."],
  "workspace-pickups": ["ORIGIN SETTINGS", "Pickup Addresses", "Manage warehouses, offices and recurring pickup origins."],
  "workspace-team": ["ACCESS CONTROL", "Team & Roles", "Invite teammates and decide what each role can manage."],
  "workspace-kyc": ["BUSINESS VERIFICATION", "KYC & Billing", "Review KYC, GST and billing identity for the workspace."],
  "support-history": ["SUPPORT RECORDS", "Ticket History", "Track open and resolved conversations with the Pax team."],
  "support-contact": ["CONTACT DESK", "Contact Support", "Reach the local logistics team by WhatsApp, phone or email."],
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

function userCacheKey(baseKey, email = readSession()?.email) {
  return email ? `${baseKey}:${String(email).trim().toLowerCase()}` : `${baseKey}:anonymous`;
}

function readShipments() {
  try {
    const saved = JSON.parse(localStorage.getItem(userCacheKey(SHIPMENTS_KEY)) || "null");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function readNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(userCacheKey(NOTIFICATIONS_KEY)) || "null");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function readWalletBalance() {
  const saved = Number(localStorage.getItem(userCacheKey(WALLET_KEY)));
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
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

function indiaDateAfter(days = 0) {
  return new Date(Date.now() + (330 * 60 * 1000) + (days * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function createEmptyQcQuestion() {
  return { questionId: "", type: "multi", options: "", value: "", required: true, questionImages: "" };
}

function createEmptyQcItem() {
  return { item: "", description: "", images: "", returnReason: "", quantity: "1", brand: "", productCategory: "", questions: [createEmptyQcQuestion()] };
}

function createEmptyShipmentForm() {
  return {
    customer: "", phone: "", address: "", city: "", state: "", pincode: "", weight: "1", payment: "Prepaid", flow: "Forward", productType: "Parcel", pickupLocation: "", amount: "", productsDescription: "", quantity: "1", shippingMode: "Surface", transportSpeed: "D", ewbn: "", returnAddress: "", returnCity: "", returnState: "", returnPincode: "", qcEnabled: false, customQc: [],
  };
}

function RvpQcEditor({ items, onChange }) {
  const updateItem = (itemIndex, changes) => onChange(items.map((item, index) => index === itemIndex ? { ...item, ...changes } : item));
  const updateQuestion = (itemIndex, questionIndex, changes) => updateItem(itemIndex, {
    questions: items[itemIndex].questions.map((question, index) => index === questionIndex ? { ...question, ...changes } : question),
  });
  return <section className="rvp-qc-editor span-two">
    <div className="rvp-qc-heading"><div><strong>RVP QC 3.0 items</strong><small>Maximum 2 items and 6 mapped questions per item.</small></div><button type="button" disabled={items.length >= 2} onClick={() => onChange([...items, createEmptyQcItem()])}>Add QC item</button></div>
    {items.map((item, itemIndex) => <article className="rvp-qc-item" key={`qc-item-${itemIndex}`}>
      <div className="rvp-qc-heading"><strong>Item {itemIndex + 1}</strong>{items.length > 1 && <button type="button" onClick={() => onChange(items.filter((_, index) => index !== itemIndex))}>Remove</button>}</div>
      <div className="rvp-qc-grid"><label>Item name<input value={item.item} onChange={(event) => updateItem(itemIndex, { item: event.target.value })} /></label><label>Description *<input value={item.description} onChange={(event) => updateItem(itemIndex, { description: event.target.value })} required /></label><label className="span-two">Item image URLs *<input value={item.images} onChange={(event) => updateItem(itemIndex, { images: event.target.value })} placeholder="Comma-separated HTTPS URLs" required /></label><label>Return reason<input value={item.returnReason} onChange={(event) => updateItem(itemIndex, { returnReason: event.target.value })} /></label><label>Quantity<input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(itemIndex, { quantity: event.target.value })} /></label><label>Brand<input value={item.brand} onChange={(event) => updateItem(itemIndex, { brand: event.target.value })} /></label><label>Product category<input value={item.productCategory} onChange={(event) => updateItem(itemIndex, { productCategory: event.target.value })} /></label></div>
      {item.questions.map((question, questionIndex) => <div className="rvp-qc-question" key={`qc-question-${questionIndex}`}><div className="rvp-qc-heading"><strong>Question {questionIndex + 1}</strong>{item.questions.length > 1 && <button type="button" onClick={() => updateItem(itemIndex, { questions: item.questions.filter((_, index) => index !== questionIndex) })}>Remove</button>}</div><div className="rvp-qc-grid"><label>Mapped client question ID *<input value={question.questionId} onChange={(event) => updateQuestion(itemIndex, questionIndex, { questionId: event.target.value })} required /></label><label>Answer type<select value={question.type} onChange={(event) => updateQuestion(itemIndex, questionIndex, { type: event.target.value })}><option value="multi">Select options</option><option value="varchar">Typed answer</option></select></label><label>Options *<input value={question.options} onChange={(event) => updateQuestion(itemIndex, questionIndex, { options: event.target.value })} placeholder={question.type === "multi" ? "Black, Other" : "Leave blank for typed answer"} /></label><label>Correct value *<input value={question.value} onChange={(event) => updateQuestion(itemIndex, questionIndex, { value: event.target.value })} required /></label><label className="span-two">Question image URLs<input value={question.questionImages} onChange={(event) => updateQuestion(itemIndex, questionIndex, { questionImages: event.target.value })} placeholder="Optional comma-separated URLs" /></label><label className="rvp-qc-required"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(itemIndex, questionIndex, { required: event.target.checked })} /> Answer affects the QC result</label></div></div>)}
      <button className="rvp-qc-add-question" type="button" disabled={item.questions.length >= 6} onClick={() => updateItem(itemIndex, { questions: [...item.questions, createEmptyQcQuestion()] })}>Add question</button>
    </article>)}
  </section>;
}

function buildOverviewAnalytics(shipments, days, label) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const records = shipments.filter((shipment) => {
    const timestamp = Date.parse(shipment.date);
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
  const delivered = records.filter((item) => item.status === "Delivered").length;
  const inTransit = records.filter((item) => ["In transit", "Out for delivery"].includes(item.status)).length;
  const rto = records.filter((item) => item.status === "RTO").length;
  const scheduled = records.filter((item) => item.status === "Pickup scheduled").length;
  const attention = records.filter((item) => ["Exception", "RTO"].includes(item.status)).length;
  const codRecords = records.filter((item) => item.payment === "COD");
  const revenueValue = records.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const costValue = Math.round(revenueValue * 0.62);
  const contributionValue = revenueValue - costValue;
  const percentage = (count) => records.length ? `${((count / records.length) * 100).toFixed(1)}%` : "0%";
  const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(value);
  const destinationCounts = records.reduce((result, item) => {
    const city = String(item.destination || "").split(",")[0].trim();
    if (city) result[city] = (result[city] || 0) + 1;
    return result;
  }, {});
  const bestLane = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const bucketCounts = Array(7).fill(0);
  records.forEach((shipment) => {
    const timestamp = Date.parse(shipment.date);
    if (!Number.isFinite(timestamp)) return;
    const age = Math.max(0, Date.now() - timestamp);
    const index = Math.min(6, Math.max(0, 6 - Math.floor((age / (days * 24 * 60 * 60 * 1000)) * 7)));
    bucketCounts[index] += 1;
  });
  const maxBucket = Math.max(...bucketCounts, 1);
  const successRate = records.length ? (delivered / records.length) * 100 : 0;

  return {
    label,
    shipments: records.length,
    revenue: money(revenueValue),
    cost: money(costValue),
    aov: money(records.length ? revenueValue / records.length : 0),
    growth: "Live data",
    inTransit,
    delivered,
    scheduled,
    attention,
    codAvailable: money(codRecords.filter((item) => item.status === "Delivered").reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    avgDelivery: "—",
    firstAttempt: percentage(delivered),
    rto: percentage(rto),
    codShare: percentage(codRecords.length),
    peak: `${Math.max(...bucketCounts)} orders`,
    dailyAverage: `${Math.round(records.length / days)} orders`,
    bestLane,
    contribution: money(contributionValue),
    margin: revenueValue ? `${Math.round((contributionValue / revenueValue) * 100)}% margin` : "0% margin",
    costShare: revenueValue ? `${Math.round((costValue / revenueValue) * 100)}% of revenue` : "0% of revenue",
    aovGrowth: "Live data",
    codOrders: codRecords.length,
    sla: Number(successRate.toFixed(1)),
    pickupSla: records.length ? 100 : 0,
    transitSla: Number(successRate.toFixed(1)),
    ndrSla: Number(successRate.toFixed(1)),
    bars: bucketCounts.map((count) => count ? Math.max(12, Math.round((count / maxBucket) * 100)) : 0),
    labels: days === 7 ? ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"] : ["1", "2", "3", "4", "5", "6", "Now"],
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState(readSession);
  const [active, setActive] = useState("overview");
  const [activeTool, setActiveTool] = useState("overview-home");
  const [openMenu, setOpenMenu] = useState(null);
  const [submenuTop, setSubmenuTop] = useState(110);
  const [submenuPointerTop, setSubmenuPointerTop] = useState(24);
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
  const [warehouses, setWarehouses] = useState([]);
  const [pickupRequests, setPickupRequests] = useState([]);
  const [controlState, setControlState] = useState(() => ENABLE_PREVIEW_MODE ? readControlState() : JSON.parse(JSON.stringify(DEFAULT_CONTROL_STATE)));
  const [search, setSearch] = useState("");
  const [shipmentModal, setShipmentModal] = useState(false);
  const [toast, setToast] = useState("");
  const [trackId, setTrackId] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [ticket, setTicket] = useState({ subject: "", message: "" });
  const [rateForm, setRateForm] = useState({ pickup: "500029", delivery: "400001", weight: "2", speed: "standard", payment: "Prepaid" });
  const [rateQuote, setRateQuote] = useState(null);
  const [weightForm, setWeightForm] = useState({ actual: "2.5", length: "40", width: "30", height: "25", divisor: "5000" });
  const [weightResult, setWeightResult] = useState(null);
  const [servicePin, setServicePin] = useState("560001");
  const [serviceProductType, setServiceProductType] = useState("Parcel");
  const [serviceResult, setServiceResult] = useState(null);
  const [labelShipmentId, setLabelShipmentId] = useState(() => shipments[0]?.id || "");
  const [labelWaybill, setLabelWaybill] = useState(() => shipments[0]?.waybill || "");
  const [labelPdf, setLabelPdf] = useState(true);
  const [labelPdfSize, setLabelPdfSize] = useState("4R");
  const [generatedLabel, setGeneratedLabel] = useState(null);
  const [documentType, setDocumentType] = useState("EPOD");
  const [downloadedDocument, setDownloadedDocument] = useState(null);
  const [ndrSubmitting, setNdrSubmitting] = useState("");
  const [pickupForm, setPickupForm] = useState({ pickupDate: indiaDateAfter(1), pickupTime: "11:00:00", pickupLocation: "", expectedPackageCount: "1" });
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [newShipment, setNewShipment] = useState(createEmptyShipmentForm);
  const notificationMenuRef = useRef(null);
  const walletMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    const stopLocalSync = ENABLE_PREVIEW_MODE ? subscribeToLocalControl(setControlState) : () => undefined;
    const syncFromApi = async () => {
      try {
        const data = await getClientBootstrap();
        if (data.configuration) setControlState(cacheControlState(data.configuration));
        if (Array.isArray(data.shipments)) {
          setShipments(data.shipments);
          localStorage.setItem(userCacheKey(SHIPMENTS_KEY, user?.email), JSON.stringify(data.shipments));
        }
        if (Array.isArray(data.pickupRequests)) setPickupRequests(data.pickupRequests);
        if (Array.isArray(data.warehouses)) setWarehouses(data.warehouses);
      } catch {
        // Keep the customer workspace usable with its last synchronized snapshot.
      }
    };
    syncFromApi();
    const timer = window.setInterval(syncFromApi, 30000);
    const stopRemoteSync = subscribeToRemoteUpdates(syncFromApi);
    return () => {
      window.clearInterval(timer);
      stopLocalSync();
      stopRemoteSync();
    };
  }, [user?.email]);

  useEffect(() => {
    if (!user) return undefined;
    const syncShipments = (event) => {
      if (event.type === "storage" && event.key !== userCacheKey(SHIPMENTS_KEY, user?.email)) return;
      const next = event.detail || readShipments();
      if (Array.isArray(next)) setShipments(next);
    };
    window.addEventListener("storage", syncShipments);
    window.addEventListener("pax:shipments-updated", syncShipments);
    return () => {
      window.removeEventListener("storage", syncShipments);
      window.removeEventListener("pax:shipments-updated", syncShipments);
    };
  }, [user?.email]);

  useEffect(() => {
    if (!notificationsOpen && !walletMenuOpen && !accountMenuOpen) return undefined;

    const closeMenusOutside = (event) => {
      if (notificationsOpen && !notificationMenuRef.current?.contains(event.target)) setNotificationsOpen(false);
      if (walletMenuOpen && !walletMenuRef.current?.contains(event.target)) setWalletMenuOpen(false);
      if (accountMenuOpen && !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeMenusOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setNotificationsOpen(false);
      setWalletMenuOpen(false);
      setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMenusOutside);
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenusOutside);
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, [notificationsOpen, walletMenuOpen, accountMenuOpen]);

  const filteredShipments = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return shipments;
    return shipments.filter((shipment) =>
      [shipment.id, shipment.customer, shipment.destination, shipment.status].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, shipments]);
  const availablePaymentOptions = [
    controlState.settings.paymentOptions.prepaid && "Prepaid",
    controlState.settings.paymentOptions.cod && "COD",
  ].filter(Boolean);
  const enabledCouriers = (controlState.resources.couriers || []).filter((courier) => courier.enabled);
  const labelShipment = shipments.find((shipment) => shipment.id === labelShipmentId);
  const labelWaybills = labelShipment
    ? (Array.isArray(labelShipment.waybills) && labelShipment.waybills.length ? labelShipment.waybills : [labelShipment.waybill]).filter(Boolean).map(String)
    : [];
  const readyPickupShipments = shipments.filter((shipment) => String(shipment.status).toLowerCase() === "manifested"
    && !["pickup", "repl"].includes(String(shipment.payment).toLowerCase()));
  const readyPickupPackageCount = readyPickupShipments.reduce((total, shipment) => total + Math.max(1, Number(shipment.packageCount) || 1), 0);
  useEffect(() => {
    if (!availablePaymentOptions.length) return;
    const fallback = availablePaymentOptions[0];
    setRateForm((current) => availablePaymentOptions.includes(current.payment) ? current : { ...current, payment: fallback });
    setNewShipment((current) => availablePaymentOptions.includes(current.payment) ? current : { ...current, payment: fallback });
  }, [controlState.settings.paymentOptions.prepaid, controlState.settings.paymentOptions.cod]);
  const unreadNotificationCount = notifications.filter((notification) => notification.unread).length;
  const walletBalanceLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(walletBalance);

  if (!user) return <EmptyAuth />;

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const logout = () => {
    logoutClient();
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
      localStorage.setItem(userCacheKey(NOTIFICATIONS_KEY, user?.email), JSON.stringify(next));
      return next;
    });
    navigatePanel(notification.section, notification.tool);
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, unread: false }));
      localStorage.setItem(userCacheKey(NOTIFICATIONS_KEY, user?.email), JSON.stringify(next));
      return next;
    });
    notify("All notifications marked as read.");
  };

  const addWalletMoney = (event) => {
    event.preventDefault();
    notify("Wallet recharge will be available after the payment API is connected.");
  };

  const toggleSubmenu = (event, item) => {
    if (item.children.length === 1) {
      navigatePanel(item.id, item.children[0][0]);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const compactSubmenu = window.innerHeight <= 420;
    const estimatedHeight = item.children.length * (compactSubmenu ? 48 : 58) + (compactSubmenu ? 38 : 52);
    const availableTop = Math.max(12, window.innerHeight - estimatedHeight - 12);
    const nextTop = Math.min(rect.top - 3, availableTop);
    const pointerSize = 13;
    setSubmenuTop(nextTop);
    setSubmenuPointerTop(rect.top + (rect.height / 2) - nextTop - (pointerSize / 2));
    setOpenMenu((current) => current === item.id ? null : item.id);
  };

  const createShipment = async (event) => {
    event.preventDefault();
    if (!newShipment.customer || !newShipment.phone || !newShipment.address || !newShipment.city || !/^[1-9]\d{5}$/.test(newShipment.pincode)) {
      notify("Complete the receiver details and enter a valid PIN code.");
      return;
    }
    if (newShipment.flow === "Forward" && !availablePaymentOptions.length) {
      notify("Shipment booking is temporarily disabled by the Pax administrator.");
      return;
    }
    try {
      const { qcEnabled, customQc, ...shipmentInput } = newShipment;
      const shipment = await createClientShipment({
        ...shipmentInput,
        ...(qcEnabled ? { customQc } : {}),
        paymentMode: newShipment.flow === "Reverse" ? "Pickup" : newShipment.flow === "Replacement" ? "REPL" : newShipment.payment,
        weight: Number(newShipment.weight),
        amount: Number(newShipment.amount) || 0,
      });
      const next = [shipment, ...shipments.filter((item) => item.id !== shipment.id)];
      setShipments(next);
      localStorage.setItem(userCacheKey(SHIPMENTS_KEY, user?.email), JSON.stringify(next));
      setShipmentModal(false);
      setNewShipment(createEmptyShipmentForm());
      notify(`${shipment.id} manifested with Delhivery waybill ${shipment.waybill}.`);
    } catch (error) {
      notify(error.message || "Shipment could not be created.");
    }
  };

  const submitTracking = (event) => {
    event.preventDefault();
    const normalized = trackId.trim().toUpperCase();
    if (!/^PAX-[A-Z0-9]{6,20}$/.test(normalized)) {
      notify("Enter a valid Pax shipment reference.");
      return;
    }
    const shipment = shipments.find((item) => item.id.toUpperCase() === normalized);
    setTrackResult(shipment || { error: "Shipment not found in your account." });
  };

  const calculateRate = async (event) => {
    event.preventDefault();
    const pickup = rateForm.pickup.trim();
    const delivery = rateForm.delivery.trim();
    const weight = Number(rateForm.weight);
    const validPin = (value) => /^[1-9]\d{5}$/.test(value);
    if (!validPin(pickup) || !validPin(delivery) || !Number.isFinite(weight) || weight <= 0) {
      setRateQuote({ error: "Enter two valid 6-digit PIN codes and a valid parcel weight." });
      return;
    }
    try {
      const mot = rateForm.speed === "express" ? "E" : "S";
      const [tat, shippingCost] = await Promise.all([
        getClientExpectedTat({ originPin: pickup, destinationPin: delivery, mot, pdt: "B2C" }),
        getClientShippingCost({
          md: mot,
          cgm: Math.ceil(weight * 1000),
          originPin: pickup,
          destinationPin: delivery,
          status: "Delivered",
          paymentType: rateForm.payment === "COD" ? "COD" : "Pre-paid",
        }),
      ]);
      if (!tat.serviceable || tat.tatDays === null) {
        setRateQuote({ error: tat.remark || "Delhivery could not provide an expected TAT for this lane." });
        return;
      }
      if (!Number.isFinite(shippingCost.estimatedAmount)) {
        setRateQuote({ error: "Delhivery did not return an estimated charge for this lane." });
        return;
      }
      const eta = `${tat.tatDays} ${tat.tatDays === 1 ? "day" : "days"}`;
      const services = [{
        name: `Delhivery ${shippingCost.modeOfTransport}`,
        eta,
        amount: shippingCost.estimatedAmount,
        tone: mot === "E" ? "express" : "standard",
      }];
      setRateQuote({ pickup, delivery, weight, payment: rateForm.payment, services, modeOfTransport: tat.modeOfTransport, expectedDeliveryDate: tat.expectedDeliveryDate });
    } catch (error) {
      setRateQuote({ error: error.message || "Delhivery shipping cost could not be loaded." });
    }
  };

  const calculateWeight = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(weightForm).map(([key, value]) => [key, Number(value)]));
    if (!Object.values(values).every((value) => Number.isFinite(value) && value > 0)) {
      setWeightResult({ error: "Enter valid actual weight, dimensions and divisor." });
      return;
    }
    const volumetric = (values.length * values.width * values.height) / values.divisor;
    setWeightResult({ actual: values.actual, volumetric, chargeable: Math.max(values.actual, volumetric) });
  };

  const checkServiceability = async (event) => {
    event.preventDefault();
    const pin = servicePin.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setServiceResult({ error: "Enter a valid 6-digit Indian PIN code." });
      return;
    }
    try {
      const result = serviceProductType === "Heavy"
        ? await getClientHeavyServiceability(pin)
        : await getClientServiceability(pin);
      setServiceResult({
        ...result,
        pin,
        region: result.stateCode || result.district || "Delhivery",
        standard: result.serviceable && controlState.settings.serviceability.standard,
        prepaid: result.prepaid && controlState.settings.paymentOptions.prepaid,
        cod: result.cod && controlState.settings.serviceability.cod && controlState.settings.paymentOptions.cod,
      });
    } catch (error) {
      setServiceResult({ error: error.message || "Delhivery serviceability could not be checked." });
    }
  };

  const generateShippingLabel = async (event) => {
    event.preventDefault();
    const shipment = shipments.find((item) => item.id === labelShipmentId);
    if (!shipment) {
      setGeneratedLabel({ error: "Select a valid shipment." });
      return;
    }
    const waybill = labelWaybill || (Array.isArray(shipment.waybills) ? shipment.waybills[0] : shipment.waybill);
    if (!waybill) {
      setGeneratedLabel({ error: "This shipment does not have a manifested Delhivery waybill." });
      return;
    }
    try {
      setGeneratedLabel({ loading: true });
      const label = await getClientShippingLabel(shipment.id, { waybill: String(waybill), pdf: labelPdf, pdfSize: labelPdfSize });
      setGeneratedLabel({ ...shipment, ...label, barcode: label.waybill });
    } catch (error) {
      setGeneratedLabel({ error: error.message || "Delhivery could not generate the shipping label." });
    }
  };

  const submitNdrAction = async (shipment, action) => {
    const waybill = String(shipment.waybills?.[0] || shipment.waybill || "");
    const requestKey = `${shipment.id}:${action}`;
    setNdrSubmitting(requestKey);
    try {
      const result = await submitClientNdrAction(shipment.id, { waybill, action });
      const next = shipments.map((item) => item.id === shipment.id ? result.shipment : item);
      setShipments(next);
      localStorage.setItem(userCacheKey(SHIPMENTS_KEY, user?.email), JSON.stringify(next));
      notify(`${action} submitted · UPL ${result.provider.uplId}.`);
    } catch (error) {
      notify(error.message || "The NDR action could not be submitted.");
    } finally {
      setNdrSubmitting("");
    }
  };

  const refreshNdrStatus = async (shipment, ndrAction) => {
    const requestKey = `${shipment.id}:status:${ndrAction.uplId}`;
    setNdrSubmitting(requestKey);
    try {
      const result = await getClientNdrStatus(shipment.id, ndrAction.uplId);
      const next = shipments.map((item) => item.id === shipment.id ? result.shipment : item);
      setShipments(next);
      localStorage.setItem(userCacheKey(SHIPMENTS_KEY, user?.email), JSON.stringify(next));
      notify(`UPL ${ndrAction.uplId} is ${result.provider.status}.`);
    } catch (error) {
      notify(error.message || "The NDR status could not be refreshed.");
    } finally {
      setNdrSubmitting("");
    }
  };

  const downloadShippingLabel = () => {
    if (!generatedLabel || generatedLabel.error || generatedLabel.loading) return;
    const link = document.createElement("a");
    if (generatedLabel.format === "pdf") {
      link.href = generatedLabel.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      const url = URL.createObjectURL(new Blob([JSON.stringify(generatedLabel.labelData, null, 2)], { type: "application/json;charset=utf-8" }));
      link.href = url;
      link.download = `${generatedLabel.id}-${generatedLabel.waybill}-shipping-label.json`;
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    link.click();
    notify(`${generatedLabel.id} ${generatedLabel.format === "pdf" ? "PDF label opened" : "label JSON downloaded"}.`);
  };

  const fetchShipmentDocument = async (event) => {
    event.preventDefault();
    const shipment = shipments.find((item) => item.id === labelShipmentId);
    const waybill = labelWaybill || (Array.isArray(shipment?.waybills) ? shipment.waybills[0] : shipment?.waybill);
    if (!shipment || !waybill) {
      setDownloadedDocument({ error: "Select a manifested shipment and waybill." });
      return;
    }
    try {
      setDownloadedDocument({ loading: true });
      const result = await getClientShipmentDocument(shipment.id, { waybill: String(waybill), documentType });
      setDownloadedDocument({ ...result, shipmentId: shipment.id });
    } catch (error) {
      setDownloadedDocument({ error: error.message || "Delhivery could not fetch this document." });
    }
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
    "7D": buildOverviewAnalytics(shipments, 7, "Last 7 days"),
    "30D": buildOverviewAnalytics(shipments, 30, "Last 30 days"),
    "90D": buildOverviewAnalytics(shipments, 90, "Last 90 days"),
  };
  const destinationAnalytics = Object.entries(shipments.reduce((result, shipment) => {
    const city = String(shipment.destination || "Unknown").split(",")[0];
    result[city] = result[city] || { total: 0, delivered: 0 };
    result[city].total += 1;
    if (shipment.status === "Delivered") result[city].delivered += 1;
    return result;
  }, {})).sort((a, b) => b[1].total - a[1].total);
  const activeLaneCount = destinationAnalytics.length;

  const renderOverview = () => {
    const analytics = overviewAnalytics[overviewRange];
    const chartPoints = analytics.bars.map((height, index) => `${Math.round((index / Math.max(analytics.bars.length - 1, 1)) * 640)},${190 - Math.round(height * 1.6)}`).join(" ");
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
          <div><span className="signal-live"><i></i> Live API data</span><strong>{shipments.length ? "Shipment records connected" : "Awaiting first shipment"}</strong></div>
          <div><small>ACTIVE LANES</small><strong>{activeLaneCount}</strong><span>Current destination cities</span></div>
          <div><small>AVG. DELIVERY</small><strong>{analytics.avgDelivery}</strong><span>Across {analytics.label.toLowerCase()}</span></div>
          <div><small>FIRST ATTEMPT</small><strong>{analytics.firstAttempt}</strong><span>Successful deliveries</span></div>
          <div><small>RTO RATE</small><strong>{analytics.rto}</strong><span>Return-to-origin share</span></div>
        </section>

        <section className="portal-kpis overview-kpis" aria-label="Shipment summary">
          <article className="kpi-card kpi-purple"><span className="kpi-icon"><Icon name="box" /></span><small>TOTAL SHIPMENTS</small><strong>{analytics.shipments}</strong><p><b>Live</b> for selected period</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-yellow"><span className="kpi-icon"><Icon name="route" /></span><small>IN TRANSIT</small><strong>{analytics.inTransit}</strong><p>Across {activeLaneCount} active lanes</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-green"><span className="kpi-icon"><Icon name="box" /></span><small>DELIVERED</small><strong>{analytics.delivered}</strong><p><b>{analytics.firstAttempt}</b> first-attempt success</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
          <article className="kpi-card kpi-coral"><span className="kpi-icon"><Icon name="wallet" /></span><small>COD AVAILABLE</small><strong>{analytics.codAvailable}</strong><p>{analytics.codOrders} COD orders</p><span className="kpi-sparkline"><i></i><i></i><i></i><i></i><i></i><i></i></span></article>
        </section>

        <section className="overview-finance-strip" aria-label="Commercial analytics">
          <article><span><Icon name="wallet" /></span><div><small>GROSS REVENUE</small><strong>{analytics.revenue}</strong></div><b>{analytics.growth}</b></article>
          <article><span><Icon name="insights" /></span><div><small>SHIPPING COST</small><strong>{analytics.cost}</strong></div><b className="is-neutral">{analytics.costShare}</b></article>
          <article><span><Icon name="box" /></span><div><small>AVG. ORDER VALUE</small><strong>{analytics.aov}</strong></div><b>{analytics.aovGrowth}</b></article>
          <article><span><Icon name="route" /></span><div><small>COD SHARE</small><strong>{analytics.codShare}</strong></div><b className="is-neutral">{analytics.codOrders} orders</b></article>
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
                <polygon className="area overview-area" points={`0,190 ${chartPoints} 640,190`} />
                <polyline className="line overview-line" points={chartPoints} fill="none" />
              </svg>
              <div className="chart-days">{analytics.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </div>
            <div className="overview-chart-summary"><span><small>PEAK VOLUME</small><strong>{analytics.peak}</strong></span><span><small>DAILY AVERAGE</small><strong>{analytics.dailyAverage}</strong></span><span><small>BEST LANE</small><strong>{analytics.bestLane}</strong></span></div>
          </article>
          <article className="portal-card status-card overview-status-card">
            <div className="portal-card-head"><div><small>LIVE STATUS</small><h2>Delivery mix</h2></div><button type="button" onClick={() => navigatePanel("shipments")}>View all</button></div>
            <div className="donut-row">
              <div className="donut"><div><strong>{analytics.shipments}</strong><span>Total</span></div></div>
              <div className="donut-legend">
                <span><i className="legend-green"></i><b>Delivered</b><em>{analytics.shipments ? Math.round((analytics.delivered / analytics.shipments) * 100) : 0}%</em></span>
                <span><i className="legend-purple"></i><b>In transit</b><em>{analytics.shipments ? Math.round((analytics.inTransit / analytics.shipments) * 100) : 0}%</em></span>
                <span><i className="legend-yellow"></i><b>Scheduled</b><em>{analytics.shipments ? Math.round((analytics.scheduled / analytics.shipments) * 100) : 0}%</em></span>
                <span><i className="legend-coral"></i><b>Attention</b><em>{analytics.shipments ? Math.round((analytics.attention / analytics.shipments) * 100) : 0}%</em></span>
              </div>
            </div>
            <div className="overview-delivery-note"><span>✓</span><div><strong>Live delivery mix</strong><small>Calculated only from shipments returned by the API.</small></div></div>
          </article>
        </section>

        <section className="overview-analytics-grid">
          <article className="portal-card overview-revenue-card">
            <div className="portal-card-head"><div><small>COMMERCIAL PERFORMANCE</small><h2>Revenue vs shipping cost</h2></div><button type="button" onClick={() => notify("Finance report prepared for export.")}>Export report ↗</button></div>
            <div className="overview-revenue-head"><div><small>NET CONTRIBUTION</small><strong>{analytics.contribution}</strong><span>{analytics.margin}</span></div><p>Calculated from the booked values returned for the selected period.</p></div>
            <div className="overview-bars">
              {analytics.bars.map((height, index) => <div key={`${overviewRange}-${index}`}><span style={{ height: `${height}%` }}><i style={{ height: `${Math.max(25, height * .55)}%` }}></i></span><small>{analytics.labels[index]}</small></div>)}
            </div>
            <div className="overview-bar-legend"><span><i></i> Revenue</span><span><i></i> Shipping cost</span></div>
          </article>

          <article className="portal-card overview-sla-card">
            <div className="portal-card-head"><div><small>SERVICE QUALITY</small><h2>SLA health</h2></div><span className="trend-pill">{analytics.shipments ? "Live" : "Awaiting data"}</span></div>
            <div className="overview-sla-score"><div className="sla-gauge" style={{ background: `conic-gradient(#3157c8 0 ${analytics.sla}%, #e9eef6 ${analytics.sla}%)` }}><span><strong>{analytics.sla}</strong><small>/100</small></span></div><div><strong>On-time performance</strong><p>Calculated for {analytics.label.toLowerCase()}.</p></div></div>
            <div className="overview-sla-list">
              <div><span>Pickup SLA</span><b>{analytics.pickupSla}%</b><i><em style={{ width: `${analytics.pickupSla}%` }}></em></i></div>
              <div><span>In-transit SLA</span><b>{analytics.transitSla}%</b><i><em style={{ width: `${analytics.transitSla}%` }}></em></i></div>
              <div><span>First attempt</span><b>{analytics.firstAttempt}</b><i><em style={{ width: analytics.firstAttempt }}></em></i></div>
              <div><span>NDR resolution</span><b>{analytics.ndrSla}%</b><i><em style={{ width: `${analytics.ndrSla}%` }}></em></i></div>
            </div>
          </article>
        </section>

        <section className="overview-operations-grid">
          <article className="portal-card overview-courier-card">
            <div className="portal-card-head"><div><small>PARTNER SCORECARD</small><h2>Courier performance</h2></div><button type="button" onClick={() => navigatePanel("insights", "insights-courier")}>Deep analysis →</button></div>
            <div className="overview-courier-table">
              <div className="is-heading"><span>Courier partner</span><span>Volume</span><span>On-time</span><span>Avg. TAT</span><span>Health</span></div>
              {enabledCouriers.length ? enabledCouriers.map((courier) => {
                const health = Number.parseFloat(courier.cells?.[2]) || 0;
                const name = courier.cells?.[0] || courier.id;
                return <div key={courier.id}><span><i>{name.slice(0, 2).toUpperCase()}</i><b>{name}</b></span><span>—</span><span>{courier.cells?.[2] || "—"}</span><span>—</span><span><i className="courier-health"><em style={{ width: `${health}%` }}></em></i></span></div>;
              }) : <div className="portal-tool-empty"><p>No courier performance records received.</p></div>}
            </div>
          </article>

          <article className="portal-card overview-insight-card">
            <div className="portal-card-head"><div><small>SMART INSIGHTS</small><h2>Needs your attention</h2></div><span className="overview-ai-pill">PAX SIGNAL</span></div>
            <div className="overview-insight-list">
              <button type="button" onClick={() => navigatePanel("exceptions", "exceptions-delayed")}><span className="is-warning"><Icon name="alert" /></span><div><strong>{analytics.attention} shipments need attention</strong><small>Exceptions and returns in the selected period</small></div><b>→</b></button>
              <button type="button" onClick={() => navigatePanel("finance", "finance-cod")}><span className="is-success"><Icon name="wallet" /></span><div><strong>{analytics.codAvailable} delivered COD value</strong><small>{analytics.codOrders} COD orders in live data</small></div><b>→</b></button>
              <button type="button" onClick={() => navigatePanel("insights", "insights-rto")}><span className="is-info"><Icon name="insights" /></span><div><strong>{analytics.rto} RTO rate</strong><small>Calculated from current shipment statuses</small></div><b>→</b></button>
            </div>
          </article>
        </section>

        <section className="overview-zone-section">
          <div className="overview-section-heading"><div><small>DESTINATION INTELLIGENCE</small><h2>Zone performance</h2></div><button type="button" onClick={() => navigatePanel("insights", "insights-zones")}>Explore all zones →</button></div>
          <div className="overview-zone-grid">
            {destinationAnalytics.length ? destinationAnalytics.slice(0, 4).map(([city, data], index) => <article className={`overview-zone-card ${["is-blue", "is-green", "is-purple", "is-amber"][index]}`} key={city}><span>{city.slice(0, 1)}</span><small>{city.toUpperCase()}</small><strong>{data.total ? Math.round((data.delivered / data.total) * 100) : 0}%</strong><p>Delivery success</p><div><b>{data.total} shipments</b><em>Live data</em></div></article>) : <article className="overview-zone-card is-blue"><span>—</span><small>NO DATA</small><strong>0%</strong><p>Delivery success</p><div><b>0 shipments</b><em>Awaiting API</em></div></article>}
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
        <article className="kpi-card kpi-purple"><span className="kpi-icon"><Icon name="box" /></span><small>READY TO SHIP</small><strong>{shipments.filter((item) => item.status === "Pickup scheduled").length}</strong><p>Awaiting pickup</p></article>
        <article className="kpi-card kpi-yellow"><span className="kpi-icon"><Icon name="route" /></span><small>IN MOVEMENT</small><strong>{shipments.filter((item) => ["In transit", "Out for delivery"].includes(item.status)).length}</strong><p>Live shipment records</p></article>
        <article className="kpi-card kpi-green"><span className="kpi-icon"><Icon name="insights" /></span><small>DELIVERY RATE</small><strong>{shipments.length ? `${Math.round((shipments.filter((item) => item.status === "Delivered").length / shipments.length) * 100)}%` : "0%"}</strong><p>Current account data</p></article>
        <article className="kpi-card kpi-coral"><span className="kpi-icon"><Icon name="alert" /></span><small>NEEDS ACTION</small><strong>{shipments.filter((item) => ["Exception", "RTO"].includes(item.status)).length}</strong><p>Exceptions and returns</p></article>
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
      <section className="section-title-row"><div><p>EXCEPTION DESK</p><h1>NDR management</h1><span>Submit an eligible re-attempt or pickup reschedule after reviewing the latest Delhivery scan.</span></div><span className="section-count-pill">{shipments.filter((item) => ["Exception", "NDR", "Cancelled"].includes(item.status) || item.ndrActions?.length).length} open cases</span></section>
      <p className="ndr-guidance">Delhivery recommends applying NDR actions after 9 PM. Pax refreshes the AWB first and verifies the current NSL code and attempt count before submission.</p>
      <section className="exception-grid">
        {shipments.filter((item) => ["Exception", "NDR", "Cancelled"].includes(item.status) || item.ndrActions?.length).length ? shipments.filter((item) => ["Exception", "NDR", "Cancelled"].includes(item.status) || item.ndrActions?.length).map((shipment) => (
          <article className="portal-card exception-card" key={shipment.id}>
            <div><span className="priority-dot priority-high"></span><small>attention required</small><b>{shipment.id}</b></div>
            <h2>{shipment.status}</h2><p>{shipment.customer} · {shipment.destination}</p>
            <div className="exception-meta"><span>Last update</span><strong>{shipment.date ? new Date(shipment.date).toLocaleString("en-IN") : "Not provided"}</strong></div>
            {shipment.ndrActions?.length ? <div className="ndr-history"><small>Latest UPL</small><strong>{shipment.ndrActions.at(-1).uplId}</strong><span>{shipment.ndrActions.at(-1).action} · {shipment.ndrActions.at(-1).status}</span>{shipment.ndrActions.at(-1).statusMessage ? <span>{shipment.ndrActions.at(-1).statusMessage}</span> : null}<button className="ndr-status-button" type="button" disabled={Boolean(ndrSubmitting)} onClick={() => refreshNdrStatus(shipment, shipment.ndrActions.at(-1))}>{ndrSubmitting === `${shipment.id}:status:${shipment.ndrActions.at(-1).uplId}` ? "Checking..." : "Check UPL status"}</button></div> : null}
            <div className="ndr-actions"><button type="button" disabled={Boolean(ndrSubmitting)} onClick={() => submitNdrAction(shipment, "RE-ATTEMPT")}>{ndrSubmitting === `${shipment.id}:RE-ATTEMPT` ? "Submitting..." : "Re-attempt"}</button><button type="button" disabled={Boolean(ndrSubmitting)} onClick={() => submitNdrAction(shipment, "PICKUP_RESCHEDULE")}>{ndrSubmitting === `${shipment.id}:PICKUP_RESCHEDULE` ? "Submitting..." : "Reschedule pickup"}</button></div>
          </article>
        )) : <article className="portal-card portal-tool-empty"><h2>No NDR shipments</h2><p>Eligible live Delhivery exceptions will appear here.</p></article>}
      </section>
    </>
  );

  const renderTracking = () => (
    <>
      <section className="section-title-row"><div><p>LIVE MOVEMENT</p><h1>Track a shipment</h1><span>Follow every milestone from pickup to delivery.</span></div></section>
      <section className="tracking-workspace">
        <form className="portal-card track-search-card" onSubmit={submitTracking}>
          <small>SHIPMENT REFERENCE</small><h2>Where is your parcel?</h2>
          <label><input value={trackId} onChange={(event) => setTrackId(event.target.value)} placeholder="PAX shipment reference" /><button type="submit"><Icon name="search" /> Track</button></label>
          <p>Only shipments belonging to your signed-in account are searchable here.</p>
        </form>
        <article className="portal-card tracking-result-card">
          <div className="tracking-result-head"><div><small>{trackResult?.id || "No shipment selected"}</small><h2>{trackResult?.error || trackResult?.status || "Enter a reference to load its status"}</h2></div>{trackResult?.status && <StatusBadge status={trackResult.status} />}</div>
          <div className="tracking-route-names"><span><small>FROM</small>{user.city || "Pickup location"}</span><i>→</i><span><small>TO</small>{trackResult?.destination || "Destination"}</span></div>
          <div className="tracking-timeline">
            <div className="is-done"><i>✓</i><span><b>Shipment booked</b><small>Reference created</small></span></div>
            <div><i></i><span><b>Picked up</b><small>Updated by operations</small></span></div>
            <div><i></i><span><b>In transit</b><small>Updated by operations</small></span></div>
            <div><i></i><span><b>Delivered</b><small>Final milestone</small></span></div>
          </div>
        </article>
      </section>
    </>
  );

  const renderFinance = () => (
    <>
      <section className="section-title-row"><div><p>MONEY MOVEMENT</p><h1>Finance</h1><span>Your wallet, COD settlements and invoices at a glance.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Statement export requires the billing API.")}>Download statement</button></section>
      <section className="finance-grid">
        <article className="finance-hero"><small>AVAILABLE WALLET BALANCE</small><strong>{walletBalanceLabel}</strong><span>Ready for shipping charges and adjustments</span><button type="button" onClick={() => setWalletModal(true)}>+ Add money</button></article>
        <article className="portal-card settlement-card"><small>COD SETTLEMENT</small><h2>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(shipments.filter((item) => item.payment === "COD" && item.status === "Delivered").reduce((sum, item) => sum + Number(item.amount || 0), 0))}</h2><p>Delivered COD value</p><div><span>Settlement schedule</span><b>From billing API</b></div><button type="button" onClick={() => notify("COD remittance requires the billing API.")}>Request remittance →</button></article>
        <article className="portal-card invoice-card"><div className="portal-card-head"><div><small>RECENT INVOICES</small><h2>Billing history</h2></div></div><div className="portal-tool-empty"><p>No invoice records received from the API.</p></div></article>
      </section>
    </>
  );

  const renderAudits = () => (
    <>
      <section className="section-title-row"><div><p>COMPLIANCE CENTRE</p><h1>Audits</h1><span>Keep shipment documents, COD records and account checks organised.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Audit export requires the compliance API.")}>Export audit report</button></section>
      <section className="audit-layout">
        <article className="portal-card audit-score-card"><small>WORKSPACE HEALTH</small><div className="audit-score"><strong>—</strong><span>/100</span></div><p>Connect the compliance API to calculate workspace health.</p><div className="audit-progress"><i style={{ width: 0 }}></i></div></article>
        <article className="portal-card audit-checklist">
          <div className="portal-card-head"><div><small>CHECKLIST</small><h2>Compliance status</h2></div></div>
          {[
            ["·", "KYC documents", "Awaiting compliance API", "warn"],
            ["·", "GST information", user.gstin ? "Provided by account" : "Not provided", "warn"],
            ["·", "COD reconciliation", "Awaiting billing API", "warn"],
            ["·", "Pickup address proof", "Awaiting compliance API", "warn"],
            ["·", "Invoice numbering", "Awaiting billing API", "warn"],
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
          ["wallet", "Rate calculator", "Estimate a route before booking", () => navigatePanel("utilities", "utilities-rate")],
          ["box", "Weight calculator", "Check volumetric chargeable weight", () => navigatePanel("utilities", "utilities-weight")],
          ["support", "Serviceability", "Confirm delivery PIN support", () => navigatePanel("utilities", "utilities-pincode")],
        ].map(([icon, title, copy, action]) => <button type="button" onClick={action} key={title}><span><Icon name={icon} /></span><strong>{title}</strong><small>{copy}</small><b>Open →</b></button>)}
      </section>
      <section className="tracking-workspace utility-tracker">
        <form className="portal-card track-search-card" onSubmit={submitTracking}>
          <small>SHIPMENT TRACKER</small><h2>Where is your parcel?</h2>
          <label><input value={trackId} onChange={(event) => setTrackId(event.target.value)} placeholder="PAX shipment reference" /><button type="submit"><Icon name="search" /> Track</button></label>
          <p>Search using one of the shipment references in your account.</p>
        </form>
        <article className="portal-card tracking-result-card">
          <div className="tracking-result-head"><div><small>{trackResult?.id || "No shipment selected"}</small><h2>{trackResult?.error || trackResult?.status || "Enter a reference to load its status"}</h2></div>{trackResult?.status && <StatusBadge status={trackResult.status} />}</div>
          <div className="tracking-route-names"><span><small>FROM</small>{user.city || "Pickup location"}</span><i>→</i><span><small>TO</small>{trackResult?.destination || "Destination"}</span></div>
          <div className="utility-track-steps"><span className="done">Booked</span><span className="done">Picked up</span><span className="current">In transit</span><span>Delivery</span></div>
        </article>
      </section>
    </>
  );

  const renderRateCalculator = () => (
    <>
      <section className="section-title-row"><div><p>SHIPPING RATE TOOL</p><h1>Rate calculator</h1><span>Compare indicative services without leaving your Pax workspace.</span></div></section>
      <section className="portal-tool-layout">
        <form className="portal-card portal-tool-form" onSubmit={calculateRate}>
          <div className="portal-card-head"><div><small>ROUTE &amp; PARCEL</small><h2>Calculate shipping rates</h2></div><span className="tool-live-badge">Live tool</span></div>
          <div className="portal-tool-fields two-column">
            <label>Pickup PIN<input value={rateForm.pickup} onChange={(event) => setRateForm({ ...rateForm, pickup: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="500029" /></label>
            <label>Delivery PIN<input value={rateForm.delivery} onChange={(event) => setRateForm({ ...rateForm, delivery: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="400001" /></label>
            <label>Chargeable weight (kg)<input value={rateForm.weight} onChange={(event) => setRateForm({ ...rateForm, weight: event.target.value })} type="number" min="0.1" step="0.1" /></label>
            <label>Preferred speed<select value={rateForm.speed} onChange={(event) => setRateForm({ ...rateForm, speed: event.target.value })}><option value="standard">Surface</option><option value="express">Express</option></select></label>
            <label className="span-two">Payment mode<select value={rateForm.payment} disabled={!availablePaymentOptions.length} onChange={(event) => setRateForm({ ...rateForm, payment: event.target.value })}>{availablePaymentOptions.length ? availablePaymentOptions.map((option) => <option key={option}>{option}</option>) : <option>Disabled by administrator</option>}</select></label>
          </div>
          <button className="portal-primary portal-tool-submit" type="submit"><Icon name="wallet" /> Calculate available rates</button>
          <p className="portal-tool-note">Indicative rates include route, weight and payment handling. Final courier allocation happens while booking.</p>
        </form>
        <article className="portal-card portal-tool-result" aria-live="polite">
          {!rateQuote && <div className="portal-tool-empty"><span><Icon name="route" /></span><h2>Your rate options appear here</h2><p>Enter the pickup, destination and parcel details to compare Standard and Express.</p></div>}
          {rateQuote?.error && <div className="portal-tool-empty is-error"><span>!</span><h2>Check the shipment details</h2><p>{rateQuote.error}</p></div>}
          {rateQuote && !rateQuote.error && <>
            <div className="tool-result-route"><span><small>PICKUP</small><strong>{rateQuote.pickup}</strong></span><i>→</i><span><small>DELIVERY</small><strong>{rateQuote.delivery}</strong></span></div>
            <div className="tool-result-meta"><span>{rateQuote.weight} kg</span><span>{rateQuote.payment}</span><span>{rateQuote.modeOfTransport}</span>{rateQuote.expectedDeliveryDate && <span>EDD {rateQuote.expectedDeliveryDate}</span>}</div>
            <div className="rate-option-list">
              {rateQuote.services.map((service) => <div className={`rate-option-row is-${service.tone}`} key={service.name}><span><Icon name={service.tone === "express" ? "route" : "box"} /></span><div><strong>{service.name}</strong><small>{service.eta} estimated delivery</small></div><b>₹{service.amount.toFixed(2)}</b><button type="button" onClick={openShipment}>Book</button></div>)}
            </div>
          </>}
        </article>
      </section>
    </>
  );

  const renderWeightCalculator = () => (
    <>
      <section className="section-title-row"><div><p>PARCEL WEIGHT TOOL</p><h1>Weight calculator</h1><span>Compare actual and volumetric weight inside the dashboard.</span></div></section>
      <section className="portal-tool-layout">
        <form className="portal-card portal-tool-form" onSubmit={calculateWeight}>
          <div className="portal-card-head"><div><small>PACKED PARCEL</small><h2>Find chargeable weight</h2></div><span className="tool-live-badge">L × W × H</span></div>
          <div className="portal-tool-fields two-column">
            <label>Actual weight (kg)<input value={weightForm.actual} onChange={(event) => setWeightForm({ ...weightForm, actual: event.target.value })} type="number" min="0.1" step="0.1" /></label>
            <label>Courier divisor<select value={weightForm.divisor} onChange={(event) => setWeightForm({ ...weightForm, divisor: event.target.value })}><option value="5000">5000 — air</option><option value="6000">6000 — selected services</option></select></label>
            <label>Length (cm)<input value={weightForm.length} onChange={(event) => setWeightForm({ ...weightForm, length: event.target.value })} type="number" min="1" step="0.1" /></label>
            <label>Width (cm)<input value={weightForm.width} onChange={(event) => setWeightForm({ ...weightForm, width: event.target.value })} type="number" min="1" step="0.1" /></label>
            <label className="span-two">Height (cm)<input value={weightForm.height} onChange={(event) => setWeightForm({ ...weightForm, height: event.target.value })} type="number" min="1" step="0.1" /></label>
          </div>
          <button className="portal-primary portal-tool-submit" type="submit"><Icon name="box" /> Calculate chargeable weight</button>
        </form>
        <article className="portal-card portal-tool-result" aria-live="polite">
          {!weightResult && <div className="portal-tool-empty"><span><Icon name="box" /></span><h2>Measure the packed parcel</h2><p>The higher of actual and volumetric weight becomes chargeable.</p></div>}
          {weightResult?.error && <div className="portal-tool-empty is-error"><span>!</span><h2>Check the measurements</h2><p>{weightResult.error}</p></div>}
          {weightResult && !weightResult.error && <div className="weight-result-panel">
            <div><small>ACTUAL</small><strong>{weightResult.actual.toFixed(2)} kg</strong></div>
            <div><small>VOLUMETRIC</small><strong>{weightResult.volumetric.toFixed(2)} kg</strong></div>
            <div className="is-chargeable"><small>CHARGEABLE WEIGHT</small><strong>{weightResult.chargeable.toFixed(2)} kg</strong><span>{weightResult.chargeable === weightResult.actual ? "Actual weight applies" : "Volumetric weight applies"}</span></div>
            <button className="portal-primary" type="button" onClick={() => { setRateForm((current) => ({ ...current, weight: String(Math.ceil(weightResult.chargeable * 2) / 2) })); navigatePanel("utilities", "utilities-rate"); }}>Use in rate calculator <Icon name="arrow" /></button>
          </div>}
        </article>
      </section>
    </>
  );

  const renderPincodeServiceability = () => (
    <>
      <section className="section-title-row"><div><p>DELIVERY COVERAGE</p><h1>Pincode serviceability</h1><span>Check delivery speed and COD support before creating a shipment.</span></div></section>
      <section className="portal-tool-layout">
        <form className="portal-card portal-tool-form pincode-tool-form" onSubmit={checkServiceability}>
          <div className="portal-card-head"><div><small>DESTINATION CHECK</small><h2>Where are you shipping?</h2></div><span className="tool-live-badge">India</span></div>
          <div className="portal-tool-fields"><label>Product type<select value={serviceProductType} onChange={(event) => { setServiceProductType(event.target.value); setServiceResult(null); }}><option>Parcel</option><option>Heavy</option></select></label><label>Delivery PIN code<input value={servicePin} onChange={(event) => setServicePin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="560001" /></label></div>
          <button className="portal-primary portal-tool-submit" type="submit"><Icon name="search" /> Check serviceability</button>
        </form>
        <article className="portal-card portal-tool-result" aria-live="polite">
          {!serviceResult && <div className="portal-tool-empty"><span><Icon name="home" /></span><h2>Coverage details appear here</h2><p>Check delivery, prepaid and COD availability for any valid PIN.</p></div>}
          {serviceResult?.error && <div className="portal-tool-empty is-error"><span>!</span><h2>Coverage unavailable</h2><p>{serviceResult.error}</p></div>}
          {serviceResult && !serviceResult.error && <div className="serviceability-result">
            <div className="serviceability-head"><span>{serviceResult.serviceable ? "✓" : "!"}</span><div><small>{serviceResult.region.toUpperCase()}</small><h2>{serviceResult.pin} is {serviceResult.serviceable ? "serviceable" : serviceResult.embargoed ? "temporarily embargoed" : "not serviceable"}</h2><p>{serviceResult.serviceable ? "Live coverage confirmed by Delhivery." : serviceResult.remark || "No Delhivery delivery code was returned."}</p></div></div>
            {[["Standard delivery", serviceResult.standard], ["Prepaid delivery", serviceResult.prepaid], ["Cash on delivery", serviceResult.cod]].map(([label, available]) => <div className="serviceability-row" key={label}><span>{label}</span><b className={available ? "is-available" : "is-unavailable"}>{available ? "Available" : "Unavailable"}</b></div>)}
            {serviceResult.serviceable && <button className="portal-primary" type="button" onClick={openShipment}>Create shipment <Icon name="arrow" /></button>}
          </div>}
        </article>
      </section>
    </>
  );

  const renderLabelGenerator = () => (
    <>
      <section className="section-title-row"><div><p>SHIPPING DOCUMENT</p><h1>Label generator</h1><span>Select a booked shipment and generate its dispatch label.</span></div></section>
      <section className="portal-tool-layout">
        <form className="portal-card portal-tool-form" onSubmit={generateShippingLabel}>
          <div className="portal-card-head"><div><small>SELECT ORDER</small><h2>Prepare shipping label</h2></div><span className="tool-live-badge">Delhivery</span></div>
          <div className="portal-tool-fields">
            <label>Shipment<select value={labelShipmentId} onChange={(event) => { const nextId = event.target.value; const nextShipment = shipments.find((shipment) => shipment.id === nextId); setLabelShipmentId(nextId); setLabelWaybill(String(nextShipment?.waybills?.[0] || nextShipment?.waybill || "")); setGeneratedLabel(null); setDownloadedDocument(null); }}>{shipments.map((shipment) => <option value={shipment.id} key={shipment.id}>{shipment.id} — {shipment.customer}</option>)}</select></label>
            <label>Waybill<select value={labelWaybill} onChange={(event) => { setLabelWaybill(event.target.value); setGeneratedLabel(null); setDownloadedDocument(null); }}>{labelWaybills.map((waybill) => <option value={waybill} key={waybill}>{waybill}</option>)}</select></label>
            <label>Output<select value={labelPdf ? "pdf" : "json"} onChange={(event) => { setLabelPdf(event.target.value === "pdf"); setGeneratedLabel(null); }}><option value="pdf">PDF download</option><option value="json">Custom label JSON</option></select></label>
            <label>PDF size<select value={labelPdfSize} disabled={!labelPdf} onChange={(event) => { setLabelPdfSize(event.target.value); setGeneratedLabel(null); }}><option value="A4">A4 (8 × 11)</option><option value="4R">4R (4 × 6)</option></select></label>
          </div>
          <button className="portal-primary portal-tool-submit" type="submit" disabled={generatedLabel?.loading}><Icon name="audit" /> {generatedLabel?.loading ? "Generating..." : "Generate label"}</button>
        </form>
        <article className="portal-card portal-tool-result label-result-card" aria-live="polite">
          {!generatedLabel && <div className="portal-tool-empty"><span><Icon name="audit" /></span><h2>Your shipping label</h2><p>Choose a manifested order, PDF size and output format.</p></div>}
          {generatedLabel?.loading && <div className="portal-tool-empty"><span><Icon name="refresh" /></span><h2>Generating label</h2><p>Waiting for Delhivery to prepare the document.</p></div>}
          {generatedLabel?.error && <div className="portal-tool-empty is-error"><span>!</span><h2>Label unavailable</h2><p>{generatedLabel.error}</p></div>}
          {generatedLabel && !generatedLabel.error && !generatedLabel.loading && <div className="shipping-label-preview">
            <div className="shipping-label-head"><strong>PAX</strong><span>{generatedLabel.format.toUpperCase()} · {generatedLabel.pdfSize}</span></div>
            <small>SHIP TO</small><h2>{generatedLabel.customer}</h2><p>{generatedLabel.destination}</p>
            <div className="shipping-label-meta"><span><small>SHIPMENT</small><b>{generatedLabel.id}</b></span><span><small>PAYMENT</small><b>{generatedLabel.payment}</b></span></div>
            <div className="shipping-label-bars" aria-label={`Barcode ${generatedLabel.barcode}`}></div><b>{generatedLabel.barcode}</b>
            <button className="portal-primary" type="button" onClick={downloadShippingLabel}>{generatedLabel.format === "pdf" ? "Open PDF label" : "Download label JSON"} <Icon name="arrow" /></button>
          </div>}
        </article>
      </section>
      <section className="portal-tool-layout document-download-tool">
        <form className="portal-card portal-tool-form" onSubmit={fetchShipmentDocument}>
          <div className="portal-card-head"><div><small>DELIVERY EVIDENCE</small><h2>Download order document</h2></div><span className="tool-live-badge">Secure</span></div>
          <p className="document-tool-copy">Fetch documents for the selected shipment and waybill. Availability depends on the shipment lifecycle and Delhivery retention.</p>
          <div className="portal-tool-fields">
            <label>Document type<select value={documentType} onChange={(event) => { setDocumentType(event.target.value); setDownloadedDocument(null); }}><option value="EPOD">Electronic proof of delivery (EPOD)</option><option value="SIGNATURE_URL">Consignee signature</option><option value="RVP_QC_IMAGE">Reverse pickup QC image</option><option value="SELLER_RETURN_IMAGE">Seller return image</option></select></label>
            <label>Selected waybill<input value={labelWaybill} readOnly /></label>
          </div>
          <button className="portal-primary portal-tool-submit" type="submit" disabled={downloadedDocument?.loading}><Icon name="audit" /> {downloadedDocument?.loading ? "Fetching..." : "Fetch document"}</button>
        </form>
        <article className="portal-card portal-tool-result" aria-live="polite">
          {!downloadedDocument && <div className="portal-tool-empty"><span><Icon name="audit" /></span><h2>Order documents</h2><p>Choose a document type to retrieve its secure Delhivery link.</p></div>}
          {downloadedDocument?.loading && <div className="portal-tool-empty"><span><Icon name="refresh" /></span><h2>Fetching document</h2><p>Waiting for Delhivery to locate the requested file.</p></div>}
          {downloadedDocument?.error && <div className="portal-tool-empty is-error"><span>!</span><h2>Document unavailable</h2><p>{downloadedDocument.error}</p></div>}
          {downloadedDocument && !downloadedDocument.error && !downloadedDocument.loading && <div className="shipment-document-result">
            <small>{downloadedDocument.documentType.replaceAll("_", " ")}</small>
            <h2>{downloadedDocument.documentCount} {downloadedDocument.documentCount === 1 ? "document" : "documents"} available</h2>
            <p>{downloadedDocument.shipmentId} · {downloadedDocument.waybill}</p>
            <div>{downloadedDocument.documents.map((item) => <a className="portal-primary" href={item.downloadUrl} target="_blank" rel="noopener noreferrer" key={item.downloadUrl}>Open document {item.index} <Icon name="arrow" /></a>)}</div>
          </div>}
        </article>
      </section>
    </>
  );

  const renderInsights = () => (
    <>
      <section className="section-title-row"><div><p>SELLER ANALYTICS</p><h1>Insights</h1><span>Use route, payment and delivery patterns to plan better dispatches.</span></div><button className="portal-secondary" type="button" onClick={() => notify("Insights date range refreshed.")}>Last 30 days ▾</button></section>
      <section className="insight-layout">
        <article className="portal-card insight-bars">
          <div className="portal-card-head"><div><small>TOP DESTINATIONS</small><h2>Shipment volume by city</h2></div><span className="trend-pill">Live</span></div>
          {destinationAnalytics.length ? destinationAnalytics.slice(0, 5).map(([city, data]) => <div className="insight-bar-row" key={city}><span>{city}</span><div><i style={{ width: `${Math.round((data.total / destinationAnalytics[0][1].total) * 100)}%` }}></i></div><strong>{data.total}</strong></div>) : <div className="portal-tool-empty"><p>No destination data received.</p></div>}
        </article>
        <article className="portal-card insight-summary">
          <small>ORDER QUALITY</small><h2>Delivery performance</h2>
          <div><strong>{overviewAnalytics["30D"].firstAttempt}</strong><span>Delivered successfully</span></div>
          <ul><li><span>Average delivery</span><b>—</b></li><li><span>RTO rate</span><b>{overviewAnalytics["30D"].rto}</b></li><li><span>COD share</span><b>{overviewAnalytics["30D"].codShare}</b></li><li><span>Average order value</span><b>{overviewAnalytics["30D"].aov}</b></li></ul>
        </article>
      </section>
    </>
  );

  const renderChannels = () => (
    <>
      <section className="section-title-row"><div><p>CONNECTED COMMERCE</p><h1>Channels</h1><span>Bring store orders into the Pax dispatch workflow.</span></div><button className="portal-primary" type="button" onClick={() => notify("Channel connection wizard opened.")}><Icon name="plus" /> Connect store</button></section>
      <section className="channel-grid">
        {[
          ["SH", "Shopify", "Not connected", "Connect with store credentials", false],
          ["WC", "WooCommerce", "Not connected", "Connect with store URL", false],
          ["AZ", "Amazon", "Not connected", "Import marketplace orders", false],
          ["CS", "CSV orders", "Not connected", "Upload requires order import API", false],
        ].map(([code, title, status, copy, connected]) => <article className="portal-card channel-card" key={title}><div className={`channel-logo channel-${code.toLowerCase()}`}>{code}</div><span className={connected ? "channel-status connected" : "channel-status"}><i></i>{status}</span><h2>{title}</h2><p>{copy}</p><button type="button" onClick={() => notify(`${title} ${connected ? "settings opened" : "connection started"}.`)}>{connected ? "Manage" : "Connect"} →</button></article>)}
      </section>
    </>
  );

  const renderSupport = () => (
    <>
      <section className="section-title-row"><div><p>WE’RE HERE TO HELP</p><h1>Support desk</h1><span>Raise a ticket or talk to the local Pax team.</span></div></section>
      <section className="support-grid">
        <form className="portal-card support-form" onSubmit={(event) => { event.preventDefault(); if (!ticket.subject || !ticket.message) { notify("Add a subject and message."); return; } notify("Ticket submission requires the support API."); }}>
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

  const submitPickupRequest = async (event) => {
    event.preventDefault();
    if (!readyPickupPackageCount) {
      notify("Manifest and pack at least one forward shipment before requesting pickup.");
      return;
    }
    setPickupSubmitting(true);
    try {
      const created = await createClientPickupRequest(pickupForm);
      setPickupRequests((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setShipments((current) => current.map((shipment) => String(shipment.status).toLowerCase() === "manifested"
        && !["pickup", "repl"].includes(String(shipment.payment).toLowerCase())
        ? { ...shipment, status: "Pickup scheduled", pickupRequestId: created.id }
        : shipment));
      notify(`Pickup ${created.id} scheduled with Delhivery.`);
    } catch (error) {
      notify(`Pickup was not scheduled: ${error.message}`);
    } finally {
      setPickupSubmitting(false);
    }
  };

  const renderPickupRequests = () => (
    <>
      <section className="section-title-row"><div><p>PICKUP REQUESTS</p><h1>Schedule warehouse pickup</h1><span>Raise one request for all packed forward shipments at the registered Delhivery warehouse.</span></div></section>
      <section className="feature-workspace-grid">
        <form className="portal-card portal-tool-form" onSubmit={submitPickupRequest}>
          <div className="portal-card-head"><div><small>READY FOR HANDOVER</small><h2>{readyPickupPackageCount} packages</h2></div><StatusBadge status={readyPickupPackageCount ? "Manifested" : "Pending manifestation"} /></div>
          <p>Reverse-pickup and replacement shipments are excluded because Delhivery schedules those collections automatically.</p>
          <label>Pickup date<input type="date" min={indiaDateAfter(0)} max={indiaDateAfter(7)} value={pickupForm.pickupDate} onChange={(event) => setPickupForm({ ...pickupForm, pickupDate: event.target.value })} required /></label>
          <label>Pickup time<input type="time" step="1" value={pickupForm.pickupTime} onChange={(event) => setPickupForm({ ...pickupForm, pickupTime: event.target.value })} required /></label>
          <label>Registered warehouse<select value={pickupForm.pickupLocation} onChange={(event) => setPickupForm({ ...pickupForm, pickupLocation: event.target.value })}><option value="">Default registered warehouse</option>{warehouses.filter((warehouse) => !warehouse.isDefault).map((warehouse) => <option value={warehouse.name} key={warehouse.name}>{warehouse.name}</option>)}</select></label>
          <label>Expected package count<input type="number" min="1" max="10000" value={pickupForm.expectedPackageCount} onChange={(event) => setPickupForm({ ...pickupForm, expectedPackageCount: event.target.value })} required /></label>
          <button className="portal-primary" type="submit" disabled={pickupSubmitting || !readyPickupPackageCount}>{pickupSubmitting ? "Scheduling…" : "Create pickup request"}</button>
        </form>
        <article className="portal-card feature-activity-card">
          <div className="portal-card-head"><div><small>WAREHOUSE REQUESTS</small><h2>Pickup history</h2></div><span className="trend-pill">Delhivery</span></div>
          {pickupRequests.length ? pickupRequests.map((pickup) => (
            <div className="feature-activity-row" key={pickup.id}>
              <span className="is-complete">✓</span>
              <div><strong>{pickup.pickupDate} · {pickup.pickupTime}</strong><small>{pickup.expectedPackageCount} expected · {pickup.status}</small></div>
              <StatusBadge status={pickup.status} />
            </div>
          )) : <div className="portal-tool-empty"><span><Icon name="home" /></span><h2>No pickup requests yet</h2><p>Requests created through Pax will appear here.</p></div>}
        </article>
      </section>
    </>
  );

  const renderWarehouseAddresses = () => (
    <>
      <section className="section-title-row"><div><p>ORIGIN SETTINGS</p><h1>Pickup addresses</h1><span>Use the warehouse name exactly as registered with Delhivery when creating shipments and pickups.</span></div></section>
      <section className="feature-function-grid">
        {warehouses.length ? warehouses.map((warehouse, index) => <button type="button" key={warehouse.name} onClick={() => notify(`${warehouse.name} is registered with Delhivery.`)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{warehouse.name}</strong><small>{warehouse.isDefault ? "Default pickup location" : "Available pickup location"}</small></div><b>✓</b></button>) : <div className="portal-tool-empty"><span><Icon name="home" /></span><h2>No registered warehouse available</h2><p>Ask a Pax administrator to register a Delhivery pickup location.</p></div>}
      </section>
    </>
  );

  const runFeatureAction = (toolId, label) => {
    if (toolId === "shipments-create") {
      openShipment();
      return;
    }
    if (toolId === "utilities-rate") {
      navigatePanel("utilities", "utilities-rate");
      return;
    }
    if (toolId === "utilities-weight") {
      navigatePanel("utilities", "utilities-weight");
      return;
    }
    if (toolId === "shipments-track") {
      setTrackId("");
      setTrackResult(null);
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
    const [eyebrow, title, copy] = details;
    const features = [
      `${shipments.length} live shipments`,
      `${enabledCouriers.length} connected couriers`,
      "API-backed workflow",
      "No sample records",
    ];
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
    "dashboard-pickups": renderPickupRequests,
    "shipments-all": renderShipments,
    "shipments-track": renderTracking,
    "shipments-pickups": renderPickupRequests,
    "exceptions-ndr": renderExceptions,
    "finance-cod": renderFinance,
    "audits-weight": renderAudits,
    "utilities-rate": renderRateCalculator,
    "utilities-weight": renderWeightCalculator,
    "utilities-pincode": renderPincodeServiceability,
    "utilities-labels": renderLabelGenerator,
    "insights-shipments": renderInsights,
    "channels-connected": renderChannels,
    "workspace-company": renderWorkspace,
    "workspace-pickups": renderWarehouseAddresses,
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
          <div
            className="portal-submenu"
            style={{ top: `${submenuTop}px`, "--submenu-pointer-top": `${submenuPointerTop}px` }}
            role="menu"
            aria-label={`${openNavItem.label} options`}
          >
            <div className="portal-submenu-content">
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
            <div className="portal-notification-menu-wrap" ref={notificationMenuRef}>
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
            <div className="portal-wallet-menu-wrap" ref={walletMenuRef}>
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
            <div className="portal-account-menu-wrap" ref={accountMenuRef}>
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
              <label>State<input value={newShipment.state} onChange={(event) => setNewShipment({ ...newShipment, state: event.target.value })} placeholder="Destination state" /></label>
              <label>PIN code *<input value={newShipment.pincode} onChange={(event) => setNewShipment({ ...newShipment, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="6-digit PIN" /></label>
              <label>Weight (kg)<input value={newShipment.weight} onChange={(event) => setNewShipment({ ...newShipment, weight: event.target.value })} type="number" min=".1" step=".1" /></label>
              <label>Product type<select value={newShipment.productType} onChange={(event) => setNewShipment({ ...newShipment, productType: event.target.value })}><option>Parcel</option><option>Heavy</option></select></label>
              <label>Shipment flow<select value={newShipment.flow} onChange={(event) => setNewShipment({ ...newShipment, flow: event.target.value, productType: event.target.value === "Forward" ? newShipment.productType : "Parcel", ...(event.target.value === "Reverse" ? {} : { qcEnabled: false, customQc: [] }) })}><option>Forward</option><option>Reverse</option><option>Replacement</option></select></label>
              <label>Pickup warehouse<select value={newShipment.pickupLocation} onChange={(event) => setNewShipment({ ...newShipment, pickupLocation: event.target.value })}><option value="">Default registered warehouse</option>{warehouses.filter((warehouse) => !warehouse.isDefault).map((warehouse) => <option value={warehouse.name} key={warehouse.name}>{warehouse.name}</option>)}</select></label>
              {newShipment.flow === "Forward" && <label>Payment<select value={newShipment.payment} disabled={!availablePaymentOptions.length} onChange={(event) => setNewShipment({ ...newShipment, payment: event.target.value })}>{availablePaymentOptions.length ? availablePaymentOptions.map((option) => <option key={option}>{option}</option>) : <option>Disabled by administrator</option>}</select></label>}
              <label>Shipping mode<select value={newShipment.shippingMode} onChange={(event) => setNewShipment({ ...newShipment, shippingMode: event.target.value })}><option>Surface</option><option>Express</option></select></label>
              <label>Transport speed<select value={newShipment.transportSpeed} onChange={(event) => setNewShipment({ ...newShipment, transportSpeed: event.target.value })}><option value="D">Standard</option><option value="F">Next Day Delivery</option></select></label>
              <label className="span-two">Product description<input value={newShipment.productsDescription} onChange={(event) => setNewShipment({ ...newShipment, productsDescription: event.target.value })} placeholder="Items packed in this shipment" /></label>
              <label>Quantity<input value={newShipment.quantity} onChange={(event) => setNewShipment({ ...newShipment, quantity: event.target.value.replace(/\D/g, "") })} inputMode="numeric" /></label>
              <label className="span-two">Order value (₹)<input value={newShipment.amount} onChange={(event) => setNewShipment({ ...newShipment, amount: event.target.value })} type="number" min="0" placeholder="Optional" /></label>
              {Number(newShipment.amount) >= 50000 && <label className="span-two">E-waybill number *<input value={newShipment.ewbn} onChange={(event) => setNewShipment({ ...newShipment, ewbn: event.target.value })} required /></label>}
              {newShipment.flow !== "Forward" && <><label className="span-two">Return address<textarea value={newShipment.returnAddress} onChange={(event) => setNewShipment({ ...newShipment, returnAddress: event.target.value })} rows="2" placeholder="Optional; registered warehouse is used if blank" /></label><label>Return city<input value={newShipment.returnCity} onChange={(event) => setNewShipment({ ...newShipment, returnCity: event.target.value })} /></label><label>Return state<input value={newShipment.returnState} onChange={(event) => setNewShipment({ ...newShipment, returnState: event.target.value })} /></label><label>Return PIN<input value={newShipment.returnPincode} onChange={(event) => setNewShipment({ ...newShipment, returnPincode: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" /></label></>}
              {newShipment.flow === "Reverse" && <label className="rvp-qc-toggle span-two"><input type="checkbox" checked={newShipment.qcEnabled} onChange={(event) => setNewShipment({ ...newShipment, qcEnabled: event.target.checked, customQc: event.target.checked && !newShipment.customQc.length ? [createEmptyQcItem()] : newShipment.customQc })} /> Perform RVP QC 3.0 at the consignee's doorstep</label>}
              {newShipment.flow === "Reverse" && newShipment.qcEnabled && <RvpQcEditor items={newShipment.customQc} onChange={(customQc) => setNewShipment({ ...newShipment, customQc })} />}
            </div>
            <div className="modal-actions"><button className="portal-secondary" type="button" onClick={() => setShipmentModal(false)}>Cancel</button><button className="portal-primary" type="submit">Validate & create order <Icon name="arrow" /></button></div>
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
            <p className="wallet-secure-note"><span>i</span> No balance changes are made until the payment gateway API is connected.</p>
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
