# Totot Traditional Food Hall — "Modern Ethiopian Heritage" Design System

> **Positioning:** *Order the food. Discover the culture. Join the celebration.*
> ወደ ህላዊ ዕም እንን በደህና መጡ

This repo is the **Fana Cafe operational engine** (QR ordering → waiter → kitchen/barista →
cashier → reports → owner admin) rebuilt with a **new Ethiopian cultural front-end** on top.
Totot is the showcase implementation; the same system rebrands for any traditional restaurant
by swapping one config file.

---

## 1. The design trap we avoided

Putting green-yellow-red everywhere, fake "tribal" graphics and Amharic as an afterthought
produces a tourist brochure. Instead: **80% modern premium UI, 20% Ethiopian identity.**
The national colours appear in exactly ONE place — a 3px woven ribbon (`FlagRibbon`).
Everything else is drawn from *craft*, not the flag.

## 2. Tokens (`src/app/globals.css`)

| Token | Hex | Use |
|---|---|---|
| `obsidian` | `#171411` | page background — the hall at night |
| `night` | `#0F0D0B` | footer / hero scrim |
| `coffee` | `#4A3025` | cards, secondary surfaces |
| `ivory` | `#F4EBDD` | text on dark / background on light |
| `terracotta` | `#9A4E32` | primary action (clay red) |
| `gold` | `#B8955A` | hairlines, prices, active states |

Type: **Playfair Display** (Latin display) + **Noto Serif/Sans Ethiopic** (Amharic, real weight —
never a fallback) + **Inter** (UI). Loaded with `display=swap` in `layout.tsx`.

## 3. Woven pattern primitives (`src/components/cultural/Patterns.tsx`)

Inline SVG, zero image requests, recolorable via `currentColor`:
`TibebBand` (netela border), `MesobMark` (identity mark = gathering), `Jebena` (coffee ceremony),
`CrossMotif`, `SpiceMeter`, `DishFlag`, `FlagRibbon`. CSS backgrounds: `.pattern-tibeb`,
`.pattern-weave`, `.pattern-mesob`, `.pattern-injera`. Motion is ceremonial only
(`hallFadeUp`, `weaveReveal`, `steam`, `emberDrift`) and respects `prefers-reduced-motion`.

## 4. What we built (revenue-first)

1. **Hero — "Welcome to the Table."** Amharic leads; one verb: *Explore the Feast*.
2. **Tonight at Totot** (`TonightSection`) — live/next computed from the clock; the dance,
   band and jebena buna as a programme guests plan around. "Order before it starts" nudges
   orders into the quiet window.
3. **Share the Table** (`FeastPackagesSection`) — curated feast packages (For 2 / 4 / Group /
   Fasting / Kitfo / Coffee). The "save ETB n" badge is **computed** from `alaCarte`, never typed.
   This is the average-order-value lever.
4. **The Story Behind the Food** (`StorySection`) — name origin ("Totot" = Gurage *"let's work"*)
   + per-dish region, spice meter, raw/fasting flags, *how to eat it*, pairings. Turns
   hesitation into orders for tourists.
5. **QR menu upgrades** (`CustomerMenuApp`) — cultural header ("የዛሬ ጠረዛ • Table N"), a
   **call-waiter sheet** (need waiter / bill / more injera / coffee / drinks / celebration) and a
   cultural dish panel in the item modal.
6. **Service calls are real end-to-end** — new `service_calls` table + `/api/service-calls`
   (rate-limited guest POST, staff PATCH) published over the existing SSE `orders` channel; the
   **waiter screen shows a live guest-request queue** with emoji, "n min ago" and Accept / Done.

## 4b. CULTURAL CONTENT MANAGER (Phase A — owner control)

The cultural layer is **not** code-locked. A `cultural_content` table plus `/api/cultural` and an
admin **Cultural** tab (`rms/CulturalAdminTab.tsx`) make it owner-operable from the phone.

**Database model** — `cultural_content`: `id`, `kind` (experience | package | story | special),
`data` (typed JSON), `image_url` (a `/api/images/{id}` ref), `status` (draft | published),
`sort_order`, `active`, timestamps. Self-healing migration adds the columns to older DBs.

