export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://pax-logistic.onrender.com"
).replace(/\/+$/, "");

export const APP_MODE = import.meta.env.VITE_APP_MODE || "auto";

// Preview data is opt-in so production builds never silently mix browser demo
// records with authoritative API records.
export const ENABLE_PREVIEW_MODE = import.meta.env.VITE_ENABLE_PREVIEW_MODE === "true";
