import { useMemo, useState } from "react";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-demo-users";

function goTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSavedUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

const defaultSignup = {
  fullName: "",
  businessName: "",
  accountType: "Business",
  email: "",
  phone: "",
  gstin: "",
  monthlyShipments: "1–50",
  address: "",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "",
};

export default function SignInPage() {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [remember, setRemember] = useState(true);
  const [signup, setSignup] = useState(defaultSignup);
  const [signupOtp, setSignupOtp] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupError, setSignupError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const loginIdIsValid = useMemo(() => {
    const value = loginId.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[6-9]\d{9}$/.test(value);
  }, [loginId]);

  const requestLoginOtp = (event) => {
    event.preventDefault();
    setLoginError("");
    if (!loginIdIsValid) {
      setLoginError("Enter a valid email address or 10-digit mobile number.");
      return;
    }
    setLoginCode(createOtp());
    setLoginOtp("");
  };

  const finishLogin = (event) => {
    event.preventDefault();
    setLoginError("");
    if (loginOtp !== loginCode) {
      setLoginError("That OTP does not match the on-screen code.");
      return;
    }

    const savedUser = getSavedUsers().find(
      (user) => user.email?.toLowerCase() === loginId.trim().toLowerCase() || user.phone === loginId.trim(),
    );
    const user = savedUser || {
      fullName: "Pax Customer",
      businessName: "My shipping workspace",
      email: loginId.includes("@") ? loginId.trim() : "customer@pax.demo",
      phone: loginId.includes("@") ? "9494338206" : loginId.trim(),
      accountType: "Business",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500029",
    };
    const storage = remember ? localStorage : sessionStorage;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    storage.setItem(SESSION_KEY, JSON.stringify(user));
    goTo("/dashboard");
  };

  const updateSignup = (event) => {
    const { name, value } = event.target;
    setSignup((current) => ({ ...current, [name]: value }));
  };

  const requestSignupOtp = (event) => {
    event.preventDefault();
    setSignupError("");
    const required = [
      signup.fullName,
      signup.businessName,
      signup.email,
      signup.phone,
      signup.address,
      signup.city,
      signup.state,
      signup.pincode,
    ];
    if (required.some((value) => !value.trim())) {
      setSignupError("Please complete all required account and pickup-address fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signup.email)) {
      setSignupError("Enter a valid business email address.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(signup.phone) || !/^[1-9]\d{5}$/.test(signup.pincode)) {
      setSignupError("Enter a valid Indian mobile number and 6-digit PIN code.");
      return;
    }
    if (signup.gstin && !/^[0-9A-Z]{15}$/i.test(signup.gstin)) {
      setSignupError("GSTIN should contain 15 characters, or leave it blank.");
      return;
    }
    if (!acceptedTerms) {
      setSignupError("Please accept the account terms to continue.");
      return;
    }
    setSignupCode(createOtp());
    setSignupOtp("");
  };

  const finishSignup = (event) => {
    event.preventDefault();
    setSignupError("");
    if (signupOtp !== signupCode) {
      setSignupError("That OTP does not match the on-screen code.");
      return;
    }
    const user = { ...signup, fullName: signup.fullName.trim(), businessName: signup.businessName.trim() };
    const users = getSavedUsers().filter(
      (item) => item.email?.toLowerCase() !== user.email.toLowerCase() && item.phone !== user.phone,
    );
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    sessionStorage.removeItem(SESSION_KEY);
    goTo("/dashboard");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setLoginError("");
    setSignupError("");
    setLoginCode("");
    setSignupCode("");
  };

  return (
    <main id="main">
      <section className="signin-page">
        <div className="signin-grid-pattern" aria-hidden="true"></div>
        <div className="shell signin-layout">
          <div className="signin-copy">
            <p className="eyebrow light">Pax customer portal</p>
            <h1>Shipping, without the blind spots.</h1>
            <p>
              Book pickups, follow every parcel, review COD and keep support in one
              clear workspace—built in the same practical Pax way.
            </p>
            <div className="signin-preview" aria-hidden="true">
              <div className="signin-preview-top">
                <span><i></i> Live operations</span>
                <b>PAX / CONTROL DESK</b>
              </div>
              <div className="signin-preview-stats">
                <span><small>IN TRANSIT</small><strong>08</strong></span>
                <span><small>DELIVERED</small><strong>24</strong></span>
                <span><small>COD DUE</small><strong>₹18.4k</strong></span>
              </div>
              <div className="signin-preview-route">
                <i className="done">✓</i><span></span><i className="done">✓</i><span></span><i></i>
              </div>
              <div className="signin-preview-labels"><span>Pickup</span><span>In transit</span><span>Delivery</span></div>
            </div>
            <div className="signin-points">
              <span><i>01</i> Create shipments</span>
              <span><i>02</i> Track live movement</span>
              <span><i>03</i> Review billing</span>
            </div>
          </div>

          <div className={`signin-card${mode === "signup" ? " signin-card--wide" : ""}`}>
            <div className="auth-brand-row">
              <div className="signin-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></div>
              <span className="demo-pill">Secure demo</span>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => switchMode("login")}>Sign in</button>
              <button className={mode === "signup" ? "is-active" : ""} type="button" onClick={() => switchMode("signup")}>Create account</button>
            </div>

            {mode === "login" ? (
              <form className="auth-form" onSubmit={loginCode ? finishLogin : requestLoginOtp} noValidate>
                <p className="mini-label">Customer access</p>
                <h2>{loginCode ? "Check your code." : "Welcome back."}</h2>
                {!loginCode ? (
                  <>
                    <label>
                      Email or mobile number
                      <input
                        value={loginId}
                        onChange={(event) => setLoginId(event.target.value)}
                        type="text"
                        autoComplete="username"
                        placeholder="you@company.com or 9876543210"
                        autoFocus
                      />
                    </label>
                    <div className="signin-options">
                      <label><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> Keep me signed in</label>
                      <a href="mailto:Saipratham650@gmail.com?subject=Pax%20account%20access">Need help?</a>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="otp-demo-box">
                      <span>YOUR ON-SCREEN LOGIN CODE</span>
                      <strong>{loginCode}</strong>
                      <small>Demo mode: enter this code below. It expires when you leave this screen.</small>
                    </div>
                    <label>
                      6-digit OTP
                      <input
                        value={loginOtp}
                        onChange={(event) => setLoginOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter code"
                        maxLength="6"
                        autoFocus
                      />
                    </label>
                    <button className="auth-back" type="button" onClick={() => setLoginCode("")}>← Use another email or mobile</button>
                  </>
                )}
                <p className="form-error auth-error" role="alert">{loginError}</p>
                <button className="button button-dark full-button" type="submit">
                  {loginCode ? "Verify & open dashboard" : "Get on-screen OTP"} <span>→</span>
                </button>
                <p className="signin-note">No password needed. This preview stores demo data only in your browser.</p>
              </form>
            ) : (
              <form className="auth-form signup-form" onSubmit={signupCode ? finishSignup : requestSignupOtp} noValidate>
                <p className="mini-label">New Pax account</p>
                <h2>{signupCode ? "Verify your account." : "Start shipping."}</h2>
                {!signupCode ? (
                  <>
                    <div className="auth-section-title"><span>01</span><b>Contact details</b></div>
                    <div className="signup-grid">
                      <label>Full name *<input name="fullName" value={signup.fullName} onChange={updateSignup} autoComplete="name" placeholder="Your full name" /></label>
                      <label>Business name *<input name="businessName" value={signup.businessName} onChange={updateSignup} autoComplete="organization" placeholder="Company or store name" /></label>
                      <label>Email address *<input name="email" value={signup.email} onChange={updateSignup} type="email" autoComplete="email" placeholder="you@company.com" /></label>
                      <label>Mobile number *<input name="phone" value={signup.phone} onChange={updateSignup} inputMode="numeric" autoComplete="tel" placeholder="10-digit number" maxLength="10" /></label>
                      <label>Account type<select name="accountType" value={signup.accountType} onChange={updateSignup}><option>Business</option><option>Individual</option><option>E-commerce seller</option></select></label>
                      <label>Monthly shipments<select name="monthlyShipments" value={signup.monthlyShipments} onChange={updateSignup}><option>1–50</option><option>51–250</option><option>251–1,000</option><option>1,000+</option></select></label>
                      <label className="span-two">GSTIN <small>(optional)</small><input name="gstin" value={signup.gstin} onChange={updateSignup} maxLength="15" placeholder="15-character GSTIN" /></label>
                    </div>
                    <div className="auth-section-title"><span>02</span><b>Primary pickup address</b></div>
                    <div className="signup-grid">
                      <label className="span-two">Address *<textarea name="address" value={signup.address} onChange={updateSignup} rows="2" placeholder="House/building, street, area" /></label>
                      <label>City *<input name="city" value={signup.city} onChange={updateSignup} autoComplete="address-level2" /></label>
                      <label>State *<input name="state" value={signup.state} onChange={updateSignup} autoComplete="address-level1" /></label>
                      <label>PIN code *<input name="pincode" value={signup.pincode} onChange={updateSignup} inputMode="numeric" autoComplete="postal-code" maxLength="6" placeholder="500029" /></label>
                    </div>
                    <label className="auth-consent"><input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" /> <span>I agree to the account terms and consent to shipment-related communication.</span></label>
                  </>
                ) : (
                  <>
                    <div className="otp-demo-box">
                      <span>YOUR ON-SCREEN VERIFICATION CODE</span>
                      <strong>{signupCode}</strong>
                      <small>Demo mode: enter this code to create your workspace.</small>
                    </div>
                    <label>6-digit OTP<input value={signupOtp} onChange={(event) => setSignupOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" maxLength="6" autoFocus /></label>
                    <button className="auth-back" type="button" onClick={() => setSignupCode("")}>← Edit account details</button>
                  </>
                )}
                <p className="form-error auth-error" role="alert">{signupError}</p>
                <button className="button button-dark full-button" type="submit">
                  {signupCode ? "Verify & create workspace" : "Create account with OTP"} <span>→</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
