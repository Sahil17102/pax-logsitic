const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const mobileLinks = document.querySelectorAll(".mobile-nav a");
const rateForm = document.querySelector("#rate-form");
const rateError = document.querySelector("#rate-error");
const rateResult = document.querySelector("#rate-result");
const rateValue = document.querySelector("#rate-value");
const rateRoute = document.querySelector("#rate-route");
const rateWhatsapp = document.querySelector("#rate-whatsapp");
const trackingForm = document.querySelector("#tracking-form");
const trackingInput = document.querySelector("#tracking-id");
const trackingError = document.querySelector("#tracking-error");
const trackingPanel = document.querySelector("#tracking-panel");
const shownTrackingId = document.querySelector("#shown-tracking-id");
const demoCode = document.querySelector("#demo-code");

document.querySelector("#year").textContent = new Date().getFullYear();

const setMenu = (open) => {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  mobileNav.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};

menuToggle.addEventListener("click", () => {
  setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
});

mobileLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

const updateHeader = () => {
  header.classList.toggle("is-sticky", window.scrollY > 24);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

document.querySelectorAll('input[inputmode="numeric"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, input.maxLength || 6);
  });
});

const isValidPin = (value) => /^[1-9]\d{5}$/.test(value);

rateForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const pickup = document.querySelector("#pickup-pin").value.trim();
  const delivery = document.querySelector("#delivery-pin").value.trim();
  const weight = Number(document.querySelector("#weight").value);
  const speed = document.querySelector("#speed").value;

  rateError.textContent = "";
  rateResult.classList.remove("is-visible");

  if (!isValidPin(pickup) || !isValidPin(delivery)) {
    rateError.textContent = "Please enter two valid 6-digit Indian PIN codes.";
    return;
  }

  const sameZone = pickup.slice(0, 2) === delivery.slice(0, 2);
  const sameRegion = pickup[0] === delivery[0];
  const routeBase = sameZone ? 74 : sameRegion ? 112 : 148;
  const weightCharge = Math.ceil(weight * (sameZone ? 20 : 31));
  const expressMultiplier = speed === "express" ? 1.48 : 1;
  const estimate = Math.round((routeBase + weightCharge) * expressMultiplier);
  const lower = Math.max(79, Math.round(estimate / 10) * 10);
  const upper = Math.round((estimate * 1.28) / 10) * 10;

  rateValue.textContent = `₹${lower}–₹${upper}`;
  rateRoute.textContent = `${pickup} → ${delivery} · ${weight} kg · ${speed === "express" ? "Express" : "Standard"}`;

  const whatsappText = [
    "Hello Pax Logistics,",
    "Please confirm a shipping rate for:",
    `Pickup PIN: ${pickup}`,
    `Delivery PIN: ${delivery}`,
    `Weight: ${weight} kg`,
    `Preference: ${speed}`,
    `Website estimate: ₹${lower}–₹${upper}`,
  ].join("\n");

  rateWhatsapp.href = `https://wa.me/919494338206?text=${encodeURIComponent(whatsappText)}`;
  rateResult.classList.add("is-visible");
});

const showTrackingDemo = (reference) => {
  shownTrackingId.textContent = reference;
  trackingError.textContent = "";
  trackingPanel.classList.remove("flash");
  void trackingPanel.offsetWidth;
  trackingPanel.classList.add("flash");
  trackingPanel.scrollIntoView({ behavior: "smooth", block: "center" });
};

trackingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const reference = trackingInput.value.trim().toUpperCase();

  if (!/^PAX[-\s]?[A-Z0-9]{6,12}$/.test(reference)) {
    trackingError.textContent = "Enter a Pax reference such as PAX-260729.";
    return;
  }

  showTrackingDemo(reference.replace(/\s/g, "-"));
});

demoCode.addEventListener("click", () => {
  trackingInput.value = "PAX-260729";
  showTrackingDemo("PAX-260729");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 },
);

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(element);
});
