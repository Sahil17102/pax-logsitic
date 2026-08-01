export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://pax-logistic.onrender.com"
).replace(/\/+$/, "");

export const APP_MODE = import.meta.env.VITE_APP_MODE || "auto";
