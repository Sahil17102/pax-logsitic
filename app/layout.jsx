export const metadata = {
  title: "Pax Logistics — Courier & Shipping, Hyderabad",
  description:
    "Pax Logistics — dependable courier, parcel and freight support from Hyderabad. Get an estimate, track a shipment or talk to our team.",
  openGraph: {
    title: "Pax Logistics — Every mile, handled.",
    description: "Courier, parcel and freight support with a helpful Hyderabad team.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f2eee5" />
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="shell nav">
            <a className="brand" href="/" aria-label="Pax Logistics home">
              <span className="brand-box">P</span>
              <span className="brand-words"><strong>Pax</strong><small>Logistics</small></span>
            </a>
            <nav className="desktop-nav" aria-label="Primary navigation">
              <a href="/" data-nav="/">Home</a>
              <a href="/services" data-nav="/services">Services</a>
              <a href="/estimate" data-nav="/estimate">Estimate</a>
              <a href="/track" data-nav="/track">Track</a>
              <a href="/contact" data-nav="/contact">Contact</a>
            </nav>
            <a className="nav-phone" href="tel:+919494338206">
              <small>Call us</small>
              <strong>+91 94943 38206</strong>
            </a>
            <button className="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            <a href="/">Home</a>
            <a href="/services">Services</a>
            <a href="/estimate">Estimate</a>
            <a href="/track">Track shipment</a>
            <a href="/contact">Contact</a>
            <a className="button button-dark" href="tel:+919494338206">Call +91 94943 38206</a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div className="shell footer-grid">
            <div>
              <a className="brand footer-brand" href="/">
                <span className="brand-box">P</span>
                <span className="brand-words"><strong>Pax</strong><small>Logistics</small></span>
              </a>
              <p>Clear, practical shipping support from Hyderabad.</p>
            </div>
            <div className="footer-nav">
              <a href="/services">Services</a>
              <a href="/estimate">Estimate</a>
              <a href="/track">Track</a>
              <a href="/contact">Contact</a>
            </div>
            <address className="footer-contact">
              <a href="tel:+919494338206">+91 94943 38206</a>
              <a href="mailto:Saipratham650@gmail.com">Saipratham650@gmail.com</a>
              <span>House No. 3-6-105, Flat No. 105</span>
              <span>Himayat Nagar, Hyderabad, Telangana 500029, India</span>
            </address>
          </div>
          <div className="shell footer-bottom">
            <span>© <span id="year"></span> Pax Logistics</span>
            <span>Hyderabad · Telangana · India</span>
          </div>
        </footer>
        <script src="/script.js" defer />
      </body>
    </html>
  );
}
