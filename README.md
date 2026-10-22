# Inventory Management System

A full-stack **POS + Inventory Management System** for small retail and sari-sari stores — with QR code scanning and generation, batch and expiry tracking, supplier and receiving records, sales reporting, and a complete audit history. Built to run live on **Vercel** with a **Turso** (libSQL) database.

> **Status:** In active development. Files live in this repository; the app is deployed and hosted on Vercel.

---

## Features

### Operations
- **Dashboard / Sales Overview** — total sales, low-stock alerts, total products (SKUs), monthly revenue chart, inventory status (out of stock / low / high), latest transactions, and top selling products.
- **Cashier (POS)** — search or **scan a QR/barcode** to add items to the cart, price-check mode, Regular / PWD / Senior customer types with discounts, Cash or GCash payment, amount tendered and change, auto-generated OR numbers, printable receipts and reprinting.
- **Inventory** — product images, categories, auto-generated SKUs, multiple units per product with conversion factors and a selling price and barcode per unit, stock levels with reorder points, and CSV product import with a template and preview.
- **Receiving** — delivery records per batch: supplier, invoice number, quantity, cost, expiry date, and release status.
- **Bulk Restock** — restock many products at once with per-row quantity, cost, and expiry, plus bulk apply and a confirmation summary.
- **Product Status** — expired, recalled, damaged, and archived batches; FULL / PARTIAL box status and defective-item counts.
- **Suppliers** — full supplier directory with contact person, email, phone, and address.
- **Storage Areas** — named areas/zones with per-area totals and settled (placed) vs unsettled box counts.

### Reports
- **Sales Report** — filters by date, payment method, customer type, and more; cash vs GCash totals; per-sale details; **Returns & Exchanges**.
- **Inventory Reports** — stock value, low stock, out of stock, near-expiry and expired batches, with CSV export.
- **History Log** — a full audit trail: who did what, when, and on which item, batch, or OR number.

### System
- **Login** — username and password sign-in; the signed-in user is recorded as the cashier/actor on every transaction.
- **QR everywhere** — every product gets a generated QR code (detail view and printable labels); scanning works in the dedicated Scan view and inside the POS. OCR text capture is available as an assist when a code cannot be scanned.
- **Settings** — store profile (name, phone, address, email), theme color, date format, staff/user management, and recently deleted items with restore.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS, Font Awesome 6.5.2 icons |
| Database | Turso (libSQL) via Drizzle ORM |
| QR | In-browser generation and camera scanning (BarcodeDetector + jsQR) |
| OCR | Tesseract.js (client-side assist) |
| Hosting | Vercel (deployed from this GitHub repository) |

---

## Folder Structure

```
.
├── src/
│   ├── app/            # Pages and routes (dashboard, POS, inventory, reports, settings)
│   ├── components/     # Shared UI (sidebar, scanner, tables, modals, receipt)
│   ├── lib/            # Database client, auth, helpers, QR utilities
│   └── server/         # Server actions / API handlers
├── drizzle/            # Database migrations (SQL) + migration journal
├── public/             # Static assets
├── package.json
└── README.md
```

---

## Getting Started (Local)

Prerequisites: **Node.js 20+** (or Bun) and a Turso database (free tier is fine).

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env.local
#    then fill in the values below

# 3. Apply the database migrations
npm run db:migrate

# 4. Run the dev server
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Your Turso database URL (e.g. `libsql://your-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Your Turso database auth token |
| `SESSION_SECRET` | A long random string used to sign login sessions |

> Never commit real values. `.env.local` is git-ignored; in production these are set in the Vercel dashboard.

---

## Database Setup (Turso)

The database is set up by the owner:

1. Create a free account at **turso.tech** and create a database (name it e.g. `inventory-db`).
2. Copy the database **URL** and create/copy an **auth token** from the Turso dashboard.
3. Put both values in `.env.local` (local) or in **Vercel → Project → Settings → Environment Variables** (production).
4. Run `npm run db:migrate` locally once, or let the first deployment's build step apply the migrations in `drizzle/`.

The schema creates all tables: users, products, product units, batches, suppliers, areas, receiving, sales, sale items, returns, movements, history, and settings.

---

## Deployment (Vercel)

1. Push this repository to GitHub (already done — this is the source of truth).
2. In **Vercel**, choose **Add New → Project** and import this GitHub repository.
3. Add the environment variables above in the project's settings.
4. Deploy. Every push to the `main` branch redeploys automatically.

Camera scanning requires HTTPS — Vercel provides it by default.

---

## Default Login

| Username | Password |
|---|---|
| `admin` | `admin123` |

**Change this password immediately after your first login** (Settings → User Management). The default exists only so the owner can get in the first time.

---

## Notes

- All amounts are in Philippine pesos (₱). Stock can never go negative; POS deductions follow FIFO across batches by earliest expiry.
- Every stock change writes a movement record and a history entry — nothing is silently changed.

---

**Owner / Developer:** Steven Joe T. Reyes
