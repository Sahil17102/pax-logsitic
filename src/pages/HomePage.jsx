const services = [
  {
    tone: "card-coral",
    icon: "↗",
    title: "City courier",
    image: "/assets/pax-last-mile-delivery.png",
    imageAlt: "Pax last-mile courier in Hyderabad",
    tag: "Hyderabad pickup",
    description: "Documents and parcels across the city, coordinated through one local desk.",
    link: "/contact",
    linkText: "Plan a pickup",
    visual: "photo",
  },
  {
    tone: "card-yellow",
    icon: "□",
    title: "Live journey",
    description: "Follow the shipment stage with a simple reference and a clear status view.",
    link: "/track",
    linkText: "Track a shipment",
    visual: "tracking",
  },
  {
    tone: "card-green",
    icon: "₹",
    title: "Clear estimate",
    description: "Start with route, weight and speed before confirming the final service.",
    link: "/estimate",
    linkText: "Check an estimate",
    visual: "estimate",
  },
  {
    tone: "card-purple",
    icon: "+",
    title: "Business dispatch",
    description: "Recurring pickup assistance for sellers, offices and growing teams.",
    link: "/contact",
    linkText: "Discuss your volume",
    visual: "dashboard",
  },
];

const values = [
  ["value-pink", "01", "Talk to a person", "Call or email a Hyderabad-based contact when the shipment needs attention."],
  ["value-blue", "02", "Start with clarity", "See a useful indicative range before you confirm the final service."],
  ["value-mint", "03", "Know the stage", "A simple tracking journey keeps each major handoff understandable."],
  ["value-orange", "04", "Scale the support", "Move from one parcel to recurring business dispatch assistance."],
];

const faqs = [
  ["How do I get a final shipping price?", "Use the indicative estimator, then share parcel dimensions and exact route with our team for confirmation."],
  ["Can Pax help with recurring business pickups?", "Yes. Share your usual shipment count, routes and pickup schedule so the team can suggest a workable dispatch flow."],
  ["What do I need for tracking?", "A Pax shipment reference. The website includes a demo flow; live status requires the operations data connection."],
  ["Where is the Pax Logistics desk?", "House No. 3-6-105, Flat No. 105, Himayat Nagar, Hyderabad, Telangana 500029."],
];

function ServiceVisual({ service }) {
  if (service.visual === "photo") {
    return (
      <div className="solution-visual photo-visual">
        <img src={service.image} alt={service.imageAlt} />
        <span className="photo-tag">{service.tag}</span>
      </div>
    );
  }

  if (service.visual === "tracking") {
    return (
      <div className="solution-visual mockup-visual">
        <div className="phone-mockup">
          <div className="phone-top"><i></i><span>PAX SHIPMENT</span><b>•••</b></div>
          <div className="phone-body">
            <span className="tiny-label">REFERENCE</span>
            <strong>PAX-260729</strong>
            <div className="phone-progress">
              <i className="done"></i><span></span><i className="done"></i><span></span><i className="active"></i><span></span><i></i>
            </div>
            <div className="phone-update"><small>Latest update</small><b>Moving to delivery hub</b></div>
          </div>
        </div>
        <span className="float-bubble bubble-one">Picked up ✓</span>
        <span className="float-bubble bubble-two">In transit</span>
      </div>
    );
  }

  if (service.visual === "estimate") {
    return (
      <div className="solution-visual quote-visual">
        <div className="route-chip"><span>500029</span><i>→</i><span>400001</span></div>
        <div className="quote-panel">
          <small>INDICATIVE RANGE</small>
          <strong>₹180 – ₹230</strong>
          <div><span>Standard</span><b>2 kg</b></div>
          <div><span>Pickup</span><b>Himayat Nagar</b></div>
          <button type="button">Review option</button>
        </div>
      </div>
    );
  }

  return (
    <div className="solution-visual dashboard-visual">
      <div className="dash-head"><span>Dispatch board</span><i>July</i></div>
      <div className="dash-chart">
        {["38%", "65%", "48%", "82%", "70%", "92%"].map((height) => (
          <span key={height} style={{ "--h": height }}></span>
        ))}
      </div>
      <div className="dash-rows"><span>Ready for pickup <b>08</b></span><span>In movement <b>12</b></span></div>
    </div>
  );
}

