export const metadata = {
  title: "Shipping Estimate — Pax Logistics",
  description: "Get an indicative Pax Logistics shipping estimate.",
};

export default function EstimatePage() {
  return (
    <main id="main">
      <section className="page-hero estimate-page-hero">
        <div className="shell narrow">
          <p className="eyebrow">Quick estimate</p>
          <h1>A useful starting price.</h1>
          <p className="lead">Enter basic route and parcel details. We will show an indicative range that you can confirm with our team.</p>
        </div>
      </section>

      <section className="section page-section">
        <div className="shell form-layout">
          <form className="form-card" id="rate-form" noValidate>
            <div className="form-card-tag">Route details</div>
            <div className="field-row">
              <label>Pickup PIN code<input id="pickup-pin" inputMode="numeric" maxLength="6" placeholder="500029" required /></label>
              <label>Delivery PIN code<input id="delivery-pin" inputMode="numeric" maxLength="6" placeholder="400001" required /></label>
            </div>
            <div className="field-row">
              <label>Approx. weight<select id="weight" defaultValue="0.5"><option value="0.5">Up to 0.5 kg</option><option value="1">Up to 1 kg</option><option value="2">Up to 2 kg</option><option value="5">Up to 5 kg</option><option value="10">Up to 10 kg</option></select></label>
              <label>Service preference<select id="speed" defaultValue="standard"><option value="standard">Standard</option><option value="express">Express</option></select></label>
            </div>
            <p className="form-error" id="rate-error" role="alert"></p>
            <button className="button button-dark full-button" type="submit">Calculate indicative range <span>→</span></button>
            <div className="rate-result" id="rate-result" aria-live="polite">
              <div><small>Indicative shipment range</small><strong id="rate-value">₹—</strong><span id="rate-route"></span></div>
              <a id="rate-whatsapp" href="#" target="_blank" rel="noreferrer">Confirm with the team →</a>
            </div>
          </form>
          <aside className="form-aside estimate-aside">
            <span className="aside-number">₹</span>
            <p className="mini-label">Before you confirm</p>
            <h2>This is an estimate, not a final quote.</h2>
            <p>Final pricing can vary based on dimensions, exact serviceability and shipment type.</p>
            <a className="text-link" href="tel:+919494338206">Call +91 94943 38206</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
