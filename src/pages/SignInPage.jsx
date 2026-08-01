import { useEffect, useMemo, useState } from "react";
import { loginClient, registerClient } from "../services/clientApi.js";

const SESSION_KEY = "pax-user-session";
const USERS_KEY = "pax-demo-users";
const PINCODE_LOOKUP_URL = "https://api.postalpincode.in/pincode";

function goTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
  const [loginMethod, setLoginMethod] = useState("otp");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [remember, setRemember] = useState(true);
  const [signup, setSignup] = useState(defaultSignup);
  const [signupStep, setSignupStep] = useState(1);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pinLookup, setPinLookup] = useState({ status: "idle", message: "" });

  const loginIdIsValid = useMemo(() => {
    const value = loginId.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  const findLoginUser = () => {
    const normalizedId = loginId.trim().toLowerCase();
    return getSavedUsers().find((user) => user.email?.toLowerCase() === normalizedId);
  };

  const requestLoginOtp = (event) => {
    event.preventDefault();
    setLoginError("");
    if (!loginIdIsValid) {
      setLoginError("Enter a valid email address.");
      return;
    }
    const loginUser = findLoginUser();
    if (!loginUser) {
      setLoginError("No Pax account found with this email. Create an account first.");
      return;
    }
    if (loginUser.disabled) {
      setLoginError("This account has been disabled by the Pax administrator. Contact support for access.");
      return;
    }

    setLoginCode(createOtp());
    setLoginOtp("");
  };

  const finishOtpLogin = (event) => {
    event.preventDefault();
    setLoginError("");
    if (!loginCode || loginOtp !== loginCode) {
      setLoginError("That OTP does not match the on-screen code.");
      return;
    }

    const savedUser = findLoginUser();
    if (!savedUser) {
      setLoginError("This account is no longer available. Please create it again.");
      setLoginCode("");
      return;
    }
    if (savedUser.disabled) {
      setLoginError("This account has been disabled by the Pax administrator. Contact support for access.");
      return;
    }

    saveSession(savedUser, remember);
    goTo("/dashboard");
  };

  const finishPasswordLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    if (!loginIdIsValid) {
      setLoginError("Enter a valid email address.");
      return;
    }
    if (loginPassword.length < 8) {
      setLoginError("Enter your password (minimum 8 characters).");
      return;
    }

    const savedUser = findLoginUser();

    try {
      const apiUser = await loginClient(loginId.trim().toLowerCase(), loginPassword, remember);
      saveSession({ ...apiUser, authVersion: 2 }, remember);
      goTo("/dashboard");
      return;
    } catch (apiError) {
      if (!savedUser) {
        setLoginError(apiError.message);
        return;
      }
    }

    if (!savedUser) {
      setLoginError("No Pax account found with these details. Create an account first.");
      return;
    }
    if (savedUser.disabled) {
      setLoginError("This account has been disabled by the Pax administrator. Contact support for access.");
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

  const getSignupStepError = (step) => {
    if (step === 1) {
      if ([signup.fullName, signup.businessName, signup.email, signup.phone].some((value) => !value.trim())) {
        return "Complete all contact details to continue.";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signup.email)) {
        return "Enter a valid business email address.";
      }
      if (!/^[6-9]\d{9}$/.test(signup.phone)) {
        return "Enter a valid 10-digit Indian mobile number.";
      }
    }

    if (step === 2) {
      if (!signup.password || !signup.confirmPassword) {
        return "Enter and confirm your password.";
      }
      if (signup.password.length < 8 || !/[A-Za-z]/.test(signup.password) || !/\d/.test(signup.password)) {
        return "Password must be at least 8 characters and include a letter and number.";
      }
      if (signup.password !== signup.confirmPassword) {
        return "Passwords do not match.";
      }
      if (signup.gstin && !/^[0-9A-Z]{15}$/i.test(signup.gstin)) {
        return "GSTIN should contain 15 characters, or leave it blank.";
      }
    }

    if (step === 3) {
      if ([signup.address, signup.city, signup.state, signup.pincode].some((value) => !value.trim())) {
        return "Complete the primary pickup address.";
      }
      if (!/^[1-9]\d{5}$/.test(signup.pincode)) {
        return "Enter a valid 6-digit PIN code.";
      }
      if (!acceptedTerms) {
        return "Please accept the account terms to continue.";
      }
    }

    return "";
  };

  const advanceSignup = () => {
    const error = getSignupStepError(signupStep);
    setSignupError(error);
    if (!error) setSignupStep((current) => Math.min(current + 1, 3));
  };

  const finishSignup = async (event) => {
    event.preventDefault();
    setSignupError("");
    for (let step = 1; step <= 3; step += 1) {
      const error = getSignupStepError(step);
      if (error) {
        setSignupStep(step);
        setSignupError(error);
        return;
      }
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
    try {
      const apiUser = await registerClient(user);
      Object.assign(user, apiUser, { authVersion: 2 });
    } catch {
      // Preserve local preview signup when the shared API is unavailable.
    }
    const upgradedUsers = users.filter(
      (item) => item.email?.toLowerCase() !== user.email && item.phone !== user.phone,
    );
    localStorage.setItem(USERS_KEY, JSON.stringify([...upgradedUsers, user]));
    saveSession(user, true);
    goTo("/dashboard");
  };

  const handleSignupSubmit = (event) => {
    if (signupStep === 3) {
      finishSignup(event);
      return;
    }
    event.preventDefault();
    advanceSignup();
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setLoginError("");
    setSignupError("");
    setLoginCode("");
    setLoginOtp("");
    if (nextMode === "signup") setSignupStep(1);
  };

  const switchLoginMethod = (nextMethod) => {
    setLoginMethod(nextMethod);
    setLoginError("");
    setLoginCode("");
    setLoginOtp("");
  };

  return (
    <main id="main">
      <section className={`signin-page auth-page-v2 auth-page-v2--${mode}`}>
        <div className="auth-page-orbit auth-page-orbit-one" aria-hidden="true"></div>
        <div className="auth-page-orbit auth-page-orbit-two" aria-hidden="true"></div>
        <div className="shell signin-layout">
          <div className="signin-copy">
            <p className="reference-kicker"><span></span> Pax delivery network</p>
            <h1>Move every parcel.<br /><em>Know every step.</em></h1>
            <p>
              Book pickups, track every handoff and keep courier operations moving
              from one dependable workspace.
            </p>
            <div
              className="auth-visual auth-cinematic-delivery"
              role="img"
              aria-label="Animated Pax courier leaving a Hyderabad logistics hub for a city delivery"
            >
              <div className="cinematic-aurora" aria-hidden="true"></div>
              <div className="cinematic-scene-head">
                <span><i></i> Live city delivery</span>
                <b>HYD <em>•</em> 08:42 PM</b>
              </div>
              <svg
                className="cinematic-world"
                viewBox="0 20 640 245"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="cinematicSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06142e" />
                    <stop offset="52%" stopColor="#173b76" />
                    <stop offset="100%" stopColor="#7b76b7" />
                  </linearGradient>
                  <linearGradient id="cinematicGround" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#163f4b" />
                    <stop offset="100%" stopColor="#092b3d" />
                  </linearGradient>
                  <linearGradient id="cinematicHub" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#edf5ff" />
                    <stop offset="100%" stopColor="#aec4ed" />
                  </linearGradient>
                  <linearGradient id="cinematicVan" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#d9e7ff" />
                  </linearGradient>
                  <radialGradient id="cinematicMoon">
                    <stop offset="0%" stopColor="#fff7dc" />
                    <stop offset="72%" stopColor="#ffd891" />
                    <stop offset="100%" stopColor="#ffb963" stopOpacity="0" />
                  </radialGradient>
                  <filter id="cinematicGlow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="cinematicShadow" x="-50%" y="-50%" width="200%" height="220%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#020817" floodOpacity=".5" />
                  </filter>
                </defs>

                <rect width="640" height="285" fill="url(#cinematicSky)" />
                <circle className="cinematic-moon-halo" cx="525" cy="66" r="54" fill="url(#cinematicMoon)" />
                <circle className="cinematic-star cinematic-star-one" cx="426" cy="52" r="1.8" />
                <circle className="cinematic-star cinematic-star-two" cx="462" cy="83" r="1.4" />
                <circle className="cinematic-star cinematic-star-three" cx="578" cy="39" r="1.6" />
                <circle className="cinematic-star cinematic-star-four" cx="354" cy="70" r="1.2" />

                <g className="cinematic-skyline cinematic-skyline--far">
                  <path d="M0 172V133H31V111H57V145H84V94H111V128H139V105H165V172Z" />
                  <path d="M385 172V125H410V99H437V141H462V80H494V116H522V92H548V135H578V103H608V126H640V172Z" />
                </g>
                <g className="cinematic-city-windows">
                  <path d="M92 109h5v6h-5zm0 13h5v6h-5zm398-28h5v7h-5zm0 15h5v7h-5zm96 7h5v7h-5zm13 0h5v7h-5z" />
                </g>

                <path d="M0 166C130 146 221 176 339 159C455 142 541 149 640 133V285H0Z" fill="url(#cinematicGround)" />
                <path className="cinematic-ground-grid" d="M0 204H640M0 244H640M86 166L18 285M174 160L135 285M270 160L253 285M371 155L389 285M472 148L523 285M561 141L632 266" />

                <path className="cinematic-road-shadow" d="M-70 292C130 238 248 266 375 218C484 177 566 180 701 137" />
                <path className="cinematic-road" d="M-70 285C130 231 248 259 375 211C484 170 566 173 701 130" />
                <path className="cinematic-road-edge" d="M-70 263C132 208 247 238 368 192C481 149 560 153 697 109" />
                <path className="cinematic-road-edge cinematic-road-edge--lower" d="M-65 307C128 256 253 281 382 231C489 190 574 193 705 151" />
                <path className="cinematic-road-lane" d="M-70 285C130 231 248 259 375 211C484 170 566 173 701 130" />

                <g className="cinematic-hub" filter="url(#cinematicShadow)">
                  <path className="cinematic-hub-side" d="M39 112L79 87V195L39 213Z" />
                  <path className="cinematic-hub-front" d="M79 87H205V195H79Z" fill="url(#cinematicHub)" />
                  <path className="cinematic-hub-roof" d="M61 76H196L217 92H79Z" />
                  <path className="cinematic-hub-trim" d="M79 92H205V107H79Z" />
                  <path className="cinematic-bay" d="M102 126H164V195H102Z" />
                  <path className="cinematic-bay-lines" d="M106 136H160M106 148H160M106 160H160M106 172H160" />
                  <rect className="cinematic-hub-window" x="174" y="126" width="20" height="26" rx="2" />
                  <text className="cinematic-hub-logo" x="115" y="103">PAX</text>
                  <text className="cinematic-hub-label" x="142" y="103">HYD HUB</text>
                  <ellipse className="cinematic-loader-glow" cx="133" cy="192" rx="44" ry="10" />
                </g>

                <g className="cinematic-parcel cinematic-parcel--one">
                  <path d="M0 5L10 0L20 5L10 11Z" />
                  <path d="M0 5L10 11V22L0 16Z" />
                  <path d="M20 5L10 11V22L20 16Z" />
                </g>
                <g className="cinematic-parcel cinematic-parcel--two">
                  <path d="M0 5L10 0L20 5L10 11Z" />
                  <path d="M0 5L10 11V22L0 16Z" />
                  <path d="M20 5L10 11V22L20 16Z" />
                </g>

                <g className="cinematic-destination" filter="url(#cinematicShadow)">
                  <path className="cinematic-tower-side" d="M536 107L557 96V181L536 190Z" />
                  <path className="cinematic-tower-front" d="M557 96H603V181H557Z" />
                  <path className="cinematic-tower-roof" d="M549 90H596L609 98H557Z" />
                  <path className="cinematic-tower-windows" d="M566 111h10v11h-10zm18 0h10v11h-10zm-18 20h10v11h-10zm18 0h10v11h-10zm-18 20h10v11h-10z" />
                  <circle className="cinematic-beacon-wave cinematic-beacon-wave--one" cx="580" cy="84" r="20" />
                  <circle className="cinematic-beacon-wave cinematic-beacon-wave--two" cx="580" cy="84" r="12" />
                  <path className="cinematic-pin" d="M580 68C571 68 565 74 565 82C565 94 580 105 580 105S595 94 595 82C595 74 589 68 580 68Z" />
                  <circle className="cinematic-pin-core" cx="580" cy="82" r="4" />
                  <text className="cinematic-destination-label" x="579" y="201" textAnchor="middle">JUBILEE HILLS</text>
                </g>

                <g className="cinematic-tree" transform="translate(504 163)">
                  <path d="M9 23V42" /><circle cx="9" cy="13" r="13" /><circle cx="0" cy="20" r="10" /><circle cx="18" cy="21" r="10" />
                </g>
                <g className="cinematic-tree cinematic-tree--small" transform="translate(235 176)">
                  <path d="M9 23V42" /><circle cx="9" cy="13" r="13" /><circle cx="0" cy="20" r="10" /><circle cx="18" cy="21" r="10" />
                </g>

                <g className="cinematic-van" filter="url(#cinematicShadow)">
                  <animateMotion
                    dur="7.2s"
                    repeatCount="indefinite"
                    rotate="auto"
                    path="M126 242 C245 259 319 232 390 204 C468 173 535 169 611 143"
                  />
                  <ellipse className="cinematic-van-shadow" cx="0" cy="18" rx="35" ry="8" />
                  <path className="cinematic-van-body" d="M-38 -18H11V16H-38Z" fill="url(#cinematicVan)" />
                  <path className="cinematic-van-cab" d="M11 -12H27L39 1V16H11Z" fill="url(#cinematicVan)" />
                  <path className="cinematic-van-window" d="M16 -8H25L33 1H16Z" />
                  <path className="cinematic-van-stripe" d="M-38 5H39V11H-38Z" />
                  <circle className="cinematic-van-wheel" cx="-24" cy="17" r="7" />
                  <circle className="cinematic-van-wheel" cx="26" cy="17" r="7" />
                  <circle className="cinematic-van-hubcap" cx="-24" cy="17" r="2.5" />
                  <circle className="cinematic-van-hubcap" cx="26" cy="17" r="2.5" />
                  <text className="cinematic-van-mark" x="-27" y="0">PAX</text>
                  <circle className="cinematic-headlight" cx="38" cy="8" r="3" />
                  <path className="cinematic-headlight-beam" d="M41 5L86 -7V20L41 11Z" />
                </g>
              </svg>
              <div className="cinematic-dispatch-chip">
                <span className="cinematic-dispatch-icon" aria-hidden="true"><i></i></span>
                <div>
                  <small>OUT FOR DELIVERY</small>
                  <strong>6 stops remaining</strong>
                </div>
                <b>LIVE <i></i></b>
              </div>
              <svg className="motion-route-map" viewBox="0 0 640 260" aria-hidden="true">
                <defs>
                  <linearGradient id="paxRouteGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#68e4bd" />
                    <stop offset="48%" stopColor="#70a0ff" />
                    <stop offset="100%" stopColor="#ff9d4d" />
                  </linearGradient>
                  <filter id="paxRouteGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="7" />
                  </filter>
                </defs>
                <path
                  className="motion-route-glow"
                  d="M64 188 C148 92 235 222 330 142 C416 70 493 72 576 112"
                />
                <path
                  className="motion-route-line"
                  d="M64 188 C148 92 235 222 330 142 C416 70 493 72 576 112"
                />
                <g className="motion-route-node motion-route-node--pickup" transform="translate(64 188)">
                  <circle className="motion-node-pulse" r="24" />
                  <circle className="motion-node-ring" r="13" />
                  <circle className="motion-node-core" r="5" />
                  <text x="0" y="43" textAnchor="middle">PICKUP</text>
                </g>
                <g className="motion-route-node motion-route-node--hub" transform="translate(330 142)">
                  <circle className="motion-node-pulse" r="30" />
                  <circle className="motion-node-ring" r="16" />
                  <circle className="motion-node-core" r="6" />
                  <text x="0" y="47" textAnchor="middle">HYD HUB</text>
                </g>
                <g className="motion-route-node motion-route-node--delivery" transform="translate(576 112)">
                  <circle className="motion-node-pulse" r="24" />
                  <circle className="motion-node-ring" r="13" />
                  <path className="motion-node-check" d="M-5 0 -1 4 7 -5" />
                  <text x="0" y="43" textAnchor="middle">DELIVERY</text>
                </g>
                <g className="motion-van">
                  <animateMotion
                    dur="6.5s"
                    repeatCount="indefinite"
                    rotate="auto"
                    path="M64 188 C148 92 235 222 330 142 C416 70 493 72 576 112"
                  />
                  <ellipse className="motion-van-shadow" cx="0" cy="14" rx="27" ry="6" />
                  <path className="motion-van-body" d="M-30-12H8V11H-30Z" />
                  <path className="motion-van-cab" d="M8-8H20L29 1V11H8Z" />
                  <path className="motion-van-window" d="M12-5H19L24 1H12Z" />
                  <circle className="motion-van-wheel" cx="-18" cy="12" r="5" />
                  <circle className="motion-van-wheel" cx="19" cy="12" r="5" />
                  <text className="motion-van-mark" x="-20" y="3">PAX</text>
                </g>
              </svg>
              <div className="motion-scene-status">
                <span className="motion-status-icon" aria-hidden="true">→</span>
                <div>
                  <small>NOW MOVING</small>
                  <strong>Hyderabad → Customer</strong>
                </div>
                <b>ETA TODAY</b>
              </div>
            </div>
            <div className="signin-points">
              <span><i>01</i> Doorstep pickup</span>
              <span><i>02</i> Live shipment tracking</span>
              <span><i>03</i> Pan-India delivery</span>
            </div>
          </div>

          <div className={`signin-card${mode === "signup" ? " signin-card--wide" : " signin-card--login"}`}>
            <div className="auth-brand-row">
              <div className="signin-logo"><img src="/assets/pax-logo.png" alt="PAX — Reaching Further" /></div>
              <span className="auth-secure-pill"><i>✓</i> Customer portal</span>
            </div>
            {mode === "login" ? (
              <form
                className="auth-form login-method-form"
                onSubmit={loginMethod === "otp"
                  ? (loginCode ? finishOtpLogin : requestLoginOtp)
                  : finishPasswordLogin}
                noValidate
              >
                <p className="mini-label">Welcome to Pax</p>
                <h2>Log in to your account.</h2>
                <p className="auth-form-intro">Choose a secure login method and use your registered email address.</p>
                <div className="login-method-tabs" role="tablist" aria-label="Login method">
                  <button
                    className={loginMethod === "otp" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={loginMethod === "otp"}
                    onClick={() => switchLoginMethod("otp")}
                  >
                    Email OTP
                  </button>
                  <button
                    className={loginMethod === "password" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={loginMethod === "password"}
                    onClick={() => switchLoginMethod("password")}
                  >
                    Email + Password
                  </button>
                </div>

                {loginMethod === "otp" && loginCode ? (
                  <>
                    <div className="otp-demo-box">
                      <span>YOUR ON-SCREEN EMAIL CODE</span>
                      <strong>{loginCode}</strong>
                      <small>Demo mode: enter this code below. It expires when you leave this screen.</small>
                    </div>
                    <label>
                      6-digit OTP *
                      <input
                        value={loginOtp}
                        onChange={(event) => setLoginOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter 6-digit code"
                        maxLength="6"
                        autoFocus
                      />
                    </label>
                    <button className="auth-back" type="button" onClick={() => setLoginCode("")}>← Change email address</button>
                  </>
                ) : (
                  <>
                    <label>
                      Email address *
                      <span className="auth-input-with-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6" /></svg>
                        <input
                          value={loginId}
                          onChange={(event) => setLoginId(event.target.value)}
                          type="email"
                          autoComplete="username"
                          placeholder="e.g., yourname@company.com"
                          autoFocus
                        />
                      </span>
                    </label>
                    {loginMethod === "password" && (
                      <label>
                        Password *
                        <span className="password-field auth-input-with-icon">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10V7.5a5.5 5.5 0 0 1 11 0V10M4.5 10h15v10h-15z" /></svg>
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
                    )}
                  </>
                )}

                <div className="signin-options">
                  <label><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> Keep me signed in on this device</label>
                  {loginMethod === "password" && (
                    <button type="button" onClick={() => setLoginError("Password recovery requires the registered email. Contact Pax support for assistance.")}>Forgot password?</button>
                  )}
                </div>
                <p className="form-error auth-error" role="alert">{loginError}</p>
                <button className="button auth-submit-button full-button" type="submit">
                  {loginMethod === "otp" && !loginCode ? "Send email OTP" : "Log in"} <span>→</span>
                </button>
                <p className="signin-note">
                  New user? <button type="button" onClick={() => switchMode("signup")}>Create account here</button>
                </p>
              </form>
            ) : (
              <form className="auth-form signup-form" onSubmit={handleSignupSubmit} noValidate>
                <button className="auth-back signup-auth-back" type="button" onClick={() => switchMode("login")}>← Back to login</button>
                <p className="mini-label">New Pax account</p>
                <h2>Create your workspace.</h2>
                <p className="auth-form-intro">Three short steps—no long form or page scrolling.</p>
                <div className="signup-progress" aria-label={`Account setup step ${signupStep} of 3`}>
                  {[[1, "Contact"], [2, "Security"], [3, "Pickup"]].map(([step, label]) => (
                    <span key={step} className={`${signupStep === step ? "is-active" : ""}${signupStep > step ? " is-complete" : ""}`}>
                      <i>{signupStep > step ? "✓" : step}</i><b>{label}</b>
                    </span>
                  ))}
                </div>

                {signupStep === 1 && (
                  <div className="signup-step-panel">
                    <div className="auth-section-title"><span>01</span><b>Contact details</b></div>
                    <div className="signup-grid">
                      <label>Full name *<input name="fullName" value={signup.fullName} onChange={updateSignup} autoComplete="name" placeholder="Your full name" autoFocus /></label>
                      <label>Business name *<input name="businessName" value={signup.businessName} onChange={updateSignup} autoComplete="organization" placeholder="Company or store name" /></label>
                      <label>Email address *<input name="email" value={signup.email} onChange={updateSignup} type="email" autoComplete="email" placeholder="you@company.com" /></label>
                      <label>Mobile number *<input name="phone" value={signup.phone} onChange={updateSignup} inputMode="numeric" autoComplete="tel" placeholder="10-digit number" maxLength="10" /></label>
                    </div>
                  </div>
                )}

                {signupStep === 2 && (
                  <div className="signup-step-panel">
                    <div className="auth-section-title"><span>02</span><b>Security & business profile</b></div>
                    <div className="signup-grid">
                      <label>Password *<span className="password-field"><input name="password" value={signup.password} onChange={updateSignup} type={showSignupPassword ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters" autoFocus /><button type="button" onClick={() => setShowSignupPassword((visible) => !visible)}>{showSignupPassword ? "Hide" : "Show"}</button></span></label>
                      <label>Confirm password *<input name="confirmPassword" value={signup.confirmPassword} onChange={updateSignup} type={showSignupPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat password" /></label>
                      <label>Account type<select name="accountType" value={signup.accountType} onChange={updateSignup}><option>Business</option><option>Individual</option><option>E-commerce seller</option></select></label>
                      <label>Monthly shipments<select name="monthlyShipments" value={signup.monthlyShipments} onChange={updateSignup}><option>1–50</option><option>51–250</option><option>251–1,000</option><option>1,000+</option></select></label>
                      <label className="span-two">GSTIN <small>(optional)</small><input name="gstin" value={signup.gstin} onChange={updateSignup} maxLength="15" placeholder="15-character GSTIN" /></label>
                    </div>
                  </div>
                )}

                {signupStep === 3 && (
                  <div className="signup-step-panel">
                    <div className="auth-section-title"><span>03</span><b>Primary pickup address</b></div>
                    <div className="signup-grid">
                      <label className="span-two">Address *<textarea name="address" value={signup.address} onChange={updateSignup} rows="2" placeholder="House/building, street, area" autoFocus /></label>
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
                  </div>
                )}

                <p className="form-error auth-error" role="alert">{signupError}</p>
                <div className="signup-step-actions">
                  {signupStep > 1 && <button className="signup-previous" type="button" onClick={() => { setSignupStep((current) => current - 1); setSignupError(""); }}>← Back</button>}
                  <button className="button auth-submit-button" type="submit">
                    {signupStep === 3 ? "Create account & continue" : "Next step"} <span>→</span>
                  </button>
                </div>
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