**API behaviour**
- `GET` public → ACTIVE + PUBLISHED rows only (drafts & inactive hidden); `?kind=x` or all.
- `GET ?scope=admin` → admin-only, returns drafts + inactive too.
- `POST / PUT / DELETE` → admin-only (`requireAdmin`; staff roles can **not** write).
- Validation: integer ids, kind allow-list; bad input → 400/401, never a crash.

**Media** — owner uploads from the phone; client compresses (`compressImage`), server persists
via the existing `persistImageRef` → `cdn_images` (MIME/size/magic-byte validated) and stores the
ref in `image_url`. `countReferences` now includes cultural images so orphan cleanup never
deletes a still-used photo; changed/removed images are cleaned on update/delete.

**Lifecycle** — draft (hidden, editable, previewable) → published+active (public) → active=false
(inactive). No major schema rewrite: it reuses `status` + `active`.

**Preview** — the admin tab's "Preview as customer" renders the REAL customer components
(`TonightSection` / `FeastPackagesSection` / `StorySection`, which accept optional props) fed with
the current incl. unsaved values, so wrong photo / price / missing Amharic are obvious pre-publish.

**Fallback** — public GET returns an empty shape when Postgres is down → customer sections show
bundled Totot defaults; admin writes return **503 (a real error)**, never a fake success.

**Authorization rules (verified)** — public read 200; unauthenticated POST/PUT/DELETE and
`?scope=admin` all **401**; auth precedes validation (bad id unauthenticated is still 401).
Guards asserted by `scripts/verify-cultural-security.mjs` (in `npm test`).

**Tenant scoping (current limitation, documented)** — the system is **single-restaurant per
deployment**: `cultural_content` has no tenant column because each deployment IS one restaurant
(config in `restaurant.ts`). This is deliberate and does **not** block future multi-tenancy: a
`restaurant_id` column can be added later without touching the customer UI. Restaurant A and B are
separate deployments today; nothing in the new code reads or writes across deployments.

## 4c. RUSH MODE (Phase B — first feature)

An owner-only **operational command center** that answers one question: *"Where should the
manager intervene right now?"* It is not a report or analytics dashboard.

- **`GET /api/rush`** (admin-only): admin→200, logged-in staff→403, none→401 (via
  `readAdminSession`/`readStaffSession`, *not* `requireStaffOrAdmin`). Read-only; aggregates
  server-side over OPEN tickets only (`status NOT IN paid/cancelled`, indexed) and returns a
  compact snapshot — the browser never receives full history.
- **Pure compute** in `src/lib/rush.ts` (`computeRush`), unit-testable; thresholds
  (`DEFAULT_RUSH_THRESHOLDS`) are tunable starting points, not gospel.
- **Snapshot**: overall (active tables / open orders / waiting confirmation / ready for payment /
  active service calls), kitchen & barista (cooking / waiting / oldest / delayed), waiter workload
  (counts only — no invented score), and a short **Attention** list sorted by age.
- **No new columns in v1.** Uses existing `tickets.createdAt/updatedAt/status`,
  `ticket_items.createdAt/stationName/stationStatus`, `service_calls.createdAt/status/ackBy`.
  Precision is honest: confirmation age = now−created_at (exact); prep age = now−item.created_at
  (exact); ready age = now−updated_at (**approximate**, labelled "since last update").
- **Realtime**: subscribes to the existing SSE `orders` channel + a 30s tick (ages advance with
  clock time). No heavy polling.
- **UI**: admin **Rush Mode** tab (`rms/RushModeTab.tsx`). Guarded by
  `scripts/verify-rush-security.mjs` (in `npm test`).

## 4d. ORDER HEALTH (Phase B — second feature)

Per-order operational health that answers *"which orders need intervention, and where?"*
It READS the existing order system — no second order table, no schema change.

- **Pure engine** `src/lib/order-health.ts` (`computeOrderHealth`, `classifyAge`), unit-tested by
  `scripts/verify-order-health-logic.mjs` (boundary tests at 6:59/7:00/9:59/10:00/10:01, waiter /
  kitchen / barista delays, ready-approx, service-call separation, worst-item rollup, partial data).
