# **Booking Engine — Blueprint**

**Last updated:** 2026-05-12 **Status:** Phases 1–4 \+ 6.5 \+ 6.6 shipped. Stripe Connect live on UAE sandbox (Polish entity migration scheduled post-19 May). Flex auto-charge (Phase 5\) not started. Welcome Pickups partnership in motion.

Multi-tenant hotel website \+ booking engine platform. Each hotel runs on its own custom domain with a bespoke website and an integrated booking flow connected to Cloudbeds. Built and managed by Rockenue as the webmaster across all properties (≈40 independent hotels, luxury → near-hostel spectrum).

This document is the single source of truth. It replaces `README.md`, `hotel-platform-build-plan.md`, `THEMES.md`, and `TODO.md`. AI agent rules continue to live in `AGENTS.md` / `CLAUDE.md`.

---

## **Table of contents**

1. [Product vision](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#1-product-vision)  
2. [Architecture](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#2-architecture)  
3. [Tech stack](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#3-tech-stack)  
4. [Multi-tenant routing](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#4-multi-tenant-routing)  
5. [Themes system](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#5-themes-system)  
6. [Database schema](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#6-database-schema)  
7. [Cloudbeds integration](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#7-cloudbeds-integration)  
8. [Stripe Connect](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#8-stripe-connect)  
9. [Booking flow](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#9-booking-flow)  
10. [Admin v3](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#10-admin-v3)  
11. [Photos \+ Cloudflare R2](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#11-photos--cloudflare-r2)  
12. [Content CMS](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#12-content-cms)  
13. [Email (SendGrid)](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#13-email-sendgrid)  
14. [Guest self-cancel](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#14-guest-self-cancel)  
15. [File structure](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#15-file-structure)  
16. [Local dev \+ scripts](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#16-local-dev--scripts)  
17. [Deployment](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#17-deployment)  
18. [Design conventions](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#18-design-conventions)  
19. [Forward plan](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#19-forward-plan)  
20. [Welcome Pickups integration plan](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#20-welcome-pickups-integration-plan)  
21. [Phase 7 — Post-launch features](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#21-phase-7--post-launch-features)  
22. [Open design questions](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#22-open-design-questions)  
23. [Out of scope for launch](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#23-out-of-scope-for-launch)  
24. [Engineering reminders](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#24-engineering-reminders)

---

## **1\. Product vision**

A multi-tenant hotel website platform with an integrated booking engine, connected to Cloudbeds. Each hotel gets a fully bespoke website on their own domain (`www.thehotel.com`) with a seamlessly integrated booking flow — not a generic widget bolted on, but a native part of the site. Karol manages ≈40 independent hotels. They are not a chain — to a guest each must read as its own brand. Per-hotel front-ends are bespoke (designed in Claude Design, mocked in HTML, signed off by the owner, then ported to React). The **booking flow** stays consistent across hotels (theme \+ copy only); the **marketing surface** (homepage, hero, gallery, story) is fully customised per hotel. Pattern is "templates \+ bespoke overrides", not "40 separate apps".

### **Design philosophy**

**Conversion-first.** 99.9% of guests already know the hotel from OTAs. The website's job is to steal the booking, not showcase the hotel.

* Homepage \= hero image \+ date picker. That's the first and only interaction above the fold.  
* Below the fold: photos, location, about — for reassurance, but most won't scroll.  
* Booking flow is separate pages: `/` → `/book` → `/rooms` → `/extras` → `/checkout` → `/confirmation`  
* No content-heavy sections, virtual tours, or 20-section homepages.  
* Subtly emulate Booking.com UX patterns to build trust with guests arriving from OTAs.

---

## **2\. Architecture**

```
┌─────────────────────────────────────────────────────┐
│                    GUEST BROWSER                     │
│         www.thehotel.com (custom domain)             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              NEXT.JS 16 APPLICATION                  │
│                   (Railway)                           │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  / /book │  │ /rooms   │  │  /admin           │  │
│  │  Hero +  │  │ /extras  │  │  (webmaster only) │  │
│  │  Dates   │  │ /checkout│  │                   │  │
│  │          │  │ /confirm │  │                   │  │
│  └──────────┘  └────┬─────┘  └───────────────────┘  │
│                     │                                │
│              ┌──────┴──────┐                         │
│              │  API Routes │                         │
│              └──────┬──────┘                         │
└─────────────────────┼───────────────────────────────┘
                      │
          ┌───────────┼─────────────────────┐
          ▼           ▼                     ▼
   ┌────────────┐ ┌────────────────┐  ┌────────────────────┐
   │ PostgreSQL │ │ Stripe Connect │  │ Cloudbeds REST API │
   │   (Neon)   │ │ (Standard,      │  │ (OAuth2 per       │
   │            │ │  direct charges)│  │  property)        │
   └────────────┘ └────────────────┘  └────────────────────┘
                          │
                          ▼
                  ┌─────────────┐
                  │ Cloudflare  │
                  │   R2        │  (hotel photos)
                  └─────────────┘
```

### **Per-hotel front-end pattern (planned, partially scaffolded)**

The booking flow's data \+ state \+ side effects live in `src/lib/booking` as headless hooks (`useAvailability`, `useExtras`, `useBookingDraft`, `usePersistedDraft`, `submitBooking`). Per-hotel page components consume these hooks and own only JSX \+ CSS. Every hotel ships its own bespoke `Home.tsx`, `Rooms.tsx`, `Checkout.tsx`, `Confirmation.tsx`, while the booking pipeline is identical underneath.

Shared designs live as templates in `src/hotels/_templates/<name>/`; properties either re-render a template with their own config or implement bespoke per-page. Mix-and-match (shared Home, bespoke Rooms) is allowed.

Not yet fully scaffolded — `src/lib/booking` exists and is canonical; the `src/hotels/<slug>/` directory pattern lands when the first hotel mockup is ready to port.

**Discipline rules when the scaffold lands:**

1. **API contract is sacred.** Per-hotel UI can render however it wants but must speak to `/api/availability`, `/api/extras`, `/api/bookings` with the same shape. Backend validates everything.
2. **Headless hooks > shared components.** Don't build a shared `<RoomCard>` that all 40 hotels theme — that fights the bespoke goal. Per-hotel components consume `useAvailability` + `useBookingDraft` and render results freeform. Exceptions: a few stubborn primitives (date picker, country/phone input, Stripe Elements wrapper) stay shared and hotels override styling via CSS.
3. **CSS isolation.** Pick one of CSS Modules / scoped stylesheets / Tailwind per-hotel layers before hotel #2 — global CSS will leak across 40 hotels.
4. **Booking flow stays consistent.** Marketing surface is fully bespoke per hotel. The booking flow itself (rooms → checkout → confirmation) is theme-only — same UX, different colours / fonts / copy. Don't reinvent the booking mechanics per hotel: consistency = trust + smaller bug surface.

---

## **3\. Tech stack**

| Layer | Technology | Status |
| ----- | ----- | ----- |
| **Framework** | Next.js 16 (App Router, Turbopack) | ✅ |
| **Language** | TypeScript | ✅ |
| **Database** | PostgreSQL 17 on Neon (AWS, eu-central-1) | ✅ |
| **ORM** | Drizzle ORM (`drizzle-kit push`, no migrations dir) | ✅ |
| **Hosting** | Railway Pro | ✅ |
| **UI Library** | Radix UI (popovers), react-day-picker (calendar), Lucide (icons) | ✅ |
| **Font** | Inter (Google Fonts in default theme) · Cormorant Garamond \+ Inter (Portico) | ✅ |
| **PMS** | Cloudbeds REST API (OAuth2 per property) | 🟢 Inventory, rates, extras, webhooks, write paths live |
| **Payments** | Stripe Connect (Standard accounts, direct charges \+ `on_behalf_of`) | 🟢 Live on UAE sandbox; Polish entity migration scheduled |
| **Image storage** | Cloudflare R2 \+ `@aws-sdk/client-s3` \+ `sharp` | 🟢 Bucket `rockenue-hotel-photos`, 3 variants per upload (hero 1600w / gallery 800w / thumb 400w) |
| **Email** | SendGrid (`@sendgrid/mail`) | 🟢 Booking confirmation \+ cancellation emails (NR \+ Flex) |
| **DNS** | Cloudflare | 🟡 Custom domains pending; R2.dev URL covers photos for now |

**Next.js 16 has breaking changes from prior versions.** Per `AGENTS.md`: check `node_modules/next/dist/docs/` before writing route handlers, middleware, or server actions. Middleware was renamed to `proxy.ts`; `revalidateTag` now requires a two-arg signature with `{ expire: 0 }` for immediate expiration.

---

## **4\. Multi-tenant routing**

`src/proxy.ts` (Next.js 16's renamed middleware) reads the `Host` header → resolves property from DB → serves correct theme \+ content. Also 404s the dev mockup routes (`/bars`, `/compare`, `/compare-live`, `/enhance`, `/fonts`, `/pickers`, `/rates`, `/rooms-mockup`) when `NODE_ENV === "production"`.

### **Property resolution (`src/lib/get-property.ts`)**

Order:

1. `?property=<slug>` query param (set by proxy via `x-property-slug` header) — useful for forcing a property in dev or testing.  
2. `properties.domain` exact match against the request `Host`.  
3. `properties.slug` match against the host's domain part.  
4. **Fallback**: first property with `cloudbedsPropertyId` set (preferred — bookings actually work).  
5. **Final fallback**: any property at all (covers fresh DBs).

So in a multi-property setup, set `domain` per environment to control which property each Railway service serves. Localhost dev typically falls through to step 4 — picks the Cloudbeds-connected property automatically.

---

## **5\. Themes system**

The booking engine ships **one codebase, many designs**. The look/layout of the public-facing flow is selected per Railway service via the `THEME` env var. Backend, database, Cloudbeds, Stripe, and email are identical across every deployment.

| `THEME` | Design | Status |
| ----- | ----- | ----- |
| `default` (unset) | Original live design | shipped |
| `portico-ivory` | The Portico Hotel — Editorial Ivory | testing |

Theme components are token-driven (`src/themes/<theme>/tokens.ts`), so adding a future palette variant is a token-only change.

### **Per-deployment setup on Railway**

For each new design link:

1. Create a new Railway service (or add the env var to an existing one) pointing at the same GitHub repo.  
2. Reuse all existing env vars (`DATABASE_URL`, `CLOUDBEDS_*`, `STRIPE_*`, `SENDGRID_*`, etc.). Same backend, same data.  
3. Add one extra env var: `THEME=portico-ivory`.  
4. Map a domain (Railway-provided `*.up.railway.app` is fine for testing).  
5. Set `properties.domain` for the property you want this URL to resolve to.  
6. Deploy.

The active theme is read at request time from `process.env.THEME` (see `src/lib/active-theme.ts`). Restart the Railway service after changing it. Admin/internal routes remain identical across every deployment — they don't fork on theme.

### **Local preview — flipping themes without restarting**

Run `npm run dev` once. Visit `http://localhost:3000/dev/themes` and pick a theme — sets a session cookie and reloads the homepage in that design. Every themed screen also has a small floating badge in the bottom-right that links back to `/dev/themes`. Cookie persists for 30 days; clear with the link on `/dev/themes` or by deleting cookies for `localhost`.

The dev cookie has **no effect in production**: on Railway the env var is the only source of truth.

### **Themed vs shared**

**Themed (changes per deployment):**

* Public marketing & booking flow: `/`, `/book`, `/rooms`, `/extras`, `/checkout`, `/confirmation`  
* Photography in `public/<theme>/*`  
* Logo assets

**Shared (identical everywhere):**

* All API routes (`src/app/api/*`)  
* Database schema, Cloudbeds sync, Stripe Connect, webhooks, email  
* Headless booking hooks (`useAvailability`, `useBookingDraft`, `useExtras`, `usePersistedDraft`, `submitBooking`)  
* Admin dashboard (`/admin`)  
* Internal/dev routes

### **Portico Ivory flow**

| Path | Component | Description |
| ----- | ----- | ----- |
| `/` | `screens/Home.tsx` | Long scrollable: hero → 01 Neighbourhood (drawing-room photo \+ Carto Positron map) → 02 Inside (editorial gallery \+ lightbox) → 03 Good to know → cinematic dark footer |
| `/book` | `screens/Dates.tsx` | Step 01\. Two-pane: wardrobe-doors photo left, calendar \+ guest steppers right |
| `/rooms` | `screens/RoomSelect.tsx` | Step 02\. Each room block: 460px gallery left, room name \+ Sleeps pill \+ rate-plan ladder \+ OTA strip right. Sticky basket on selection |
| `/extras` | `screens/Extras.tsx` | Step 03\. Two-pane: phone photo left, Cloudbeds extras list \+ special-requests right |
| `/checkout` | `screens/Checkout.tsx` | Step 04\. Form left, cinematic dark summary panel right with Stripe Element themed to Portico |
| `/confirmation` | `screens/Confirmation.tsx` | Cinematic hero strip \+ reference \+ summary rows |

Customization points (likely to change): photography (`public/portico/*.jpg`), logo PNGs, mock copy in Home.tsx, OTA price multipliers (`OTA_MARKUP` constant in RoomSelect — replace with real rate-shopping integration later), rate-plan supporting notes (`src/lib/booking/rate-plan-notes.ts` pattern-based mapping), Stripe Element appearance (`src/themes/portico/stripe-appearance.ts`), dark-teal cinematic surface (`#15252a` reused across checkout summary, sticky basket, footer), map (Carto Positron tiles via Leaflet), calendar (custom range-picker).

Portico open follow-ups: real OTA rates integration, per-room photography (currently the same 6 photos rotate), SVG logo, per-theme confirmation email template, Stripe Customer email backfill, mobile fine-tuning at edge viewports.

### **Static HTML mockups** (`public/mockups/`)

Standalone decision tools rendered at `/mockups/<file>` on any deployment. Not part of the live flow — used for picking design directions and showing options to stakeholders before porting to React.

| File | Purpose |
| ----- | ----- |
| `admin-mockup-v3.html` | Signed-off Admin v3 sidebar shell |
| `admin-mockup.html` · `admin-overview-concepts.html` · `admin-overview-modern-ai.html` | Earlier admin design iterations |
| `portico-extras-concepts.html` | 5 extras display concepts |
| `portico-map-concepts.html` | 5 map style concepts |
| `portico-footer-colors.html` | 5 footer colour options |
| `portico-roomselect-concepts.html` | 4 rate-plan layouts |
| `portico-roomblock-layout.html` | 5 room-block layouts (chose 05) |

---

## **6\. Database schema**

Live on Neon. Push schema changes via `npx drizzle-kit push` (no migrations dir).

### **Tables**

**`properties`** — multi-tenant config

* Core: `id`, `slug`, `name`, `domain`, `currency`, `timezone`, `theme` (JSONB)  
* Cloudbeds: `cloudbedsPropertyId`, `cloudbedsAccessToken` (encrypted), `cloudbedsRefreshToken` (encrypted), `cloudbedsTokenExpiresAt`  
* Stripe Connect: `stripeAccountId`, `stripeAccountStatus` (`pending` | `active` | `restricted`), `stripeAccountCurrency`, `platformFeePercent` (default `3.00`), `payoutSchedule` (default `weekly`)

**`pages`** — page layouts per property (JSON composition; legacy, unused in Portico flow)

**`content_blocks`** — key-value JSONB content per property. Admin Content tab writes 5 keys: `hero`, `neighbourhood`, `goodToKnow`, `contact`, `footer`. Defaults in `src/lib/content-defaults.ts`; merged at read time via `getPropertyContent()`.

**`images`** — photo library

* Identity: `propertyId`, `key` (R2 path), unique on `(propertyId, key)`  
* Categorization: `slot` (`hero` | `gallery` | `room` | `neighbourhood`, default `gallery`), `roomTypeId` (FK when `slot=room`), `sortOrder`  
* File meta: `mimeType`, `sizeBytes`, `altText`  
* Variants: `variants` JSONB (`{ hero: {key,url,w,h,sizeBytes}, gallery: {...}, thumb: {...} }`)  
* R2 keys follow `properties/<propertyId>/<uuid>-{hero|gallery|thumb}.jpg`

**`room_types`** — mirrored from Cloudbeds (`otaRoomId` \= Cloudbeds `roomTypeID`, numeric)

**`rate_plans`** — mirrored from Cloudbeds (`otaRateId` \= Cloudbeds `rateID`); `isRefundable` \+ `cancellationPolicy` are admin-managed (not in CB API), seeded from a name heuristic on first sync.

**`inventory`** — ARI cache (date × room × rate → units, rate, restrictions); upserted by `syncInventoryForProperty`.

**`property_extras`** — Cloudbeds addon catalog mirrored per property (`cloudbedsAddonId`, `cloudbedsProductId`, `name`, `description`, `priceMinorUnits`, `currency`, `lastSyncedAt`). Unique on `(propertyId, cloudbedsAddonId)`; deletes rows whose addon no longer appears in CB.

**`bookings`** — guest bookings

* Identity: `id`, `orderId` (UUID, idempotency key matching Stripe metadata)  
* Cloudbeds: `cloudbedsReservationId`  
* Stripe: `stripeSetupIntentId`, `stripePaymentMethodId`, `stripeCustomerId`, `chargeAt` (null until known)  
* Cancellation: `cancellationPolicySnapshot` (JSONB)  
* Rate: `rateType` (`flex` | `nr`)  
* Status: lifecycle below  
* Price breakdown (all `decimal(10,2)`): `roomTotal`, `extrasTotal`, `taxesTotal`, `applicationFee`, `grandTotal`

Booking `status` lifecycle (not strictly sequential — `pms_synced` and `paid` can occur in either order in the Flex flow):

* `pending` — created, no money or PMS yet  
* `payment_authorized` — Flex SetupIntent saved, no charge yet  
* `paid` — PaymentIntent succeeded (NR at checkout, or Flex at cutoff)  
* `pms_synced` — `postReservation` succeeded (Cloudbeds reservation exists)  
* `failed` — terminal; auto-charge gave up after 24h grace, or Stripe declined and we couldn't recover  
* `cancelled` — guest self-cancelled or auto-cancelled after failure

**`booking_day_rates`** — nightly breakdown per booking

**`booking_extras`** — folio extras (`cloudbedsItemId`, `name`, `qty`, `unitPrice`, `totalPrice`, `currency`)

**`payment_events`** — Stripe \+ auto-charge audit trail

* Types: `payment_intent_created` | `payment_intent_succeeded` | `payment_intent_failed` | `setup_intent_created` | `setup_intent_succeeded` | `auto_charge_attempt` | `auto_charge_succeeded` | `auto_charge_failed` | `refund` | `payment_method_detached`  
* Fields: `bookingId`, `stripeId`, `amount`, `currency`, `status`, `errorCode`, `errorMessage`, `payload` (JSONB raw Stripe object), `createdAt`

**`cloudbeds_webhook_subscriptions`** — one row per `(property, object, action)`; persisted so we can `deleteWebhook` on disconnect.

---

## **7\. Cloudbeds integration**

### **API surfaces — we use both**

* **v1.3 (legacy, action-style)** at `https://hotels.cloudbeds.com/api/v1.3` — `getRatePlans`, `getReservations`, `postReservation`, `postCustomItem`, `postPayment`, `postWebhook`, `putReservationStatus`. `propertyID` goes in the query string. Response is `{ success, data, ... }`.  
* **New modular API** at `https://api.cloudbeds.com` — REST paths like `/addons/v1/addons`. `propertyId` goes in the `x-property-id` header. Response is `{ offset, limit, data }`. Prices are returned as strings in **minor units** (e.g. `"1500"` \= £15.00) — divide by 100 when displaying.

Both share one OAuth flow \+ one set of tokens. Just request the union of scopes.

### **OAuth scopes (`src/lib/cloudbeds/scopes.ts`)**

`read:addon, read:currency, read:dataInsightsGuests, read:dataInsightsOccupancy, read:dataInsightsReservations, read:guest, write:guest, read:hotel, read:rate, write:rate, read:reservation, write:reservation, read:room, read:taxesAndFees, read:user`.

**Adding any new scope requires re-OAuth on every connected property** — old tokens don't carry it.

### **What's shipped**

* **OAuth2 \+ token refresh** — encrypted at-rest (AES-256-GCM via `CLOUDBEDS_TOKEN_KEY`), silent refresh.  
* **Inventory sync** — `syncInventoryForProperty(propertyId, days=90)`. Pulls `getRoomTypes` \+ `getRatePlans` (with `detailedRates: true`), flattens into `roomTypes`, `ratePlans`, `inventory`. Master rates get synthesised names (e.g. "Double Room Standard"); derived rates use `ratePlanNamePrivate`. **`isRefundable` heuristic:** seeded `false` if name matches `/non[- ]?ref/i`, otherwise `true`. **Sync only seeds on insert; updates do not clobber `isRefundable` or `cancellationPolicy`.** Admin UI overrides take precedence forever after. Bulk upsert per rate plan (`onConflictDoUpdate`). 90 days × 8 rate plans \= \~3 seconds. Idempotent.  
* **Extras catalog sync** — `syncExtrasForProperty(propertyId)` pages `/addons/v1/addons` on the new API host, upserts on `(propertyId, cloudbedsAddonId)`, hard-deletes rows no longer in CB. Called at end of inventory sync and as cold-start from `/api/extras`.  
* **Webhook subscriptions** — `subscribeWebhooksForProperty` / `unsubscribeWebhooksForProperty`. Persists subscription IDs so we can `deleteWebhook` later. Idempotent.  
* **Webhook handler** at `/api/cloudbeds/webhooks/[token]/` — receives 10 events, returns 200 in \<600ms (well under Cloudbeds' 2-second budget), fires `void syncInventoryForProperty(...)` background. Accepts both `propertyID` and `propertyId` field names since Cloudbeds spells it both ways. **Token-gated** — wrong token returns 404; compared with `timingSafeEqual`.  
* **Reservation writes** — `postReservation`, `postCustomItem`, `postPayment` in `src/lib/cloudbeds/reservations.ts`. Form-encoded POST (not JSON), `propertyID` in query string, **returns flat fields at top level** (not wrapped in `{ data }` like most v1.3 endpoints — surprised us on first run).  
* **Cancellation** — `putReservationStatus` (v1.3, `status=canceled` with single-l spelling) \+ optional `reason`. Cloudbeds is idempotent on already-cancelled reservations.  
* **Cold-start sync** — `/api/availability` triggers a background sync if a connected property has no inventory rows in the requested window. Uses `revalidateTag` to flush the per-property cache when sync completes.  
* **Cron** — Railway service `inspiring-trust` runs `0 */6 * * *` UTC against `/api/cron/inventory-sync` (Bearer-protected with `CRON_SECRET`).  
* **Hotel details sync** (Phase 6.6, 2026-05-08) — `/getHotelDetails` runs on every 6h cron via `sync-hotel-details.ts`. Non-destructive merge into `content_blocks` (only fills fields still matching Portico defaults — admin edits are owned forever); always-overwrite into `properties` for `name`, `currency`, `timezone`. Fields synced: `contact.addressLines`, `contact.reservationsPhone`, `contact.reservationsEmail`, `contact.generalEmail`, `neighbourhood.mapLat/mapLon`, `goodToKnow.rows[Check-in/Check-out]`.

### **Webhook security model**

Cloudbeds **does not sign webhooks**. Security comes from:

* **URL obscurity** — `/api/cloudbeds/webhooks/[token]/` with `CLOUDBEDS_WEBHOOK_TOKEN` env var. Wrong token \= 404\.  
* **Property-ID cross-check** — every payload contains `propertyID`/`propertyId`. We look it up against `properties` and ignore unknown properties.  
* **Idempotent sync** — Cloudbeds events are at-least-once delivered. `syncInventoryForProperty` is idempotent so replays are no-ops.  
* Confirmed source IP `35.93.165.6` from real inbound delivery (future option: IP allowlist).

### **Carry-forward / known limitations**

* **Stale-row cleanup on rate-plan deletion.** If a hotel deletes a rate plan or room type in Cloudbeds, our DB still holds it — sync only upserts, doesn't delete missing rows. Mostly invisible (availability filters on positive `unitsAvailable`, CB's `getRatePlans` only returns active rates). `syncExtrasForProperty` already does this for addons — use as pattern.  
* **`roomblock/created` / `roomblock/removed` webhooks abandoned.** `postWebhook` returned "Scope required for this call was not granted by property." even after re-OAuth with `read:roomBlock`. Likely a property-feature gate. Room blocks are OOO/maintenance only; `getRatePlans` already reflects what's saleable.  
* **Cancellation policy admin UI** — `isRefundable` \+ `{deadlineHours, penaltyType, penaltyPercent}` editable per rate plan. The REST API does not expose cancellation policy fields (probed `/getRatePlanDetails`, `/getCancellationPolicies`, `/getCancellationPolicy`, `/getPolicies` — all 404), so we can't auto-sync; admin maintains. **Granularity may be reduced** — see [open design questions](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#22-open-design-questions).  
* **Postpartum reservation failure.** Stripe succeeded but `postReservation` fails → money taken, no PMS reservation. Currently returns 502; booking row left in DB. Pre-launch: design retry queue \+ admin alert \+ auto-refund fallback.  
* **Per-extra failure handling is silent.** A failed `postCustomItem` is logged but not surfaced to admin.

### **Cloudbeds operational scripts**

```shell
# Run all of these with: set -a && source .env.local && set +a && npx tsx <script>
src/scripts/cloudbeds-smoke.ts demo               # Read-only; saves raw responses to tmp/cloudbeds-smoke/
src/scripts/cloudbeds-sync.ts demo 90             # Run full inventory + extras sync for 90 days
src/scripts/cloudbeds-subscribe.ts demo           # Subscribe webhooks (idempotent)
src/scripts/cloudbeds-rotate-webhooks.ts demo     # Unsubscribe + resubscribe (use after webhook URL changes)
src/scripts/cloudbeds-update-name.ts demo         # Pull hotel name from getHotelDetails (use --with-currency / --with-timezone)
src/scripts/cloudbeds-sync-hotel-details.ts demo  # Smoke-test the metadata sync; prints affected blocks
src/scripts/cloudbeds-debug-hotel-details.ts demo # Raw response dumper
src/scripts/check-inventory.ts demo               # Inspect DB state + most recent updatedAt
src/scripts/test-confirmation-email.ts <to>       # Send one Flex + one NR confirmation to a target email
```

For `cloudbeds-subscribe.ts` / `cloudbeds-rotate-webhooks.ts`, the registered URL is built from `CLOUDBEDS_WEBHOOK_URL` (if set), or `${origin of CLOUDBEDS_REDIRECT_URI}/api/cloudbeds/webhooks/${CLOUDBEDS_WEBHOOK_TOKEN}` as fallback.

---

## **8\. Stripe Connect**

Live on UAE sandbox (ROCKENUE INTERNATIONAL GROUP L.L.C-FZ) as of 2026-05-01. Polish entity migration scheduled — notary 19 May 2026, sp. z o.o. registered \~1–2 weeks after, production approval \~1–3 weeks after that.

### **Architecture**

* **Account type: Standard** (not Express). Hotels are real businesses; full Stripe Dashboard \+ ability to connect existing Stripe accounts \> simplified Express dashboard. (Build plan originally specified Express; switched after reviewing tradeoffs.)  
* **Direct charges** on connected accounts with `application_fee_amount` for our platform fee.  
* **`on_behalf_of: stripeAccountId`** mandatory for cross-region charges. Discovered the hard way: UAE platform → GB connected account fails with *"Cannot create a destination charge for connected accounts in GB because funds would be settled on the platform and the connected account is outside the platform's region"*. Fix: `on_behalf_of` makes the connected account the merchant of record so funds settle in their country. Safe to leave on permanently.

### **Onboarding flow**

* `POST /api/stripe/connect/start` — admin-only, creates a Standard connected account (idempotent — only on first call) and returns an `accountLink` URL via `accountLinks.create({ type: 'account_onboarding' })`. No `STRIPE_CONNECT_CLIENT_ID` needed (that's only for OAuth-based Standard onboarding; we use API-only).  
* `GET /api/stripe/connect/start?refresh=1&propertyId=…` — handles Stripe's `refresh_url` callback if the link expires.  
* `GET /api/stripe/connect/return` — return URL Stripe redirects to. Calls `accounts.retrieve`, derives status via `src/lib/stripe/status.ts`, persists `stripeAccountStatus` \+ `stripeAccountCurrency`.  
* Admin UI: "Connect to Stripe" / "Resume onboarding" / "Manage in Stripe" button \+ status pill \+ currency-mismatch warning.  
* `account.updated` webhook handler refreshes status when Stripe updates the account out-of-band.

### **Stripe webhook events handled** (`/api/stripe/webhooks`)

Signature-verified via `STRIPE_WEBHOOK_SECRET`. Five event types processed:

* `account.updated` — refreshes `stripeAccountStatus` / `stripeAccountCurrency` on the matching property.
* `payment_intent.succeeded` / `payment_intent.payment_failed` — logs to `payment_events` (`payment_intent_succeeded` / `payment_intent_failed`). Booking lookup by `metadata.orderId`; row inserted with `bookingId=null` if booking hasn't been written yet (webhook can fire before `/api/bookings` completes).
* `setup_intent.succeeded` / `setup_intent.setup_failed` — logs to `payment_events` (`setup_intent_succeeded` / `setup_intent_failed`).

Other events fall through. `charge.refunded` and `payment_method.detached` are handled inline by the cancel route, not via webhook.

### **Payment flow**

* `POST /api/stripe/payment-intent` (NR) — `application_fee_amount` from `properties.platformFeePercent`, `transfer_data.destination = stripeAccountId`, `on_behalf_of = stripeAccountId`, idempotent on `orderId`.  
* `POST /api/stripe/setup-intent` (Flex) — creates platform-side Customer \+ SetupIntent with `usage: 'off_session'`. The off-session PI in Phase 5 will reference this customer \+ the saved payment method.  
* `src/components/checkout/StripePaymentSection.tsx` — `<Elements>` \+ `<PaymentElement>` wrapper. `confirmPayment`/`confirmSetup` with `redirect: 'if_required'` so card payments stay inline.  
* `src/app/checkout/checkout-client.tsx` — generates session orderId once, lazily creates the right intent (PI vs SI) when guest enters their email, branches button label on rate type. Forwards Stripe IDs to `/api/bookings`.  
* `AvailabilityResult.ratePlan.isRefundable` flows through `/api/availability` → headless hooks → checkout client so the client knows which intent kind to request.

### **Polish entity migration plan**

Entity: **Rockenue Tech sp. z o.o.** (95% Karol Marcu / 5% Zeynep Taskin). Notary 19 May 2026 at Kancelaria Notarialna Mateusz Marek (or Katarzyna Meysztowicz). Translated by sworn English translator. PKD codes: 62.01.Z primary (software development), 62.09.Z, 63.12.Z, 73.11.Z, 74.90.Z.

When the Polish platform Stripe account is live:

1. Swap env vars on Railway (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`).  
2. Re-register webhook endpoint against the new account.  
3. Re-onboard each connected property under the new platform (Stripe Connect platforms cannot be transferred between legal entities — each connected account must be onboarded fresh).  
4. Test connected accounts and PaymentIntents in UAE are throwaway.  
5. `on_behalf_of` keeps working — Polish (EU) platform has wide cross-border rights so most country combinations work without further config.

### **Polish-specific gotchas (from 2026 underwriting research)**

* **Biała lista** — sp. z o.o.'s bank account must appear on the Polish Ministry of Finance "White List". Wise / Revolut Business may not be White-Listed by default; stick with mBank / ING / Santander to be safe.  
* **CRBR (Beneficial Owner registry)** — must file within **14 days** of KRS registration. Penalty range theoretically up to PLN 1M. Confirm with notary that filing is included, or arrange immediately via accountant.  
* **Stripe May/Oct 2026 Europe verification update** — new connected accounts must meet updated KYC standards from May 1; existing must re-verify by Oct 31\. Use Stripe-hosted onboarding so the UI auto-collects new fields. Don't build custom onboarding UI.  
* **Statement descriptor 22-char limit** — needs a per-property `statement_descriptor_short` field for hotels with long names. Current usage: `statement_descriptor_suffix: "ROCKENUE"` on direct charges (capped so combined ≤22 chars).  
* **PCI SAQ A AoC** — generate via Stripe Dashboard once production live (Settings → Compliance → PCI Compliance → generate AoC). Refresh annually. Some hotels/TMCs may ask for it.  
* **Application fee currency** — fees come in the charge currency; Stripe FX-converts to the platform payout currency. Configure Stripe to hold balances in GBP/EUR/USD rather than auto-converting to PLN; use Wise/your bank for cheaper FX on bulk conversion.  
* **Rolling reserve risk** — Stripe typically imposes 10–25% hold on travel platforms; held 30–90 days; reduces with clean processing history (6–12 months typically). Plan cashflow accordingly.  
* **PCI compliance** — every PaymentIntent uses Stripe Elements / hosted iframes (PCI SAQ A — Stripe handles card data, we never see raw card). Document this in the underwriting application.

### **Underwriting application strategy**

Present the platform as the technology arm of the established Rockenue agency, not a speculative new marketplace. Key signals to include:

* Rockenue UAE: 8+ years history, £400k+ ARR, official Booking.com chain status, 39 properties under management contracts  
* Polish sp. z o.o. is the EU technology subsidiary  
* All hotels onboarded as Standard connected accounts are clients under formal management agreements, not third-party random sellers  
* Direct charges with `application_fee_amount` (hotels are MoR, not us — avoids "payment facilitator" restricted category)  
* 3D Secure 2.0 enforced  
* Pre-existing Cloudbeds integration provides hotel verification trail  
* Start with 3–5 pilot hotels (Shreeji or Vilenza group); don't oversell projected GMV

### **Backup plan**

If Stripe imposes punishing reserves (\>15%) after 3 months, start **Mangopay** application (escrow-until-check-in model, Luxembourg EMI, EU passporting; supports Polish sp. z o.o. \+ UK connected accounts cleanly). 8–10 week underwriting timeline — start before pain hits, not after.

### **Carry-forward (Stripe)**

* **Polish platform swap** (above).  
* **Stripe webhook secret \+ CLI.** Brew install of Stripe CLI failed (Command Line Tools too outdated). Skipped for now; happy path works without webhooks because the return route does a synchronous `account.retrieve` and the checkout uses `confirmPayment` synchronously. To install later: download the binary directly from `https://github.com/stripe/stripe-cli/releases`, then `stripe login` \+ `stripe listen --forward-to localhost:3000/api/stripe/webhooks`.  
* **Transfer Reversal logic for partial refunds** — if a guest stays 3 nights and gets refunded for 1, `application_fee_amount` doesn't auto-reduce. Add proportional fee reversal: on refund, calculate `(refundAmount / originalAmount) * applicationFee` and issue a Transfer Reversal of that amount. Currently the full-refund path handles this via `refund_application_fee: true, reverse_transfer: true`; partial refunds need explicit handling.  
* **Per-property `statement_descriptor_short`** field — admin field, 22-char max, default derived from `property.name` truncated, override allowed during onboarding. Wire into PaymentIntent creation via `on_behalf_of` context.

---

## **9\. Booking flow**

Pages: `/` → `/book` → `/rooms?checkIn=&checkOut=&adults=&children=` → `/extras` → `/checkout` → `/confirmation?orderId=`

### **Headless booking library (`src/lib/booking/`)**

* `types.ts` — canonical `AvailabilityResult`, `Extra`, `BookingDraft`, `GuestDetails`, `NightlyRate`. Components import from here.  
* `useAvailability(args)` — cancelable fetch of `/api/availability`, returns `{ results, loading, error }`.  
* `useExtras(propertyId)` — fetch of `/api/extras` (60s `unstable_cache` server-side).  
* `useBookingDraft()` — selection state during the flow (room, rate, extras).  
* `usePersistedDraft()` — `sessionStorage` (30-min TTL) for draft round-trip; `savePersistedConfirmation()` / `loadPersistedConfirmation()` same pattern for post-booking payload (2h TTL, so refresh on `/confirmation` still renders).  
* `submitBooking(args)` — typed POST to `/api/bookings`. Signature has slots for `paymentIntentId` / `setupIntentId` / `paymentMethodId` / `customerId`.

### **`/api/bookings` route logic**

* Client passes `orderId` (UUID, same one used as Stripe idempotency key \+ metadata).  
* **Idempotent retry** — existing booking row with the same `orderId` returned as-is. Covers double-submit, network retry, refresh-after-success.  
* **Server-side Stripe verification** — retrieves PaymentIntent (NR) or SetupIntent (Flex) from Stripe and refuses unless `status === 'succeeded'`. Trusts nothing the client sends.  
* Splits `body.totalPrice` into `roomTotal` \+ `extrasTotal` correctly so application fee \= `grandTotal × platformFeePercent` (not just room).  
* Snapshots cancellation policy onto the booking.  
* Calls `postReservation`, then loops extras into `postCustomItem` (logs per-extra failure but doesn't fail the whole booking — money's already taken; missing folio lines hotel can fix manually). NR also calls `postPayment` with `description = "Stripe pi_..."` for reconciliation.  
* Updates booking with `cloudbedsReservationId` \+ `status = 'pms_synced'`.  
* Fires `sendBookingConfirmationEmail` (fail-soft).

### **Confirmation page**

* **Reservation Number** (`cloudbedsReservationId`) is the primary reference guest quotes on arrival. Internal `orderId` shown secondary.  
* **Payment status pill** branches on `rateType`: green "Paid in Full" for NR vs blue "Card on File" for Flex.  
* **Extras** render as sub-section in the price breakdown.  
* "Total Paid" / "Total Due" header label flips by rate type.

### **Availability performance**

Shipped 2026-05-04:

* **A. Cold-start sync moved out of request path.** `/api/availability` no longer awaits `syncInventoryForProperty` inline. Fires `void syncInventoryForProperty(...).catch(...)` background and returns whatever inventory exists.  
* **B. `unstable_cache` wrapper \+ tag invalidation.** Response wrapped in `unstable_cache` keyed by `["availability", propertyId, checkIn, checkOut, adults]`, `revalidate: 30`, tagged `availability:${propertyId}`. `syncInventoryForProperty` calls `revalidateTag('availability:${propertyId}', { expire: 0 })` (Next 16 two-arg form) after all DB writes. Any sync — webhook, cron, or cold-start — flushes the cache the moment it completes. No 30-second stale window after a booking.

Deferred:

* **C. N+1 collapse to a single JOIN.** Demo property still does \~28 sequential queries on cold cache miss. Revisit only if production says cache misses are painful.  
* **D. Per-hotel pre-rendering with ISR.** Lands when Phase 2.5 (`src/hotels/<slug>/`) does.

---

## **10\. Admin v3**

Shipped 2026-05-07. Full UX signed off as `public/mockups/admin-mockup-v3.html`. Light "Modern AI / Linear" sidebar shell.

### **Shell**

* `src/app/admin/layout.tsx` — auth gate only (token via localStorage, `useAdminAuth()` exposes `{ token, setToken, logout }`).  
* `src/app/admin/[propertyId]/layout.tsx` — fetches property meta, renders the sidebar shell. Active nav item inferred from pathname. `<PropertyBar>` at top of main area shows hotel name \+ status pill \+ domain \+ currency \+ always-new-tab "Open site ↗".  
* `src/components/admin/Sidebar.tsx` — 240px persistent sidebar. Hotel switcher card → Property nav (Overview, Bookings, Content, Photos, Rates, Alerts) → Integrations nav (Cloudbeds, Stripe, Domain) → user/logout chip.  
* `src/components/admin/TopStrip.tsx` — page header \+ button primitive (`<Btn>`) with variants `primary | secondary | danger | ghost`, sizes `sm | md`, `newTab` prop.  
* v3 design tokens scoped under `.admin-root` in `src/app/globals.css` — `--a-bg`, `--a-side`, `--a-ink`, `--a-accent` (`#5B5BD6`), tinted soft variants for green/amber/red/blue, `.font-jbm` utility for JetBrains Mono.

### **Pages**

| Page | Endpoint(s) | Status |
| ----- | ----- | ----- |
| `/admin` (Dashboard) | `GET /api/admin/properties` (list with bookings·7d \+ revenue·7d) | ✅ |
| `/admin/[id]` (Overview) | `GET /api/admin/properties/[id]/overview` | ✅ |
| `/admin/[id]/bookings` | `GET /api/admin/properties/[id]/bookings` (200-row cap, hydrates extras) | ✅ |
| `/admin/[id]/content` | `GET POST /api/admin/properties/[id]/content` | ✅ |
| `/admin/[id]/photos` | `GET POST /api/admin/properties/[id]/photos` \+ `PATCH DELETE /[photoId]` | ✅ |
| `/admin/[id]/rates` | `GET /api/admin/properties/[id]/rate-plans` \+ `PATCH /[ratePlanId]` | ✅ |
| `/admin/[id]/cloudbeds` | `GET /api/admin/properties/[id]/cloudbeds` \+ `POST /sync` | ✅ |
| `/admin/[id]/stripe` | `GET /api/admin/properties/[id]/stripe` (Promise.allSettled across account/fees/payouts/balance/refunds) | ✅ |
| `/admin/[id]/domain` | TODO | 🟡 stub |
| `/admin/[id]/alerts` | TODO (alerts engine first) | 🟡 stub |

### **Cross-cutting decisions**

* **Hotels are siloed** — no cross-property views. Dashboard is the only cross-hotel surface and only shows status pills.  
* **Light only** — chose over dark mode in design picker. Top tabs vs sidebar: sidebar wins for 9-tab depth.  
* **Cold vs warm** — chose cold/Linear over Anthropic warm cream. Admin should feel like a tool, not a brand surface.  
* **OAuth callbacks migrated** — Cloudbeds callback redirects to `/admin/[propertyId]/cloudbeds?connected=1`. Stripe callbacks still point at old `/admin/properties/[id]?...` URLs — pending cleanup.  
* **Cloudbeds scopes** extracted to `src/lib/cloudbeds/scopes.ts`.

### **Carry-forward (admin)**

* Domain & deploy tab needs DNS / SSL / Railway probe display.  
* Alerts tab needs the underlying alerts engine (compute from operational signals).  
* Resend confirmation \+ Cancel/refund actions are placeholders on booking detail panel.  
* Per-hotel onboarding wizard — "+ New hotel" button on dashboard is a placeholder. At hotel \#21+ build a wizard for full setup.

---

## **11\. Photos \+ Cloudflare R2**

Shipped 2026-05-07.

* **Bucket:** `rockenue-hotel-photos` (single bucket holds all hotel photos).  
* **Public URL:** `https://pub-8cc422176ea047e683cb49fef0837d63.r2.dev` (R2.dev subdomain). Custom domain swap is a one-env-var change later (`R2_PUBLIC_URL`).  
* **Client:** `src/lib/r2/client.ts` wraps `@aws-sdk/client-s3` with `uploadToR2()` and `deleteFromR2()`.  
* **Resize:** `src/lib/r2/resize.ts` uses `sharp` to generate 3 JPEG variants on every upload. Hero 1600w, gallery 800w, thumb 400w. Quality 80 with mozjpeg, EXIF rotation honoured, never enlarges past source. Originals NOT kept in R2 — the local copy is the master.  
* **Limits:** 30 MB max upload (DSLR-friendly), allowed types: `jpeg / png / webp / avif / gif / heic / heif`.  
* **Variant URLs** stored on the DB row in `images.variants` JSONB. Admin grid renders the thumb (3-30 KB each) — page loads instantly even with 100+ photos. Customer-facing pages pick the variant matching their layout context.  
* **Slot/room assignment** in admin via ⋯ menu on each photo. Drag-reorder UI deferred (`sortOrder` is set on upload).  
* **`unoptimized={src.startsWith("http")}`** on every `<Image>` that may receive an R2 URL — bypasses Next.js image optimisation (which would need a `next.config` allowlist for the R2 host). `sharp` already produces compressed JPEGs so no quality loss.  
* **`sharp` on Railway** — if a future Railway redeploy errors on platform-mismatch, add `optionalDependencies: { "@img/sharp-linux-x64": "*" }` to `package.json`.

---

## **12\. Content CMS**

Shipped 2026-05-07.

* **Storage:** existing `content_blocks` table, key-value JSONB. Admin Content tab writes 5 keys: `hero`, `neighbourhood`, `goodToKnow`, `contact`, `footer`.  
* **Defaults** at `src/lib/content-defaults.ts` — Portico's existing hardcoded copy moved here verbatim, so a fresh DB renders identically to the seed. Doubles as seed values for new hotels and as merge base when fields are partially saved.  
* **Merge** via `mergeContent(blocks)` — DB blocks override per-key fields. Returned shape is fully typed `PropertyContent`, never has nulls.  
* **Read** via `getPropertyContent(propertyId)` in `src/lib/get-property.ts`.  
* **Inline emphasis:** `*word*` becomes italic-accent on customer pages; `\n` becomes `<br>`. Helper at `src/themes/portico/components/emphasis.tsx`. Keeps Portico's distinctive italic style admin-editable without dragging in a markdown parser.  
* **Portico Home wired** — Hero, Neighbourhood, GoodToKnow, Footer all read content with fallbacks to `defaultContent`. Editing in admin → save → hard-refresh customer page \= changes appear (no deploy, no caching layer).  
* **Booking-flow screens** (Dates, Extras, Checkout, Confirmation) **still hardcoded** — small bits of static copy that aren't really property-editable. Promote when needed.

### **Cloudbeds-driven fields (Phase 6.6)**

* `contact.addressLines`, `contact.reservationsPhone`, `contact.reservationsEmail`, `contact.generalEmail`, `neighbourhood.mapLat/mapLon`, `goodToKnow.rows[Check-in/Check-out]` — non-destructive merge from `/getHotelDetails`. Only fills when current value still matches default; admin edits are owned forever.  
* Per-field hints "auto-fills from Cloudbeds" on affected fields in admin.  
* **Rooms** card on Content admin (read-only) — synced from Cloudbeds room types, lists each `room_types` row with name, occupancy range, description, amenity chips.

---

## **13\. Email (SendGrid)**

* `@sendgrid/mail` installed.  
* `src/lib/email/sendgrid.ts` — thin wrapper. **Hardcoded From: `noreply@em4689.market-pulse.io`** (uses Karol's existing market-pulse SendGrid domain authentication). Per-hotel sender domain is carry-forward.  
* `src/lib/email/booking-confirmation.ts` — HTML \+ text templates. Subject: `Booking confirmed at {hotel} — {reservationId}`. Branches body copy on `rateType`. Always references `cloudbedsReservationId` as canonical booking ref (orderId shown as secondary). Optional `cancelUrl` arg — renders "Manage or cancel booking" outline button below the payment-status pill. Only populated for Flex.  
* `src/lib/email/booking-cancellation.ts` — cancellation email template. Body branches on `refunded` (green "refund issued in 5–10 days" panel vs grey "no charge taken").  
* Wired in `/api/bookings` — fires after `status = 'pms_synced'`, fail-soft.

### **Carry-forward (email)**

* **Per-hotel sender.** Currently every email comes from `noreply@em4689.market-pulse.io` regardless of which hotel. When real hotels onboard, replace with the hotel's own authenticated domain — needs `properties.emailFromAddress` field \+ per-hotel SendGrid sender authentication. Defer until hotel \#1 lands.  
* **Per-hotel reply-to.** Same shape.  
* **Guest comms platform** — fully designed in [Phase 7](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#21-phase-7--post-launch-features) (Maily.to composer \+ per-hotel branding \+ scheduler). Build pending.

---

## **14\. Guest self-cancel**

Shipped 2026-05-08. Token-based one-click cancellation triggered from the confirmation email. No booking-lookup form.

### **How it works**

* **Token:** HMAC-SHA256 (`signCancelToken` / `verifyCancelToken` in `src/lib/crypto.ts`) over `bookingId.timestamp` using the shared `CLOUDBEDS_TOKEN_KEY`. No expiry — replay safety comes from the booking's status check (already-cancelled returns idempotent success).  
* **Confirmation email:** `cancelUrl` populated only for `rateType === 'flex'`.  
* **Page:** `src/app/cancel/[token]/page.tsx` (server-rendered) \+ `cancel-client.tsx` (confirm button). Renders booking summary \+ policy preview. Three branches: eligible / already-cancelled / ineligible. The ineligible block uses `getPropertyContent(propertyId)` to surface hotel phone/email.  
* **API:** `POST /api/bookings/cancel` is the single decision point. Verifies token, loads booking, mirrors policy logic (deadline window from `cancellationPolicySnapshot.deadlineHours × checkIn`). Branches:  
  * **Already cancelled** → 200 `{ outcome: "already_cancelled" }`.  
  * **NR or `isRefundable === false`** → 409 `{ outcome: "ineligible", reason: "non_refundable" }`. v1 punts to "contact hotel".  
  * **Past deadline** → 409 `{ outcome: "ineligible", reason: "past_deadline", deadlineAt }`. Penalty calculation deferred.  
  * **Eligible Flex** → cancel CB first (abort if it fails — better leave room held than detach card). Then refund branch: if `status === 'paid'`, `stripe.refunds.create` with `refund_application_fee: true, reverse_transfer: true`. Otherwise, `detachPaymentMethod`. Status flips to `cancelled`. Logs `payment_events` row. Fires `sendBookingCancellationEmail`.

### **Carry-forward**

* **NR refund branch** — current code returns "non\_refundable" for NR. Route via email-the-hotel for v1.  
* **Penalty-charge for past-deadline Flex** — punts to "contact hotel". Future iteration could auto-charge penalty via saved PM.  
* **Smoke test against real Cloudbeds.** `putReservationStatus` documented but not yet driven by a script. Add `src/scripts/cloudbeds-cancel.ts` before pointing a guest at the link in production.  
* **Per-property sender on cancellation email.** Inherits the hardcoded From; moves with per-hotel sender work.

---

## **15\. File structure**

```
src/
├── app/
│   ├── page.tsx, home-client.tsx          # Homepage
│   ├── book/                              # /book — date picker (Portico)
│   ├── rooms/                             # /rooms — room select
│   ├── extras/                            # /extras — Cloudbeds add-ons (Portico)
│   ├── checkout/                          # /checkout — guest details + Stripe
│   ├── confirmation/                      # /confirmation
│   ├── cancel/[token]/                    # Guest self-cancel (token-verified)
│   ├── pickers/, bars/, compare/, compare-live/, fonts/, rates/, enhance/, rooms-mockup/   # DEV mockup pages (404 in prod)
│   ├── admin/                             # v3 admin
│   │   ├── layout.tsx                     # Auth gate + AdminAuthContext
│   │   ├── page.tsx                       # Dashboard tile grid
│   │   ├── [propertyId]/
│   │   │   ├── layout.tsx                 # Sidebar shell + PropertyBar
│   │   │   ├── page.tsx                   # Overview
│   │   │   ├── bookings/page.tsx
│   │   │   ├── content/page.tsx
│   │   │   ├── photos/page.tsx
│   │   │   ├── rates/page.tsx
│   │   │   ├── cloudbeds/page.tsx
│   │   │   ├── stripe/page.tsx
│   │   │   ├── domain/page.tsx            # 🟡 stub
│   │   │   └── alerts/page.tsx            # 🟡 stub
│   │   ├── properties/[id]/page.tsx       # 🗑️ Old property editor (orphan, pending delete)
│   │   └── bookings/page.tsx              # 🗑️ Old cross-property bookings (orphan, pending delete)
│   └── api/
│       ├── availability/route.ts          # unstable_cache + cold-start sync
│       ├── extras/route.ts                # Per-property addon catalog (60s cache)
│       ├── bookings/route.ts              # POST creates booking after Stripe verification + CB write
│       ├── bookings/cancel/route.ts       # Guest self-cancel
│       ├── cloudbeds/
│       │   ├── oauth/start/route.ts       # Admin-only OAuth start
│       │   ├── oauth/callback/route.ts    # Token exchange + webhook subscribe + redirect
│       │   └── webhooks/[token]/route.ts  # Token-gated webhook handler
│       ├── cron/inventory-sync/route.ts   # Bearer-protected sync sweep
│       ├── stripe/                        # connect/start, connect/return, payment-intent, setup-intent, webhooks
│       └── admin/properties/[id]/         # Admin REST endpoints
│           ├── route.ts, overview/, bookings/, content/, photos/, rate-plans/, cloudbeds/, stripe/
├── components/
│   ├── layout/                            # ThemeProvider, NavBar, Footer
│   ├── website/                           # HeroSection (legacy theme)
│   ├── booking/                           # BookingBar*, ExtrasPanel, etc. (legacy theme)
│   ├── checkout/                          # StripePaymentSection
│   ├── ui/                                # FadeIn
│   ├── admin/                             # Sidebar, TopStrip, ThemeEditor (legacy)
│   └── PageRenderer.tsx                   # JSON → components (legacy)
├── db/
│   ├── schema.ts                          # Drizzle schema; push via drizzle-kit push (no migrations dir)
│   └── index.ts                           # Neon connection
├── lib/
│   ├── theme.ts, content-defaults.ts, get-property.ts, admin-auth.ts, crypto.ts, active-theme.ts
│   ├── booking/                           # Headless booking hooks
│   ├── cloudbeds/                         # client, scopes, sync-inventory, sync-extras, sync-hotel-details, reservations, webhook-*
│   ├── stripe/                            # client (platform), browser, status, amounts, detach
│   ├── email/                             # sendgrid, booking-confirmation, booking-cancellation
│   └── r2/                                # client, resize
├── themes/portico/                        # Portico Ivory theme
│   ├── PorticoShell.tsx, tokens.ts, fonts.ts, stripe-appearance.ts, index.ts
│   ├── components/                        # Nav, Calendar, Gallery, Map, primitives, RoomGallery, StickyBar, Logo, Wordmark, emphasis
│   └── screens/                           # Home, Dates, RoomSelect, Extras, Checkout, Confirmation
├── scripts/
│   ├── cloudbeds-smoke.ts, cloudbeds-sync.ts, cloudbeds-subscribe.ts, cloudbeds-rotate-webhooks.ts
│   ├── cloudbeds-update-name.ts, cloudbeds-sync-hotel-details.ts, cloudbeds-debug-hotel-details.ts
│   ├── check-inventory.ts, cleanup-demo-seed.ts, reset-db.ts
│   ├── seed.ts, seed-second.ts, seed-rate-plans.ts (legacy)
│   ├── test-confirmation-email.ts
│   └── update-font.ts, update-themes.ts (legacy)
└── proxy.ts                               # Next.js 16 proxy (renamed from middleware)
```

---

## **16\. Local dev \+ scripts**

```shell
npm install
npm run dev
# → http://localhost:3000 (resolves to first property in DB)
# → http://localhost:3000/?property=urbanstay (switch property)
```

Requires `DATABASE_URL` in `.env.local` pointing at the Neon Postgres instance.

### **Deploy**

```shell
railway up
```

### **Push schema changes**

```shell
npx drizzle-kit push
```

### **Dev pages (design comparison tools — production routes 404\)**

* `/bars` — 6 booking bar concepts on full hero folds  
* `/compare` — 15 price comparison banner concepts  
* `/compare-live` — 5 shortlisted banners in full page context (with switcher)  
* `/fonts` — font comparison on full room cards  
* `/rates` — rate plan display concepts  
* `/enhance` — extras panel concepts  
* `/rooms-mockup` — 4 room card layout concepts in full page (with switcher)  
* `/pickers` — legacy booking bar variants

### **Test data**

**The Kensington Arms / Rockenue Partner Account** (slug: `demo`, GBP, `cloudbedsPropertyId=302817`) — connected to Cloudbeds.

* 3 room types: Single Room, Double Room, Triple Room  
* 8 rate plans: 3 master rates (Standard) \+ 2 derived (`Non refundable -10%`) \+ 3 master ("Direct Rate \- 72h cancelation")  
* 720 inventory rows (8 plans × 90 days)  
* 1 extra: "Continental Breakfast" ($10.00, addon ID 234169\) — note CB returns USD on the partner test account; booking flow uses `properties.currency` (GBP) for charging  
* 8 webhook subscriptions live  
* Hero image: boutique hotel room (from House on Warwick)  
* Theme: Navy (\#2C3E50) primary, warm border (\#E5E0D8)

**UrbanStay Apartments** (slug: `urbanstay`, EUR) — 2 rooms, slate \+ blue theme, system font.

---

## **17\. Deployment**

* **Railway URL:** `https://booking-engine-production-b11b.up.railway.app`  
* **Admin panel:** `/admin` (token rotated to a 32-byte random value on 2026-04-29)  
* **Dev convenience:** `?property=urbanstay` switches property on localhost or Railway URL

### **Environment variables on Railway**

* `DATABASE_URL`, `ADMIN_TOKEN` — core  
* `CLOUDBEDS_CLIENT_ID`, `CLOUDBEDS_CLIENT_SECRET`, `CLOUDBEDS_REDIRECT_URI`, `CLOUDBEDS_TOKEN_KEY` — OAuth \+ AES-GCM token encryption  
* `CRON_SECRET` — Bearer token for `/api/cron/inventory-sync`  
* `CLOUDBEDS_WEBHOOK_TOKEN` — random 24-byte hex value used as the dynamic segment in `/api/cloudbeds/webhooks/[token]`. Wrong token → 404\. Compared with `timingSafeEqual`.  
* `CLOUDBEDS_WEBHOOK_URL` — optional explicit override; if unset, fallback is `${origin of CLOUDBEDS_REDIRECT_URI}/api/cloudbeds/webhooks/${CLOUDBEDS_WEBHOOK_TOKEN}`  
* `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_APP_URL` — Stripe Connect platform  
* `SENDGRID_API_KEY` — confirmation \+ cancellation emails  
* `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` — Cloudflare R2 photo hosting. Bucket: `rockenue-hotel-photos`.  
* `THEME` — set to `portico-ivory` on the Portico Railway service. Empty \= default theme.

### **Railway services**

* `booking-engine` — main Next.js app  
* `inspiring-trust` — cron service running `0 */6 * * *` UTC against `/api/cron/inventory-sync`. Image `alpine:latest`, start command: `apk add --no-cache curl && curl -fS -X POST -H "Authorization: Bearer $CRON_SECRET" <url>`. Logs visible in Railway → service → Deployments.

---

## **18\. Design conventions**

These are the outcomes of the design overhaul. Follow them unless explicitly redesigning.

* **Hosting:** Railway (not Vercel).  
* **DB:** Neon Postgres 17, AWS eu-central-1.  
* **Design:** Conversion-first, not content-first. Homepage \= booking engine.  
* **Page flow:** Separate pages (`/` → `/book` → `/rooms` → `/extras` → `/checkout` → `/confirmation`), not single-page scroll.  
* **Font:** Inter (default theme); Cormorant Garamond \+ Inter (Portico).  
* **Booking bar:** Icon-led — tinted icon squares, small gray labels, no underlines, glow button.  
* **Room card layout:** Dark Header concept (navy band with room name \+ urgency tags, image left, rates right).  
* **Rate plan buttons:** Outline "Reserve" style (`border: 1px solid primary, borderRadius: 2px`).  
* **Extras:** Card grid with navy header, toggle on/off, sticky navy basket bar below.  
* **Price compare:** Emerald gradient banner with OTA rates in frosted pills.  
* **Trust signals:** "Official Site" badge in nav, "Official Website — Lowest Price Guaranteed" on hero, "Best rate guaranteed" on rooms header.  
* **Page backgrounds:** Homepage \= white \+ \#F2F2F2 alternating, booking flow \= \#F2F2F2 throughout.  
* **Dev mockup pages:** Pattern is to create comparison pages with multiple concepts, then pick the winner and apply to live. All dev pages have links in the NavBar dev section. This process works well — keep doing it for future design decisions.

### **Karol's design preferences (learned through iteration)**

* **Dislikes:** emojis, too much navy/dark, magnolia (\#FAF8F5) as standalone background, heavy borders, uppercase values, card-per-section on homepage.  
* **Likes:** clean white \+ \#F2F2F2, navy used sparingly (headers, one full section), outline buttons, subtle trust signals, Inter font, frosted/glass effects, icon-led UI.  
* Homepage should feel like a hotel website, booking flow should feel like a polished product.  
* The dark header pattern on room cards is the signature — navy band with room name, white body below.  
* Sticky basket bar should feel substantial (navy bg, white button) not shy.

### **Design iteration process**

1. Create a dev mockup page (e.g. `/bars`, `/compare`) with 10-15 static concepts.  
2. Karol shortlists to 4-5 favourites.  
3. Create a "live" mockup page showing the shortlisted options in full page context with a switcher.  
4. Karol picks the winner, you apply it to the real components.

---

## **19\. Forward plan**

### **Phase status**

| Phase | Steps | Status |
| ----- | ----- | ----- |
| 1\. Foundation | git, B2U removal, schema | ✅ Done |
| 2\. Cloudbeds REST API | OAuth, smoke-test, inventory, extras | ✅ Done |
| 2.5 Per-hotel front-end architecture | Headless hooks, sessionStorage drafts | ✅ Hooks done; `src/hotels/<slug>/` scaffold pending |
| 3\. Stripe Connect | Platform setup, onboarding, Elements | ✅ Done — UAE sandbox, Standard accounts, end-to-end working |
| 4\. Booking flow rewrite | postReservation / Items / Payment, confirmation page, email | ✅ Done |
| 5\. Flex auto-charge | Hourly cron, off-session PI, failure handling, monitoring | ⛔ Not started |
| 6\. Cancellation \+ launch hardening | Step 16 Flex self-cancel | 🟡 Flex within-window shipped; NR \+ past-deadline punt to "contact hotel" |
| 6.5 Admin v3 \+ R2 \+ Content CMS | shipped 2026-05-07 | ✅ Done |
| 6.6 Cloudbeds metadata auto-sync | shipped 2026-05-08 | ✅ Done |
| 7\. Post-launch features | Welcome Pickups · GEO/AI · WhatsApp · etc. | 🟡 Welcome Pickups in motion; GEO/AI flagged as must |

### **Phase 5 — Flex auto-charge (not started)**

**Step 13: Hourly cron job**

* Find Flex bookings where `now > chargeAt`, `status = 'pms_synced'`, no successful `auto_charge_succeeded` event yet.  
* For each: create off-session `PaymentIntent` with the saved `stripePaymentMethodId`, `stripeCustomerId`, `off_session: true`, `confirm: true`, application fee \+ transfer\_data as Step 10\. Idempotency key includes `bookingId` \+ attempt number.  
* On success: `postPayment` to Cloudbeds, update booking to `status = 'paid'`, log `paymentEvents`.  
* On failure: log `paymentEvents` with error code, kick off Step 14\.

**Step 14: Failure handling \+ guest re-auth page**

* Email guest with a secure link (signed token) to `/payment-update?token=…`.  
* That page lets them enter / update card → new SetupIntent → new payment method. Once saved, reset `chargeAt = now + 5 minutes`.  
* 24h grace timer (start at first failure). If still unresolved: cancel the Cloudbeds reservation, release inventory, set booking `status = 'cancelled'`, send cancellation email.

**Step 15: Monitoring \+ alerting**

* Heartbeat: cron logs an event each run. Alert if no heartbeat in 90 minutes.  
* Per-run summary: count attempts, succeeded, failed, no-eligible-bookings.  
* Alert on patterns: ≥5 failures in a single run, or any single property with all failures, or any auto-cancel.  
* Surface digest in admin dashboard \+ daily email summary.

### **Phase 6 — Launch hardening (remaining)**

* **Custom domains per hotel** — Cloudflare DNS → Railway.  
* **Real copy \+ room descriptions in DB** — move out of `AvailabilityResults.tsx` `ROOM_DESCRIPTIONS`.  
* **JSON-LD Hotel schema** on each homepage (also feeds GEO work in Phase 7).  
* **`next/font` swap** for the Google Fonts `<link>` in `layout.tsx`.  
* **Domain & deploy tab** — DNS / SSL / Railway probe display.  
* **Alerts tab \+ engine** — compute operational signals.  
* **Resend confirmation \+ Cancel/refund actions** — replace placeholders on booking detail panel.  
* **Smoke test for Flex cancellation** — `src/scripts/cloudbeds-cancel.ts` driving `putReservationStatus` before pointing real guests at the link.

### **Polish entity migration (post 19 May 2026\)**

See [Stripe Connect → Polish entity migration plan](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#polish-entity-migration-plan). When sp. z o.o. is KRS-registered:

1. Apply for Polish Stripe production account.  
2. Wait for underwriting approval (1–3 weeks).  
3. Swap env vars on Railway.  
4. Re-register webhook endpoint.  
5. Re-onboard each connected property.

---

## **20\. Welcome Pickups integration plan**

Airport transfer partnership in motion. Karol emailed Welcome Pickups 2026-05-07. Initial response received from Serkan Bayer (BD Manager). Follow-up sent with questions about vehicle types, API capability, payment handling.

### **Status**

* 🟡 **In discussion** — commercial terms pending.  
* API docs reviewed at `https://welcomepickups.gitbook.io/api-docs`.  
* Self-serve API key via `partnerships@welcomepickups.com` or signup form. Staging environment available.

### **Payment model — preferred \+ 2 fallbacks**

**Preferred: Welcome Pickups as a Stripe Connect connected account on our platform.**

How it works:

* Welcome Pickups onboards as a Standard connected account on our Polish sp. z o.o. Stripe Connect platform (same flow hotels use).  
* Single guest checkout: guest pays £200 room \+ £60 transfer \= £260 in one PaymentIntent.  
* Stripe automatically splits using multi-destination charges (`transfer_data` per line or paired Transfers):  
  * £200 minus our fee → hotel's connected account  
  * £60 minus our fee → Welcome Pickups' connected account  
* Both transactions appear on guest's statement with the right merchant of record.  
* We earn `application_fee_amount` on both legs.  
* No reconciliation pain — Stripe handles everything.

**Why we ask for this:**

* Single checkout \= highest conversion (\~15-20% better than redirected/second-payment models)  
* Hotel doesn't see transfer revenue they didn't earn → clean accounting  
* Welcome Pickups receives funds directly → no monthly invoicing/reconciliation  
* We earn commission on transfer revenue  
* Stripe handles refunds, disputes, currency conversion automatically

**Fallback 1: Wholesale \+ single checkout (we settle with Welcome Pickups out-of-band).**

If Welcome Pickups won't onboard to our Stripe Connect:

* Welcome Pickups gives us wholesale price (e.g. £45)  
* We display retail price to guest (e.g. £60)  
* Guest pays £260 total in single PaymentIntent on hotel's connected account  
* £260 lands in hotel's Stripe; we take our `application_fee_amount` on the full amount  
* Hotel "owes" us £60 for the transfer; we settle:  
  * Option A: charge back to hotel via separate invoice or Stripe Transfer Reversal logic  
  * Option B: split the application fee structure so we effectively recapture it  
* Welcome Pickups invoices us monthly at wholesale rate  
* Our margin: £60 retail − £45 wholesale − Stripe fee on £60 \= \~£14 per transfer

Pros: still single checkout, still highest conversion. Cons: three-way reconciliation, we become merchant-of-record adjacent for the transfer, hotel sees £60 they didn't earn.

**Fallback 2: Their checkout, post-booking surface.**

If neither of the above works:

* Don't surface transfer inline at `/checkout` (would cause two payment steps and conversion drop).  
* Push transfer offer to:  
  * **Confirmation page** ("Add airport transfer" CTA → opens Welcome Pickups booking flow)  
  * **Pre-arrival WhatsApp T-3 days** (once WhatsApp lands — this is where transfer attach rate is highest anyway)  
* Welcome Pickups handles their own checkout, sends commission monthly.

### **Build plan (when commercials land)**

Assuming preferred model:

1. **New `extra_type` enum** on `property_extras` or `booking_extras` — `internal` (Cloudbeds addon) | `transfer` (Welcome Pickups) | future: `parking`, `experience`.  
2. **Welcome Pickups onboarding via admin** — similar UX to hotel Stripe Connect (admin button → account link → status pill).  
3. **API integration** — `src/lib/welcome-pickups/`:  
   * `client.ts` — Bearer token auth, base URL by environment  
   * `quotes.ts` — pre-checkout quote lookup (`POST /v1/external/quote/...`)  
   * `bookings.ts` — create transfer booking with `pre_paid: true` flag  
   * `webhooks.ts` — handle driver assignment / status updates / cancellations  
4. **Booking flow integration:**  
   * `/extras` — add "Airport transfer" card alongside Cloudbeds addons (with city detection: only show if property is Welcome-Pickups-supported)  
   * PaymentIntent creation — multi-destination split if Stripe Connect onboarded; else single-destination on hotel account (Fallback 1\)  
   * Confirmation email — include driver/voucher details  
5. **Webhook handler** — `/api/welcome-pickups/webhooks/[token]/route.ts` — token-gated like Cloudbeds webhooks.  
6. **Admin visibility** — booking detail panel shows transfer line item \+ driver assignment when known.

### **Open questions for Serkan (sent 2026-05-09)**

1. Vehicle types in London — minicabs (PHV), black cabs, or executive private hire?  
2. API capability for full IBE integration vs widget/redirect.  
3. Payment model — Stripe Connect onboarding, wholesale settlement, or their checkout.  
4. Commission/markup structure.

### **Alternatives if Welcome Pickups doesn't fit**

* **Karhoo** — bigger marketplace (3,000+ fleets, used by Accor \+ SNCF Connect). Mature REST API \+ deeplink option (`@karhoo/demand-deeplink` npm package). Sales-led onboarding (not self-serve). Aggregates multi-supplier choice per ride.  
* **Mozio** — global aggregator covering 3,500+ airports (relevant if expand beyond UK). 5–10% commission. Mature API.  
* **Minicabit** — UK-only, broader coverage outside London (Manchester, Birmingham, Edinburgh). Budget tier.

Karhoo is the strongest pure-UK alternative if Welcome Pickups doesn't work. Mozio is the strongest global alternative.

---

## **21\. Phase 7 — Post-launch features**

Loose direction for post-launch. Each item gets its own focused step when its time comes; this section captures decisions made 2026-05-07 onwards.

### **Active**

* **Welcome Pickups airport transfers** — see [section 20](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#20-welcome-pickups-integration-plan).

### **Highest-leverage cheap win**

* **GEO / AI-friendly content** — single highest-leverage item in the roadmap. Make Portico (and every property) discoverable to AI agents (ChatGPT, Claude, Perplexity, Google AI Overviews), search, and direct queries. Cost ≈ £0 ongoing; \~4 weeks of work.

   Concretely:

  * **JSON-LD schema** on every property page. Types: `Hotel`, `FAQPage`, `AggregateRating`, `Offer`. Generated server-side from property data \+ content blocks.  
  * **FAQ admin section** — pre-populated with 15 standard questions per property (check-in, parking, breakfast, accessibility, pets, etc.), editable. New content key `faq` in content blocks. Renders both as visible `/faq` page AND as `FAQPage` JSON-LD.  
  * **5–10 specific factual claims** per property homepage — concrete, verifiable, citation-ready ("3 minutes from Paddington Station", "Eight rooms", etc.). Already partially shipped in the neighbourhood block; add a structured `facts` field.  
  * **MCP endpoint** at `/mcp/server` — exposes availability \+ property details via Model Context Protocol so AI agents can query rooms directly. Wraps `/api/availability` \+ property meta. Future-positioning for AI-agent-driven booking.  
  * **Per-property local-guide content** — owner-written ongoing copy. Adds depth \+ originality, not boilerplate. Lives in content blocks as `localGuide` (or split into multiple).

### **Guest comms platform — designed, build pending**

Goal: per-hotel designable email templates \+ smart scheduling \+ ops view. Replaces today's hardcoded confirmation/cancellation templates with admin-editable ones.

**Stack:**

* **Composer:** Maily.to (open-source MIT, Notion-style block editor built on Tiptap, made by the Resend team). JSON-on-disk, renders to HTML at send. Embedded in `/admin/[propertyId]/emails`. Free.  
* **Delivery:** SendGrid (already paying). Essentials tier ($20/mo) covers up to 50k emails/mo ≈ 30–40 hotels at moderate volume. Pro ($90/mo) at higher volume.  
* **Per-hotel branding:** three new columns on `properties` (`emailFromAddress`, `emailLogoUrl`, `emailAccentColor`). Injected at render time.  
* **Per-hotel reputation isolation:** SendGrid authenticated domains per hotel (`mail.<hotel-domain>` DNS at onboarding) \+ Subusers tier at hotel \#10+.  
* **Scheduler:** our existing Railway cron, extended. Hourly tick, finds bookings hitting trigger window, queues sends.

**DB tables to add:**

* `email_templates` — `(id, propertyId, key, name, mailyJson, htmlCached, status, updatedAt)`  
* `email_schedules` — booking-trigger metadata  
* `email_sends` — audit trail from SendGrid Event Webhook

**Phased rollout:**

1. Phase 1 — Composer \+ transactional templates (\~5–7 days). Maily.to embedded; move existing confirmation \+ cancellation into editable templates with Portico-faithful defaults; per-property `emailFromAddress` \+ authenticated domain at onboarding; SendGrid Event Webhook → `email_sends`.  
2. Phase 2 — Scheduler \+ non-transactional flows (\~3–5 days). 3 standard automated flows (pre-arrival 3 days out, welcome at check-in, post-stay review request 1 day after checkout).  
3. Phase 3 — Hardening at scale (hotel \#10+). SendGrid Subusers, per-hotel API key, unsubscribe groups per hotel.  
4. Phase 4 — Multi-channel (when WhatsApp lands). Revisit Knock ($300/mo) for routing.

**Target budget: $60/mo at 40 hotels.** Knock ($300/mo) and Postmark ($245/mo) were evaluated and rejected — replaced by \~1 day of internal engineering each.

**Three open decisions before scaffolding starts:**

1. Phased or all-in for v1? Lean: phased.  
2. Scheduler scope — event-relative only, or also one-off broadcasts? Lean: event-relative only.  
3. Who edits templates — Karol-only or per-hotel logins? Lean: Karol-only.

### **Under consideration**

* **WhatsApp Business API** — pre-arrival upsell, confirmations, review requests. **360dialog** as BSP. Foundation for Welcome Pickups \+ Tiqets flow. Decide before building those two. Pairs naturally with guest comms platform above (same scheduler, different dispatch channel).  
* **Corporate / TMC portal** — open. Build only if demand emerges from business-traveler properties.

### **Defer**

* **Tiqets / GetYourGuide attractions** — defer until WhatsApp flow exists. Pattern: pre-arrival WhatsApp surfaces curated experiences, links to Tiqets.  
* **Guest accounts / cross-property identity** — note for future. Foundation for "welcome back" across 39-property portfolio. Big enough that it deserves its own design pass. Account login (auth), profile data, preferences across hotels, repeat-guest detection.

### **Skipped / dropped**

* ❌ **Stripe Identity** — would impact conversion. Identity verification, if ever needed, lives in a separate self-check-in app, not the booking engine.  
* ❌ **JustPark / parking** — most properties have no parking. Per-property optional add-on later if a specific hotel asks.  
* ❌ **Onyx travel-agent commissions** — not now.

### **Already in pipeline (separate work stream)**

* Google Hotel Ads \+ Meta Travel Ads — paid acquisition handled separately. Needs `/feeds/google-hotels.xml`, `/feeds/meta-catalog.csv`, Meta Pixel, server-side Conversions API on `booking.confirmed`. Apply to Google Hotel Center 1–2 weeks after first hotel goes live with real bookings flowing.

---

## **22\. Open design questions**

* **Reservation creation failure** (Stripe succeeds, `postReservation` fails). Happy path landed Step 11; design the retry / pending-state / auto-refund flow before launch.  
* **Error state UX** — payment fails, room sold out between selection and payment, 3DS fails, Cloudbeds down. Decide during Phase 5\.  
* **Address field in checkout** — TBD design.  
* **Cancellation policy ergonomics** — granular per-rate editor shipped in Step 11, but at 40 hotels maintaining policy in *both* Cloudbeds *and* our admin, the duplication is friction. Options:  
  * **A. Keep granular** — current shape. Maximum flexibility, maximum hotel-side maintenance burden.  
  * **B. Simplify** — drop per-rate JSONB; keep `isRefundable` per rate (auto-detected from name); add one `cancellationDeadlineHours` per property. Refund logic: refundable \+ before deadline \= full refund; else no refund. Covers \~95% of real direct-booking policies. **Karol's lean.** Hotels maintain real schedule in CB; our system enforces simplified version for refunds.  
  * **C. Drop entirely** — show "to cancel, contact the hotel" on bookings; no automated refund flow; push Step 16 self-cancel out of v1. Cleanest tech, worst guest UX.  
  * **Underlying constraint:** Cloudbeds REST API doesn't expose policy fields. Re-probe periodically — if the new modular API at `api.cloudbeds.com` adds policy endpoints, we can swap to read-only sync and retire the editor.

---

## **23\. Out of scope for launch**

* Modifications (force cancel-and-rebook).  
* Partial refunds in the engine (hotel handles manually outside our system; Transfer Reversal logic needed if we expose it).  
* Inventory holds during checkout (race conditions \= polite "sold out" message).  
* Adults/children occupancy split.  
* Loyalty / member accounts.  
* Multi-language.  
* Abandoned cart recovery.  
* Multi-property bookings in a single transaction.  
* Guest "delete my data" UI (legally required — flag for v1.5).  
* Hotel admin user accounts with roles (single admin token continues for now).

---

## **24\. Engineering reminders**

* **3DS on SetupIntent** runs at save; doesn't guarantee the off-session charge bypasses 3DS later. The Phase 5 grace path covers issuer-required reauth.  
* **Application fee currency** — fees come in the charge currency; Stripe FX-converts to the platform payout currency. Reporting/reconciliation awareness.  
* **Statement descriptor** — on direct charges, the connected account's base descriptor dominates. We use `statement_descriptor_suffix: "ROCKENUE"` only, capped so combined ≤22 chars. Future: per-property `statement_descriptor_short`.  
* **Idempotency** — every Stripe call uses `orderId` as idempotency key; every Cloudbeds write is wrapped in retry-safe logic.  
* **Webhook handlers must return 200 in \<2s** — Cloudbeds budget. We fire work in background via `void ...`.  
* **Cloudbeds spelling: `propertyID` vs `propertyId`** — both appear across CB events. Our handler accepts either.  
* **R2 URLs need `unoptimized` prop** on `<Image>` to bypass Next.js image optimisation without configuring `next.config` `images.remotePatterns`.  
* **Next.js 16 `revalidateTag`** requires two-arg signature: `revalidateTag(tag, { expire: 0 })` for immediate. Single-arg form is deprecated.  
* **Polish bank account must be on Biała lista** before linking to Stripe. mBank/ING/Santander safe; Wise/Revolut may not be.  
* **CRBR filing** within 14 days of KRS registration. Confirm notary includes this, or arrange via accountant.

---

*This document is intended to be the single source of truth. When something changes, update here first; don't let docs scatter again.*

