const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const mobileLinks = document.querySelectorAll(".mobile-nav a");
const year = document.querySelector("#year");

if (year) year.textContent = new Date().getFullYear();

const cleanPath = window.location.pathname.replace(/\/$/, "") || "/";
document.querySelectorAll("[data-nav]").forEach((link) => {
  link.classList.toggle("is-active", link.dataset.nav === cleanPath);
});

const setMenu = (open) => {
  if (!menuToggle || !mobileNav) return;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  mobileNav.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};

menuToggle?.addEventListener("click", () => {
  setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
});

mobileLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelectorAll('input[inputmode="numeric"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, input.maxLength || 6);
  });
});

document.querySelectorAll(".faq-item").forEach((item) => {
  const button = item.querySelector("button");

  button?.addEventListener("click", () => {
    const willOpen = !item.classList.contains("is-open");

    document.querySelectorAll(".faq-item.is-open").forEach((openItem) => {
      openItem.classList.remove("is-open");
      openItem.querySelector("button")?.setAttribute("aria-expanded", "false");
    });

    item.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
});

const homeRateForm = document.querySelector("#home-rate-form");

if (homeRateForm) {
  const pickupInput = document.querySelector("#home-pickup-pin");
  const deliveryInput = document.querySelector("#home-delivery-pin");
  const homeRateError = document.querySelector("#home-rate-error");

  homeRateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const pickup = pickupInput.value.trim();
    const delivery = deliveryInput.value.trim();
    const validPin = (value) => /^[1-9]\d{5}$/.test(value);

    if (!validPin(pickup) || !validPin(delivery)) {
      homeRateError.textContent = "Please enter two valid 6-digit Indian PIN codes.";
      return;
    }

    homeRateError.textContent = "";
    window.location.href = `/estimate?pickup=${encodeURIComponent(pickup)}&delivery=${encodeURIComponent(delivery)}`;
  });
}

const rateForm = document.querySelector("#rate-form");

if (rateForm) {
  const rateError = document.querySelector("#rate-error");
  const rateResult = document.querySelector("#rate-result");
  const rateValue = document.querySelector("#rate-value");
  const rateRoute = document.querySelector("#rate-route");
  const rateWhatsapp = document.querySelector("#rate-whatsapp");
  const pickupInput = document.querySelector("#pickup-pin");
  const deliveryInput = document.querySelector("#delivery-pin");
  const query = new URLSearchParams(window.location.search);
  const queryPickup = query.get("pickup") || "";
  const queryDelivery = query.get("delivery") || "";

  if (/^[1-9]\d{5}$/.test(queryPickup)) pickupInput.value = queryPickup;
  if (/^[1-9]\d{5}$/.test(queryDelivery)) deliveryInput.value = queryDelivery;

  rateForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const pickup = pickupInput.value.trim();
    const delivery = deliveryInput.value.trim();
    const weight = Number(document.querySelector("#weight").value);
    const speed = document.querySelector("#speed").value;
    const validPin = (value) => /^[1-9]\d{5}$/.test(value);

    rateError.textContent = "";
    rateResult.classList.remove("is-visible");

    if (!validPin(pickup) || !validPin(delivery)) {
      rateError.textContent = "Please enter two valid 6-digit Indian PIN codes.";
      return;
    }

    const sameZone = pickup.slice(0, 2) === delivery.slice(0, 2);
    const sameRegion = pickup[0] === delivery[0];
    const routeBase = sameZone ? 74 : sameRegion ? 112 : 148;
    const weightCharge = Math.ceil(weight * (sameZone ? 20 : 31));
    const speedMultiplier = speed === "express" ? 1.48 : 1;
    const estimate = Math.round((routeBase + weightCharge) * speedMultiplier);
    const lower = Math.max(79, Math.round(estimate / 10) * 10);
    const upper = Math.round((estimate * 1.28) / 10) * 10;

    rateValue.textContent = `₹${lower}–₹${upper}`;
    rateRoute.textContent = `${pickup} → ${delivery} · ${weight} kg · ${speed === "express" ? "Express" : "Standard"}`;

    const message = [
      "Hello Pax Logistics,",
      "Please confirm a shipping rate for:",
      `Pickup PIN: ${pickup}`,
      `Delivery PIN: ${delivery}`,
      `Weight: ${weight} kg`,
      `Preference: ${speed}`,
      `Website estimate: ₹${lower}–₹${upper}`,
    ].join("\n");

    rateWhatsapp.href = `https://wa.me/919494338206?text=${encodeURIComponent(message)}`;
    rateResult.classList.add("is-visible");
  });
}

const trackingForm = document.querySelector("#tracking-form");

if (trackingForm) {
  const trackingInput = document.querySelector("#tracking-id");
  const trackingError = document.querySelector("#tracking-error");
  const trackingPanel = document.querySelector("#tracking-panel");
  const shownTrackingId = document.querySelector("#shown-tracking-id");
  const demoCode = document.querySelector("#demo-code");

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

  demoCode?.addEventListener("click", () => {
    trackingInput.value = "PAX-260729";
    showTrackingDemo("PAX-260729");
  });
}

const contactForm = document.querySelector("#contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#contact-name").value.trim();
    const phone = document.querySelector("#contact-phone").value.trim();
    const details = document.querySelector("#contact-message").value.trim();
    const error = document.querySelector("#contact-error");

    if (!name || !phone || !details) {
      error.textContent = "Please complete all three fields.";
      return;
    }

    error.textContent = "";
    const message = [
      "Hello Pax Logistics,",
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Shipment details: ${details}`,
    ].join("\n");

    window.open(`https://wa.me/919494338206?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
}