- **States**: `WAITING | HEALTHY | AT_RISK | DELAYED`. `AT_RISK` at `target × warnFraction` (~0.7);
  `DELAYED` at `≥ target`. Thresholds centralized (`DEFAULT_ORDER_HEALTH_THRESHOLDS`):
  confirmMin / kitchenPrepMin / baristaPrepMin / readyMin / serviceMin / warnFraction. The menu
  "prep time" display string is NOT a timing rule.
- **Item → ticket rollup**: per item/station health is computed; the ticket takes the WORST stage
  and a `where` pointer (`WAITER|KITCHEN|BARISTA|PAYMENT`). The offending stage is never hidden.
- **Service calls stay separate**: an unacked call ≥ serviceMin adds a ⚠ table warning WITHOUT
  recoloring food health.
- **`GET /api/order-health`** admin-only (200/403/401), read-only, 3 bounded queries (open tickets +
  their items + new service calls), compact snapshot, no N+1, no history, no customer-sensitive fields.
- **UI**: admin **Order Health** tab (`rms/OrderHealthTab.tsx`), grouped NEEDS ATTENTION / AT RISK /
  HEALTHY, item chips + ⚠ warnings; SSE `orders` refresh + one 20s tick (skipped when hidden).

**Timing accuracy (honest):**
- EXACT — waiting-for-waiter (`now−tickets.createdAt` while `pending_waiter`); waiting-at-station
  (`now−ticket_items.createdAt` while `pending`).
- APPROXIMATE — preparation (item age from `createdAt`; no `accepted_at`/`done_at`) and
  ready-for-payment (`now−updatedAt`, labelled "since last update"; no `ready_at`).
- NOT AVAILABLE / FUTURE ADDITIVE — `tickets.confirmed_at`, `tickets.ready_at`,
  `ticket_items.accepted_at`/`done_at` would make stages exact; deliberately NOT added in v1.

## 4e. REVENUE INTELLIGENCE (Phase B — third feature)

Owner-facing **decision** view that EXTENDS the operational Reports tab (which keeps
today/yesterday/7d/30d operational figures) with ranges, comparison, trend, range-based
item/category analysis, low sellers, order patterns and a rule-based Opportunities list.

- **Authoritative revenue predicate** (payment-verified): `status!=='cancelled' AND
  (status==='paid' OR paymentStatus∈{paid_cash,paid_telebirr,paid_cbe,paid_card})`. Cancelled,
  unpaid-active and completed-but-unpaid are never revenue.
- **Pure engine** `src/lib/revenue-intelligence.ts` (unit-tested): headline (revenue/paid orders/
  AOV/total qty + previous-period deltas), daily trend, hourly + daypart, item & category
  performance (historical transaction price; removed items excluded), payment mix (real enums),
  order patterns ("frequently ordered together", min support), drink-attachment pattern,
  low sellers (only on ranges ≥7d, non-prescriptive wording), and deterministic Opportunities.
- **`GET /api/revenue-intelligence`** admin-only (200/403/401), server-side aggregation, ONE
  bounded tickets scan + ONE batched item read; ranges capped at 366 days; report-on-demand UI
  (no polling).
- **Honesty:** revenue ≠ profit (no cost data → no margin/profit claims); no customer identity,
  no marketing attribution, no feast-package/Tonight/special revenue (no source identity in
  tickets) — all documented as future, not faked.
- **Timezone:** day/hour bucketing centralized in one Addis-aware helper (`dayKey`/`hourOf`,
  `Africa/Addis_Ababa`); a full `timestamptz` migration is deliberately deferred and documented.

## 4f. SPLIT BILLING V1 (settlement-only)

ONE operational ticket = ONE order; splitting affects only how the bill is PAID. No cloned
orders, no seats, no refunds, no change, no tips.

- **`ticket_payments`** table (additive): `id, ticket_id, amount, method (cash|telebirr|cbe|card|
  online), receipt_image (per-payment proof), reference, status (active|void), recorded_by,
  idempotency_key, created_at`. Unique `(ticket_id, idempotency_key)`; index on `ticket_id`.
