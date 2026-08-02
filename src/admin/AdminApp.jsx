import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  completeAdminPickupRequest,
  createAdminWarehouse,
  fetchDelhiverySingleWaybill,
  fetchDelhiveryWaybills,
  getAdminExpectedTat,
  getAdminHeavyServiceability,
  getAdminServiceability,
  getAdminShippingCost,
  getAdminDashboard,
  getDelhiveryWaybills,
  hasAdminToken,
  loginAdmin,
  logoutAdmin,
  saveAdminConfiguration,
  setCustomerAccess,
  setShipmentStatus,
  submitAdminNdrAction,
  updateAdminWarehouse,
} from "../services/adminApi.js";
import { ENABLE_PREVIEW_MODE } from "../config.js";
import { cacheControlState, DEFAULT_CONTROL_STATE, readControlState, subscribeToLocalControl, subscribeToRemoteUpdates, writeControlState } from "../services/sharedControl.js";

const PREVIEW_SESSION_KEY = "pax-admin-preview-session";
const CLIENT_USERS_KEY = "pax-demo-users";
const CLIENT_SHIPMENTS_KEY = "pax-demo-shipments";

const navigation = [
  { id: "overview", label: "Dashboard", icon: "grid" },
  { id: "shipments", label: "Orders", icon: "box", badge: true },
  { id: "operations", label: "Operations", icon: "support", children: [["ndr", "NDR"], ["rto", "RTO"]] },
  { id: "accounts", label: "Accounts", icon: "users", children: [["customers", "Users Management"], ["plans", "Plan Management"]] },
  { id: "shipping", label: "Shipping Management", icon: "truck", children: [["couriers", "Couriers"], ["credentials", "Courier Credentials"], ["providers", "Service Providers"], ["serviceability", "Serviceability"], ["warehouses", "Pickup Warehouses"], ["waybills", "Waybill Inventory"], ["pricing-b2b", "B2B Pricing"], ["pricing-b2c", "B2C Pricing"]] },
  { id: "billing", label: "Billing", icon: "wallet", children: [["invoices", "Invoices"], ["billing-preferences", "Billing Preferences"], ["cod", "COD Remittance"], ["wallet", "Wallet"]] },
  { id: "reconciliation", label: "Reconciliation", icon: "scale", children: [["weight", "Weight Discrepancies"], ["disputes", "Dispute Management"]] },
  { id: "tools-menu", label: "Tools", icon: "tools", children: [["rate", "Rate Calculator"], ["rate-terms", "Rate Calculator Terms"], ["tracking", "Order Tracking"], ["api", "API Integration"], ["about", "About Us Page"], ["support", "Support"]] },
  { id: "settings-menu", label: "Settings", icon: "settings", children: [["payment-options", "Payment Options"], ["password", "Change Password"], ["developer", "Developer"]] },
];

const statusOptions = ["Pending manifestation", "Manifested", "Pickup scheduled", "In transit", "Out for delivery", "Delivered", "Exception", "RTO"];

const pageTitles = {
  overview: ["Admin dashboard", "Monitor orders, sellers, revenue and delivery health across the Pax network."],
  shipments: ["Orders", "Search every order and update the shipment status visible to customers."],
  ndr: ["NDR management", "Resolve non-delivery reports before they turn into returns."],
  rto: ["RTO orders", "Review return-to-origin movement and customer impact."],
  customers: ["Users management", "Manage customer accounts, verification and platform access."],
  plans: ["Plan management", "Configure seller plans, prices and active benefits."],
  couriers: ["Couriers", "Manage courier partners, service state and delivery performance."],
  credentials: ["Courier credentials", "Review configured courier connections without exposing secrets."],
  providers: ["Service providers", "Control logistics providers available to the booking engine."],
  serviceability: ["Serviceability", "Check delivery and COD coverage for an Indian PIN code."],
  waybills: ["Waybill inventory", "Fetch Delhivery B2C waybills in advance and monitor the stored inventory."],
  warehouses: ["Pickup warehouses", "Register and update exact case-sensitive Delhivery warehouse details."],
  "pricing-b2b": ["B2B pricing", "Manage business shipment slabs and freight rates."],
  "pricing-b2c": ["B2C pricing", "Manage parcel pricing by zone and weight slab."],
  invoices: ["Invoices", "Review platform invoices, due dates and payment state."],
  "billing-preferences": ["Billing preferences", "Configure invoice cycle, tax and settlement behaviour."],
  cod: ["COD remittance", "Monitor collected cash and seller remittance batches."],
  wallet: ["Wallet", "Review platform credits, debits and manual adjustments."],
  weight: ["Weight discrepancies", "Audit declared and courier-measured shipment weight."],
  disputes: ["Dispute management", "Resolve open billing and weight disputes."],
  rate: ["Rate calculator", "Estimate shipping charges using Pax pricing rules."],
  "rate-terms": ["Rate calculator terms", "Manage the notes and conditions shown with rate estimates."],
  tracking: ["Order tracking", "Find an order and inspect its customer-visible milestone."],
  api: ["API integration", "Review backend endpoints and connection health."],
  about: ["About Us page", "Edit the company content shown on the customer website."],
  support: ["Support", "Triage customer tickets and shipment issues."],
  "payment-options": ["Payment options", "Control payment methods available during booking and recharge."],
  password: ["Change password", "Update the current administrator password."],
  developer: ["Developer settings", "Review environment and webhook configuration."],
};

const managementPages = {
  plans: { action: "Add plan", columns: ["Plan", "Monthly fee", "Shipment limit", "Status"] },
  couriers: { action: "Add courier", columns: ["Courier", "Service", "Delivery rate", "Status"] },
  credentials: { action: "Connect courier", columns: ["Connection", "Account", "Last verified", "Status"] },
  providers: { action: "Add provider", columns: ["Provider", "Type", "Coverage", "Status"] },
  "pricing-b2b": { action: "Add rate slab", columns: ["Zone", "Weight slab", "Base freight", "Status"] },
  "pricing-b2c": { action: "Add rate slab", columns: ["Zone", "Weight slab", "Base rate", "Status"] },
  invoices: { action: "Export invoices", actionType: "export", columns: ["Invoice", "Customer", "Amount", "Status"] },
  cod: { action: "Create remittance", columns: ["Batch", "Seller", "Collected", "Status"] },
  wallet: { action: "Add adjustment", columns: ["Transaction", "Account", "Amount", "Status"] },
  weight: { action: "Export report", actionType: "export", columns: ["Shipment", "Declared", "Measured", "Status"] },
  disputes: { action: "Create dispute", columns: ["Dispute", "Shipment", "Amount at risk", "Status"] },
  support: { action: "Raise ticket", columns: ["Ticket", "Subject", "Owner", "Status"] },
};

const managementStatusOptions = ["Active", "Review", "Pending", "Paid", "Due", "Processed", "Credit", "Debit", "Open", "Resolved", "Disabled"];

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function buildPreviewDashboard() {
  const cachedShipments = safeParse(localStorage.getItem(CLIENT_SHIPMENTS_KEY), []);
  const cachedUsers = safeParse(localStorage.getItem(CLIENT_USERS_KEY), []);
  const shipments = Array.isArray(cachedShipments) ? cachedShipments : [];
  const customers = Array.isArray(cachedUsers) && cachedUsers.length
    ? cachedUsers.map((user, index) => ({
      id: user.id || `CUS-${String(1100 + index)}`,
      name: user.fullName || "Pax Customer",
      business: user.businessName || "Individual account",
      email: user.email || "—",
      phone: user.phone || "—",
      city: user.city || "Hyderabad",
      shipments: shipments.filter((shipment) => shipment.customer === user.businessName).length,
      joinedAt: user.joinedAt || "Recently",
      status: "Active",
    }))
    : [];

  return { shipments, customers, activities: [] };
}

