export default function WeightCalculatorPage() {
  return (
    <main id="main">
      <section className="page-hero weight-page-hero">
        <div className="shell narrow">
          <p className="eyebrow">Weight calculator</p>
          <h1>Measure the space your parcel uses.</h1>
          <p className="lead">Compare actual and volumetric weight to understand which value may be used for shipping.</p>
        </div>
      </section>

      <section className="section page-section calculator-section">
        <div className="shell form-layout">
          <form className="form-card" id="weight-form" noValidate>
            <div className="form-card-tag">Parcel measurements</div>
            <div className="field-row">
              <label>Actual weight (kg)<input id="actual-weight" type="number" min="0.1" step="0.1" placeholder="2.5" required /></label>
              <label>Courier divisor<select id="weight-divisor" defaultValue="5000"><option value="5000">5000 — common air rate</option><option value="6000">6000 — selected services</option></select></label>
            </div>
            <div className="dimension-row">
              <label>Length (cm)<input id="parcel-length" type="number" min="1" step="0.1" placeholder="40" required /></label>
              <span>×</span>
              <label>Width (cm)<input id="parcel-width" type="number" min="1" step="0.1" placeholder="30" required /></label>
              <span>×</span>
              <label>Height (cm)<input id="parcel-height" type="number" min="1" step="0.1" placeholder="25" required /></label>
            </div>
            <p className="form-error" id="weight-error" role="alert"></p>
            <button className="button button-dark full-button" type="submit">Calculate chargeable weight <span>→</span></button>
            <div className="weight-result" id="weight-result" aria-live="polite">
              <div><small>Actual weight</small><strong id="actual-result">—</strong></div>
              <div><small>Volumetric weight</small><strong id="volumetric-result">—</strong></div>
              <div className="chargeable-result"><small>Chargeable weight</small><strong id="chargeable-result">—</strong></div>
            </div>
          </form>

          <aside className="form-aside weight-aside">
            <span className="aside-number">㎏</span>
            <p className="mini-label">How it works</p>
            <h2>Large, light parcels can cost more space.</h2>
            <p>Volumetric weight is calculated as length × width × height divided by the selected courier divisor.</p>
            <a className="text-link" href="/rate-calculator">Continue to rate calculator →</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