- **Pure engine** `src/lib/split-billing.ts`: `computeBalance` (server-authoritative remaining),
  `splitEven` (integer shares summing exactly), `validatePayment` (>0 integer, ≤ remaining, not
  cancelled/paid, valid method), `methodToPaymentStatus`.
- **`/api/ticket-payments`**: POST create / PATCH void restricted to **cashier + admin** (waiter/
  kitchen/barista→403, none→401); GET read for any staff. Creation runs in ONE transaction: lock
  ticket (`FOR UPDATE`), re-read active payments, recompute remaining from the CURRENT total,
  validate, insert once (idempotent), and mark `paid`/`closedAt`/`verifiedAt` **only** when the
  recomputed remaining reaches 0 — otherwise the ticket stays open.
- **Cashier UI**: Total/Paid/Remaining, payment history, Add Payment, Pay Remaining, Split-evenly
  (÷2/÷3/÷4) suggestions, optional per-payment digital proof. Legacy "Mark PAID & Release" is only
  offered when a ticket has no settlement records; split tickets close at zero remaining.
- **Reporting compatibility**: revenue/order-count still come from `tickets.totalAmount` (one order);
  payment **mix** in `/api/reports` and Revenue Intelligence now sums `ticket_payments` by method when
  present, falling back to the legacy single method for old tickets — a 6,000 split 2,000/2,500/1,500
  reports Revenue=6,000, Orders=1, correct per-method amounts (no double count).

**NOT V1 (documented, not built):** by-item splitting, quantity splitting, guest/seat assignment,
refunds/void-after-close, cash received/change, tips, service charge, customer accounts.

## 5. Configuration, not hard-coding

Everything venue-specific lives in `src/lib/restaurant.ts` (`RESTAURANT: RestaurantConfig`):
identity (en/am), culture pack, contact, tokens, tonight's programme, packages, dish stories,
and feature modules. `brand.ts` reads from it and repairs any Fana text leaked from an old DB.

## 6. Roadmap (sequenced per product review)

**Phase A — make the design operational (COMPLETE, pending deployment verification)**
- ✅ Cultural Content Manager (Tonight / packages / stories / specials) — owner-controlled, DB-backed.
- ✅ Owner photo upload (phone → cdn_images) for all four content types.
- ✅ Draft → Preview → Publish lifecycle + in-admin customer preview (real components).
- ✅ Security guard for `/api/cultural` in `npm test`.
- Remaining: Coolify/PostgreSQL end-to-end verification (migration, writes, upload, SSE).

**Phase B — busy-night intelligence**
- ✅ **Rush Mode** implemented (admin `/api/rush` + Rush Mode tab); deployment verification pending.
- ✅ **Order Health** implemented (`/api/order-health` + Order Health tab); deployment verification pending.
- ✅ **Revenue Intelligence** implemented (`/api/revenue-intelligence` + Revenue Intel tab); deployment verification pending.
- ✅ **Split Billing V1** implemented (`ticket_payments` + `/api/ticket-payments` + cashier settlement UI); deployment verification pending.
- **Revenue intelligence**: avg table value, "kitfo tables also order coffee", peak-hour alerts.
- **Group billing**: split equally / pay my items / host pays on one merged table ticket.
- **Reservations as "Plan your evening"** (dinner / + show / + ceremony / group feast).
- **Tourist mode** ("I'm visiting Ethiopia" → Must-Try shortlist).

**Phase C — revenue intelligence** — avg table/order value, most profitable dishes, package
conversion, upsell performance, time-based sales, experience correlation.

**Later / deliberately NOT now** — inventory, payroll, accounting, loyalty, delivery overhaul,
customer accounts, AI chatbot, CRM. Keep it excellent before enormous. Also queued: private
post-meal feedback (food / service / experience + on-time yes/no) and the "First time eating
Ethiopian food?" recommendation wizard.

## 7. Assets

AI-generated photography in `public/images/` (`hero-hall`, `kitfo`, `coffee-ceremony`,
`cultural-show`) stands in until real Totot photography is uploaded.
