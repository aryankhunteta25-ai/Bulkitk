# Bulk It — Backend

Node.js/Express + MongoDB (Mongoose) + Socket.IO backend for the Bulk It wholesale ordering app.
Covers auth, addresses (geocoded, geospatial), catalog with bulk slab pricing, orders, real-time
delivery tracking, Google Maps routing/navigation, masked click-to-call, loyalty (Crate Coins),
credit line (Udhaar), and the "request any item" flow.

> **Deploying this?** See `DEPLOYMENT.md` for a step-by-step GitHub + Railway walkthrough.

## 1. Setup

```bash
cd bulkit-backend
npm install
cp .env.example .env   # then fill in your real values
```

### Required environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Signs shop-owner auth tokens |
| `GOOGLE_MAPS_API_KEY` | Needs **Geocoding API**, **Directions API**, **Distance Matrix API** enabled |
| `WAREHOUSE_LAT` / `WAREHOUSE_LNG` | Dispatch origin used for routing/ETA |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_CALLER_ID` | Masked click-to-call between shop and rider |
| `CLIENT_ORIGIN` | CORS allow-origin for your frontend |

### Run

```bash
npm run seed   # loads 5 sample bulk products + a demo shop (phone 9999900000 / password123)
npm run dev    # nodemon, local dev
npm start      # production
```

Server boots an HTTP server *and* a Socket.IO server on the same port (default `5000`).

---

## 2. Architecture

```
config/db.js              MongoDB connection
models/                   Mongoose schemas (Shop, Address, Product, Order, DeliveryPartner,
                           ItemRequest, LoyaltyLedger, Vendor, Admin)
services/
  googleMaps.service.js   geocodeAddress, getRoute, getLiveEta, buildNavigationUrl
  call.service.js         Twilio masked call bridging
  pricing.service.js      Bulk slab price calculation
  loyalty.service.js      Crate Coins accrual + tier recompute
  csvImport.service.js    Bulk product CSV parsing/validation + template generator
controllers/               Request handlers (incl. vendor, admin, adminProduct, adminVendor)
routes/                    Express routers, mounted under /api
sockets/trackingSocket.js  Real-time location + ETA + status + marketplace notifications
middleware/                auth (JWT: shop/vendor/admin), upload (multer/CSV), validation, errors
scripts/
  seed.js                 Sample products + demo shop
  seedAdmin.js            Demo admin + verified demo vendor + one pending product
```

---

## 3. REST API

Base URL: `http://localhost:5000/api`
Authenticated routes require `Authorization: Bearer <token>` (returned from `/auth/login`).

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | shopName, ownerName, phone, password, email?, gstin? | Creates shop account |
| POST | `/auth/login` | phone, password | Returns JWT |
| GET | `/auth/me` | — | Current shop profile |

### Addresses (MongoDB, geocoded via Google Maps on save)
| Method | Path | Notes |
|---|---|---|
| GET | `/addresses` | List this shop's saved addresses |
| POST | `/addresses` | addressLine, city, state, pincode, landmark?, dropOffInstructions?, isDefault? — geocoded server-side, stored as a GeoJSON `Point` with a `2dsphere` index |
| PATCH | `/addresses/:id` | Re-geocodes automatically if the address text changes |
| DELETE | `/addresses/:id` | |

### Catalog
| Method | Path | Notes |
|---|---|---|
| GET | `/catalog?category=&search=&page=&limit=` | Public, text-indexed search |
| GET | `/catalog/:id` | Single product with slab table |

### Orders
| Method | Path | Notes |
|---|---|---|
| POST | `/orders` | `{ items:[{productId, qty}], addressId, paymentMethod, deliverySlot }` — validates stock, applies bulk slabs, checks Udhaar credit limit, computes the warehouse→shop route via Google Directions, credits Crate Coins, emits `order:created` over the shop's socket room |
| GET | `/orders` | This shop's order history |
| GET | `/orders/:id` | Single order + `navigationUrl` |
| GET | `/orders/:id/navigation` | Google Maps deep link: `https://www.google.com/maps/dir/?api=1&destination=lat,lng` |

Ops/warehouse status updates now live under `/admin/orders/:id/status` (admin auth) — see §4a.

### Item requests
| Method | Path | Notes |
|---|---|---|
| POST | `/item-requests` | itemName, brand?, quantityNeeded?, notes? — notifies ops room in real time |
| GET | `/item-requests` | This shop's requests |

Ops responses now live under `/admin/item-requests/:id/respond` (admin auth) — see §4a.

### Loyalty
| Method | Path | Notes |
|---|---|---|
| GET | `/loyalty/summary` | Tier, coin balance, coins needed for next tier |
| GET | `/loyalty/ledger` | Audit trail of earn/redeem/referral entries |
| POST | `/loyalty/redeem` | `{ coins, reason }` |

