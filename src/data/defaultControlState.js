export const DEFAULT_CONTROL_STATE = {
  revision: 1,
  resources: {
    plans: [],
    couriers: [],
    credentials: [],
    providers: [],
    "pricing-b2b": [],
    "pricing-b2c": [],
    invoices: [],
    cod: [],
    wallet: [],
    weight: [],
    disputes: [],
    support: [],
  },
  settings: {
    paymentOptions: { prepaid: true, cod: true, wallet: true, upi: true },
    billing: { weekly: true, gst: true },
    serviceability: { standard: true, express: true, cod: true },
  },
  locations: {
    countries: [],
    states: [],
    cities: [],
  },
  content: {
    about: "Pax Logistics provides clear, practical shipping support from Hyderabad to customers across India.",
    rateTerms: "Rates are indicative and may change after courier-measured weight and service validation.",
    maintenanceNotice: "",
  },
};

export function cloneDefaultControlState() {
  return JSON.parse(JSON.stringify(DEFAULT_CONTROL_STATE));
}