export default function PaxLogisticsHome() {
  return (
    <main id="main">
      <section className="product-hero">
        <div className="shell product-hero-grid">
          <div className="product-hero-copy">
            <p className="eyebrow"><span></span> Hyderabad courier & logistics</p>
            <h1>Every parcel.<br /><em>One clear journey.</em></h1>
            <p className="lead">City pickups, domestic shipping and business dispatch—coordinated by one accessible Hyderabad team.</p>
            <div className="hero-actions">
              <a className="button button-coral" href="/estimate">Get an estimate <span>→</span></a>
              <a className="button button-cream" href="/track">Track shipment</a>
            </div>
            <div className="hero-trust">
              <span><i>01</i> Local support</span>
              <span><i>02</i> Clear stages</span>
              <span><i>03</i> Flexible service</span>
            </div>
          </div>

          <div className="hero-product-collage" aria-label="Pax Logistics shipment experience">
            <div className="hero-colour-block"></div>
            <div className="hero-image-card">
              <img src="/assets/pax-real-courier.jpg" alt="Courier loading parcels into a delivery van" />
              <span>Last-mile, handled.</span>
            </div>
            <div className="hero-track-ui">
              <div className="hero-ui-head"><span>PAX / TRACK</span><b>Live</b></div>
              <p>Shipment PAX-260729</p>
              <strong>Moving to delivery hub</strong>
              <div className="hero-ui-route">
                <i className="done">✓</i><span></span><i className="done">✓</i><span></span><i className="active"></i><span></span><i></i>
              </div>
              <div className="hero-ui-labels"><small>Booked</small><small>Pickup</small><small>Transit</small><small>Delivery</small></div>
            </div>
            <div className="hero-route-card">
              <small>INDICATIVE ROUTE</small>
              <div><strong>500029</strong><span>→</span><strong>400001</strong></div>
              <p>Standard · 2 kg</p>
            </div>
            <div className="hero-roundel">PAX<br /><small>LOGISTICS</small></div>
          </div>
        </div>
        <div className="hero-marquee" aria-label="Pax Logistics services">
          <div className="marquee-track">
            <span>City courier</span><i>✦</i><span>Domestic shipping</span><i>✦</i><span>Business dispatch</span><i>✦</i><span>Freight support</span><i>✦</i>
            <span>City courier</span><i>✦</i><span>Domestic shipping</span><i>✦</i><span>Business dispatch</span><i>✦</i><span>Freight support</span><i>✦</i>
          </div>
        </div>
      </section>

      <section className="section solutions-section">
        <div className="wide-shell">
          <div className="big-heading centre reveal">
            <p className="eyebrow">One logistics desk. Four ways to move.</p>
            <h2>Choose what your shipment needs.</h2>
            <p>Fast when it is urgent. Practical when budget matters. Flexible when your business grows.</p>
          </div>
          <div className="colour-card-rail">
            {services.map((service) => (
              <article className={`solution-card ${service.tone} reveal`} key={service.title}>
                <header><span className="round-glyph">{service.icon}</span><h3>{service.title}</h3></header>
                <ServiceVisual service={service} />
                <div className="solution-copy">
                  <p>{service.description}</p>
                  <a href={service.link}>{service.linkText} <span>→</span></a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="journey-section section">
        <div className="wide-shell">
          <div className="big-heading centre reveal">
            <p className="eyebrow">A connected shipping journey</p>
            <h2>From “send” to safely received.</h2>
          </div>
          <div className="journey-board reveal">
            <div className="journey-head">
              <div className="active"><span>01</span><strong>Book</strong><small>Shipment details</small></div>
              <div><span>02</span><strong>Pickup</strong><small>Handover planned</small></div>
              <div><span>03</span><strong>Move</strong><small>Route in progress</small></div>
              <div><span>04</span><strong>Deliver</strong><small>Final confirmation</small></div>
            </div>
            <div className="journey-track">
              <div className="track-bar book"><span>Route</span><span>Weight</span><span>Speed</span></div>
              <div className="track-bar pickup"><span>Ready</span><span>Collected</span></div>
              <div className="track-bar movement"><span>Origin hub</span><span>In transit</span><span>Destination hub</span></div>
              <div className="track-bar delivery"><span>Out for delivery</span><span>Received</span></div>
            </div>
            <div className="journey-loop"><span>Clear communication across every handoff</span></div>
          </div>
        </div>
      </section>

      <section className="operations-section section">
        <div className="shell">
          <div className="operations-copy reveal">
            <p className="eyebrow light">Operations & coordination</p>
            <h2>Built around the work behind every parcel.</h2>
            <p>Pickup, scan, sort, route and delivery—connected by a team you can reach.</p>
            <a className="button button-white" href="/services">Explore services <span>→</span></a>
          </div>
          <div className="operations-photo reveal">
            <img src="/assets/pax-warehouse-operations.png" alt="Parcel sorting team working inside a logistics hub" />
            <div className="photo-overlay"></div>
            <div className="ops-metrics">
              <div><small>01</small><strong>One local desk</strong><span>Direct support</span></div>
              <div><small>02</small><strong>Four movement types</strong><span>Matched to the job</span></div>
              <div><small>03</small><strong>Clear handoffs</strong><span>Useful updates</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section value-section">
        <div className="shell value-grid">
          <div className="value-heading reveal">
            <p className="eyebrow">Why Pax</p>
            <h2>Logistics without the runaround.</h2>
            <p>Useful choices, direct contact and no unnecessary complexity.</p>
          </div>
          <div className="value-cards">
            {values.map(([tone, number, title, copy]) => (
              <article className={`value-card ${tone} reveal`} key={number}>
                <span>{number}</span><h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section estimate-band">
        <div className="shell estimate-band-grid">
          <div className="band-copy reveal">
            <p className="eyebrow light">Quick estimate</p>
            <h2>Price the route before you book.</h2>
            <p>Enter two PIN codes and a few parcel details. Get an indicative range in under a minute.</p>
          </div>
          <form className="quick-rate-card reveal" id="home-rate-form" noValidate>
            <div className="quick-rate-row">
              <label>Pickup PIN<input id="home-pickup-pin" inputMode="numeric" maxLength="6" placeholder="500029" /></label>
              <span>→</span>
              <label>Delivery PIN<input id="home-delivery-pin" inputMode="numeric" maxLength="6" placeholder="400001" /></label>
            </div>
            <div className="quick-rate-footer">
              <p><small>Need full details?</small><strong>Use our estimate calculator</strong></p>
              <button className="button button-coral" type="submit">Continue <span>→</span></button>
            </div>
            <p className="form-error" id="home-rate-error" role="alert"></p>
          </form>
        </div>
      </section>

      <section className="section faq-section">
        <div className="shell faq-grid">
          <div className="faq-heading reveal">
            <p className="eyebrow">Common questions</p>
            <h2>A few things worth knowing.</h2>
            <p>Need something more specific? Call the team directly.</p>
            <a className="text-link" href="tel:+919494338206">+91 94943 38206</a>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <article className="faq-item reveal" key={question}>
                <button type="button" aria-expanded="false"><span>{question}</span><i>+</i></button>
                <div><p>{answer}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-contact-section">
        <div className="shell home-contact-grid">
          <div className="home-contact-intro reveal">
            <p className="eyebrow light">Pax Logistics · Hyderabad</p>
            <h2>All the details you need.</h2>
            <p>Call, email or visit the Himayat Nagar shipping desk for your next parcel or recurring dispatch requirement.</p>
          </div>
          <div className="home-contact-details reveal">
            <a href="tel:+919494338206"><small>Phone</small><strong>+91 94943 38206</strong><span>→</span></a>
            <a href="mailto:Saipratham650@gmail.com"><small>Email</small><strong>Saipratham650@gmail.com</strong><span>→</span></a>
            <a href="https://maps.google.com/?q=House+Number+3-6-105+Flat+Number+105+Himayat+Nagar+Hyderabad+Telangana+500029" target="_blank" rel="noreferrer">
              <small>Address</small>
              <strong>House No. 3-6-105, Flat No. 105, Himayat Nagar, Hyderabad, Telangana 500029, India</strong>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className="final-cta section">
        <div className="wide-shell final-cta-card reveal">
          <div className="cta-orbit orbit-one"></div>
          <div className="cta-orbit orbit-two"></div>
          <p className="eyebrow light">City · Domestic · Business · Freight</p>
          <h2>Ready to move<br />the next parcel?</h2>
          <div className="final-actions">
            <a className="button button-white" href="/contact">Plan a pickup <span>→</span></a>
            <a className="button button-outline-white" href="tel:+919494338206">Call the team</a>
          </div>
        </div>
      </section>
    </main>
  );
}
