# Pax Logistics

Responsive Vite + React website for Pax Logistics, Hyderabad.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Deploy on Render

1. Push this repository to GitHub or GitLab.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Render reads `render.yaml`, runs `npm ci && npm run build`, and publishes `dist`.
4. The included rewrite sends all client-side routes to `index.html`.

The site will use a Render `onrender.com` URL. You can attach a custom domain in Render settings.

## Render environment variables

Landing-page static site:

```env
VITE_API_URL=https://pax-logistic.onrender.com
```

Backend web service:

```env
FRONTEND_URL=https://paxlogistic.onrender.com
DATABASE_URL=<set securely in the Render dashboard>
```

Never add `DATABASE_URL` to a Vite variable or commit it to this repository. Vite variables are bundled into browser-delivered JavaScript.