function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" /></>,
    truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" /><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" /></>,
    support: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.3 2.1c-.8.4-1.1.8-1.1 1.7M12 17h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6A8 8 0 0 0 9 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.4.8l.3 2.8h4l.3-2.8a8 8 0 0 0 1.5-.8l2.4 1 2-3.4-2-1.5c0-.3.1-.7.1-1Z" /></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    scale: <><path d="M12 3v18M5 6h14M6 6l-3 7h6L6 6Zm12 0-3 7h6l-3-7ZM8 21h8" /></>,
    tools: <><path d="m4 20 8-8M14 6l4-4 4 4-4 4M3 7l4-4 4 4-4 4Z" /></>,
    code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14" />,
    page: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    refresh: <><path d="M20 6v5h-5" /><path d="M18 9a7 7 0 1 0 1 7" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function StatusBadge({ status }) {
  const slug = String(status || "pending").toLowerCase().replaceAll(" ", "-");
  return <span className={`admin-status admin-status--${slug}`}><i></i>{status}</span>;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function AdminLogin({ onLogin, onPreview }) {
  const [form, setForm] = useState({ username: "", password: "", remember: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.username.trim().length < 3 || form.password.length < 8) {
      setError("Enter your admin username and password (minimum 8 characters).");
      return;
    }
    setLoading(true);
    try {
      const admin = await loginAdmin(form);
      onLogin(admin);
    } catch (loginError) {
      if (ENABLE_PREVIEW_MODE && form.username.trim().toLowerCase() === "admin" && form.password === "Pax@1234") {
        onPreview();
        return;
      }
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-story">
        <div className="admin-brand admin-brand--light"><img src="/assets/pax-logo.png" alt="Pax Logistics" /><span>ADMIN</span></div>
        <div className="admin-login-copy">
          <p>OPERATIONS CONTROL CENTRE</p>
          <h1>Every parcel.<br />One clear view.</h1>
          <span>Manage customers, monitor movement, resolve exceptions and keep collections on track.</span>
        </div>
        <div className="admin-login-route" aria-hidden="true">
          <span className="is-done">Pickup</span><i></i><span className="is-live">HYD Hub</span><i></i><span>Delivery</span>
        </div>
        <small>Restricted to authorised Pax operations staff.</small>
      </section>
      <section className="admin-login-panel">
        <form className="admin-login-card" onSubmit={submit}>
          <div className="admin-mobile-brand"><img src="/assets/pax-logo.png" alt="Pax Logistics" /><span>ADMIN</span></div>
          <p className="admin-eyebrow">SECURE ADMIN ACCESS</p>
          <h2>Welcome back.</h2>
          <p>Sign in with the username and password issued by your Pax administrator.</p>
          <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter admin username" autoComplete="username" /></label>
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" autoComplete="current-password" /></label>
          <label className="admin-remember"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} /> Keep me signed in</label>
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={loading}>{loading ? "Connecting…" : "Sign in to operations"}<Icon name="arrow" /></button>
          {ENABLE_PREVIEW_MODE && <><div className="admin-demo-credentials"><span>Preview credentials</span><strong>admin</strong><i>/</i><strong>Pax@1234</strong></div><button className="admin-preview-button" type="button" onClick={onPreview}>Open local preview</button></>}
          <small className="admin-api-caption">API: {API_BASE_URL}</small>
        </form>
      </section>
    </main>
  );
}

function MetricCard({ label, value, note, tone, icon }) {
  return <article className={`admin-metric admin-metric--${tone}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><i className="admin-metric-icon"><Icon name={icon} /></i></article>;
}

function ShipmentTable({ shipments, onStatusChange, compact = false }) {
  if (!shipments.length) return <div className="admin-empty">No shipments match the current filters.</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Shipment</th><th>Customer</th><th>Destination</th><th>Payment</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>{shipments.map((shipment) => <tr key={shipment.id}>
          <td><strong>{shipment.id}</strong></td>
          <td>{shipment.customer}</td>
          <td>{shipment.destination}</td>
          <td><span>{shipment.payment}</span><small>{formatMoney(shipment.amount)}</small></td>
          <td>{compact ? <StatusBadge status={shipment.status} /> : <select className="admin-status-select" value={shipment.status} onChange={(event) => onStatusChange(shipment.id, event.target.value)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>}</td>
          <td>{shipment.date || "Today"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function ManagementWorkspace({ page, flash, search, records, onRecordsChange }) {
  const config = managementPages[page];
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setEditorOpen(false);
    setEditingId(null);
  }, [page]);

  if (!config) return null;
  const query = search.trim().toLowerCase();
  const visibleRows = records.filter((record) => !query || (record.cells || []).some((cell) => String(cell).toLowerCase().includes(query)));
  const editingRecord = records.find((record) => record.id === editingId) || null;

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
  };

  const openNewEditor = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEditEditor = (record) => {
    setEditingId(record.id);
    setEditorOpen(true);
  };

  const saveRecord = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cells = config.columns.map((column, index) => String(data.get(`cell-${index}`) || "").trim());
    if (cells.some((value) => !value)) {
      flash("Complete every field before saving this record.");
      return;
    }
    const updatedAt = new Date().toISOString();
    if (editingRecord) {
      onRecordsChange(records.map((record) => record.id === editingRecord.id ? { ...record, cells, updatedAt } : record));
      flash(`${cells[0]} updated in ${pageTitles[page][0]}.`);
    } else {
      onRecordsChange([{ id: `${page}-${Date.now()}`, cells, enabled: true, updatedAt }, ...records]);
      flash(`${cells[0]} added to ${pageTitles[page][0]}.`);
    }
    closeEditor();
  };

  const exportRecords = () => {
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [config.columns, ...records.map((record) => config.columns.map((_, index) => record.cells?.[index] || ""))]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    flash(`${pageTitles[page][0]} exported with ${records.length} records.`);
  };

  const toggleRecord = (record) => {
    onRecordsChange(records.map((item) => item.id === record.id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item));
    flash(`${record.cells[0]} ${record.enabled ? "disabled" : "enabled"}. Client-facing availability will refresh automatically.`);
  };

  const deleteRecord = (record) => {
    onRecordsChange(records.filter((item) => item.id !== record.id));
    if (editingId === record.id) closeEditor();
    flash(`${record.cells[0]} removed.`);
  };

  return <section className="admin-card admin-table-card admin-full-card">
    <div className="admin-table-toolbar"><div><strong>{visibleRows.length} records</strong><span>Search, review and manage every field in the current configuration.</span></div><button className="admin-compact-primary" type="button" onClick={config.actionType === "export" ? exportRecords : editorOpen ? closeEditor : openNewEditor}>{editorOpen && config.actionType !== "export" ? "Close editor" : config.action}</button></div>
    {editorOpen && <form className="admin-inline-editor" key={`${page}-${editingId || "new"}`} onSubmit={saveRecord}>
      <div className="admin-editor-heading"><strong>{editingRecord ? `Edit ${editingRecord.cells?.[0] || "record"}` : config.action}</strong><span>Complete all {config.columns.length} fields. Changes will be reflected in this table and connected client configuration.</span></div>
      {config.columns.map((column, index) => {
        const value = editingRecord?.cells?.[index] || (column === "Status" ? "Active" : "");
        const statusOptions = managementStatusOptions.includes(value) ? managementStatusOptions : [value, ...managementStatusOptions];
        return <label key={column}>{column}{column === "Status"
          ? <select name={`cell-${index}`} defaultValue={value} required>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
          : <input name={`cell-${index}`} defaultValue={value} required placeholder={`Enter ${column.toLowerCase()}`} autoFocus={index === 0} />}</label>;
      })}
      <div className="admin-editor-actions"><button className="admin-editor-cancel" type="button" onClick={closeEditor}>Cancel</button><button type="submit">{editingRecord ? "Save changes" : "Create record"}</button></div>
    </form>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th>Availability</th><th>Actions</th></tr></thead><tbody>{visibleRows.map((record) => <tr className={record.enabled ? "" : "is-disabled"} key={record.id}>{config.columns.map((column, index) => { const cell = record.cells?.[index] || "—"; return <td key={`${column}-${index}`}>{index === config.columns.length - 1 ? <StatusBadge status={record.enabled ? cell : "Disabled"} /> : index === 0 ? <strong>{cell}</strong> : cell}</td>; })}<td><button className={`admin-switch${record.enabled ? " is-on" : ""}`} type="button" aria-label={`${record.enabled ? "Disable" : "Enable"} ${record.cells?.[0] || "record"}`} onClick={() => toggleRecord(record)}><i></i><span>{record.enabled ? "On" : "Off"}</span></button></td><td><div className="admin-row-actions"><button type="button" onClick={() => openEditEditor(record)}>Edit</button><button className="is-danger" type="button" onClick={() => deleteRecord(record)}>Delete</button></div></td></tr>)}</tbody></table></div>
  </section>;
}

function WaybillWorkspace({ flash }) {
  const [count, setCount] = useState("25");
  const [status, setStatus] = useState("");
  const [inventory, setInventory] = useState({ items: [], summary: { total: 0, stored: 0, reserved: 0, used: 0 } });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingSingle, setFetchingSingle] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = async (nextStatus = status) => {
    setLoading(true);
    setError("");
    try {
      setInventory(await getDelhiveryWaybills({ status: nextStatus, limit: 100 }));
    } catch (requestError) {
      setError(requestError.message || "Waybill inventory could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory(status);
  }, [status]);

  const fetchBatch = async (event) => {
    event.preventDefault();
    const requestedCount = Number(count);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 10000) {
      setError("Enter a whole number between 1 and 10,000.");
      return;
    }
    setFetching(true);
    setError("");
    try {
      const result = await fetchDelhiveryWaybills(requestedCount);
      flash(`${result.storedCount} Delhivery waybills stored${result.duplicateCount ? `; ${result.duplicateCount} duplicates skipped` : ""}.`);
      await loadInventory(status);
    } catch (requestError) {
      setError(requestError.message || "Delhivery waybills could not be fetched.");
    } finally {
      setFetching(false);
    }
  };

  const fetchSingle = async () => {
    setFetchingSingle(true);
    setError("");
    try {
      const result = await fetchDelhiverySingleWaybill();
      flash(`${result.storedCount} single Delhivery waybill stored${result.duplicateCount ? "; duplicate skipped" : ""}.`);
      await loadInventory(status);
    } catch (requestError) {
      setError(requestError.message || "A single Delhivery waybill could not be fetched.");
    } finally {
      setFetchingSingle(false);
    }
  };

  const summary = inventory.summary || { total: 0, stored: 0, reserved: 0, used: 0 };
  return <>
    <section className="admin-metrics">
      <MetricCard label="Total waybills" value={summary.total} note="Unique Delhivery AWBs" tone="blue" icon="box" />
      <MetricCard label="Ready to assign" value={summary.stored} note="Stored inventory" tone="green" icon="grid" />
      <MetricCard label="Reserved" value={summary.reserved} note="Held for manifestation" tone="purple" icon="truck" />
      <MetricCard label="Used" value={summary.used} note="Assigned to shipments" tone="amber" icon="support" />
    </section>
    <section className="admin-tool-layout">
      <form className="admin-card admin-tool-form" onSubmit={fetchBatch}>
        <p>DELHIVERY WAYBILL INVENTORY</p><h2>Fetch and store waybills</h2>
        <label>Waybill count<input type="number" min="1" max="10000" step="1" value={count} onChange={(event) => setCount(event.target.value)} /></label>
        <button type="submit" disabled={fetching}>{fetching ? "Fetching..." : "Fetch and store"}</button>
        <button type="button" disabled={fetchingSingle} onClick={fetchSingle}>{fetchingSingle ? "Fetching one..." : "Fetch single waybill"}</button>
        <span>Bulk: maximum 10,000 per request and 50,000 per five minutes. Single: one AWB per call. Newly fetched waybills remain stored for later manifestation.</span>
        {error && <p className="is-error">{error}</p>}
      </form>
      <div className="admin-card admin-tool-result"><span>INVENTORY SAFETY</span><h2>Stored before use</h2><p>Duplicate waybills are ignored. A waybill is not assigned to an order until the Delhivery manifestation contract is integrated.</p></div>
    </section>
    <section className="admin-card admin-table-card admin-full-card">
      <div className="admin-table-toolbar"><div><strong>{inventory.items.length} waybills shown</strong><span>Oldest inventory appears first.</span></div><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="stored">Stored</option><option value="reserved">Reserved</option><option value="used">Used</option></select></label></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Waybill</th><th>Status</th><th>Batch</th><th>Fetched</th><th>Shipment</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Loading inventory...</td></tr> : inventory.items.length ? inventory.items.map((item) => <tr key={item.waybill}><td><strong>{item.waybill}</strong></td><td><StatusBadge status={item.status === "stored" ? "Active" : item.status} /></td><td>{item.batchId}</td><td>{item.fetchedAt ? new Date(item.fetchedAt).toLocaleString() : "—"}</td><td>{item.shipmentId || "—"}</td></tr>) : <tr><td colSpan="5">No waybills have been fetched yet.</td></tr>}</tbody></table></div>
    </section>
  </>;
}

function ToolWorkspace({ page, shipments, connection, sourceLabel, flash, controlState, onControlChange }) {
  const [pin, setPin] = useState("500029");
  const [serviceProductType, setServiceProductType] = useState("Parcel");
  const [pinResult, setPinResult] = useState(null);
  const [rate, setRate] = useState({ pickup: "500029", delivery: "560001", weight: "1", payment: "Prepaid", mot: "S" });
  const [rateResult, setRateResult] = useState(null);
  const [trackingId, setTrackingId] = useState(shipments[0]?.id || "");
  const [trackingResult, setTrackingResult] = useState(null);
  const [content, setContent] = useState(controlState.content[page === "rate-terms" ? "rateTerms" : "about"] || "");
  const [options, setOptions] = useState({ ...controlState.settings.paymentOptions, ...controlState.settings.billing });

  useEffect(() => {
    setOptions({ ...controlState.settings.paymentOptions, ...controlState.settings.billing });
    if (["about", "rate-terms"].includes(page)) setContent(controlState.content[page === "rate-terms" ? "rateTerms" : "about"] || "");
  }, [controlState, page]);

  const toggle = (key) => {
    const nextOptions = { ...options, [key]: !options[key] };
    setOptions(nextOptions);
    const settingGroup = ["weekly", "gst"].includes(key) ? "billing" : "paymentOptions";
    onControlChange({ ...controlState, settings: { ...controlState.settings, [settingGroup]: { ...controlState.settings[settingGroup], [key]: nextOptions[key] } } });
    flash("Preference updated in preview mode.");
  };

  const toggleService = (key) => {
    onControlChange({ ...controlState, settings: { ...controlState.settings, serviceability: { ...controlState.settings.serviceability, [key]: !controlState.settings.serviceability[key] } } });
    flash(`${key} service ${controlState.settings.serviceability[key] ? "disabled" : "enabled"}.`);
  };

  const checkPinServiceability = async (event) => {
    event.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setPinResult({ error: "Enter a valid 6-digit PIN code." });
      return;
    }
    try {
      setPinResult(serviceProductType === "Heavy"
        ? await getAdminHeavyServiceability(pin)
        : await getAdminServiceability(pin));
    } catch (error) {
      setPinResult({ error: error.message || "Delhivery serviceability could not be checked." });
    }
  };

  const calculateAdminRate = async (event) => {
    event.preventDefault();
    const weight = Number(rate.weight);
    if (!/^[1-9]\d{5}$/.test(rate.pickup) || !/^[1-9]\d{5}$/.test(rate.delivery) || weight <= 0) {
      setRateResult({ error: "Enter two valid PIN codes and parcel weight." });
      return;
    }
    try {
      const [tat, shippingCost] = await Promise.all([
        getAdminExpectedTat({ originPin: rate.pickup, destinationPin: rate.delivery, mot: rate.mot, pdt: "B2C" }),
        getAdminShippingCost({
          md: rate.mot,
          cgm: Math.ceil(weight * 1000),
          originPin: rate.pickup,
          destinationPin: rate.delivery,
          status: "Delivered",
          paymentType: rate.payment === "COD" ? "COD" : "Pre-paid",
        }),
      ]);
      if (!tat.serviceable || tat.tatDays === null) {
        setRateResult({ error: tat.remark || "Delhivery could not provide an expected TAT for this lane." });
        return;
      }
      if (!Number.isFinite(shippingCost.estimatedAmount)) {
        setRateResult({ error: "Delhivery did not return an estimated charge for this lane." });
        return;
      }
      setRateResult({ amount: shippingCost.estimatedAmount, shippingCost, tat });
    } catch (error) {
      setRateResult({ error: error.message || "Delhivery shipping cost could not be loaded." });
    }
  };

  if (page === "serviceability") return <section className="admin-tool-layout"><form className="admin-card admin-tool-form" onSubmit={checkPinServiceability}><p>DELHIVERY PIN CODE CHECK</p><h2>Check and control serviceability</h2><label>Product type<select value={serviceProductType} onChange={(event) => { setServiceProductType(event.target.value); setPinResult(null); }}><option>Parcel</option><option>Heavy</option></select></label><label>Delivery PIN code<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" /></label><button type="submit">Check live coverage</button><div className="admin-service-toggles">{[["standard", "Standard"], ["express", "Express"], ["cod", "COD"]].map(([key, label]) => <button className={controlState.settings.serviceability[key] ? "is-on" : ""} type="button" key={key} onClick={() => toggleService(key)}><i></i><span>{label}</span></button>)}</div></form><div className="admin-card admin-tool-result">{!pinResult ? <p>Enter a PIN code to view live Delhivery parcel or Heavy delivery availability.</p> : pinResult.error ? <p className="is-error">{pinResult.error}</p> : <><span>{pinResult.productType || "Parcel"} · PIN {pin} · {pinResult.stateCode || pinResult.district || "Delhivery"}</span><h2>{pinResult.serviceable ? "Serviceable" : pinResult.embargoed ? "Temporary embargo" : "Not serviceable"}</h2><ul><li><b>Standard delivery</b><StatusBadge status={controlState.settings.serviceability.standard && pinResult.serviceable ? "Active" : "Disabled"} /></li><li><b>Prepaid delivery</b><StatusBadge status={pinResult.prepaid ? "Active" : "Disabled"} /></li><li><b>Cash on delivery</b><StatusBadge status={controlState.settings.serviceability.cod && pinResult.cod ? "Active" : "Disabled"} /></li></ul></>}</div></section>;

  if (page === "rate") return <section className="admin-tool-layout"><form className="admin-card admin-tool-form" onSubmit={calculateAdminRate}><p>SHIPPING RATE &amp; TAT TOOL</p><h2>Calculate a rate</h2><div className="admin-form-grid"><label>Pickup PIN<input value={rate.pickup} onChange={(event) => setRate({ ...rate, pickup: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></label><label>Delivery PIN<input value={rate.delivery} onChange={(event) => setRate({ ...rate, delivery: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></label><label>Weight (kg)<input type="number" min="0.1" step="0.1" value={rate.weight} onChange={(event) => setRate({ ...rate, weight: event.target.value })} /></label><label>Transport<select value={rate.mot} onChange={(event) => setRate({ ...rate, mot: event.target.value })}><option value="S">Surface</option><option value="E">Express</option></select></label><label>Payment<select value={rate.payment} onChange={(event) => setRate({ ...rate, payment: event.target.value })}><option>Prepaid</option><option>COD</option></select></label></div><button type="submit">Calculate rate &amp; TAT</button></form><div className="admin-card admin-tool-result">{!rateResult ? <p>Enter shipment details to calculate customer charges and live Delhivery TAT.</p> : rateResult.error ? <p className="is-error">{rateResult.error}</p> : <><span>DELHIVERY ESTIMATED RATE</span><h2>{formatMoney(rateResult.amount)}</h2><ul><li><b>Expected TAT</b><strong>{rateResult.tat.tatDays} {rateResult.tat.tatDays === 1 ? "day" : "days"}</strong></li>{rateResult.tat.expectedDeliveryDate && <li><b>Expected delivery</b><span>{rateResult.tat.expectedDeliveryDate}</span></li>}<li><b>Mode</b><strong>{rateResult.shippingCost.modeOfTransport}</strong></li><li><b>Charged weight</b><span>{rateResult.shippingCost.chargedWeightGrams ?? rateResult.shippingCost.requestedWeightGrams} g</span></li><li><b>GST</b><span>Provider estimate; final invoice may vary</span></li></ul></>}</div></section>;

  if (page === "tracking") return <section className="admin-tool-layout"><form className="admin-card admin-tool-form" onSubmit={(event) => { event.preventDefault(); const found = shipments.find((item) => item.id.toLowerCase() === trackingId.trim().toLowerCase()); setTrackingResult(found || { error: "No matching order found." }); }}><p>LIVE ORDER LOOKUP</p><h2>Track an order</h2><label>Pax reference<input value={trackingId} onChange={(event) => setTrackingId(event.target.value.toUpperCase())} placeholder="PAX shipment reference" /></label><button type="submit">Track order</button></form><div className="admin-card admin-tool-result">{!trackingResult ? <p>Search a Pax reference to inspect its current milestone.</p> : trackingResult.error ? <p className="is-error">{trackingResult.error}</p> : <><span>{trackingResult.id}</span><h2>{trackingResult.customer}</h2><ul><li><b>Destination</b><span>{trackingResult.destination}</span></li><li><b>Payment</b><span>{trackingResult.payment}</span></li><li><b>Latest status</b><StatusBadge status={trackingResult.status} /></li></ul></>}</div></section>;

  if (["payment-options", "billing-preferences"].includes(page)) {
    const settings = page === "payment-options" ? [["prepaid", "Prepaid orders", "Accept online-paid bookings"], ["cod", "Cash on delivery", "Allow COD on serviceable PIN codes"], ["wallet", "Pax wallet", "Use wallet balance for shipping"], ["upi", "UPI recharge", "Allow UPI wallet recharges"]] : [["weekly", "Weekly invoicing", "Generate invoices every Monday"], ["gst", "GST invoices", "Include tax breakup and GSTIN"]];
    return <section className="admin-card admin-preference-card"><div><p>PLATFORM PREFERENCES</p><h2>{pageTitles[page][0]}</h2></div>{settings.map(([key, title, detail]) => <button key={key} type="button" className={options[key] ? "is-on" : ""} onClick={() => toggle(key)}><span><strong>{title}</strong><small>{detail}</small></span><i></i></button>)}</section>;
  }

  if (["about", "rate-terms"].includes(page)) return <form className="admin-card admin-content-editor" onSubmit={(event) => { event.preventDefault(); const key = page === "rate-terms" ? "rateTerms" : "about"; onControlChange({ ...controlState, content: { ...controlState.content, [key]: content } }); flash(`${pageTitles[page][0]} content saved and queued for client refresh.`); }}><div><p>WEBSITE CONTENT</p><h2>{pageTitles[page][0]}</h2><span>This content is published to connected client panels through the shared configuration API.</span></div><label>Page content<textarea rows="10" value={content} onChange={(event) => setContent(event.target.value)} /></label><button type="submit">Save and publish</button></form>;

  if (page === "password") return <form className="admin-card admin-password-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (data.get("next") !== data.get("confirm") || String(data.get("next")).length < 8) { flash("Passwords must match and contain at least 8 characters."); return; } event.currentTarget.reset(); flash("Password update request saved."); }}><p>ACCOUNT SECURITY</p><h2>Change administrator password</h2><label>Current password<input name="current" type="password" required /></label><label>New password<input name="next" type="password" minLength="8" required /></label><label>Confirm new password<input name="confirm" type="password" minLength="8" required /></label><button type="submit">Update password</button></form>;

  if (["api", "developer"].includes(page)) return <section className="admin-card admin-settings-card"><div><p>{page === "api" ? "DATA CONNECTION" : "DEVELOPER TOOLS"}</p><h2>{pageTitles[page][0]}</h2><span>Production secrets remain on the backend and are never bundled into this static admin app.</span></div><dl><div><dt>Base URL</dt><dd>{API_BASE_URL}</dd></div><div><dt>Admin dashboard</dt><dd>GET /api/admin/dashboard</dd></div><div><dt>Order update</dt><dd>PATCH /api/admin/shipments/:id/status</dd></div><div><dt>Webhook</dt><dd>POST /api/webhooks/shipment-status</dd></div><div><dt>Current state</dt><dd><span className={`admin-connection-dot is-${connection}`}></span>{sourceLabel}</dd></div></dl></section>;

  return null;
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(() => hasAdminToken() || (ENABLE_PREVIEW_MODE && sessionStorage.getItem(PREVIEW_SESSION_KEY) === "true"));
  const [admin, setAdmin] = useState({ name: "Operations Admin", username: "admin" });
  const [previewMode, setPreviewMode] = useState(() => ENABLE_PREVIEW_MODE && sessionStorage.getItem(PREVIEW_SESSION_KEY) === "true");
  const [active, setActive] = useState("overview");
  const [openNavGroup, setOpenNavGroup] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [snapshot, setSnapshot] = useState(() => ENABLE_PREVIEW_MODE ? buildPreviewDashboard() : { shipments: [], warehouses: [], pickupRequests: [], customers: [], activities: [] });
  const [controlState, setControlState] = useState(() => ENABLE_PREVIEW_MODE ? readControlState() : JSON.parse(JSON.stringify(DEFAULT_CONTROL_STATE)));
  const [connection, setConnection] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [warehouseSubmitting, setWarehouseSubmitting] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name: "", phone: "", email: "", address: "", city: "", pin: "", country: "India", registered_name: "", return_address: "", return_city: "", return_pin: "", return_state: "", return_country: "India" });
  const [warehouseUpdating, setWarehouseUpdating] = useState(false);
  const [warehouseEditForm, setWarehouseEditForm] = useState({ id: "", name: "", phone: "", address: "", pin: "" });
  const [ndrSubmitting, setNdrSubmitting] = useState("");

  const loadDashboard = async () => {
    if (!authenticated) return;
    setLoading(true);
    if (previewMode) {
      setSnapshot(buildPreviewDashboard());
      setControlState(readControlState());
      setConnection("preview");
      setLoading(false);
      return;
    }
    setConnection("checking");
    try {
      const data = await getAdminDashboard();
      setSnapshot({ shipments: data.shipments || [], warehouses: data.warehouses || [], pickupRequests: data.pickupRequests || [], customers: data.customers || [], activities: data.activities || [] });
      if (data.configuration) {
        setControlState(data.configuration);
        cacheControlState(data.configuration);
      }
      setConnection("live");
    } catch {
      if (ENABLE_PREVIEW_MODE) setSnapshot(buildPreviewDashboard());
      setConnection("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Pax Admin — Operations Control Centre";
    loadDashboard();
  }, [authenticated, previewMode]);

  useEffect(() => {
    const parent = navigation.find((item) => item.children?.some(([id]) => id === active));
    setOpenNavGroup(parent?.id || null);
  }, [active]);

  useEffect(() => ENABLE_PREVIEW_MODE ? subscribeToLocalControl(setControlState) : undefined, []);

  useEffect(() => {
    if (!authenticated || previewMode) return undefined;
    return subscribeToRemoteUpdates(loadDashboard);
  }, [authenticated, previewMode]);

  useEffect(() => {
    if (!authenticated || !previewMode) return undefined;
    const syncClientPreview = (event) => {
      if (event.key && ![CLIENT_USERS_KEY, CLIENT_SHIPMENTS_KEY].includes(event.key)) return;
      setSnapshot(buildPreviewDashboard());
    };
    window.addEventListener("storage", syncClientPreview);
    return () => window.removeEventListener("storage", syncClientPreview);
  }, [authenticated, previewMode]);

  const shipments = snapshot.shipments || [];
  const warehouses = snapshot.warehouses || [];
  const pickupRequests = snapshot.pickupRequests || [];
  const customers = snapshot.customers || [];
  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const matchesSearch = !query || [shipment.id, shipment.customer, shipment.destination, shipment.payment, shipment.status].some((value) => String(value).toLowerCase().includes(query));
      return matchesSearch && (statusFilter === "All statuses" || shipment.status === statusFilter);
    });
  }, [shipments, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => !query || [customer.name, customer.business, customer.email, customer.phone, customer.city].some((value) => String(value).toLowerCase().includes(query)));
  }, [customers, search]);

  const delivered = shipments.filter((item) => item.status === "Delivered").length;
  const moving = shipments.filter((item) => ["In transit", "Out for delivery"].includes(item.status)).length;
  const exceptions = shipments.filter((item) => ["Exception", "RTO"].includes(item.status)).length;
  const codValue = shipments.filter((item) => item.payment === "COD").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const prepaidValue = shipments.filter((item) => item.payment === "Prepaid").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const grossValue = codValue + prepaidValue;
  const averageOrderValue = shipments.length ? Math.round(grossValue / shipments.length) : 0;
  const rtoCount = shipments.filter((item) => item.status === "RTO").length;
  const pickupCount = shipments.filter((item) => item.status === "Pickup scheduled").length;
  const activeCouriers = (controlState.resources.couriers || []).filter((item) => item.enabled).length;
  const openTickets = (controlState.resources.support || []).filter((item) => item.enabled && item.cells.at(-1) !== "Resolved").length;
  const openWeightCases = (controlState.resources.weight || []).filter((item) => item.enabled && item.cells.at(-1) === "Review").length;
  const courierCost = Math.round(grossValue * 0.62);
  const netRevenue = grossValue - courierCost;
  const statusSummary = statusOptions.map((status) => ({ status, count: shipments.filter((item) => item.status === status).length }));
  const destinationSummary = Object.entries(shipments.reduce((result, shipment) => {
    const city = String(shipment.destination || "Unknown").split(",")[0];
    result[city] = (result[city] || 0) + 1;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const adminDateLabel = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()).toUpperCase();
  const sourceLabel = connection === "live" ? "Live API" : connection === "checking" ? "Connecting" : connection === "offline" ? "API offline" : "Local preview";

  const flash = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const changeControlState = async (nextState) => {
    if (!previewMode && connection !== "live") {
      flash("The API is offline. Configuration was not changed.");
      return;
    }
    const previous = controlState;
    const next = writeControlState(nextState);
    setControlState(next);
    if (!previewMode && connection === "live") {
      try {
        await saveAdminConfiguration(next);
      } catch (error) {
        setControlState(cacheControlState(previous));
        flash(`Configuration was not changed: ${error.message}`);
      }
    }
  };

  const changeStatus = async (id, status) => {
    const previous = snapshot;
    const next = { ...snapshot, shipments: shipments.map((shipment) => shipment.id === id ? { ...shipment, status } : shipment) };
    setSnapshot(next);
    if (previewMode) {
      localStorage.setItem(CLIENT_SHIPMENTS_KEY, JSON.stringify(next.shipments));
      window.dispatchEvent(new CustomEvent("pax:shipments-updated", { detail: next.shipments }));
      flash(`${id} updated in the client preview data.`);
      return;
    }
    if (connection !== "live") {
      setSnapshot(previous);
      flash("The API is offline. Shipment status was not changed.");
      return;
    }
    try {
      await setShipmentStatus(id, status);
      flash(`${id} status updated.`);
    } catch (error) {
      setSnapshot(previous);
      flash(error.message);
    }
  };

  const completePickupRequest = async (pickupRequest) => {
    if (previewMode || connection !== "live") {
      flash("A live API connection is required to confirm pickup collection.");
      return;
    }
    try {
      const completed = await completeAdminPickupRequest(pickupRequest.id);
      setSnapshot((current) => ({ ...current, pickupRequests: (current.pickupRequests || []).map((item) => item.id === completed.id ? completed : item) }));
      flash(`${pickupRequest.id} marked completed after collection.`);
    } catch (error) {
      flash(`Pickup was not completed: ${error.message}`);
    }
  };

  const submitNdrAction = async (shipment, action) => {
    if (previewMode || connection !== "live") {
      flash("A live API connection is required to submit an NDR action.");
      return;
    }
    const waybill = String(shipment.waybills?.[0] || shipment.waybill || "");
    const requestKey = `${shipment.id}:${action}`;
    setNdrSubmitting(requestKey);
    try {
      const result = await submitAdminNdrAction(shipment.id, { waybill, action });
      setSnapshot((current) => ({ ...current, shipments: (current.shipments || []).map((item) => item.id === shipment.id ? result.shipment : item) }));
      flash(`${action} submitted · UPL ${result.provider.uplId}.`);
    } catch (error) {
      flash(`NDR action was not submitted: ${error.message}`);
    } finally {
      setNdrSubmitting("");
    }
  };

  const registerWarehouse = async (event) => {
    event.preventDefault();
    if (previewMode || connection !== "live") {
      flash("A live API connection is required to register a Delhivery warehouse.");
      return;
    }
    setWarehouseSubmitting(true);
    try {
      const warehouse = await createAdminWarehouse(warehouseForm);
      setSnapshot((current) => ({ ...current, warehouses: [warehouse, ...(current.warehouses || []).filter((item) => item.id !== warehouse.id)] }));
      setWarehouseForm({ name: "", phone: "", email: "", address: "", city: "", pin: "", country: "India", registered_name: "", return_address: "", return_city: "", return_pin: "", return_state: "", return_country: "India" });
      flash(`${warehouse.name} registered with Delhivery.`);
    } catch (error) {
      flash(`Warehouse was not registered: ${error.message}`);
    } finally {
      setWarehouseSubmitting(false);
    }
  };

  const beginWarehouseEdit = (warehouse) => {
    setWarehouseEditForm({ id: warehouse.id, name: warehouse.name, phone: warehouse.phone || "", address: warehouse.address || "", pin: warehouse.pin || "" });
  };

  const updateWarehouse = async (event) => {
    event.preventDefault();
    if (previewMode || connection !== "live") {
      flash("A live API connection is required to update a Delhivery warehouse.");
      return;
    }
    setWarehouseUpdating(true);
    try {
      const warehouse = await updateAdminWarehouse(warehouseEditForm.id, {
        pin: warehouseEditForm.pin,
        ...(warehouseEditForm.phone ? { phone: warehouseEditForm.phone } : {}),
        ...(warehouseEditForm.address ? { address: warehouseEditForm.address } : {}),
      });
      setSnapshot((current) => ({ ...current, warehouses: (current.warehouses || []).map((item) => item.id === warehouse.id ? warehouse : item) }));
      setWarehouseEditForm({ id: "", name: "", phone: "", address: "", pin: "" });
      flash(`${warehouse.name} updated in Delhivery.`);
    } catch (error) {
      flash(`Warehouse was not updated: ${error.message}`);
    } finally {
      setWarehouseUpdating(false);
    }
  };

  const changeCustomerAccess = async (customer) => {
    if (!previewMode && connection !== "live") {
      flash("The API is offline. Customer access was not changed.");
      return;
    }
    const enabled = customer.status === "Disabled";
    const nextCustomers = customers.map((item) => item.id === customer.id ? { ...item, status: enabled ? "Active" : "Disabled" } : item);
    setSnapshot((current) => ({ ...current, customers: nextCustomers }));
    if (previewMode) {
      try {
        const savedUsers = safeParse(localStorage.getItem(CLIENT_USERS_KEY), []);
        localStorage.setItem(CLIENT_USERS_KEY, JSON.stringify(savedUsers.map((user) => user.email === customer.email ? { ...user, disabled: !enabled } : user)));
      } catch {
        // Ignore malformed browser-only preview data.
      }
    }
    if (!previewMode && connection === "live") {
      try {
        await setCustomerAccess(customer.id, enabled);
      } catch (error) {
        setSnapshot((current) => ({ ...current, customers }));
        flash(`Customer access was not changed: ${error.message}`);
        return;
      }
    }
    flash(`${customer.business} access ${enabled ? "enabled" : "disabled"}.`);
  };

  const signOut = () => {
    logoutAdmin();
    sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    setAuthenticated(false);
    setPreviewMode(false);
  };

  if (!authenticated) {
    return <AdminLogin onLogin={(nextAdmin) => { setAdmin(nextAdmin); setAuthenticated(true); }} onPreview={() => { sessionStorage.setItem(PREVIEW_SESSION_KEY, "true"); setPreviewMode(true); setAuthenticated(true); }} />;
  }

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar${mobileNav ? " is-open" : ""}`}>
        <div className="admin-brand"><img src="/assets/pax-logo.png" alt="Pax Logistics" /><span>ADMIN</span></div>
        <nav aria-label="Admin navigation">{navigation.map((item) => {
          const hasActiveChild = item.children?.some(([id]) => id === active);
          const isOpen = openNavGroup === item.id;
          if (!item.children) return <button key={item.id} className={`admin-nav-main${active === item.id ? " is-active" : ""}`} type="button" onClick={() => { setActive(item.id); setMobileNav(false); setSearch(""); }}><Icon name={item.icon} /><span>{item.label}</span>{item.badge && <b>{shipments.length}</b>}</button>;
          return <div className={`admin-nav-group${isOpen ? " is-open" : ""}`} key={item.id}>
            <button className={`admin-nav-main admin-nav-group-trigger${hasActiveChild ? " has-active-child" : ""}`} type="button" aria-expanded={isOpen} aria-controls={`admin-nav-${item.id}`} onClick={() => setOpenNavGroup(isOpen ? null : item.id)}><Icon name={item.icon} /><span>{item.label}</span><i className="admin-nav-chevron"><Icon name="chevron" /></i></button>
            <div className="admin-nav-children" id={`admin-nav-${item.id}`}>{item.children.map(([id, label]) => <button key={id} className={active === id ? "is-active" : ""} type="button" onClick={() => { setActive(id); setMobileNav(false); setSearch(""); }}><i></i><span>{label}</span></button>)}</div>
          </div>;
        })}</nav>
        <div className="admin-sidebar-foot"><span className={`admin-connection-dot is-${connection}`}></span><div><strong>{sourceLabel}</strong><small>{API_BASE_URL.replace(/^https?:\/\//, "")}</small></div></div>
      </aside>
      {mobileNav && <button className="admin-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" type="button" onClick={() => setMobileNav(true)}><Icon name="menu" /></button>
          <label className="admin-global-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shipment, customer or city" /></label>
          <div className="admin-topbar-actions"><button type="button" title="Refresh data" onClick={loadDashboard} disabled={loading}><Icon name="refresh" /></button><button type="button" className="admin-bell"><Icon name="bell" /><i></i></button><div className="admin-user"><span>{(admin.name || "PA").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{admin.name || "Pax Admin"}</strong><small>{admin.username || admin.email || "Operations"}</small></div></div><button type="button" title="Sign out" onClick={signOut}><Icon name="logout" /></button></div>
        </header>

        <div className="admin-content">
          {connection === "offline" && <div className="admin-connection-banner"><span><strong>Backend unavailable.</strong> Live records could not be loaded; no sample records have been substituted.</span><button type="button" onClick={loadDashboard}>Retry connection</button></div>}
          {previewMode && <div className="admin-connection-banner is-preview"><span><strong>Preview mode.</strong> Same-origin customer records are connected through shared browser storage.</span><button type="button" onClick={loadDashboard}>Refresh preview</button></div>}
          <div className="admin-page-heading"><div><p>{adminDateLabel} · HYDERABAD</p><h1>{pageTitles[active][0]}</h1><span>{pageTitles[active][1]}</span></div><div className="admin-live-chip"><i></i>{sourceLabel}</div></div>

          {active === "overview" && <>
            <section className="admin-metrics">
              <MetricCard label="Total shipments" value={shipments.length} note={`${moving} moving now`} tone="blue" icon="box" />
              <MetricCard label="Delivery success" value={shipments.length ? `${Math.round((delivered / shipments.length) * 100)}%` : "0%"} note={`${delivered} delivered`} tone="green" icon="truck" />
              <MetricCard label="Customers" value={customers.length} note="Connected accounts" tone="purple" icon="users" />
              <MetricCard label="Needs attention" value={exceptions} note="Exceptions and RTO" tone="amber" icon="support" />
            </section>
            <section className="admin-action-strip">
              <article><i className="is-coral"></i><span><strong>Open tickets</strong><small>Support triage</small></span><b>{openTickets}</b><button type="button" onClick={() => setActive("support")}>Review</button></article>
              <article><i className="is-yellow"></i><span><strong>Pending KYC</strong><small>Verification queue</small></span><b>{customers.filter((item) => item.status === "Review").length}</b><button type="button" onClick={() => setActive("customers")}>Review</button></article>
              <article><i className="is-purple"></i><span><strong>Weight disputes</strong><small>Reconciliation</small></span><b>{openWeightCases}</b><button type="button" onClick={() => setActive("weight")}>Review</button></article>
              <article><i className="is-green"></i><span><strong>Active sellers</strong><small>Seller analytics</small></span><b>{customers.length}</b><button type="button" onClick={() => setActive("customers")}>View</button></article>
            </section>
            <section className="admin-overview-grid">
              <article className="admin-card admin-volume-card"><div className="admin-card-head"><div><p>SHIPMENT VOLUME</p><h2>Network movement</h2></div><span>Current API data</span></div><div className="admin-chart"><div className="admin-chart-y"><span>{shipments.length}</span><span></span><span></span><span></span><span>0</span></div><div className="admin-bars">{statusSummary.map((item) => <div key={item.status}><i style={{ height: `${shipments.length ? Math.max(4, (item.count / shipments.length) * 100) : 0}%` }}></i><span>{item.status.split(" ")[0]}</span></div>)}</div></div></article>
              <article className="admin-card admin-activity-card"><div className="admin-card-head"><div><p>LIVE FEED</p><h2>Recent activity</h2></div></div><div className="admin-activity-list">{snapshot.activities?.length ? snapshot.activities.map((item, index) => <div key={`${item.title}-${index}`}><i className={`is-${item.tone}`}></i><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>) : <div className="admin-empty">No live activity yet.</div>}</div></article>
            </section>
            <section className="admin-health-grid">
              <article className="admin-card admin-summary-card"><div className="admin-card-head"><div><p>FINANCIAL HEALTH</p><h2>Revenue, cost and margin</h2></div><button type="button" onClick={() => setActive("invoices")}>Open billing <Icon name="arrow" /></button></div><div className="admin-summary-tiles"><div><span>Shipping collected</span><strong>{formatMoney(grossValue)}</strong><small>Seller-facing charges</small></div><div><span>Courier cost</span><strong>{formatMoney(courierCost)}</strong><small>Estimated partner payable</small></div><div><span>Net revenue</span><strong>{formatMoney(netRevenue)}</strong><small>{grossValue ? `${Math.round((netRevenue / grossValue) * 100)}% contribution` : "No orders yet"}</small></div><div><span>Average order value</span><strong>{formatMoney(averageOrderValue)}</strong><small>Across all orders</small></div></div></article>
              <article className="admin-card admin-summary-card"><div className="admin-card-head"><div><p>TODAY'S OPERATIONS</p><h2>Movement snapshot</h2></div><button type="button" onClick={() => setActive("shipments")}>Manage orders <Icon name="arrow" /></button></div><div className="admin-summary-tiles"><div><span>Orders created</span><strong>{shipments.length}</strong><small>Current connected set</small></div><div><span>Pending pickup</span><strong>{pickupCount}</strong><small>Waiting for collection</small></div><div><span>In movement</span><strong>{moving}</strong><small>Transit and OFD</small></div><div><span>Delivered</span><strong>{delivered}</strong><small>{shipments.length ? `${Math.round((delivered / shipments.length) * 100)}% success` : "No orders yet"}</small></div></div></article>
            </section>
            <section className="admin-insight-grid">
              <article className="admin-card"><div className="admin-card-head"><div><p>ORDER STATUS</p><h2>Network distribution</h2></div></div><div className="admin-status-distribution">{statusSummary.map((item) => <button type="button" key={item.status} onClick={() => { setStatusFilter(item.status); setActive("shipments"); }}><span><StatusBadge status={item.status} /></span><strong>{item.count}</strong><i style={{ width: `${shipments.length ? Math.max(5, (item.count / shipments.length) * 100) : 5}%` }}></i></button>)}</div></article>
              <article className="admin-card"><div className="admin-card-head"><div><p>COURIER SNAPSHOT</p><h2>Partner performance</h2></div><span>{activeCouriers} active</span></div><div className="admin-ranking-list">{(controlState.resources.couriers || []).slice(0, 5).map((courier, index) => <div className={courier.enabled ? "" : "is-disabled"} key={courier.id}><b>{index + 1}</b><span><strong>{courier.cells[0]}</strong><small>{courier.cells[1]}</small></span><em>{courier.enabled ? courier.cells[2] : "Disabled"}</em></div>)}</div></article>
              <article className="admin-card"><div className="admin-card-head"><div><p>DESTINATION HOTSPOTS</p><h2>Top delivery cities</h2></div></div><div className="admin-ranking-list">{destinationSummary.map(([city, count], index) => <div key={city}><b>{index + 1}</b><span><strong>{city}</strong><small>{count} connected orders</small></span><em>{Math.round((count / Math.max(shipments.length, 1)) * 100)}%</em></div>)}</div></article>
            </section>
            <section className="admin-card admin-seller-card"><div className="admin-card-head"><div><p>SELLER ANALYTICS</p><h2>Customer account performance</h2></div><button type="button" onClick={() => setActive("customers")}>Manage users <Icon name="arrow" /></button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Seller</th><th>Orders</th><th>Booked value</th><th>Delivery health</th><th>Account</th></tr></thead><tbody>{customers.slice(0, 6).map((customer) => { const customerShipments = shipments.filter((item) => item.customer === customer.business); const customerValue = customerShipments.reduce((sum, item) => sum + Number(item.amount || 0), 0); const customerDelivered = customerShipments.filter((item) => item.status === "Delivered").length; return <tr key={customer.id}><td><strong>{customer.business}</strong><small>{customer.name}</small></td><td>{customerShipments.length || customer.shipments || 0}</td><td>{formatMoney(customerValue)}</td><td>{customerShipments.length ? `${Math.round((customerDelivered / customerShipments.length) * 100)}%` : "New account"}</td><td><StatusBadge status={customer.status || "Active"} /></td></tr>; })}</tbody></table></div></section>
            <section className="admin-card admin-table-card"><div className="admin-card-head"><div><p>ACTIVE OPERATIONS</p><h2>Recent shipments</h2></div><button type="button" onClick={() => setActive("shipments")}>View all <Icon name="arrow" /></button></div><ShipmentTable shipments={filteredShipments.slice(0, 5)} onStatusChange={changeStatus} compact /></section>
          </>}

          {active === "shipments" && <section className="admin-card admin-table-card admin-full-card"><div className="admin-table-toolbar"><div><strong>{filteredShipments.length} shipments</strong><span>Updates are reflected in the customer panel.</span></div><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label></div><ShipmentTable shipments={filteredShipments} onStatusChange={changeStatus} /></section>}

          {active === "waybills" && <WaybillWorkspace flash={flash} />}

          {active === "warehouses" && <section className="admin-health-grid">
            <form className="admin-card admin-settings-card" onSubmit={registerWarehouse}><div><p>DELHIVERY WAREHOUSE</p><h2>Register pickup location</h2><span>The name is case-sensitive and the return address is mandatory.</span></div><dl><div><dt>Warehouse name *</dt><dd><input value={warehouseForm.name} onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })} required /></dd></div><div><dt>POC phone *</dt><dd><input value={warehouseForm.phone} onChange={(event) => setWarehouseForm({ ...warehouseForm, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" required /></dd></div><div><dt>Email</dt><dd><input type="email" value={warehouseForm.email} onChange={(event) => setWarehouseForm({ ...warehouseForm, email: event.target.value })} /></dd></div><div><dt>Pickup address</dt><dd><input value={warehouseForm.address} onChange={(event) => setWarehouseForm({ ...warehouseForm, address: event.target.value })} /></dd></div><div><dt>City</dt><dd><input value={warehouseForm.city} onChange={(event) => setWarehouseForm({ ...warehouseForm, city: event.target.value })} /></dd></div><div><dt>Pickup PIN *</dt><dd><input value={warehouseForm.pin} onChange={(event) => setWarehouseForm({ ...warehouseForm, pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" required /></dd></div><div><dt>Registered account</dt><dd><input value={warehouseForm.registered_name} onChange={(event) => setWarehouseForm({ ...warehouseForm, registered_name: event.target.value })} placeholder="Uses backend account name if blank" /></dd></div><div><dt>Return address *</dt><dd><input value={warehouseForm.return_address} onChange={(event) => setWarehouseForm({ ...warehouseForm, return_address: event.target.value })} required /></dd></div><div><dt>Return city</dt><dd><input value={warehouseForm.return_city} onChange={(event) => setWarehouseForm({ ...warehouseForm, return_city: event.target.value })} /></dd></div><div><dt>Return PIN</dt><dd><input value={warehouseForm.return_pin} onChange={(event) => setWarehouseForm({ ...warehouseForm, return_pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" /></dd></div><div><dt>Return state</dt><dd><input value={warehouseForm.return_state} onChange={(event) => setWarehouseForm({ ...warehouseForm, return_state: event.target.value })} /></dd></div></dl><button className="admin-compact-primary" type="submit" disabled={warehouseSubmitting}>{warehouseSubmitting ? "Registering…" : "Register warehouse"}</button></form>
            <article className="admin-card admin-activity-card"><div className="admin-card-head"><div><p>REGISTERED LOCATIONS</p><h2>{warehouses.length} API warehouses</h2></div></div><div className="admin-activity-list">{warehouses.length ? warehouses.map((warehouse) => <div key={warehouse.id}><i className="is-green"></i><span><strong>{warehouse.name}</strong><small>{warehouse.city || "—"} · {warehouse.pin || "—"} · {warehouse.status}</small></span><button className="admin-row-action" type="button" onClick={() => beginWarehouseEdit(warehouse)}>Edit</button></div>) : <div className="admin-empty">No warehouse has been registered through Pax yet.</div>}</div></article>
            {warehouseEditForm.id && <form className="admin-card admin-settings-card" onSubmit={updateWarehouse}><div><p>UPDATE WAREHOUSE</p><h2>{warehouseEditForm.name}</h2><span>The registered name is immutable. Only address, PIN and phone can be changed.</span></div><dl><div><dt>Warehouse name</dt><dd><input value={warehouseEditForm.name} disabled /></dd></div><div><dt>Phone</dt><dd><input value={warehouseEditForm.phone} onChange={(event) => setWarehouseEditForm({ ...warehouseEditForm, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" /></dd></div><div><dt>Address</dt><dd><input value={warehouseEditForm.address} onChange={(event) => setWarehouseEditForm({ ...warehouseEditForm, address: event.target.value })} /></dd></div><div><dt>PIN *</dt><dd><input value={warehouseEditForm.pin} onChange={(event) => setWarehouseEditForm({ ...warehouseEditForm, pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" required /></dd></div></dl><div className="admin-row-actions"><button className="admin-compact-primary" type="submit" disabled={warehouseUpdating}>{warehouseUpdating ? "Updating…" : "Update warehouse"}</button><button type="button" onClick={() => setWarehouseEditForm({ id: "", name: "", phone: "", address: "", pin: "" })}>Cancel</button></div></form>}
          </section>}

          {active === "ndr" && <section className="admin-ndr-workspace"><div className="admin-card admin-ndr-guidance"><strong>NDR action queue</strong><span>Delhivery recommends submitting after 9 PM. Pax refreshes the AWB and verifies its current NSL code, attempt count, and pickup cancellation eligibility before sending an action.</span></div><div className="admin-ndr-grid">{shipments.filter((item) => ["Exception", "NDR", "Cancelled"].includes(item.status) || item.ndrActions?.length).length ? shipments.filter((item) => ["Exception", "NDR", "Cancelled"].includes(item.status) || item.ndrActions?.length).map((shipment) => <article className="admin-card admin-ndr-card" key={shipment.id}><div><StatusBadge status={shipment.status} /><small>{shipment.id}</small></div><h2>{shipment.customer}</h2><p>{shipment.destination} · {shipment.waybill}</p>{shipment.ndrActions?.length ? <dl><dt>Latest UPL</dt><dd>{shipment.ndrActions.at(-1).uplId}</dd><dt>Action</dt><dd>{shipment.ndrActions.at(-1).action} · {shipment.ndrActions.at(-1).status}</dd></dl> : null}<div><button type="button" disabled={Boolean(ndrSubmitting)} onClick={() => submitNdrAction(shipment, "RE-ATTEMPT")}>{ndrSubmitting === `${shipment.id}:RE-ATTEMPT` ? "Submitting..." : "Re-attempt"}</button><button type="button" disabled={Boolean(ndrSubmitting)} onClick={() => submitNdrAction(shipment, "PICKUP_RESCHEDULE")}>{ndrSubmitting === `${shipment.id}:PICKUP_RESCHEDULE` ? "Submitting..." : "Reschedule pickup"}</button></div></article>) : <div className="admin-empty admin-card">No NDR shipments are currently available.</div>}</div></section>}

          {active === "rto" && <section className="admin-card admin-table-card admin-full-card"><div className="admin-table-toolbar"><div><strong>Return-to-origin orders</strong><span>Monitor reverse transit and seller communication.</span></div><button className="admin-compact-primary" type="button" onClick={() => flash("RTO manifest generated.")}>Generate manifest</button></div><ShipmentTable shipments={shipments.filter((item) => item.status === "RTO")} onStatusChange={changeStatus} /></section>}

          {active === "customers" && <section className="admin-card admin-table-card admin-full-card"><div className="admin-table-toolbar"><div><strong>{filteredCustomers.length} customer accounts</strong><span>Enable or disable client-panel access without exposing authentication secrets.</span></div><button className="admin-compact-primary" type="button" onClick={() => flash("New users register from the client panel and appear here automatically.")}>Invite user</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Business</th><th>Contact</th><th>City</th><th>Shipments</th><th>Status</th><th>Access</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr className={customer.status === "Disabled" ? "is-disabled" : ""} key={customer.id}><td><strong>{customer.name}</strong><small>{customer.id}</small></td><td>{customer.business}</td><td><span>{customer.email}</span><small>{customer.phone}</small></td><td>{customer.city}</td><td>{customer.shipments || 0}</td><td><StatusBadge status={customer.status || "Active"} /></td><td><button className={`admin-switch${customer.status === "Disabled" ? "" : " is-on"}`} type="button" onClick={() => changeCustomerAccess(customer)}><i></i><span>{customer.status === "Disabled" ? "Off" : "On"}</span></button></td></tr>)}</tbody></table></div></section>}

          {active === "pickups" && <section className="admin-list-grid">{pickupRequests.length ? pickupRequests.map((pickup) => <article className="admin-card admin-pickup-card" key={pickup.id}><div className="admin-pickup-time"><strong>{pickup.pickupTime?.slice(0, 5) || "—"}</strong><span>{pickup.pickupDate}</span></div><div><StatusBadge status={pickup.status} /><h2>{pickup.pickupLocation}</h2><p>{pickup.id} · {pickup.expectedPackageCount} expected packages</p></div><button type="button" onClick={() => pickup.status === "Completed" ? loadDashboard() : completePickupRequest(pickup)}>{pickup.status === "Completed" ? "Refresh" : "Confirm collected"}</button></article>) : <div className="admin-empty admin-card">No Delhivery pickup requests have been scheduled.</div>}</section>}

          {active === "finance" && <><section className="admin-metrics"><MetricCard label="COD exposure" value={formatMoney(codValue)} note={`${shipments.filter((item) => item.payment === "COD").length} shipments`} tone="green" icon="wallet" /><MetricCard label="Prepaid value" value={formatMoney(prepaidValue)} note={`${shipments.filter((item) => item.payment === "Prepaid").length} shipments`} tone="blue" icon="wallet" /><MetricCard label="Gross booked value" value={formatMoney(codValue + prepaidValue)} note="Current shipment set" tone="purple" icon="grid" /><MetricCard label="Settlement health" value="—" note="Connect billing API" tone="amber" icon="support" /></section><section className="admin-card admin-finance-card"><div className="admin-card-head"><div><p>COLLECTION MIX</p><h2>Payment distribution</h2></div></div><div className="admin-finance-bar"><i style={{ width: `${(codValue / Math.max(codValue + prepaidValue, 1)) * 100}%` }}></i></div><div className="admin-finance-legend"><span><i className="is-cod"></i>COD <strong>{formatMoney(codValue)}</strong></span><span><i className="is-prepaid"></i>Prepaid <strong>{formatMoney(prepaidValue)}</strong></span></div></section></>}

          {Object.hasOwn(managementPages, active) && <ManagementWorkspace page={active} flash={flash} search={search} records={controlState.resources[active] || []} onRecordsChange={(records) => changeControlState({ ...controlState, resources: { ...controlState.resources, [active]: records } })} />}

          {["serviceability", "rate", "tracking", "payment-options", "billing-preferences", "about", "rate-terms", "password", "api", "developer"].includes(active) && <ToolWorkspace page={active} shipments={shipments} connection={connection} sourceLabel={sourceLabel} flash={flash} controlState={controlState} onControlChange={changeControlState} />}

          {active === "settings" && <section className="admin-card admin-settings-card"><div><p>DATA CONNECTION</p><h2>Admin API</h2><span>The admin panel reads customer and shipment records from this shared backend.</span></div><dl><div><dt>Base URL</dt><dd>{API_BASE_URL}</dd></div><div><dt>Dashboard endpoint</dt><dd>GET /api/admin/dashboard</dd></div><div><dt>Status update</dt><dd>PATCH /api/admin/shipments/:id/status</dd></div><div><dt>Authentication</dt><dd>Bearer token via POST /api/admin/auth/login</dd></div><div><dt>Current state</dt><dd><span className={`admin-connection-dot is-${connection}`}></span>{sourceLabel}</dd></div></dl></section>}
        </div>
      </main>
      {toast && <div className="admin-toast" role="status">{toast}</div>}
    </div>
  );
}

export default AdminApp;
