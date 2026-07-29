export default function SignInPage() {
  return (
    <main id="main">
      <section className="signin-page">
        <div className="shell signin-layout">
          <div className="signin-copy">
            <p className="eyebrow light">Pax customer portal</p>
            <h1>Your dispatch workspace.</h1>
            <p>Sign in to manage shipment references, saved routes and recurring business dispatches.</p>
            <div className="signin-points">
              <span><i>01</i> View shipment activity</span>
              <span><i>02</i> Reuse saved routes</span>
              <span><i>03</i> Keep dispatch details together</span>
            </div>
          </div>

          <form className="signin-card" id="signin-form" noValidate>
            <div className="signin-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></div>
            <p className="mini-label">Account access</p>
            <h2>Welcome back.</h2>
            <label>Email address<input id="signin-email" type="email" autoComplete="email" placeholder="you@company.com" required /></label>
            <label>Password<input id="signin-password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength="6" required /></label>
            <div className="signin-options">
              <label><input id="remember-user" type="checkbox" /> Remember me</label>
              <a href="mailto:Saipratham650@gmail.com?subject=Pax%20account%20access">Need help?</a>
            </div>
            <p className="form-error" id="signin-error" role="alert"></p>
            <p className="signin-status" id="signin-status" role="status"></p>
            <button className="button button-dark full-button" type="submit">Sign in <span>→</span></button>
            <p className="signin-note">Need a business account? <a href="/contact">Contact Pax Logistics</a></p>
          </form>
        </div>
      </section>
    </main>
  );
}
