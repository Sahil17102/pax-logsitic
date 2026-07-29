import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import EstimatePage from "./pages/EstimatePage.jsx";
import TrackPage from "./pages/TrackPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import { usePageInteractions } from "./usePageInteractions.js";

const navItems = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/estimate", "Estimate"],
  ["/track", "Track"],
  ["/contact", "Contact"],
];

function navigateClient(to) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function AppLink({ to, className, children, ...props }) {
  const isActive = window.location.pathname === to;
  const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;

  return (
    <a
      href={to}
      className={resolvedClassName}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigateClient(to);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

function Header({ pathname }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="shell nav">
        <AppLink className="brand" to="/" aria-label="Pax Logistics home">
          <span className="brand-box">P</span>
          <span className="brand-words"><strong>Pax</strong><small>Logistics</small></span>
        </AppLink>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(([path, label]) => (
            <AppLink key={path} to={path} className={({ isActive }) => isActive ? "is-active" : undefined}>{label}</AppLink>
          ))}
        </nav>
        <a className="nav-phone" href="tel:+919494338206">
          <small>Call us</small>
          <strong>+91 94943 38206</strong>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
      <nav className={`mobile-nav${menuOpen ? " is-open" : ""}`} aria-label="Mobile navigation">
        {navItems.map(([path, label]) => <AppLink key={path} to={path}>{label}</AppLink>)}
        <a className="button button-dark" href="tel:+919494338206">Call +91 94943 38206</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <AppLink className="brand footer-brand" to="/">
            <span className="brand-box">P</span>
            <span className="brand-words"><strong>Pax</strong><small>Logistics</small></span>
          </AppLink>
          <p>Clear, practical shipping support from Hyderabad.</p>
        </div>
        <div className="footer-nav">
          {navItems.slice(1).map(([path, label]) => <AppLink key={path} to={path}>{label}</AppLink>)}
        </div>
        <address className="footer-contact">
          <a href="tel:+919494338206">+91 94943 38206</a>
          <a href="mailto:Saipratham650@gmail.com">Saipratham650@gmail.com</a>
          <span>House No. 3-6-105, Flat No. 105</span>
          <span>Himayat Nagar, Hyderabad, Telangana 500029, India</span>
        </address>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Pax Logistics</span>
        <span>Hyderabad · Telangana · India</span>
      </div>
    </footer>
  );
}

function SiteRoutes({ location }) {
  usePageInteractions(location, navigateClient);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const titles = {
      "/": "Pax Logistics — Courier & Shipping, Hyderabad",
      "/services": "Services — Pax Logistics",
      "/estimate": "Shipping Estimate — Pax Logistics",
      "/track": "Track a Shipment — Pax Logistics",
      "/contact": "Contact — Pax Logistics",
    };
    document.title = titles[location.pathname] || titles["/"];
  }, [location.pathname]);

  const pages = {
    "/": <HomePage />,
    "/services": <ServicesPage />,
    "/estimate": <EstimatePage />,
    "/track": <TrackPage />,
    "/contact": <ContactPage />,
  };

  return pages[location.pathname] || <HomePage />;
}

export default function App() {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const updateLocation = () => setLocation({
      pathname: window.location.pathname,
      search: window.location.search,
    });
    window.addEventListener("popstate", updateLocation);
    return () => window.removeEventListener("popstate", updateLocation);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header pathname={location.pathname} />
      <SiteRoutes location={location} />
      <Footer />
    </>
  );
}
