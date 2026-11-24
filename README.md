# School ERP: web app

React 18 + Vite, Bootstrap 5 + Bootstrap Icons, plain JavaScript (JSX). No other UI or state libraries. Charts are small SVG components.

## Run

```bash
# in backend/ (API on :5000)
npm run dev
# in web/
npm install
npm run dev        # http://localhost:5173. /api is proxied to http://localhost:5000
npm run lint
npm run build      # outputs to dist/, served by Nginx in production
```

The proxy target can be changed with `VITE_API_PROXY=http://host:port npm run dev`.

In production, serve `dist/` and proxy `/api` to the backend from the **same origin**. The refresh-token cookie is `SameSite=Strict` and scoped to `/api/v1/auth`.

## How it works

- **Auth** (`src/auth/AuthContext.jsx`, `src/api/client.js`)
  - The access token is kept in memory only. On load the app calls `/auth/refresh`, and the httpOnly cookie restores the session.
  - A `TOKEN_EXPIRED` response triggers one refresh, then the request is retried once.
  - Only one refresh request runs at a time, because the API revokes a session when a refresh token is reused.
- **Permissions** come from the tenant context (`/context`). The sidebar (`src/nav.js`) and action buttons only show what the user's effective permissions allow. The API still enforces everything.
- **Navigation:** staff get the full ERP navigation. Parents and students get the family portal (`/my/*`). Platform admins get `/platform/*`.
- **Pages** are grouped by module in `src/pages/*.jsx` and lazy-loaded.
- **Shared components:** `src/components/ui.jsx` (PageHeader, StatCard, StatusBadge, DataTable, Pagination, FilterBar, FormField, Modal, ConfirmDialog, loading, empty and error states, BarChart) and `src/components/pickers.jsx` (session, class/section, student search).
- **Money:** the API uses integer paise. The UI converts with `money()` and `toMinor()` in `src/utils/format.js` and never adds up totals on the client: totals come from the API.
- **Collecting a fee** sends an `idempotencyKey`, so a double submit or a retry cannot charge twice. Success is shown only after the API confirms.
- **Online payment** loads Razorpay Checkout only when a parent clicks *Pay online*. The payment is confirmed through `/portal/fees/orders/verify`, and the webhook records it even if the browser closes.

## Not included yet

Homework, announcements and communication (Phase 11 backend), custom-role editing in the UI (the API supports it), and PDF export. Receipts and report cards are printable pages, so the browser's *Print → Save as PDF* works.
