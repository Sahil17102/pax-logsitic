export const metadata = {
  title: "Pax Logistics — Courier & Shipping, Hyderabad",
  description:
    "Pax Logistics — dependable courier, parcel and freight support from Hyderabad. Get an estimate, track a shipment or talk to our team.",
  openGraph: {
    title: "Pax Logistics — Every mile, handled.",
    description: "Courier, parcel and freight support with a helpful Hyderabad team.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#07111f" />
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        {children}
        <script src="/script.js" defer />
      </body>
    </html>
  );
}
