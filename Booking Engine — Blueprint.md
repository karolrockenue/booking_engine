# **Booking Engine — Blueprint**

**Last updated:** 2026-05-21 **Status:** Phases 1–5 \+ 6.5 \+ 6.6 \+ 7.1 shipped. Stripe Connect live on UAE sandbox (Polish entity migration scheduled post-19 May). Flex auto-charge \+ PMS retry recovery live on production. **Guest comms (Phase 7.1) shipped end-to-end — Unlayer composer + R2 image pipeline + scheduler + send log. Maily.to replaced 2026-05-12 (no font control); Unlayer integrates uploads into the Media library and supports brand fonts. See §13.** Welcome Pickups partnership in motion. **✅ Cloudbeds Marketplace CERTIFIED 2026-05-20** — passed via the live Marketplace "Connect app" flow. The retry-day fixes that closed it: the OAuth callback now accepts **Cloudbeds-initiated** installs (unsigned state → fresh property, `63d5745`); the admin "Open site" button uses the `/<slug>` path, not the retired `?property=` shim (`8c4079b`); and the Cloudbeds console's **Login URL** (a stale `market-pulse.io` value) was repointed to `/api/install`. Full chain verified end-to-end: OAuth → auto-create hotel → inventory/rates/extras/hotel-details sync → webhooks → Stripe auto-attach → real NR + Flex bookings with per-morning breakfast folio + cancel. **us2 needs no special handling** — OAuth authorize is the standard `hotels.cloudbeds.com/api/v1.3/oauth` (not `us2`/`v1.1`); the cluster resolves internally. See the **2026-05-20 session log** immediately below + §7 chronicle. **Post-cert cleanup pending: DROP the `cert_attach_test_stripe` trigger + delete the throwaway test properties.** **2026-05-21 (post-cert):** platform domain **`app.rockenue.tech`** is live (Hostinger DNS → Railway) with a Rockenue Tech landing page; admin gained **room-type visibility** + a dedicated **Rooms** page, and **Rate plans** now show logical (deduped) plans with per-plan visibility + a booking-engine display-name override. **Google Hotel Center integration Sprints 1–4 + Sprint 5 foundation shipped** (separate work stream — see `Google Hotel Center — Blueprint.md`). See the **2026-05-21 session log** below.

Multi-tenant hotel website \+ booking engine platform. Each hotel runs on its own custom domain with a bespoke website and an integrated booking flow connected to Cloudbeds. Built and managed by Rockenue as the webmaster across all properties (≈40 independent hotels, luxury → near-hostel spectrum).

This document is the single source of truth. It replaces `README.md`, `hotel-platform-build-plan.md`, `THEMES.md`, and `TODO.md`. AI agent rules continue to live in `AGENTS.md` / `CLAUDE.md`.

> **Companion blueprint — Google Hotel Center.** The Google integration work stream (Free Booking Links / Hotel Ads — Hotel List XML feed, ARI Push, Landing Pages XML, JSON-LD hotel-price data, Connectivity Partner application) lives in its **own** document: **`Google Hotel Center — Blueprint.md`** in the repo root. If a task touches Google feeds, Hotel Center, FBL/Hotel Ads, or hotel-price structured data, read that file — it's the source of truth for that work stream. This document stays focused on the IBE (booking engine, Cloudbeds, Stripe, admin, themes, email).

---

## **2026-05-21 session log — post-cert: admin polish, platform domain, Google integration**

Post-certification work, all deployed to `main`/Railway. Newest first; commit hashes in parentheses.

