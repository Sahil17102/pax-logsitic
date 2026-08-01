const makeRecords = (prefix, rows) => rows.map((cells, index) => ({
  id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
  cells,
  enabled: true,
  updatedAt: new Date().toISOString(),
}));

export const DEFAULT_CONTROL_STATE = {
  revision: 1,
  resources: {
    plans: makeRecords("PLAN", [["Starter", "Rs 0", "50 / month", "Active"], ["Growth", "Rs 1,499", "500 / month", "Active"], ["Enterprise", "Custom", "Unlimited", "Review"]]),
    couriers: makeRecords("CRR", [["Pax Express", "Domestic", "97.2%", "Active"], ["Delhivery", "National", "95.8%", "Active"], ["Blue Dart", "Express", "96.1%", "Active"]]),
    credentials: makeRecords("KEY", [["Pax Express API", "Primary", "Verified today", "Active"], ["Delhivery API", "DLV-2981", "Verified yesterday", "Active"], ["Blue Dart API", "BD-HYD-04", "Needs review", "Review"]]),
    providers: makeRecords("PRV", [["Pax Logistics", "First party", "Pan India", "Active"], ["SouthLine Freight", "Surface", "South India", "Active"], ["Metro Sprint", "Last mile", "8 metros", "Review"]]),
    "pricing-b2b": makeRecords("B2B", [["Within city", "Up to 10 kg", "Rs 180", "Active"], ["Regional", "10-25 kg", "Rs 420", "Active"], ["National", "25-50 kg", "Rs 890", "Active"]]),
    "pricing-b2c": makeRecords("B2C", [["Local", "0.5 kg", "Rs 79", "Active"], ["Metro", "0.5 kg", "Rs 119", "Active"], ["National", "0.5 kg", "Rs 149", "Active"]]),
    invoices: makeRecords("INV", [["INV-260731", "Aarav Retail", "Rs 12,840", "Paid"], ["INV-260724", "Nila Studios", "Rs 8,420", "Paid"], ["INV-260719", "Kite Office", "Rs 5,960", "Due"]]),
    cod: makeRecords("COD", [["COD-731", "Nila Studios", "Rs 18,420", "Processed"], ["COD-728", "Rohan Mehta", "Rs 6,850", "Review"], ["COD-724", "Veda Foods", "Rs 4,120", "Processed"]]),
    wallet: makeRecords("WAL", [["WAL-8042", "Aarav Retail", "+ Rs 5,000", "Credit"], ["WAL-8039", "Kite Office", "- Rs 590", "Debit"], ["WAL-8032", "Nila Studios", "+ Rs 860", "Credit"]]),
    weight: makeRecords("WGT", [["PAX-260714", "2.4 kg", "3.1 kg", "Review"], ["PAX-260702", "5.0 kg", "5.6 kg", "Review"], ["PAX-260691", "1.2 kg", "1.2 kg", "Resolved"]]),
    disputes: makeRecords("DSP", [["DSP-184", "PAX-260714", "Rs 184", "Open"], ["DSP-172", "PAX-260702", "Rs 96", "Open"], ["DSP-160", "PAX-260691", "Rs 0", "Resolved"]]),
    support: makeRecords("SUP", [["SUP-104", "Weight mismatch review", "Operations", "Open"], ["SUP-101", "Delivery address query", "Support", "Open"], ["SUP-096", "COD confirmation", "Finance", "Resolved"]]),
  },
  settings: {
    paymentOptions: { prepaid: true, cod: true, wallet: true, upi: true },
    billing: { weekly: true, gst: true },
    serviceability: { standard: true, express: true, cod: true },
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
