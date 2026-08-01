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

## Admin panel

The same production build serves the admin panel when either:

- the hostname contains `admin` (for example `pax-logsiticadmin.onrender.com`),
- the URL path is `/admin`, or
- `VITE_APP_MODE=admin` is set on the Render static service.

For local development, open `http://127.0.0.1:4173/admin`. Preview mode reads the existing customer-panel keys (`pax-demo-users` and `pax-demo-shipments`) and writes shipment status changes back to the same browser storage.

Production mode expects these authenticated backend endpoints at `VITE_API_URL`:

```text
POST  /api/admin/auth/login
GET   /api/admin/dashboard
PATCH /api/admin/shipments/:id/status
```

`POST /api/admin/auth/login` accepts `{ "username": "...", "password": "..." }` and must return `{ "token": "...", "admin": { ... } }`. `GET /api/admin/dashboard` should return `{ "shipments": [], "customers": [], "activities": [] }` (optionally wrapped in `data`). Admin credentials and database secrets must stay on the backend; never expose them through `VITE_*` variables.

Until production authentication is connected, the static preview login is `admin` / `Pax@1234`. This is deliberately preview-only and must not be treated as production security.
