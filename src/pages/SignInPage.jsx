import { useEffect, useMemo, useState } from "react";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-demo-users";
const PINCODE_LOOKUP_URL = "https://api.postalpincode.in/pincode";

function goTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getSavedUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveSession(user, remember) {
  const { password, ...safeUser } = user;
  const storage = remember ? localStorage : sessionStorage;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  storage.setItem(SESSION_KEY, JSON.stringify(safeUser));
}

const defaultSignup = {
  fullName: "",
  businessName: "",
  accountType: "Business",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  gstin: "",
  monthlyShipments: "1–50",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

export default function SignInPage() {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [remember, setRemember] = useState(true);
  const [signup, setSignup] = useState(defaultSignup);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pinLookup, setPinLookup] = useState({ status: "idle", message: "" });

  const loginIdIsValid = useMemo(() => {
    const value = loginId.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[6-9]\d{9}$/.test(value);
  }, [loginId]);

  useEffect(() => {
    const pincode = signup.pincode;
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPinLookup({ status: "idle", message: "" });
      return undefined;
    }

    const controller = new AbortController();
    const lookupTimer = window.setTimeout(async () => {
      setPinLookup({ status: "loading", message: "Finding city and state…" });
      try {
        const response = await fetch(`${PINCODE_LOOKUP_URL}/${pincode}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("PIN lookup request failed");
        const payload = await response.json();
        const result = payload?.[0];
        const office = result?.PostOffice?.[0];
        if (result?.Status !== "Success" || !office?.District || !office?.State) {
          setPinLookup({ status: "error", message: "PIN code not found. Enter city and state manually." });
          return;
        }

        setSignup((current) => current.pincode === pincode
          ? { ...current, city: office.District, state: office.State }
          : current);
        setPinLookup({
          status: "success",
          message: `${office.District}, ${office.State} found automatically.`,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setPinLookup({ status: "error", message: "Could not look up this PIN right now. Enter city and state manually." });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(lookupTimer);
      controller.abort();
    };
  }, [signup.pincode]);

  const finishLogin = (event) => {
    event.preventDefault();
    setLoginError("");
    if (!loginIdIsValid) {
      setLoginError("Enter a valid email address or 10-digit mobile number.");
      return;
    }
    if (loginPassword.length < 8) {
      setLoginError("Enter your password (minimum 8 characters).");
      return;
    }

    const normalizedId = loginId.trim().toLowerCase();
    const savedUser = getSavedUsers().find(
      (user) => user.email?.toLowerCase() === normalizedId || user.phone === loginId.trim(),
    );

    if (!savedUser) {
      setLoginError("No Pax account found with these details. Create an account first.");
      return;
    }
    if (!savedUser.password) {
      setLoginError("This older preview account has no password. Please create your account again.");
      return;
    }
    if (savedUser.password !== loginPassword) {
      setLoginError("Incorrect password. Check it and try again.");
      return;
    }

    saveSession(savedUser, remember);
    goTo("/dashboard");
  };

  const updateSignup = (event) => {
    const { name, value } = event.target;
    if (name === "pincode") {
      const pincode = value.replace(/\D/g, "").slice(0, 6);
      setSignup((current) => ({
        ...current,
        pincode,
        city: current.pincode === pincode ? current.city : "",
        state: current.pincode === pincode ? current.state : "",
      }));
      return;
    }
    setSignup((current) => ({ ...current, [name]: value }));
  };

  const finishSignup = (event) => {
    event.preventDefault();
    setSignupError("");
    const required = [
      signup.fullName,
      signup.businessName,
      signup.email,
      signup.phone,
      signup.password,
      signup.confirmPassword,
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
    if (signup.password.length < 8 || !/[A-Za-z]/.test(signup.password) || !/\d/.test(signup.password)) {
      setSignupError("Password must be at least 8 characters and include a letter and number.");
      return;
    }
    if (signup.password !== signup.confirmPassword) {
      setSignupError("Passwords do not match.");
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

    const users = getSavedUsers();
    const duplicate = users.find(
      (item) => item.email?.toLowerCase() === signup.email.trim().toLowerCase() || item.phone === signup.phone,
    );
    if (duplicate?.password) {
      setSignupError("An account already exists with this email or mobile number. Please sign in.");
      return;
    }

    const { confirmPassword, ...accountFields } = signup;
    const user = {
      ...accountFields,
      authVersion: 2,
      fullName: signup.fullName.trim(),
      businessName: signup.businessName.trim(),
      email: signup.email.trim().toLowerCase(),
    };
    const upgradedUsers = users.filter(
      (item) => item.email?.toLowerCase() !== user.email && item.phone !== user.phone,
    );
    localStorage.setItem(USERS_KEY, JSON.stringify([...upgradedUsers, user]));
    saveSession(user, true);
    goTo("/dashboard");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setLoginError("");
    setSignupError("");
  };

  return (
    <main id="main">
      <section className="signin-page auth-page-v2">
        <div className="auth-page-orbit auth-page-orbit-one" aria-hidden="true"></div>
        <div className="auth-page-orbit auth-page-orbit-two" aria-hidden="true"></div>
        <div className="shell signin-layout">
          <div className="signin-copy">
            <p className="reference-kicker"><span></span> Pax customer workspace</p>
            <h1>Your deliveries.<br /><em>One clear view.</em></h1>
            <p>
              The same straightforward Pax experience—now for bookings, shipment
              movement, payments, reports and support.
            </p>
            <div className="auth-visual">
              <img src="/assets/pax-domestic-sort-v2.jpg" alt="Pax Logistics domestic parcel operations" />
              <div className="auth-visual-shade"></div>
              <div className="auth-visual-top"><span><i></i> Network active</span><b>HYDERABAD DESK</b></div>
              <div className="auth-visual-card">
                <small>TODAY’S MOVEMENT</small>
                <strong>38 shipments</strong>
                <div><span><i></i> Booked</span><span><i></i> Moving</span><span><i></i> Delivered</span></div>
              </div>
              <div className="auth-visual-route"><span>HYD</span><i></i><b>→</b><i></i><span>INDIA</span></div>
            </div>
            <div className="signin-points">
              <span><i>01</i> Create shipments</span>
              <span><i>02</i> Resolve exceptions</span>
              <span><i>03</i> Review finance</span>
            </div>
          </div>

          <div className={`signin-card${mode === "signup" ? " signin-card--wide" : ""}`}>
            <div className="auth-brand-row">
              <div className="signin-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></div>
              <span className="auth-secure-pill"><i>✓</i> Customer portal</span>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => switchMode("login")}>Log in</button>
              <button className={mode === "signup" ? "is-active" : ""} type="button" onClick={() => switchMode("signup")}>Create account</button>
            </div>

            {mode === "login" ? (
              <form className="auth-form" onSubmit={finishLogin} noValidate>
                <p className="mini-label">Welcome to Pax</p>
                <h2>Log in to your account.</h2>
                <p className="auth-form-intro">Use the email or mobile number registered while creating your account.</p>
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
                <label>
                  Password
                  <span className="password-field">
                    <input
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                    />
                    <button type="button" onClick={() => setShowLoginPassword((visible) => !visible)}>
                      {showLoginPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
                <div className="signin-options">
                  <label><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> Keep me signed in</label>
                  <button type="button" onClick={() => setLoginError("Password recovery requires the registered email. Contact Pax support for assistance.")}>Forgot password?</button>
                </div>
                <p className="form-error auth-error" role="alert">{loginError}</p>
                <button className="button auth-submit-button full-button" type="submit">Log in <span>→</span></button>
                <p className="signin-note">
                  New to Pax? <button type="button" onClick={() => switchMode("signup")}>Create your account first</button>
                </p>
              </form>
            ) : (
              <form className="auth-form signup-form" onSubmit={finishSignup} noValidate>
                <p className="mini-label">New Pax account</p>
                <h2>Create your workspace.</h2>
                <p className="auth-form-intro">Complete these details once, then use your email/mobile and password to log in.</p>
                <div className="auth-section-title"><span>01</span><b>Account details</b></div>
                <div className="signup-grid">
                  <label>Full name *<input name="fullName" value={signup.fullName} onChange={updateSignup} autoComplete="name" placeholder="Your full name" /></label>
                  <label>Business name *<input name="businessName" value={signup.businessName} onChange={updateSignup} autoComplete="organization" placeholder="Company or store name" /></label>
                  <label>Email address *<input name="email" value={signup.email} onChange={updateSignup} type="email" autoComplete="email" placeholder="you@company.com" /></label>
                  <label>Mobile number *<input name="phone" value={signup.phone} onChange={updateSignup} inputMode="numeric" autoComplete="tel" placeholder="10-digit number" maxLength="10" /></label>
                  <label>Password *<span className="password-field"><input name="password" value={signup.password} onChange={updateSignup} type={showSignupPassword ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters" /><button type="button" onClick={() => setShowSignupPassword((visible) => !visible)}>{showSignupPassword ? "Hide" : "Show"}</button></span></label>
                  <label>Confirm password *<input name="confirmPassword" value={signup.confirmPassword} onChange={updateSignup} type={showSignupPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat password" /></label>
                  <label>Account type<select name="accountType" value={signup.accountType} onChange={updateSignup}><option>Business</option><option>Individual</option><option>E-commerce seller</option></select></label>
                  <label>Monthly shipments<select name="monthlyShipments" value={signup.monthlyShipments} onChange={updateSignup}><option>1–50</option><option>51–250</option><option>251–1,000</option><option>1,000+</option></select></label>
                  <label className="span-two">GSTIN <small>(optional)</small><input name="gstin" value={signup.gstin} onChange={updateSignup} maxLength="15" placeholder="15-character GSTIN" /></label>
                </div>
                <div className="auth-section-title"><span>02</span><b>Primary pickup address</b></div>
                <div className="signup-grid">
                  <label className="span-two">Address *<textarea name="address" value={signup.address} onChange={updateSignup} rows="2" placeholder="House/building, street, area" /></label>
                  <label>PIN code *<input name="pincode" value={signup.pincode} onChange={updateSignup} inputMode="numeric" autoComplete="postal-code" maxLength="6" placeholder="Enter 6-digit PIN" /></label>
                  <label>City *<input name="city" value={signup.city} onChange={updateSignup} autoComplete="address-level2" placeholder="Auto-filled from PIN" /></label>
                  <label>State *<input name="state" value={signup.state} onChange={updateSignup} autoComplete="address-level1" placeholder="Auto-filled from PIN" /></label>
                  <p className={`pin-lookup-status pin-lookup-${pinLookup.status} span-two`} aria-live="polite">
                    {pinLookup.status === "loading" && <i aria-hidden="true"></i>}
                    {pinLookup.status === "success" && <b aria-hidden="true">✓</b>}
                    {pinLookup.status === "error" && <b aria-hidden="true">!</b>}
                    {pinLookup.message || "City and state will fill automatically after a valid PIN code."}
                  </p>
                </div>
                <label className="auth-consent"><input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" /> <span>I agree to the account terms and consent to shipment-related communication.</span></label>
                <p className="form-error auth-error" role="alert">{signupError}</p>
                <button className="button auth-submit-button full-button" type="submit">Create account & continue <span>→</span></button>
                <p className="signin-note">Already registered? <button type="button" onClick={() => switchMode("login")}>Log in instead</button></p>
              </form>
            )}
            <p className="auth-storage-note">Preview account data is stored only on this browser until the production authentication service is connected.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
