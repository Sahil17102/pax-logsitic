# Pax Logistics Admin

Responsive Vite + React customer and administration apps for Pax Logistics. Render builds the same source in two explicit modes: the customer service uses `VITE_APP_MODE=client`, while the admin service uses `VITE_APP_MODE=admin` and always opens with admin login.

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

Admin static service:

```env
VITE_API_URL=https://pax-logistic.onrender.com
VITE_APP_MODE=admin
```

Backend web service:

```env
FRONTEND_URL=https://paxlogistic.onrender.com
DATABASE_URL=<set securely in the Render dashboard>
```

Never add `DATABASE_URL` to a Vite variable or commit it to this repository. Vite variables are bundled into browser-delivered JavaScript.

## Admin panel

Open `http://127.0.0.1:4173/` locally. Preview mode reads the existing customer-panel keys (`pax-demo-users` and `pax-demo-shipments`) and writes shipment status changes back to the same browser storage.

Production mode expects these authenticated backend endpoints at `VITE_API_URL`:

```text
POST  /api/admin/auth/login
GET   /api/admin/dashboard
PATCH /api/admin/shipments/:id/status
PUT   /api/admin/configuration
PATCH /api/admin/customers/:id/access
GET   /api/client/bootstrap
GET   /api/events
```

`POST /api/admin/auth/login` accepts `{ "username": "...", "password": "..." }` and must return `{ "token": "...", "admin": { ... } }`. `GET /api/admin/dashboard` should return `{ "shipments": [], "customers": [], "activities": [] }` (optionally wrapped in `data`). Admin credentials and database secrets must stay on the backend; never expose them through `VITE_*` variables.

Until production authentication is connected, the static preview login is `admin` / `Pax@1234`. This is deliberately preview-only and must not be treated as production security.

## Shared admin/client state

The repository now includes the Express API in `server/index.js`. It stores the complete platform state in PostgreSQL when `DATABASE_URL` is present and uses an in-memory fallback for local development. Admin configuration changes are published to client panels through server-sent events, with a 30-second client polling fallback.

Admin controls currently propagate:

- customer access enable/disable to client login;
- shipment status changes to client tracking and order lists;
- Prepaid/COD availability to shipment creation and rate calculation;
- courier enable/disable to customer rate options;
- plans, pricing, providers, billing, reconciliation, support and page-content configuration through the shared control document.

Run the API locally with `npm run start:api`. Render Blueprint creates separate client/admin static services, the Node API service and PostgreSQL database. Set a strong `ADMIN_PASSWORD` in Render before using production authentication.