### Calls (masked click-to-call)
| Method | Path | Notes |
|---|---|---|
| POST | `/calls/orders/:id/call-rider` | Twilio calls the shop owner, then bridges to the rider once answered — neither side sees the other's real number |
| GET/POST | `/calls/twiml/bridge` | Twilio-only webhook, not called by the app directly |

### Tracking
| Method | Path | Notes |
|---|---|---|
| GET | `/tracking/orders/:id` | One-shot snapshot (status, timeline, live ETA, route, last known partner location, navigation URL) — used to render the tracking screen before the socket takes over |

---

## 4a. Marketplace: adding products (platform side + vendor side)

Two separate ways products enter the catalog, both converging on the same `Product` model:

- **Platform side** — Bulk It's own catalog team adds products directly via `/admin/products`.
  These are **auto-approved** (`approvalStatus: 'approved'`) since it's Bulk It's own data.
- **Vendor side** — external suppliers register as a `Vendor`, get **verified** by an admin, then
  submit products via `/vendor-products`. These start as `approvalStatus: 'pending'` and only
  appear in the shop-owner-facing catalog (`GET /catalog`) once an admin approves them.

The public catalog (`GET /catalog`) always filters to `isActive: true, approvalStatus: 'approved'`
— shop owners never see pending or rejected listings, regardless of source.

### Vendor auth & account
| Method | Path | Notes |
|---|---|---|
| POST | `/vendors/register` | vendorName, contactName, phone, password, gstin?, warehouseCity?, warehouseState? — account starts **unverified** |
| POST | `/vendors/login` | phone, password |
| GET | `/vendors/me` | Vendor profile |
| GET | `/vendors/dashboard` | Tool: counts of total/pending/approved/rejected/low-stock listings |

### Vendor product tools (`/vendor-products`, requires vendor auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/vendor-products?status=` | This vendor's own listings, any approval status |
| POST | `/vendor-products` | Submit one product → `pending` (blocked with a clear message until the vendor is verified) |
| PATCH | `/vendor-products/:id` | Edit a listing — any material change on an already-approved product resets it to `pending` |
| PATCH | `/vendor-products/:id/stock` | Tool: `{ delta }` to adjust, or `{ setTo }` to set exactly |
| DELETE | `/vendor-products/:id` | Remove a listing |
| GET | `/vendor-products/csv-template` | Tool: downloads a sample CSV with the exact expected columns |
| POST | `/vendor-products/bulk-upload` | Tool: multipart file field `file` (CSV) → validates every row, inserts valid ones as `pending`, returns per-row errors for the rest |

### Admin product tools (`/admin/products`, requires admin auth)
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/products` | Add a product directly — auto-approved, `sourceType: 'platform'` |
| GET | `/admin/products?status=&sourceType=&vendorId=` | Full catalog view including pending/rejected |
| GET | `/admin/products/pending` | Tool: the vendor-submission approval queue, oldest first |
| POST | `/admin/products/:id/approve` | Notifies the vendor's dashboard in real time |
| POST | `/admin/products/:id/reject` | `{ reason }` — notifies the vendor with the reason |
| PATCH | `/admin/products/:id/toggle-active` | Pull a product off-catalog without deleting it |
| PATCH | `/admin/products/:id/stock` | Tool: same `{ delta }`/`{ setTo }` shape as the vendor version |
| GET | `/admin/products/csv-template` | Tool: same template format as the vendor one |
| POST | `/admin/products/bulk-upload` | Tool: CSV bulk-add, auto-approved (no queue, since it's the platform's own data) |

### Admin vendor management (`/admin/vendors`, requires admin auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/vendors?verified=true\|false` | List vendors |
| POST | `/admin/vendors/:id/verify` | Unlocks the vendor's ability to have products go live |
| PATCH | `/admin/vendors/:id/suspend` | Deactivates the vendor **and** deactivates all their current listings |

### Other admin-gated ops endpoints
| Method | Path | Notes |
|---|---|---|
| PATCH | `/admin/orders/:id/status` | Moves a docket through confirmed → packed → out_for_delivery → delivered |
| PATCH | `/admin/item-requests/:id/respond` | Quote/fulfil/decline a shop's item request |

### CSV bulk-upload format

Both the vendor and admin bulk-upload tools accept the same columns (download `csv-template` from
either endpoint for a working example):

```
name, brand, category, packUnit, packSize, pricePerPack, stockAvailable,
slab1MinQty, slab1DiscountPercent, slab2MinQty, slab2DiscountPercent, slab2FreeDelivery, imageUrl
```