### Google Hotel Center integration — Sprints 1–4 + Sprint 5 foundation (`d7352bd`, `3abda76`, `8876820`, `5e5d98a`, `37f2c9a`)
- New work stream in **its own doc — `Google Hotel Center — Blueprint.md`** (Free Booking Links first, Hotel Ads later). It carries a standing **plan → execute → update** process (its §11 Progress log). Code lives in `src/lib/google-hotels/` + `src/app/api/google/feeds/`.
- **Sprint 1 — Hotel List XML feed** (`/api/google/feeds/hotel-list`, admin-gated): emits the `<listings>` identity feed from `properties` + `content_blocks`; **validates against Google's `local_feed.xsd`**.
- **Sprint 2 — JSON-LD on `/rooms`**: extracted `computeAvailability` into **`src/lib/booking/availability.ts`** (now shared by the availability route AND the JSON-LD builder, so the structured-data price can't drift from the booking page). `buildHotelJsonLd` injects a server-rendered schema.org `Hotel` + `makesOffer` into the shared `/rooms` route. Verified: JSON-LD price === availability lowest.
- **Sprint 3 — VAT / rate-display audit** (no code): confirmed feed price = displayed = booking = Stripe charge; VAT sits inside the Cloudbeds rate; the 3% platform fee is a Stripe `application_fee` **deduction** from the hotel payout, never a checkout add-on. Decision: feed declares an all-inclusive `Baserate`.
- **Sprint 4 — Landing Pages XML** (`/api/google/feeds/landing-pages`, admin-gated): a `<PointsOfSale>` macro-templated deep-link URL; the substituted URL returns **HTTP 200 on the live app**. Hotel List feed's `alternate_hotel_id` is now the **slug** (the routing key).
- **Sprint 5 — ARI Push foundation** (`37f2c9a`): `google_ari_messages` audit/queue table + `src/lib/google-hotels/ari/` (OAuth service-account module, Google `<Transaction>` generators for Property Data + price, client + mock endpoint). Full generate→POST→200→log loop **verified against the live mock**. **Remaining in Sprint 5:** OTA rate/avail/inventory messages, delta/dedup, retry cron, Cloudbeds-webhook→fire — best done with the exact OTA structure and/or Google allowlisting.

### Platform domain + landing page (`206a11c`, `b5c82d6`, `12e8107`, `b8dbcc5`)
- **`app.rockenue.tech` live** (Hostinger DNS CNAME → Railway, SSL issued). Intended canonical host for admin + the Cloudbeds OAuth/webhook + Stripe webhook + Google feeds. **Endpoint cutover still pending** — swap `CLOUDBEDS_REDIRECT_URI` / `CLOUDBEDS_WEBHOOK_URL` / `PUBLIC_APP_URL`, add the new redirect URI + Login URL in the Cloudbeds console (parallel with the Railway ones), re-point the Stripe webhook, then retire the Railway URL (see §19 Phase 6).
- **Rockenue Tech landing page** at the bare platform host (`src/components/rockenue/Landing.tsx`): dark `#14181D`, teal/gold `(tech)` motif, Inter, **Admin button → `/admin`**. Bare `/` now renders this instead of falling through to the first Cloudbeds hotel; a host a hotel owns still redirects to `/<slug>`; per-hotel sites remain at `/<slug>`.
- Root tidy: removed `.DS_Store` + `tmp/` scratch; gitignored `/backups/` (local DB snapshots).

### Admin — Rate plans: logical plans + visibility + display name (`720a578`, `6776355`, `9459255`)
- The Rate plans page no longer lists per-room rows — they're **grouped into logical plans** (Standard, Non Refundable, Direct Rate, Direct NRF) by stripping the room-type prefix from synthesised "<Room> Standard" master names. Lancaster's **27 rows → 4**. Hiding or editing one **fans out to every underlying per-room rate plan**.
- **Visibility toggle** per logical plan reuses **`rate_plans.isPublic`** (availability already filters on it; the sync never overwrites it). Hidden plans drop from the booking engine.
- **Booking-engine display-name override** — new **`rate_plans.display_name`** (admin-owned; sync never writes it). Availability serves `displayName ?? namePublic ?? name`; the admin row shows both the booking-engine name and the Cloudbeds name (defaults to the CB name).

### Admin — Room-type visibility + dedicated Rooms page (`3399859`, `72a8c6c`, `29fc813`)
- New **`room_types.hidden_from_booking`** (admin-owned; sync never writes it). Availability filters hidden rooms out, so virtual/staff room types (e.g. Lancaster's **"Virtual Double"**, **"Air BnB"**) drop from the booking engine.
- **Dedicated "Rooms" sidebar page** (`/admin/[id]/rooms`, between Media and Rate plans) with a Shown/Hidden toggle per room — moved out of the Content page (which no longer fetches/renders rooms). Cloudbeds HTML room descriptions are flattened to plain text in the admin row.

### Cert documentation (`27de6b6`, `77d0835`)
- Recorded the Cloudbeds Marketplace **certification** + retry-day fixes (Cloudbeds-initiated OAuth callback, Open Site path fix, console Login URL repoint). See the 2026-05-20 session log + §7.

---

## **2026-05-20 session log — cert-prep sprint**

A large batch shipped + verified live against `demo` (Cloudbeds `302817`, us1). All deployed to `main`/Railway unless noted. Newest first; commit hashes in parentheses.

### ✅ CERTIFIED — live Marketplace "Connect app" flow (`8c4079b`, `63d5745`)
- **Cloudbeds Marketplace certification PASSED 2026-05-20.**
- **The blocker that remained from the failed attempt: the install is Cloudbeds-INITIATED.** "Connect app" starts OAuth on Cloudbeds' side and hits our callback with a `state` we never signed → the old callback rejected it with `invalid_state`. **Fix (`63d5745`):** treat a missing/unverifiable state as a first-time install — allocate a fresh property UUID + INSERT, exactly like `/api/install`. A valid signed state still takes the app-initiated path (admin "Connect Cloudbeds" upserts in place). Verified live (callback probe returns `token_exchange_failed`, not `invalid_state`).
- **Open Site fix (`8c4079b`):** the admin button still built `/?property=<slug>` (retired shim → fell through to the domain owner, opening the wrong hotel). Now `/<slug>`. The path-routing sprint (`a755baf`) had missed this one button.
- **Cloudbeds console config corrected:** the app's **Login URL** field held a stale `market-pulse.io` value (legacy host) → "during OAuth it took me to market-pulse". Repointed — **Login URL** = `…/api/install`, **Connect App URL** = "Use OAuth URL" (v1.3 authorize → our callback), **Redirect URL** = `…/api/cloudbeds/oauth/callback`. Declared scopes include `write:item` + `write:payment`.
- **us2 / version learning:** OAuth must use **`hotels.cloudbeds.com/api/v1.3/oauth`** — NOT `us2.cloudbeds.com` or `/api/v1.1`. Authorize + token exchange must match host+version (our token endpoint is `hotels.cloudbeds.com/api/v1.3/access_token`). The cluster resolves internally; us2 needs no special host.
- **Clean-slate rehearsal:** wiped all properties (snapshot → `backups/`), re-OAuthed the Rockenue partner account via the exact Cloudbeds-initiated path → fresh property created + synced (3 rooms · 8 rates · 686 inventory rows · 3 extras · 8 webhooks · currency USD), Stripe auto-attached (`acct_1TSCLV1ZjN2BG9vB`, `charges_enabled`), and **two real bookings** (NR `1474805519554` + Flex `5256302014941`) with per-morning breakfast folio (`postCustomItem` ✓) + cancel.
- **`cert_attach_test_stripe` trigger made self-contained** — now copies a literal test-account id instead of reading the (deletable) `demo` row, so any fresh install still gets test Stripe.
- **Post-cert cleanup pending:** DROP `cert_attach_test_stripe` trigger + function; delete throwaway test properties; (optional) add an "already connected?" guard so the `/api/install` Login URL doesn't create a duplicate row when an installed hotel re-opens the app.

### Path-based per-property routing (`a755baf`)
- Customer site moved under a **`[property]` dynamic segment**: `/<slug>`, `/<slug>/rooms`, `/<slug>/book`, `/<slug>/extras`, `/<slug>/checkout`, `/<slug>/confirmation`. Resolved from the **path** (`resolvePropertyBySlug`), not the Host header. Bare `/` resolves by domain → redirects to `/<slug>`. See §4 (rewritten).
- **Fixes the cert-day "`?property=` doesn't override" bug** — root cause was navigation dropping the query param + falling back to the domain-owner; the slug now lives in the path and never drops. `?property=` shim retired.
- Tested: prod `/demo` + `/demo/rooms` resolve demo (not the domain owner); bare `/` 307→`/<slug>`; unknown slug 404; prod build passes.

### Cloudbeds rate pricing — `rooms[][roomRateID]` (`ad10465`)
- `postReservation` priced every room at the **master/base** rate: Cloudbeds selects the rate from `rooms[i][roomRateID]`, which we never sent (`ratesID` + `subtotal` are ignored for pricing). A derived rate ("Direct Rate −10%") was quoted 108 by us but charged 120 by the PMS. Fix: send `rooms[0][roomRateID]` = the rate we sold; `subtotal` corrected to room-only.
- Tested live: derived rate now prices at **108** (was 120); master rates still 120.

### Breakfast / extras pricing model (`fd46b2d`, `bbea31d`, `f7d8a20`)
- New **`property_extras.pricing_model`** column (`per_stay` default | `per_guest_per_night`). Cloudbeds exposes no charge model (verified via `/addons/v1/addons` + `/getItems`), so it's our config; the sync never writes it (survives re-syncs).
- Shared helper `src/lib/booking/extra-pricing.ts` (`extraQuantity` / `extraLineTotal` / `extrasSubtotal` / `stayMornings`) used by **both** client (display + Stripe amount) and server (booking row + folio qty) so charge = booking = PMS. Server re-derives the model from the DB — never trusts the client.
- **Breakfast picker** (`src/themes/portico/components/BreakfastPicker.tsx`): smart default = all guests × all mornings (`guests × nights`; mornings = the morning after each night); "Customise" reveals a guest stepper + per-morning toggles. Stored in the draft as `ExtraConfig { guests, mornings }` (+ sessionStorage). Children count as guests.
- **Per-day folio + staff note:** breakfast posts ONE dated folio line per morning (qty = guests that morning) via `postCustomItem`'s `serviceDate`, so Cloudbeds' "items by date" / Service-Date reports give the kitchen daily counts; plus a `postReservationNote` summary in the reservation's Notes tab.
- Tested live: math (1n/2g = $20, 2n = $40); dated lines + note posted + read back; full picker → checkout → folio.

### Confirmation breakdown + cancel (`f3a45a2`, `660cf1a`, `5b8358c`)
- **Line-item breakdown** (Accommodation + each extra ×qty + Total) on the Portico confirmation **screen** and in the **email** (injected `{{booking.breakdownBlock}}` var — keeps the flat `{{var}}` template, no loop). Per-extra qty/lineTotal persisted.
- **Cancel button** in the confirmation email (`{{links.cancelBlock}}` — styled button for Flex, empty string for NR so no dead link) and on the confirmation screen (Flex only). Demo's stored email template re-seeded to pick up the tokens.
- **Cancel reversal:** cancelling zeroes the room in Cloudbeds but leaves posted custom items as charges → balance due. v1.3 has no delete-item endpoint (404) and `postAdjustment` needs a scope we don't hold, so the cancel route posts an **offsetting negative `postCustomItem`** per charged extra → folio nets to $0 (uses existing `write:item`). Guest self-cancel path only.
- Tested live: email renders button for Flex / nothing for NR; cancel reversal balance 20 → 0; `postCustomItem` works on a cancelled reservation.

### Admin extras config (`660cf1a`)
- New **Admin → Extras** page (`/admin/[propertyId]/extras`) + `GET`/`PATCH /api/admin/properties/[id]/extras`: lists Cloudbeds extras, set the charge model per extra. Sidebar gains an "Extras" entry. Replaces setting `pricing_model` in SQL.

### Scopes + postCustomItem shape (`36b2ed0`)
- `read:item`/`write:item` + `read:payment`/`write:payment` added to `scopes.ts`; `postCustomItem` rewritten to the real v1.3 shape (PHP-style `items[i][appItemID|itemName|itemQuantity|itemPrice]`, response `{ data: { soldProductID, externalRelationID } }`). See §7. Verified end-to-end on demo.

### Cert onboarding + Stripe (this session; partly DB-only, not in git)
- Confirmed the OAuth callback already (post-`b4056ec`) **auto-creates** the hotel shell (name/slug/cbId from `getHotels`) + subscribes webhooks + fires inventory sync; `/api/install` is the Marketplace entry point. The cert-day "manual INSERT + click Sync" is obsolete.
- **Cert Stripe shim — `cert_attach_test_stripe` DB trigger (prod, no deploy):** BEFORE-INSERT on `properties`, auto-copies demo's test Connect account onto any new property with no Stripe, so a freshly-installed cert hotel can take a test booking with `4242` — zero manual step. **MUST be dropped after cert** (see §7 → prod hacks). Verified by inserting + deleting a throwaway hotel.
- **us2 resolved as a non-issue.** The cert hotel (`5886676873777241`, "[Demo] Manuel US2") is on Cloudbeds' us2 island. The "You don't have access to property ID" seen this session was a **revoked grant** (Manuel revoked after the failed call) — NOT a cluster/host problem. Proof: on the cert call we successfully called `getRatePlans`/`getRooms`/`getReservations` against that hotel on the standard host (that's how the rooms were found to be `isVirtual:true`); and a healthy token works identically on `hotels.cloudbeds.com` and `hotels.us2.cloudbeds.com`. **us2 onboarding is identical to normal — no host/region code change needed.**

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
13. [Email (SendGrid + Unlayer composer)](https://claude.ai/chat/f7c44679-0eaf-433e-b582-dff9dfcccb3e#13-email-sendgrid--unlayer-composer)  
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
| **PMS** | Cloudbeds REST API (OAuth2 per property) | 🟢 Inventory, rates, extras, webhooks, write paths live · **Marketplace CERTIFIED 2026-05-20** |
| **Payments** | Stripe Connect (Standard accounts, direct charges \+ `on_behalf_of`) | 🟢 Live on UAE sandbox; Polish entity migration scheduled |
| **Image storage** | Cloudflare R2 \+ `@aws-sdk/client-s3` \+ `sharp` | 🟢 Bucket `rockenue-hotel-photos`, 3 variants per upload (hero 1600w / gallery 800w / thumb 400w) |
| **Email** | SendGrid (`@sendgrid/mail`) · Unlayer composer (`react-email-editor`) | 🟢 Transactional + scheduled flows; admin composer with R2 media library |
| **DNS** | Cloudflare | 🟡 Custom domains pending; R2.dev URL covers photos for now |

**Next.js 16 has breaking changes from prior versions.** Per `AGENTS.md`: check `node_modules/next/dist/docs/` before writing route handlers, middleware, or server actions. Middleware was renamed to `proxy.ts`; `revalidateTag` now requires a two-arg signature with `{ expire: 0 }` for immediate expiration.

---

## **4\. Multi-tenant routing**

**Path-based per-property routing (since 2026-05-20).** Customer-facing routes live under a **`[property]` dynamic segment** — each hotel is reached at `/<slug>`, `/<slug>/rooms`, `/<slug>/book`, `/<slug>/extras`, `/<slug>/checkout`, `/<slug>/confirmation`. The property is resolved from the **path** via `resolvePropertyBySlug(slug)`, so the slug is always visible and never drops mid-flow. (In future these slugs front real hotel domains.)

`src/proxy.ts` (Next.js 16's renamed middleware) still runs: it 404s the dev mockup routes (`/bars`, `/compare`, `/compare-live`, `/enhance`, `/fonts`, `/pickers`, `/rates`, `/rooms-mockup`) when `NODE_ENV === "production"`, and sets `x-property-host` for the bare-`/` domain resolution. Static routes (`/admin`, `/api`, dev mockups, `/cancel/[token]`, `/payment-update/[token]`) take precedence over `[property]` (Next.js static-over-dynamic), so they're never mistaken for slugs; an unknown slug 404s.

### **Property resolution (`src/lib/get-property.ts`)**

- **Customer pages** (under `[property]`) call `resolvePropertyBySlug(slug)` with the route param → `notFound()` on an unknown slug. This is the primary path.
- **Bare `/`** (since 2026-05-21) resolves by **host**: if a hotel owns the exact host (`properties.domain` match) it redirects to that hotel's `/<slug>`; otherwise it's the **platform host** (`app.rockenue.tech`) and renders the **Rockenue Tech landing page** (`src/components/rockenue/Landing.tsx`, Admin button → `/admin`). It no longer falls through to the first Cloudbeds-connected hotel. (`src/app/page.tsx`.)
- **Token routes** (`/cancel/[token]`, `/payment-update/[token]`) still call `resolveProperty()` — resolves by `properties.domain` exact match, else the first property with `cloudbedsPropertyId` set (dev/staging fallback), else any property.

The old `?property=<slug>` shim is **retired** — the path replaces it. (It was the source of the cert-day "wrong property after navigation" bug: internal navigation dropped the query param and fell back to the domain owner. See the 2026-05-20 session log.) For a single deployment that should serve one hotel from its bare domain, set `properties.domain`.

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
| `admin-map.html` | Annotated tour of the live admin (dashboard · shell with 3 navigation levels · breadcrumb pattern · per-page wireframes · email composer zoom). Useful for orientation when adding pages. |
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
* Categorization: `slot` (`hero` | `gallery` | `room` | `neighbourhood` | `marketing`, default `gallery`), `roomTypeId` (FK when `slot=room`), `sortOrder`. `marketing` is admin-only — never auto-displayed on the public site (see `getPropertyPhotos` which ignores it); used for logos and brand assets surfaced in the email composer.  
* File meta: `mimeType`, `sizeBytes`, `altText`  
* Variants: `variants` JSONB (`{ hero: {key,url,w,h,sizeBytes}, gallery: {...}, thumb: {...} }`)  
* R2 keys follow `properties/<propertyId>/<uuid>-{hero|gallery|thumb}.jpg`

**`room_types`** — mirrored from Cloudbeds (`otaRoomId` \= Cloudbeds `roomTypeID`, numeric). `hiddenFromBooking` (bool, default false) is admin-controlled visibility — the inventory sync never writes it, so it survives re-syncs; `/api/availability` filters hidden room types out (used to hide virtual/staff rooms). Managed on Admin → **Rooms** (2026-05-21).

**`rate_plans`** — mirrored from Cloudbeds (`otaRateId` \= Cloudbeds `rateID`); `isRefundable` \+ `cancellationPolicy` are admin-managed (not in CB API), seeded from a name heuristic on first sync. **`isPublic`** (bool, default true) is admin-controlled visibility — availability filters on it; the sync never overwrites it (used by the Rate plans "Shown/Hidden" toggle). **`displayName`** (nullable, 2026-05-21) is an admin override for the name shown on the booking engine — availability serves `displayName ?? namePublic ?? name`; sync never writes it.

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

**Actual current list (11 scopes):** `read:addon, read:currency, read:guest, write:guest, read:hotel, read:rate, read:reservation, write:reservation, read:room, read:taxesAndFees, read:user`.

**Adding any new scope requires re-OAuth on every connected property** — old tokens don't carry it.

**Extras → folio + NR payment record: RESOLVED 2026-05-20.** `postCustomItem` (paid extra → reservation folio) requires `write:item`; `postPayment` (NR-rate folio payment record) requires `write:payment`. Both were granted in the Cloudbeds console on 2026-05-20 — the console groups scopes as Adjustment / Item / Payment / … each with Read/Write/Delete; we ticked **Item → R+W** and **Payment → R+W** — and added to `scopes.ts` as `read:item`/`write:item` and `read:payment`/`write:payment`. **Granting the scopes exposed a second, latent bug in `postCustomItem`:** the old code sent flat `name`/`amount`/`quantity` and parsed a flat response — both wrong (they only ever failed earlier with the scope error, masking the shape bug). The real v1.3 shape is a PHP-style indexed array — each item needs `items[i][appItemID]` (an app-supplied unique ID; we mint a UUID per line), `items[i][itemName]`, `items[i][itemQuantity]`, and a price (`items[i][itemPrice]` = unit price, or `itemAmount` = line total). The response is **wrapped**: `{ success, data: { soldProductID: "p_64862080", externalRelationID: "64862080" } }` — we persist `soldProductID` as `cloudbedsItemId`. Fixed in `src/lib/cloudbeds/reservations.ts` and verified end-to-end against the demo property (postReservation → postCustomItem → postPayment → cancel, all ✓). **Remaining before cert retry:** re-OAuth `demo-manuel-us2` (cert hotel still holds an old-scope token), deploy `scopes.ts` so `/api/install` requests the new scopes for future installs, then run the pending-extras sweep for any stuck rows.

### **What's shipped**

* **OAuth2 \+ token refresh** — encrypted at-rest (AES-256-GCM via `CLOUDBEDS_TOKEN_KEY`), silent refresh.  
* **Inventory sync** — `syncInventoryForProperty(propertyId, days=90)`. Pulls `getRoomTypes` \+ `getRatePlans` (with `detailedRates: true`), flattens into `roomTypes`, `ratePlans`, `inventory`. Master rates get synthesised names (e.g. "Double Room Standard"); derived rates use `ratePlanNamePrivate`. **`isRefundable` heuristic:** seeded `false` if name matches `/non[- ]?ref/i`, otherwise `true`. **Sync only seeds on insert; updates do not clobber `isRefundable` or `cancellationPolicy`.** Admin UI overrides take precedence forever after. Bulk upsert per rate plan (`onConflictDoUpdate`). 90 days × 8 rate plans \= \~3 seconds. Idempotent.  
* **Extras catalog sync** — `syncExtrasForProperty(propertyId)` pages `/addons/v1/addons` on the new API host, upserts on `(propertyId, cloudbedsAddonId)`, hard-deletes rows no longer in CB. Called at end of inventory sync and as cold-start from `/api/extras`.  
* **Webhook subscriptions** — `subscribeWebhooksForProperty` / `unsubscribeWebhooksForProperty`. Persists subscription IDs so we can `deleteWebhook` later. Idempotent.  
* **Webhook handler** at `/api/cloudbeds/webhooks/[token]/` — receives 10 events, returns 200 in \<600ms (well under Cloudbeds' 2-second budget), fires `void syncInventoryForProperty(...)` background. Accepts both `propertyID` and `propertyId` field names since Cloudbeds spells it both ways. **Token-gated** — wrong token returns 404; compared with `timingSafeEqual`.  
* **Reservation writes** — `postReservation`, `postCustomItem`, `postPayment` in `src/lib/cloudbeds/reservations.ts`. Form-encoded POST (not JSON), `propertyID` in query string, **returns flat fields at top level** (not wrapped in `{ data }` like most v1.3 endpoints — surprised us on first run).  
* **Cancellation** — `putReservationStatus` (v1.3, `status=canceled` with single-l spelling) \+ optional `reason`. Cloudbeds is idempotent on already-cancelled reservations.  
* **Cold-start sync** — `/api/availability` triggers a background sync if a connected property has no inventory rows in the requested window. Uses `revalidateTag` to flush the per-property cache when sync completes.  
* **Cron** — Railway service `cron-inventory-sync` runs `0 */6 * * *` UTC against `/api/cron/inventory-sync` (Bearer-protected with `CRON_SECRET`).  
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
* **Postpartum reservation failure — handled by Phase 5 PMS retry cron.** When `postReservation` fails inline, `/api/bookings` still returns 502 (so the guest sees an error), but `cron-pms-retry` (every 5 min) picks the stuck booking up and retries for ~1h. After giveup: NR is auto-refunded, Flex has its saved PM detached, booking flips to `failed`. See section 19 Phase 5 for the full flow. **~~Open carry-forward: the original extras list is lost on inline failure~~ — RESOLVED 2026-05-20 (commit `b37b68e`).** `bookingExtras` rows are now inserted *before* `postCustomItem` with `cloudbedsItemId = null`, then patched with the real item ID on success. A failed call leaves the row in place for retry instead of evaporating.  
* **Per-extra failure handling is silent** (still true for the guest-facing path — a failed `postCustomItem` is logged, not surfaced), **but the data is now recoverable.** New admin endpoint `POST /api/admin/properties/[id]/cloudbeds/sync-pending-extras` (Bearer `ADMIN_TOKEN`, idempotent) sweeps every `bookingExtras` row with `cloudbedsItemId IS NULL` whose booking has a Cloudbeds reservation and replays `postCustomItem`. Built to backfill the queue once the `write:item` scope is granted.

### **Marketplace certification (2026-05-19 → 20) — ✅ CERTIFIED 2026-05-20**

**Outcome: PASSED on 2026-05-20** via the live Marketplace "Connect app" flow. The final blocker (after the cert-prep sprint fixed everything else) was that the Marketplace install is **Cloudbeds-initiated** — "Connect app" starts OAuth on Cloudbeds' side and returns to our callback with a `state` we never signed, which the old callback rejected with `invalid_state`. Closed by `63d5745` (callback accepts unsigned state → fresh install), `8c4079b` (Open Site → `/<slug>`), and repointing the Cloudbeds console **Login URL** off a stale `market-pulse.io` value to `/api/install`. Also confirmed: OAuth authorize must be `hotels.cloudbeds.com/api/v1.3/oauth` (not `us2`/`v1.1`). See the **2026-05-20 session log** at the top for the full retry-day write-up. The post-mortem of the *first* (failed) attempt follows.

We applied for Cloudbeds Marketplace certification. The reviewer (Manuel, Cloudbeds) provided a sandbox property — `[Demo] Manuel US2`, Cloudbeds `propertyID 5886676873777241`, on the `us2` cluster. **First attempt failed 2026-05-19.** This is the full post-mortem: what broke, in order; what was root-caused vs environmental; what we fixed; and where we stand.

#### What broke during the live call (in order)

1. **No Marketplace install flow.** The OAuth callback only did `UPDATE properties WHERE id = state.propertyId` — it never *created* a property. There was no entry point for a brand-new hotel. The admin "new hotel" button was a stub ("functionality coming later"). To get through the call we had to **manually `INSERT` a property row into the prod (Neon) DB** and then call `/api/cloudbeds/oauth/start` with `ADMIN_TOKEN` to mint a signed authorize URL.
2. **`?property=<slug>` override didn't take effect.** The dev override (read in `get-property.ts` from the `x-property-slug` header, which `src/proxy.ts` sets) didn't change which property the bare URL resolved. **NOTE — initial mis-diagnosis:** during the session this was wrongly attributed to `src/proxy.ts` being mis-named (we briefly renamed it to `middleware.ts`). That was **wrong and has been reverted** — Next.js 16 renamed Middleware to **Proxy**, so `src/proxy.ts` exporting `proxy` is the *correct* convention (see §4 and `node_modules/next/dist/docs/.../version-16.md` line 627). The proxy was running fine. The real reason `?property=` didn't override is still **suspected response caching** of `/` (the cached HTML doesn't vary on the query string) — to be confirmed. Either way the domain-swap (next item) was the working path on the call.
3. **Single-domain routing hack.** Because the middleware was dead and `properties.domain` is unique, the only way to make the Railway URL resolve to the cert hotel was to **swap the `domain` column** off the existing `demo` property onto `demo-manuel-us2` (and flip its status to `live`). This is why the bare URL had been showing the old Portico/demo data.
4. **Stripe env vars missing on Railway.** `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` lived only in local `.env.local`. `getStripe()` threw `"STRIPE_SECRET_KEY not configured"` — and it was called *outside* the route's try/catch, so the route crashed with a bare **500 and empty body** (very hard to diagnose live). Stripe Elements also wouldn't mount client-side (the "red, Stripe doesn't appear" symptom) without the publishable key.
5. **Pasted env vars carried newlines.** After adding the keys in the Railway dashboard, the value picked up a line break → Node rejected the outbound `Authorization` header with `TypeError: Invalid character in header content ["Authorization"]` (`ERR_INVALID_CHAR`). Surfaced to the user as `StripeConnectionError` ("could not connect to Stripe, retried 2 times") which *looked* like a network fault but wasn't. Fix: re-paste each key as one unbroken line.
6. **Inventory sync not part of OAuth completion.** The callback fired webhook subscription but not `syncInventoryForProperty`, so a freshly connected property had tokens but **no rooms** until something else triggered a sync.
7. **Country field was free text.** `Checkout.tsx` had a plain `<Input autoComplete="country-name">`. The guest typed "United States"; Cloudbeds `postReservation` requires **ISO 3166-1 alpha-2** and rejected with `"Parameter guestCountry is not valid"` — the final-step failure on the call.

#### Root-cause investigations (direct Cloudbeds API probing)

After the call we probed Cloudbeds' API directly using the cert hotel's stored token (decrypt `cloudbeds_access_token` with `CLOUDBEDS_TOKEN_KEY`, format is `iv.tag.ciphertext` base64, AES-256-GCM) to separate *our* bugs from *their* environment:

* **"We could not accommodate your request" on every `postReservation`, even though `getRatePlans` showed `roomsAvailable: 3`, `closedToArrival: false`, `cutOff: 0` for the same dates.** Reproduced with raw `curl` across many date ranges (today, +1 day, +1/2/7 months) — all rejected identically. Cause: **the cert hotel's rooms were flagged `isVirtual: true`** (confirmed via `getRooms`). Cloudbeds refuses bookings against virtual rooms by design — they're placeholders for setup/demo. The Rockenue demo property `302817` has `isVirtual: false` and its bookings succeed (3 of 6 synced in our DB; cert hotel was 0 of 5). **This was Cloudbeds' environment, not our code** — defensible evidence to push back on the reviewer. Once real (non-virtual) rooms were provided, bookings went through.
* **Same-day-after-checkin-time also blocks.** The first failed booking was for *today*; the hotel is in Jakarta (UTC+7) with a 14:00 check-in, and we hit `postReservation` ~22:00 local. Cloudbeds rejects same-day reservations once the local check-in time has passed — a **property-level rule not surfaced by `getRatePlans`**. (Distinct from the virtual-room cause; both produce the same generic message.)
* **Breakfast extra never reached the folio.** Booking synced fine (`50GPUPM1GK`) and `extras_total` was correct in our DB, but `booking_extras` had no row. Replaying `postCustomItem` by hand returned **`"Scope required for this call was not granted by property."`** → we hold `read:addon` but not **`write:item`**. See §7 → OAuth scopes.

#### What we fixed

**Commit `b4056ec` — cert blockers (booking-engine repo):**
1. ~~`src/proxy.ts` → `src/middleware.ts` rename~~ **— MISTAKE, reverted (commit `<revert>`).** This was based on the wrong belief that `proxy.ts` was dead code. Next.js 16 uses `proxy.ts` (Middleware was renamed to Proxy); the original file was correct. `src/middleware.ts` deleted, `src/proxy.ts` restored. The `?property=` override still needs a real fix (suspected `/` response caching — TBD).
2. `getStripe()` moved inside the try/catch in `payment-intent` + `setup-intent` routes → missing env var now returns a clear 502, not a bare 500.
3. Country free-text → ISO 3166-1 alpha-2 `<Select>` (`src/lib/countries.ts`, new `Select` primitive in the Portico theme).
4. `syncInventoryForProperty` fired (fire-and-forget) in the OAuth callback alongside webhook subscription → new connections get rooms/rates immediately.
5. OAuth callback `UPDATE` → **upsert** (`insert … onConflictDoUpdate`). Existing "Connect Cloudbeds" button still updates in place; first-time installs create the row. Hotel name pulled from `getHotels`; slug = slugified name + UUID prefix.
6. **`GET /api/install`** — the Marketplace install entry point. Allocates a UUID, signs OAuth state, redirects to Cloudbeds authorize. No DB write until token exchange succeeds, so abandoned installs leave no trace. This is the URL to set as the Marketplace "Install / Launch URL" (or paste directly in a browser to test).

**Commit `b37b68e` — extras durability:**
* `bookingExtras` rows inserted *before* `postCustomItem` (with `cloudbedsItemId = null`), patched on success — failures no longer lose the line item.
* New `POST /api/admin/properties/[id]/cloudbeds/sync-pending-extras` retry sweep (see §7 → carry-forward).

**Marketing-site repo (`rockenue-web`), earlier the same week:** added the mandatory support article at `rockenue.com/support/booking-engine` and a Guest Booking Data section to `rockenue.com/privacy` (Cloudbeds cert requires both).

#### Temporary prod hacks made during the call — **TO CLEAN UP**

These were done by hand against the prod Neon DB to get through the live call and are still in place:
* `INSERT`ed the `demo-manuel-us2` property row (id `9d4f0e45-4825-4f12-afaf-c2eb37730473`).
* Swapped `properties.domain` from `demo` → `demo-manuel-us2` (so the Railway URL resolves to the cert hotel). **`demo` no longer owns its domain.**
* Copied the demo's **test** Stripe Connect account (`acct_1TSCLV1ZjN2BG9vB`, `stripe_account_status='active'`) onto `demo-manuel-us2` so checkout could complete — the cert hotel has no Stripe of its own. Stripe is in **test mode** (`sk_test_`), so no real money moved; test card `4242 4242 4242 4242`.
* **`cert_attach_test_stripe` DB trigger (added 2026-05-20).** BEFORE-INSERT on `properties` — auto-copies demo's test Connect account onto ANY new property that has no Stripe, so a freshly-installed cert hotel can take a test booking with zero manual step + no deploy. It's a TEST account and only fires when Stripe is empty (won't clobber a real one), but **must be dropped after cert** (revert SQL below) before real multi-tenant onboarding.
* `demo-manuel-us2` name/cbId were briefly overwritten during us2-OAuth probing on 2026-05-20 (the consents landed as the Karol/us1 account, not the reviewer's) and **restored** to `[Demo] Manuel US2` / `5886676873777241`. Manuel's re-auth at the retry overwrites them correctly anyway.

Revert SQL when done testing:
```sql
UPDATE properties SET domain = 'booking-engine-production-b11b.up.railway.app' WHERE slug = 'demo';
UPDATE properties SET domain = NULL, stripe_account_id = NULL, stripe_account_status = 'pending', stripe_account_currency = NULL WHERE slug = 'demo-manuel-us2';
-- or DELETE the demo-manuel-us2 row entirely once cert is done with it
DROP TRIGGER IF EXISTS cert_attach_test_stripe_trg ON properties;  -- cert Stripe shim
DROP FUNCTION IF EXISTS cert_attach_test_stripe();
```

#### Where we are now (2026-05-20) — ✅ CERTIFIED

* **CERTIFIED 2026-05-20.** Onboarding is hands-off: "Connect app" (or `/api/install`) → OAuth **auto-creates** the hotel shell + syncs inventory/rates/extras/details + subscribes webhooks → the `cert_attach_test_stripe` trigger attaches test Stripe → book with `4242`. Verified end-to-end live (incl. NR + Flex bookings with per-morning breakfast folio + cancel).
* **us2 needs no special handling** — OAuth authorize is the standard `hotels.cloudbeds.com/api/v1.3/oauth`; the cluster resolves internally. Earlier "no access" was a revoked/non-included property grant, never a host issue.

#### Post-cert cleanup (do before real multi-tenant onboarding)

* **DROP the cert Stripe trigger** — `DROP TRIGGER IF EXISTS cert_attach_test_stripe_trg ON properties; DROP FUNCTION IF EXISTS cert_attach_test_stripe();`. It now attaches a literal **test** account (`acct_1TSCLV1ZjN2BG9vB`) to every fresh install — must go before live hotels onboard.
* **Delete the throwaway test properties** created during cert rehearsals (e.g. `rockenue-partner-account-*`). Snapshot of the pre-wipe state is in `backups/prod-snapshot-*.json`.
* **`/api/install` Login URL creates a duplicate row on app re-open** — add an "already connected for this Cloudbeds property?" guard before wider rollout.
* **Cloudbeds-side (was the first-attempt killer):** a hotel must have **non-virtual, bookable rooms** — Cloudbeds refuses to book `isVirtual:true` rooms (proven not our bug).

#### Still open (not cert blockers)

* **Real per-hotel Stripe Connect onboarding** — the test-account trigger is an interim shim; the real "Start onboarding" flow errored on the call and needs its own pass before real hotels go live.
* **Client-side same-day guard:** block check-in = today once `propertyCheckInTime` (from `getHotelDetails`) has passed in property-local time.
* **Per-property theming** — drop the single-tenant `THEME` env var (§5) so each hotel renders its own brand, not Portico.
* **Admin "+ New hotel" / create-property UI** — still a stub; `/api/install` (Cloudbeds-initiated) is the working path.
* **Email composer caveat:** the injected `{{links.cancelBlock}}` / `{{booking.breakdownBlock}}` tokens live in the seeded `htmlCached`, not the Unlayer design JSON — a composer re-edit + save would drop them. Fine for seed/cert; wire into the design before multi-tenant launch.
* **`modify` link in confirmation email** — parked (cancel is done; modify TBD).

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
* `src/components/admin/Sidebar.tsx` — 240px persistent sidebar. Hotel switcher card (HOTEL label + hotel name + slug · currency meta + ⇅ icon — clearly reads as a switcher; clicking returns to the cross-hotel dashboard) → Property nav (Overview, Bookings, Content, Media, **Rooms**, Rate plans, Extras, Emails, Alerts) → Integrations nav (Cloudbeds, Stripe, Domain) → user/logout chip.  
* `src/components/admin/TopStrip.tsx` — page header \+ button primitive (`<Btn>`) with variants `primary | secondary | danger | ghost`, sizes `sm | md`, `newTab` prop. Also exports `<Crumb to={parentHref}>Section</Crumb>` — muted grey clickable parent + slash, used in titles of every sub-page (e.g. `Emails / Booking confirmation`). Sidebar active state stays on the parent section even when deep in a sub-page so admin always knows where they are.  
* **Content width:** `max-w-[1560px]` on both `/admin` dashboard and per-property `<main>` (raised from 1180px on 2026-05-12). Pages center on wide screens; on 13–15" laptops the cap is never hit.  
* v3 design tokens scoped under `.admin-root` in `src/app/globals.css` — `--a-bg`, `--a-side`, `--a-ink`, `--a-accent` (`#5B5BD6`), tinted soft variants for green/amber/red/blue, `.font-jbm` utility for JetBrains Mono.

### **Pages**

| Page | Endpoint(s) | Status |
| ----- | ----- | ----- |
| `/admin` (Dashboard) | `GET /api/admin/properties` (list with bookings·7d \+ revenue·7d) | ✅ |
| `/admin/[id]` (Overview) | `GET /api/admin/properties/[id]/overview` | ✅ |
| `/admin/[id]/bookings` | `GET /api/admin/properties/[id]/bookings` (200-row cap, hydrates extras) | ✅ |
| `/admin/[id]/content` | `GET POST /api/admin/properties/[id]/content` | ✅ |
| `/admin/[id]/media` | `GET POST /api/admin/properties/[id]/photos` \+ `PATCH DELETE /[photoId]` | ✅ (renamed from `/photos` 2026-05-12; API path keeps `photos` for now) |
| `/admin/[id]/rooms` | `GET /api/admin/properties/[id]/rooms` \+ `PATCH` (`hiddenFromBooking`) | ✅ (2026-05-21 — Shown/Hidden toggle per room type; hides virtual/staff rooms from the booking engine) |
| `/admin/[id]/extras` | `GET PATCH /api/admin/properties/[id]/extras` (per-extra `pricing_model`) | ✅ |
| `/admin/[id]/emails`, `/template/[key]`, `/schedule`, `/log` | `/api/admin/properties/[id]/email-templates`, `/email-schedules`, `/email-sends` | ✅ (Phase 7.1 — Unlayer composer; see §13) |
| `/admin/[id]/rates` | `GET /api/admin/properties/[id]/rate-plans` \+ `PATCH /[ratePlanId]` | ✅ (2026-05-21 — **logical** rate plans, deduped across room types; per-plan Shown/Hidden via `isPublic`; booking-engine `displayName` override) |
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

## **13\. Email (SendGrid + Unlayer composer)**

Phase 7 wave 1 shipped 2026-05-12: per-property editable templates, scheduled automated flows, send log, R2 media library integrated into the composer. Editor swapped from Maily.to to **Unlayer (`react-email-editor`)** the same day after Maily proved to have no font-family control (renderer hardcoded `'Inter', sans-serif`).

### **How rendering works (split client / server)**

* **Client-side** (composer page): Unlayer's editor runs in an iframe and exports both a **design JSON** (Unlayer's `JSONTemplate`) and a **rendered HTML** string via `editor.exportHtml()`. Brand fonts live as inline `font-family` on every element in the exported HTML.
* **Server-side** (sending): we never run Unlayer on the server. The composer ships the rendered HTML to the DB on save; the send-time renderer just substitutes `{{var}}` tokens into the cached HTML. Pure string replace, fast, deterministic.

This split means the only thing that touches the cached HTML at send time is `substitute()` in `src/lib/email/variables.ts`. Adding/removing variables only needs a code change there; no template re-renders.

### **What's wired today**

* **Storage:** `email_templates`, `email_schedules`, `email_sends` tables. New column `email_templates.body_format` (`text NOT NULL default 'unlayer'`) flags which composer produced the row — only `'unlayer'` is written now; the column exists so a future migration can detect legacy rows. `properties.emailFromAddress` / `emailFromName` / `emailReplyTo` columns (NULL → falls back to platform default `noreply@em4689.market-pulse.io`).
* **Schema split:** `email_templates.body` (jsonb) = Unlayer design JSON for re-edit. `email_templates.html_cached` (text) = pre-rendered HTML with `{{var}}` tokens still in place. Render at send time = `substitute(htmlCached, vars)`.
* **Templates:** 5 default keys seeded idempotently per property on first visit — `confirmation`, `cancellation`, `pre_arrival` (T-3 09:00), `welcome` (T+0 08:00), `post_stay` (T+1 10:00 draft). Defaults at `src/lib/email/template-defaults.ts` ship **both** an Unlayer design (heading / text / divider / button content blocks with `fontFamily` set) AND a hand-rolled email HTML wrapper (brand fonts baked inline on every element). Seed in `src/lib/email/seed-templates.ts` writes both into `body` and `html_cached`.
* **Renderer:** `src/lib/email/unlayer-renderer.ts` — `renderUnlayerTemplate({ html, vars })` substitutes `{{var}}` tokens; `renderUnlayerPlainText` does the same + tag strip for the text/plain alternative.
* **Send orchestrator:** `src/lib/email/send-template.ts` — loads template, reads `htmlCached`, substitutes vars, dispatches via SendGrid with `customArgs.send_id` for webhook correlation, writes `email_sends` row.
* **Transactional path:** `src/lib/email/booking-confirmation.ts` and `booking-cancellation.ts` are thin wrappers that delegate to `sendTemplate`. Auto-charge cancel + PMS retry confirmation both call them with `propertyId` + `bookingId`.
* **Scheduler:** `src/lib/email/scheduler.ts` walks every enabled schedule, matches bookings whose trigger window falls in the current hour in property TZ, dispatches via `sendTemplate`. Idempotent on `(bookingId, templateKey)`. Audience filters: `all` | `flex` | `nr` | `min_nights_2`.
* **Cron:** `/api/cron/emails` POST, Bearer-protected with `CRON_SECRET`. **Not yet scheduled on Railway** — add hourly service before turning on real automated flows.
* **SendGrid Event Webhook:** `/api/sendgrid/webhooks/[token]` updates `email_sends.status / deliveredAt / openedAt / bouncedAt`. Token from `SENDGRID_WEBHOOK_TOKEN` env. **Not yet registered in SendGrid dashboard**.
* **Per-property sender:** `properties.emailFromAddress` plumbed through `sendEmail`; falls back to platform default when NULL.
* **Theme fonts (verified in output):** seed honours `process.env.THEME === 'portico-ivory'` and bakes Cormorant Garamond + Inter into seeded HTML. Smoke probe (`src/scripts/render-templates-smoke.ts`) confirms 2 × `Cormorant Garamond` + 4 × `Inter` references survive in every rendered template. Maily would strip them; Unlayer doesn't.

### **Composer (`/admin/[id]/emails/template/[key]`)**

Split pane: Unlayer editor on the left, live preview iframe on the right. Editor canvas defaults to ~720px tall and stretches with the page (admin shell widened to 1560px max — see §10).

* **Image upload pipeline:** Unlayer's `image` callback intercepts disk uploads. Each file POSTs to `/api/admin/properties/[id]/photos` with `slot=marketing` → R2 (3 variants per upload) → row in the `images` table. The gallery variant URL flows back to Unlayer and lands in the email block. So **every email upload also shows up in Admin → Media** for later reuse, and never auto-displays on the public site (marketing slot is admin-only).
* **Library picker (auto-open):** `selectImage` is registered, but Unlayer 1.x doesn't reliably surface its "Select" button in the current hosted build. Working path is the `content:added` event listener: dropping a fresh Image block → our R2 library modal opens automatically → admin clicks a photo → we walk the design tree (`patchImageSrc`), set the new block's `src.url`, and call `editor.loadDesign(patched)` so the change is visible immediately.
* **Library picker (manual):** toolbar "▣ Media library" button opens the same modal for browsing. When opened manually (not from Unlayer) it copies the URL to clipboard as a fallback so admin can paste it into an already-configured Image block.
* **Variables via `{{...}}`:** built from `VAR_GROUPS` in `src/lib/email/variables.ts`, exposed to Unlayer as merge tags with autocomplete on `{`. Subject line uses the same `substitute()` helper.
* **Fonts:** hardcoded set of email-safe system fonts (Arial · Helvetica · Tahoma · Trebuchet MS · Verdana · Georgia · Times New Roman · Courier New) registered as Unlayer `customFonts`, plus whitelisted Google Fonts (Cormorant Garamond, Inter, etc.) when they're in the property's brand stack. We carry our own list because Unlayer's hosted default-font fetch wasn't surfacing in the iframe in our deployment. System fonts use a no-op `data:text/css;base64,` URL (Unlayer's `CustomFont` type requires `url`).
* **Save:** `exportHtml()` → POST `{ design, html }` to PUT `/email-templates/[key]` → writes both columns. Live preview uses the same export, POSTs `{ html }` to the route's POST handler which substitutes sample vars.
* **Send test:** same `exportHtml` → POST to `send-test/`, dispatched via SendGrid with `[TEST · <key>]` prefix.

### **Other admin pages**

* `/admin/[id]/emails` — template list, per-row stats from `email_sends`, on/off toggle per schedule.
* `/admin/[id]/emails/schedule` — inline rule rows. Trigger / offset / time / audience / on-off per scheduled template. Title uses the breadcrumb pattern (see §10): `Emails / Schedule`.
* `/admin/[id]/emails/log` — last 200 sends with status pills and basic stats. Title: `Emails / Send log`.

### **Engineering gotchas**

* **`next.config.ts` has `reactStrictMode: false`.** Required because `react-email-editor` 1.x appends a new Unlayer iframe on every mount and doesn't tear the first one down. React Strict Mode's double-mount produces two stacked editors. Dev-only behaviour; production never double-renders.
* **`bodyFormat` column on `email_templates`.** Default `'unlayer'`. Kept as a flag so future migrations can identify legacy rows if we ever need to re-render.
* **One-off reset:** `src/scripts/reset-email-templates.ts` — drops rows where `body_format != 'unlayer'` OR `html_cached IS NULL`, then re-seeds. Run for the demo property on 2026-05-12 during the Maily → Unlayer migration. Re-run only when seeded defaults change.
* **Visual diagnostic:** `src/scripts/inspect-email-templates.ts <slug>` prints per-template `body_format` + cached HTML size.

### **Carry-forward (email)**

* **Per-hotel sender authentication.** `emailFromAddress` column exists but is NULL for every property. Before a real hotel ships, configure their authenticated domain on SendGrid (or move to dedicated subuser) and populate the column. Default sender keeps working for Portico's marketing-pulse domain.
* **Per-hotel reply-to.** Same shape — `emailReplyTo` column exists.
* **Register SendGrid Event Webhook.** Currently the receiver exists but SendGrid isn't told where to post. Production env needs `SENDGRID_WEBHOOK_TOKEN` set and the endpoint configured in SendGrid dashboard.
* **Add hourly cron service for `/api/cron/emails`** on Railway. Mirror the existing cron services' recipe (alpine + curl + Bearer); until then scheduled emails won't fire in prod.
* **Marketing asset slot.** Admin → Media has a `marketing` slot for logos / brand assets that the public site never auto-displays. Composer uploads default to this slot. Portico's logos are pre-uploaded for the demo property (`portico-logo.png`, `portico-logo-white.png`).
* **Plain-text alternative quality.** `renderUnlayerPlainText` is a regex tag-strip — works but can produce odd whitespace from heavily formatted HTML. If a hotel reports text/plain rendering oddly, swap to `editor.exportPlainText()` on save and cache alongside `html_cached`.

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
│       ├── google/feeds/                  # hotel-list/, landing-pages/ (admin-gated; see Google blueprint)
│       └── admin/properties/[id]/         # Admin REST endpoints
│           ├── route.ts, overview/, bookings/, content/, photos/, rooms/, extras/, rate-plans/, cloudbeds/, stripe/
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
│   ├── booking/                           # Headless booking hooks + availability.ts (shared computeAvailability)
│   ├── cloudbeds/                         # client, scopes, sync-inventory, sync-extras, sync-hotel-details, reservations, webhook-*
│   ├── google-hotels/                     # Google Hotel Center: hotel-list-feed, landing-pages, hotel-json-ld, types (see Google blueprint)
│   ├── stripe/                            # client (platform), browser, status, amounts, detach
│   ├── email/                             # sendgrid, booking-confirmation, booking-cancellation, unlayer-renderer, template-defaults, send-template, scheduler, seed-templates, variables, fonts
│   └── r2/                                # client, resize
├── components/rockenue/                   # Landing.tsx — Rockenue Tech platform landing page (bare app.rockenue.tech)
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
* `cron-inventory-sync` — runs `0 */6 * * *` UTC against `/api/cron/inventory-sync`. (Originally named `inspiring-trust` — renamed for consistency 2026-05-12.)
* `cron-auto-charge` — runs `0 * * * *` UTC (hourly) against `/api/cron/auto-charge`. Phase 5 off-session PaymentIntent for Flex bookings hitting `chargeAt`.
* `cron-pms-retry` — runs `*/5 * * * *` UTC (every 5 min) against `/api/cron/pms-retry`. Recovers stuck bookings where Stripe charged / saved card but `postReservation` failed inline.

All three cron services share the same recipe: image `alpine:latest`, start command `apk add --no-cache curl && curl -fS -X POST -H "Authorization: Bearer $CRON_SECRET" <url>`. Bearer-protected with `CRON_SECRET`. Logs visible in Railway → service → Cron Runs / Deployments. Heartbeat lines have shape `{"event":"cron_heartbeat","cron":"<name>","at":"…","ok":true,"summary":{…}}` so a future alerts engine can grep them uniformly.

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
| 5\. Flex auto-charge \+ PMS recovery | Hourly cron, off-session PI, re-auth page, 24h grace, PMS retry, monitoring | ✅ Done — shipped 2026-05-12 |
| 6\. Cancellation \+ launch hardening | Step 16 Flex self-cancel | 🟡 Flex within-window shipped; NR \+ past-deadline punt to "contact hotel" |
| 6.5 Admin v3 \+ R2 \+ Content CMS | shipped 2026-05-07 | ✅ Done |
| 6.6 Cloudbeds metadata auto-sync | shipped 2026-05-08 | ✅ Done |
| 7.1 Guest comms — composer + scheduler + log + R2 image flow | shipped 2026-05-12 (Unlayer swap same day) | ✅ Done — backend + Unlayer composer + Media library integration |
| 7\. Post-launch features | Welcome Pickups · GEO/AI · WhatsApp · etc. | 🟡 Welcome Pickups in motion; GEO/AI flagged as must |

### **Phase 5 — Flex auto-charge \+ PMS recovery (shipped 2026-05-12)**

Shipped end-to-end. Two new Railway cron services \+ a guest re-auth flow \+ a postReservation retry path. Four new columns on `bookings`: `autoChargeAttempts`, `firstAutoChargeFailureAt`, `pmsRetryAttempts`, `firstPmsFailureAt`.

**Auto-charge cron** (`/api/cron/auto-charge`, hourly):

* `chargeAt` set on Flex bookings at creation \= `checkIn (00:00 UTC) − cancellationPolicy.deadlineHours` (24h fallback when no deadline configured). NR stays null.  
* Eligibility: `rateType='flex'` AND `status='pms_synced'` AND `chargeAt <= NOW()`.  
* Off-session PaymentIntent on the connected account: `customer` \+ `payment_method` (saved at checkout) \+ `application_fee_amount` \+ `transfer_data.destination` \+ `on_behalf_of`. Idempotency key `ac_<orderId>_<attempt>` — new key per attempt so retries get fresh PIs; same key within an attempt collapses overlapping cron runs.  
* On success: `postPayment` to Cloudbeds folio (best-effort), update booking to `status='paid'`, log `auto_charge_succeeded`.  
* On failure: anchor `firstAutoChargeFailureAt` (sticky), log `auto_charge_failed` with `errorCode` \+ `errorMessage`. If `errorCode === 'authentication_required'` AND this is the first failure, send re-auth email (once).

**Re-auth flow** (`/payment-update/[token]`):

* Token \= HMAC over `pu.<bookingId>.<timestamp>` using `CLOUDBEDS_TOKEN_KEY`. `pu.` prefix prevents leaked cancel-tokens being reused here and vice versa.  
* Page mints a fresh SetupIntent attached to the same `stripeCustomerId`. Three states: eligible / already paid / cancelled.  
* On confirm: `POST /api/bookings/payment-update` verifies the SI succeeded \+ customer matches, swaps `stripePaymentMethodId`, detaches the old PM, resets `autoChargeAttempts=0` \+ `firstAutoChargeFailureAt=null` \+ `chargeAt=NOW()+5min` so the next cron run retries.

**24h grace \+ auto-cancel**:

* When `firstAutoChargeFailureAt < NOW() - 24h` on the next cron pass: cancel the Cloudbeds reservation, detach the saved PM, set `status='cancelled'`, send cancellation email (`refunded: false` — no charge ever succeeded).

**PMS retry cron** (`/api/cron/pms-retry`, every 5 min):

* Eligibility: `status IN ('paid','payment_authorized')` AND `cloudbedsReservationId IS NULL` AND `createdAt < NOW() - 1 min` (skip rows still mid-flight).  
* Retries `postReservation`. On success: write `cloudbedsReservationId`, flip to `pms_synced`, send confirmation email that the inline path never got to send. NR also re-runs `postPayment` to the folio.  
* After `MAX_ATTEMPTS = 12` (~1h at 5-min cadence): NR booking gets a full Stripe refund (`refund_application_fee: true, reverse_transfer: true`), Flex booking gets the saved PM detached, status flips to `failed`.  
* **Limitation:** original `body.extras` list is lost when `postReservation` fails inline (bookingExtras rows are only inserted after `postCustomItem` succeeds). Retry recovers the reservation but not the line items. Hotel adds extras manually if needed. Future fix: pre-insert bookingExtras with `cloudbedsItemId=NULL` before `postReservation` so the retry can complete them.

**Monitoring**:

* Both crons emit `{"event":"cron_heartbeat","cron":"<name>","at":"…","ok":true,"summary":{…}}` on each run. Per-run summary counts: charged / failed / skipped / graceExpired (auto-charge) or synced / retryFailed / gaveUp (pms-retry).  
* The alerts UI itself is Phase 6 work (admin Alerts tab) — the data is in `payment_events` rows \+ the structured logs.

**Smoke probes:** `src/scripts/test-auto-charge.ts` and `src/scripts/test-pms-retry.ts`. Both dry-run by default (just list eligible bookings); `--run` POSTs to the local dev cron route.

### **Phase 5 — verification still pending in the wild (shipped 2026-05-12)**

Code and infrastructure are deployed; these paths haven't been exercised by a real booking yet:

* **First scheduled `cron-pms-retry` run** — confirm exit code 0 in Railway → service → Cron Runs tab (within ≤5 min of deploy).  
* **First scheduled `cron-auto-charge` run** — same, at the next top-of-hour UTC.  
* **A real off-session PaymentIntent firing** — needs a real Flex booking maturing into its `chargeAt`. Will exercise itself when live bookings flow.  
* **Re-auth email actually sending** — needs Stripe to return `authentication_required` on an off-session attempt. Card-issuer dependent.  
* **A guest hitting `/payment-update/[token]`** — same trigger as above.  
* **24h grace auto-cancel branch** — needs 24h of failed retries; exercise via a test booking with a deliberately-broken card if you want to force it.  
* **PMS retry recovering a real stuck booking** — needs `postReservation` to actually fail. Test by temporarily breaking the CB OAuth token on a staging property if you want to force it.

None of these are blockers — Phase 5 is in production and the smoke probes \+ endpoint pings confirm the wiring. Just unverified end-to-end until live traffic.

### **Phase 6 — Launch hardening (remaining)**

* **Platform domain `app.rockenue.tech`** (Hostinger DNS → Railway, live 2026-05-21). Canonical host for admin + Cloudbeds OAuth/webhooks + Stripe webhook + Google feeds. Cutover pending: swap `CLOUDBEDS_REDIRECT_URI` / `CLOUDBEDS_WEBHOOK_URL` / `PUBLIC_APP_URL`, add the new redirect URI + Login URL in the Cloudbeds console (keep the old Railway ones in parallel), re-point the Stripe webhook, then retire the `…up.railway.app` URL.
* **Rockenue Tech landing page at the platform host** — bare `app.rockenue.tech` currently falls through to the first Cloudbeds-connected hotel (via `resolveProperty()`). It should instead render a Rockenue Tech corporate/landing page with an **Admin** button (top-right) → `/admin`. Needs: detect the platform host (vs a hotel custom domain or `/<slug>`) and render the landing page instead of resolving a property. Page not yet designed/built.
* **Custom domains per hotel** — registrar DNS (Hostinger/Cloudflare) → Railway; set `properties.domain` per hotel so guests see their own brand, not the platform host.  
* **Real copy \+ room descriptions in DB** — move out of `AvailabilityResults.tsx` `ROOM_DESCRIPTIONS`.  
* **JSON-LD Hotel schema** on each homepage (also feeds GEO work in Phase 7).  
* **`next/font` swap** for the Google Fonts `<link>` in `layout.tsx`.  
* **Domain & deploy tab** — DNS / SSL / Railway probe display.  
* **Alerts tab \+ engine** — compute operational signals from the `payment_events` table \+ structured cron heartbeat logs (shape `{event:"cron_heartbeat",...}`). Alert patterns to support: no-heartbeat-in-90-min, ≥5 auto_charge_failed in a single run, any auto-cancel after grace, single property with all failures.  
* **Resend confirmation \+ Cancel/refund actions** — replace placeholders on admin booking detail panel.  
* **Smoke test for Flex cancellation** — `src/scripts/cloudbeds-cancel.ts` driving `putReservationStatus` before pointing real guests at the link.  
* **Pre-insert bookingExtras before `postReservation`** — current PMS retry restores the reservation but not the folio extras (rows are only written after each `postCustomItem` succeeds, so on inline failure the original list is lost). Pre-inserting with `cloudbedsItemId=NULL` lets the retry complete them.  
* **Orphan admin pages to delete** — `src/app/admin/properties/[id]/page.tsx`, `src/app/admin/bookings/page.tsx`.  
* **Stripe OAuth callbacks** — still redirect to old `/admin/properties/[id]?...` URLs. Migrate to v3 paths (`/admin/[propertyId]/stripe?...`).

### **Phase 5 follow-ups — bounded improvements** *(not blockers, can ship anytime)*

* **Widen re-auth email trigger** — currently only sends on `authentication_required`. Other "guest must act" codes (`card_declined`, `expired_card`, `insufficient_funds`, `incorrect_cvc`) silently retry until grace expires, then auto-cancel without warning. Widen the trigger to send re-auth email after N attempts on any non-network error.  
* **NR self-cancel branch** — `/api/bookings/cancel` currently punts NR to "contact hotel". Could refund via Stripe + cancel CB if the booking is far enough out.  
* **Penalty-charge for past-deadline Flex** — currently punts to "contact hotel". Future iteration could auto-charge penalty via the saved PM.  
* **Transfer Reversal for partial refunds** — full-refund path handles `refund_application_fee: true, reverse_transfer: true`. Partial refunds (e.g. one cancelled night out of three) need proportional fee reversal logic.  
* **Per-property `statement_descriptor_short`** — admin field, 22-char max, default derived from `property.name` truncated. Wire into PaymentIntent creation.  
* **Stale-row cleanup on rate-plan deletion** — sync only upserts, doesn't delete rows missing from CB response. Use `syncExtrasForProperty` as pattern.  
* **Per-extra failure surfacing** — failed `postCustomItem` is currently logged only; add admin visibility on booking detail panel.

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

### **Guest comms platform — Phase 7.1 shipped 2026-05-12**

Goal: per-hotel designable email templates \+ smart scheduling \+ ops view. Replaces hardcoded confirmation/cancellation templates with admin-editable ones.

**Decisions locked when scaffolding started:**

1. ✅ All-in for v1 (composer + scheduler + automated flows together)  
2. ✅ Event-relative scheduler only (no one-off broadcasts)  
3. ✅ Karol-only editor (no per-hotel logins)

**Shipped end-to-end** — see §13 for the full breakdown. Stack landed as: **Unlayer composer** (`react-email-editor`) + SendGrid delivery + own Railway cron + 5 default templates + 4 admin pages + SendGrid Event Webhook + per-property sender column + R2 image upload pipeline integrated into the editor (drops land in Media library, slot=marketing). Auto-charge cancellation and PMS retry confirmation paths re-wired through the template engine.

**Editor migration note (2026-05-12):** the composer was originally built on Maily.to but Maily strips all `font-family` marks at render — verified by inspecting `node_modules/@maily-to/core/dist/index.cjs`. Same-day swap to Unlayer kept the entire backend (DB schema, send-template, scheduler, webhooks) intact; only the composer page + template-defaults format changed. Migration helper at `src/scripts/reset-email-templates.ts` blew away legacy rows and re-seeded.

**Remaining for Phase 7.x:**

* **Per-hotel sender authentication.** SendGrid authenticated domains per hotel (`mail.<hotel-domain>` DNS at onboarding) \+ Subusers tier at hotel \#10+. Schema already supports it.  
* **Hourly Railway cron service for `/api/cron/emails`.** Pattern is the existing cron services' recipe. Until added, scheduled flows don't fire in prod.  
* **SendGrid Event Webhook registration.** Endpoint exists at `/api/sendgrid/webhooks/[token]`; needs `SENDGRID_WEBHOOK_TOKEN` env + dashboard config.  
* **Phase 4 — Multi-channel** (when WhatsApp lands). Revisit Knock ($300/mo) for routing.

**Target budget: $60/mo at 40 hotels.** Knock ($300/mo) and Postmark ($245/mo) were evaluated and rejected — replaced by \~1 day of internal engineering each.

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

* **Google Hotel Center (Free Booking Links / Hotel Ads)** — full work stream documented in its own **`Google Hotel Center — Blueprint.md`** (Hotel List XML, ARI Push, Landing Pages XML, JSON-LD, Connectivity Partner application). Start at its Sprint 1 (Hotel List feed generator). Meta Travel Ads — paid acquisition handled separately: `/feeds/meta-catalog.csv`, Meta Pixel, server-side Conversions API on `booking.confirmed`.

---

## **22\. Open design questions**

* **~~Reservation creation failure~~** — Resolved by Phase 5 PMS retry cron (shipped 2026-05-12). Stuck bookings now self-heal within ~1h; giveup auto-refunds NR / detaches Flex PM. See section 19.  
* **Error state UX** — payment fails, room sold out between selection and payment, 3DS fails, Cloudbeds down. Phase 5 covers the auto-charge \+ PMS-failure paths. Remaining: room-sold-out mid-flow (race after selection), 3DS-fails at checkout, Cloudbeds-down at checkout.  
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
* **`reactStrictMode: false` in `next.config.ts`** — required because `react-email-editor` 1.x doesn't tear down its Unlayer iframe on unmount. With Strict Mode's dev double-mount the email composer renders two stacked editors. Dev-only behaviour; production never double-renders. Re-enable if/when react-email-editor 2.x supports clean tear-down.  
* **Email composer fonts are hardcoded.** Unlayer's hosted default-font list doesn't load reliably in our iframe; we ship our own list of 8 email-safe system fonts + whitelisted Google Fonts (`src/app/admin/[propertyId]/emails/template/[key]/page.tsx`). System fonts use a no-op `data:` URL since Unlayer's `CustomFont` type requires `url`.  
* **Polish bank account must be on Biała lista** before linking to Stripe. mBank/ING/Santander safe; Wise/Revolut may not be.  
* **CRBR filing** within 14 days of KRS registration. Confirm notary includes this, or arrange via accountant.

---

*This document is intended to be the single source of truth. When something changes, update here first; don't let docs scatter again.*

