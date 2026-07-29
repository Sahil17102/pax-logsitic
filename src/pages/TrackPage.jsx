export const metadata = {
  title: "Track a Shipment — Pax Logistics",
  description: "Track a Pax Logistics shipment reference.",
};

export default function TrackPage() {
  return (
    <main id="main">
      <section className="page-hero track-page-hero">
        <div className="shell narrow">
          <p className="eyebrow">Track shipment</p>
          <h1>One number. A clearer journey.</h1>
          <p className="lead">Enter your Pax reference to view the latest shipment stage.</p>
          <form className="tracking-form" id="tracking-form" noValidate>
            <label className="sr-only" htmlFor="tracking-id">Tracking reference</label>
            <input id="tracking-id" placeholder="Example: PAX-260729" autoComplete="off" />
            <button className="button button-dark" type="submit">Track now</button>
          </form>
          <p className="form-error track-error" id="tracking-error" role="alert"></p>
          <p className="demo-hint">Try demo reference <button type="button" id="demo-code">PAX-260729</button></p>
        </div>
      </section>

      <section className="section page-section tracking-section">
        <div className="shell tracking-card" id="tracking-panel">
          <div className="tracking-head">
            <div><small>Shipment reference</small><strong id="shown-tracking-id">PAX-260729</strong></div>
            <span className="status-badge">In transit</span>
          </div>
          <div className="current-update">
            <span className="simple-box">□</span>
            <div><small>Current update</small><strong>Moving to the next delivery hub</strong></div>
          </div>
          <ol className="tracking-steps">
            <li className="done"><i>✓</i><div><strong>Booked</strong><small>Reference created</small></div></li>
            <li className="done"><i>✓</i><div><strong>Picked up</strong><small>Parcel received</small></div></li>
            <li className="active"><i></i><div><strong>In transit</strong><small>Moving through network</small></div></li>
            <li><i></i><div><strong>Delivered</strong><small>Final delivery</small></div></li>
          </ol>
          <p className="panel-note">Demo tracking view. Live shipment data requires an operations connection.</p>
        </div>
      </section>
    </main>
  );
}