`category` must be one of: `grocery_staples`, `personal_care`, `household`, `beverages`,
`snacks_biscuits`, `dairy_frozen`. Rows that fail validation (missing required column, bad
category, non-positive price) are skipped and reported individually in the response — valid rows
in the same file still get inserted.

### Real-time events added for the marketplace

| Event | Room | Trigger |
|---|---|---|
| `product:submitted` | `admin_team` | Vendor submits a single product |
| `product:bulkSubmitted` | `admin_team` | Vendor's CSV bulk upload completes |
| `product:approved` / `product:rejected` | `vendor_<vendorId>` | Admin acts on a pending product |
| `vendor:verified` | `vendor_<vendorId>` | Admin verifies a vendor account |

Admin dashboards should emit `admin:subscribe` on connect; vendor dashboards should emit
`vendor:subscribe` with `{ vendorId }`.

### Admin accounts

There is intentionally **no public `/admin/register` endpoint** — admin accounts are created via:

```bash
npm run seed:marketplace
```

This creates a demo admin (`admin@bulkit.in` / `admin123`), a verified demo vendor
(phone `9888800000` / `vendor123`), and one pending vendor product so the approval queue isn't
empty on first run. **Change or remove the demo admin password before deploying.**

---

## 4. Real-time (Socket.IO)

Connect to the same host/port as the REST API.

**Client → Server**
| Event | Payload | Who emits it |
|---|---|---|
| `shop:subscribe` | `{ shopId }` | Shop owner's app, on login |
| `order:subscribe` | `{ orderId }` | Tracking screen, on open |
| `ops:subscribe` | — | Warehouse/ops dashboard |
| `partner:locationUpdate` | `{ partnerId, orderId, lat, lng }` | Delivery partner's app, every few seconds while out for delivery |

**Server → Client**
| Event | Payload | Trigger |
|---|---|---|
| `order:created` | `{ order }` | New order placed |
| `order:statusUpdate` | `{ orderId, status, timeline? }` | Ops moves the docket forward |
| `order:locationUpdate` | `{ orderId, lat, lng, liveEta? }` | Every rider GPS ping — this drives the truck icon and ETA countdown on the tracking screen |
| `itemRequest:new` | `{ request }` | Shop submits a new item request (to ops room) |
| `itemRequest:updated` | `{ request }` | Ops responds to a request (to the shop's room) |

ETA recompute is throttled to once per 20 seconds per order (`sockets/trackingSocket.js`) so
rapid GPS pings don't spam the Google Distance Matrix API — location still broadcasts on every
ping, only the ETA math is throttled.

---

## 5. Google Maps integration points

1. **Geocoding** — every saved `Address` is geocoded once and stored as a GeoJSON `Point`
   (`services/googleMaps.service.js#geocodeAddress`).
2. **Directions** — computed once per order at placement time, giving distance, duration, and an
   encoded polyline the frontend can render directly with the Google Maps JS SDK's
   `DirectionsRenderer` (`#getRoute`).
3. **Distance Matrix** — recomputed periodically as the rider's live location updates, powering
   the live ETA countdown (`#getLiveEta`).
4. **Navigation deep link** — `#buildNavigationUrl` / `Order.navigationUrl()` produce a
   `google.com/maps/dir/?api=1&destination=...` URL that opens turn-by-turn navigation directly
   in the Google Maps app on the rider's phone — no embedded map needed on their end.

## 6. Notes on the call feature

Real phone numbers are never exchanged between the shop owner and the delivery partner. The
`/calls/orders/:id/call-rider` endpoint uses Twilio to ring the shop owner first; once they pick
up, Twilio fetches `/calls/twiml/bridge` and dials the rider as a second leg. Swap in any other
voice provider (Exotel, Plivo) by replacing `services/call.service.js` — the route/controller
layer doesn't need to change.

## 7. What's stubbed vs. production-ready

- **Ready**: auth, address CRUD + geocoding, catalog, bulk slab pricing, order placement with
  credit-line enforcement, loyalty ledger, real-time socket pipeline, Google Maps service layer,
  vendor-side and platform-side product management with an approval workflow and CSV bulk-upload tools.
- **You'll need to add for production**: payment gateway webhook for UPI/card,
  a proper delivery-partner mobile client that emits `partner:locationUpdate`, a queueing/
  retry layer around the Google Maps calls (they're currently best-effort with a `console.warn`
  fallback so a Maps outage doesn't block order placement), real image upload/storage (product
  `images` currently just stores whatever URL strings you pass in — wire up S3/Cloudinary and
  validate the URLs server-side), and commission settlement/payout logic for vendors (the
  `commissionRate` field on `Vendor` is stored but nothing currently calculates or pays it out).
