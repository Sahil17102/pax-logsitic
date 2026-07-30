import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import EstimatePage from "./pages/EstimatePage.jsx";
import WeightCalculatorPage from "./pages/WeightCalculatorPage.jsx";
import TrackPage from "./pages/TrackPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import SignInPage from "./pages/SignInPage.jsx";
import { usePageInteractions } from "./usePageInteractions.js";
import { API_BASE_URL } from "./config.js";

const primaryNavItems = [
  ["/services", "Services"],
  ["/rate-calculator", "Rate Calculator"],
  ["/track", "Track Shipment"],
  ["/contact", "Contact"],
];

const utilityNavItems = [
  ["/weight-calculator", "Weight Calculator"],
  ["/sign-in", "Sign In"],
];

const navItems = [...primaryNavItems, ...utilityNavItems];

const footerItems = [
  ["/services", "Services"],
  ["/rate-calculator", "Rate Calculator"],
  ["/weight-calculator", "Weight Calculator"],
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
      <div className="header-utility">
        <div className="shell header-utility-inner">
          <span><i></i> Hyderabad-based courier and logistics support</span>
          <nav aria-label="Utility navigation">
            {utilityNavItems.map(([path, label]) => (
              <AppLink key={path} to={path}>{label}</AppLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="shell nav">
        <AppLink className="brand" to="/" aria-label="Pax Logistics home">
          <span className="brand-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></span>
        </AppLink>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryNavItems.map(([path, label]) => (
            <AppLink
              key={path}
              to={path}
              className={({ isActive }) => isActive ? "is-active" : ""}
            >
              {label}
            </AppLink>
          ))}
        </nav>
        <a className="nav-phone" href="tel:+919494338206">
          <small>Talk to our team</small>
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
        {navItems.map(([path, label]) => (
          <AppLink key={path} to={path}>{label}</AppLink>
        ))}
        <a className="button button-dark" href="tel:+919494338206">Call logistics desk</a>
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
            <span className="brand-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></span>
          </AppLink>
          <p>Clear, practical shipping support from Hyderabad.</p>
        </div>
        <div className="footer-nav">
          {footerItems.map(([path, label]) => <AppLink key={path} to={path}>{label}</AppLink>)}
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
      "/estimate": "Rate Calculator — Pax Logistics",
      "/rate-calculator": "Rate Calculator — Pax Logistics",
      "/weight-calculator": "Weight Calculator — Pax Logistics",
      "/track": "Track a Shipment — Pax Logistics",
      "/contact": "Contact — Pax Logistics",
      "/sign-in": "Sign In — Pax Logistics",
    };
    document.title = titles[location.pathname] || titles["/"];
  }, [location.pathname]);

  const pages = {
    "/": <HomePage />,
    "/services": <ServicesPage />,
    "/estimate": <EstimatePage />,
    "/rate-calculator": <EstimatePage />,
    "/weight-calculator": <WeightCalculatorPage />,
    "/track": <TrackPage />,
    "/contact": <ContactPage />,
    "/sign-in": <SignInPage />,
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
    <div data-api-base={API_BASE_URL}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header pathname={location.pathname} />
      <SiteRoutes location={location} />
      <Footer />
    </div>
  );
}
