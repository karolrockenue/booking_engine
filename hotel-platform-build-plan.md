# Hotel Website + Booking Engine Platform — Reference

> **Last updated:** 2026-04-29
> **Status:** Core platform built and deployed. Design overhaul complete. Cloudbeds Phase 1–2 fully shipped — schema migrated, OAuth working, inventory + rate plans + extras + webhooks live and syncing in production (Steps 6 + 7). Production hardening pass complete (`ADMIN_TOKEN` rotated, dev mockup routes gated in prod, webhook URL hardened with token-in-path, `middleware` → `proxy` rename, lint cleanup). Headless booking hooks extracted to `src/lib/booking` so per-hotel bespoke front-ends can share one backend; rooms / checkout / confirmation now use `sessionStorage` for draft state instead of URL-param packing. Stripe Connect not yet started. See `TODO.md` for the live build plan.

This doc is a **snapshot of the current platform** — what's built, how it's organised, the design conventions that hold across pages. For the forward plan (rebuild steps, sequencing, design questions), see `TODO.md`.

---

## Product Vision

A multi-tenant hotel website platform with an integrated booking engine, connected to Cloudbeds. Each hotel gets a fully bespoke website on their own domain (`www.thehotel.com`) with a seamlessly integrated booking flow — not a generic widget bolted on, but a native part of the site. Karol manages ~40 independent hotels (luxury → near-hostel spectrum). They are not a chain — to a guest each must read as its own brand. Per-hotel front-ends are bespoke (designed in Claude Design, mocked in HTML, signed off by the owner, then ported to React). The **booking flow** stays consistent across hotels (theme + copy only); the **marketing surface** (homepage, hero, gallery, story) is fully customised per hotel. Some designs may be shared across multiple properties — pattern is "templates + bespoke overrides", not "40 separate apps".

### Design Philosophy

**Conversion-first.** 99.9% of guests already know the hotel from OTAs. The website's job is to steal the booking, not showcase the hotel.

- Homepage = hero image + date picker. That's the first and only interaction above the fold.
- Below the fold: photos, location, about — for reassurance, but most won't scroll.
- Booking flow is separate pages: `/` → `/rooms` → `/checkout` → `/confirmation`
- No content-heavy sections, virtual tours, or 20-section homepages.
- Subtly emulate Booking.com UX patterns (date picker, guest selector, rate plan display) to build trust with guests arriving from OTAs.

---

## Architecture

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
│  │    /     │  │  /rooms   │  │  /admin           │  │
│  │  Hero +  │  │  /checkout│  │  (webmaster only) │  │
│  │  Dates   │  │  /confirm │  │                   │  │
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
   │   (Neon)   │ │ (Express,       │  │ (OAuth2 per       │
   │            │ │  direct charges)│  │  property)        │
   └────────────┘ └────────────────┘  └────────────────────┘
```

### Multi-Tenant Routing

`src/proxy.ts` (Next.js 16's renamed middleware) reads `Host` header → resolves property from DB → serves correct theme + content. For dev, `?property=slug` overrides domain lookup. Fallback: if no domain matches, serves the first property (covers Railway preview URL). The proxy also 404s the dev mockup routes (`/bars`, `/compare`, `/compare-live`, `/enhance`, `/fonts`, `/pickers`, `/rates`, `/rooms-mockup`) when `NODE_ENV === "production"`.

### Per-Hotel Front-End Architecture (planned)

The booking flow's data + state + side effects live in `src/lib/booking` as headless hooks (`useAvailability`, `useExtras`, `useBookingDraft`, `usePersistedDraft`, `submitBooking`). Per-hotel page components consume these hooks and own only JSX + CSS — every hotel ships its own bespoke `Home.tsx`, `Rooms.tsx`, `Checkout.tsx`, `Confirmation.tsx`, while the booking pipeline is identical underneath. Shared designs live as templates in `src/hotels/_templates/<name>/`; properties either re-render a template with their own config or implement bespoke per-page. Mix-and-match (shared Home, bespoke Rooms) is allowed. *Not yet scaffolded — `src/lib/booking` and the existing `/rooms`, `/checkout`, `/confirmation` clients are the canonical pattern; the `src/hotels/<slug>/` directory pattern lands when the first hotel mockup is ready to port.*

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | ✅ Built |
| **Language** | TypeScript | ✅ Built |
| **Database** | PostgreSQL 17 on Neon (AWS, eu-central-1) | ✅ Live |
| **ORM** | Drizzle ORM | ✅ Built |
| **Hosting** | Railway Pro | ✅ Deployed |
| **UI Library** | Radix UI (popovers), react-day-picker (calendar), Lucide (icons) | ✅ Built |
| **Font** | Inter (via Google Fonts) | ✅ Live |
| **PMS Integration** | Cloudbeds REST API (OAuth2) | 🟢 Inventory + rate plans + extras + webhooks live; write paths (postReservation/postCustomItem/postPayment) gated on Stripe |
| **Payments** | Stripe Connect (Express, direct charges) | 🔲 Not started |
| **Image Storage** | Cloudflare R2 (planned) | 🔲 Not started |
| **DNS/Domains** | Cloudflare (planned) | 🔲 Not started |

---

## What's Built

### Pages (booking flow + dev tools)

| Route | Purpose | Status |
|---|---|---|
| `/` | Hero image + booking bar + about/gallery/amenities/location/CTA | ✅ |
| `/rooms` | Room selection with rate plans, extras (Cloudbeds-driven), price comparison | ✅ |
| `/checkout` | Guest details + payment form + booking summary sidebar | ✅ (mock card form; reads draft from sessionStorage) |
| `/confirmation` | Booking confirmed with reference, stay details, nightly breakdown | ✅ (reads from sessionStorage; URL only carries `orderId`) |
| `/admin` | Admin dashboard (token-protected) | ✅ |
| `/admin/properties/[id]` | Property editor (general, rooms, theme) | ✅ |
| `/admin/bookings` | Bookings list across all properties | ✅ |
| `/pickers` | DEV: 4 booking bar style variants (legacy, see /bars) — 404s in prod | ✅ Dev |
| `/bars` | DEV: 6 booking bar concepts on full hero folds — 404s in prod | ✅ Dev |
| `/compare` | DEV: 15 price comparison banner concepts — 404s in prod | ✅ Dev |
| `/compare-live` | DEV: 5 shortlisted banners in full page context with switcher — 404s in prod | ✅ Dev |
| `/fonts` | DEV: 10 font options rendered on full room cards — 404s in prod | ✅ Dev |
| `/rates` | DEV: 6 rate plan display concepts — 404s in prod | ✅ Dev |
| `/enhance` | DEV: 8 extras/upsell panel concepts — 404s in prod | ✅ Dev |
| `/rooms-mockup` | DEV: 4 full-page room card layout concepts with switcher — 404s in prod | ✅ Dev |

### Booking Flow Features

**Homepage:**
- Full-screen hero with hotel image + gradient overlay
- Icon-led booking bar: tinted icon squares (Calendar, Users, Tag), small gray labels, normal-case values, no underlines
- Smart date placeholder showing tomorrow's dates
- "Check Availability" button with colour-matched glow shadow
- "Official Website — Lowest Price Guaranteed" trust badge on hero
- Below-fold sections: About, Gallery (bento grid with next/image), Amenities (white cards on #F2F2F2), Location (split panel: info + map), Why Book Direct (navy section with glass cards), Booking Policy + CTA
- Scroll fade-in animations via IntersectionObserver (FadeIn component)
- "Official Site" badge in NavBar next to hotel name

**Room Selection (`/rooms`):**
- 4-step progress bar: Select Room → Your Details → Payment → Confirmation (evenly spaced, centered)
- Navy page header with dates/guests/rooms summary + "Best rate guaranteed" inline badge
- Price comparison banner: emerald gradient with OTA prices in frosted pills (strikethrough) vs direct rate
- Dark Header room cards: navy band with room name + urgency tags, image left, description + rates right
- 4 rate plans per room: Flexible Room Only, Flexible + Breakfast, Non-Refundable Room Only, Non-Refundable + Breakfast
- Rate plans sorted by price, cheapest 2 shown by default, "Show more rates" expander
- Breakfast/cancellation badges, outline "Reserve" buttons
- Selection flow: select rate → other rooms dim, extras panel appears, sticky basket bar appears
- Extras panel: "Enhance your stay" with card grid — driven by per-property Cloudbeds `/addons/v1/addons` catalog via `/api/extras`. Hardcoded list is gone.
- Sticky basket bar: navy background, shopping bag icon, itemised extras as removable pills, running total, white "Continue" button
- Continue button writes the draft (room + extras + dates + adults + children) to `sessionStorage` (30-min TTL) and navigates to `/checkout` with no URL params

**Checkout (`/checkout`):**
- Guest Details card with navy header band (name, email, phone, country, special requests)
- Payment card with navy header band — currently a mock card form, being replaced with Stripe Elements
- Card brand badges (Visa, Mastercard, Amex)
- SSL security note
- Booking Summary sidebar with nightly breakdown
- Test data helpers (fill guest data, use test card 4242)
- "Pay & Confirm" button

**Confirmation (`/confirmation`):**
- Green "Booking Successful" header with checkmark
- Booking reference with copy-to-clipboard
- Email confirmation note
- Stay Details grid (hotel, room, dates, rate, guests, total)
- Nightly breakdown with total row
- Return to homepage button

### Design System

**Theme token system** — each property gets a full theme config stored as JSONB in the DB. Controls:
- Colors (10 tokens: primary, secondary, accent, background, surface, text, textMuted, border, error, success)
- Typography (heading/body font, weights, spacing, line height)
- Layout (max width, section/container padding, border/button/card radius)
- Style (nav style, button style, hero style, image treatment, animation level)
- Hero (headline, subheadline, image URL, overlay opacity)
- Contact (address, phone, email)
- Social (Instagram, Facebook, TripAdvisor)
- Nav (links array, booking CTA text)

All rendered via CSS custom properties. Components read from `useTheme()` context.

**Design language (established 2026-04-14):**
- Font: Inter (loaded via Google Fonts)
- Page backgrounds: `#F2F2F2` for booking flow, `#fff` for homepage sections
- Card pattern: white cards with `1px solid #E5E0D8` border, `rounded-md`
- Dark header bands: navy `var(--color-primary)` on room cards, checkout sections, confirmation sections
- Buttons: outline "Reserve" style (`border: 1px solid primary, borderRadius: 2px`) for rate selection
- Progress bar: 4 steps, evenly spaced, navy fill, 3px top accent line
- Sticky basket: navy background, white text, removable extra pills, white Continue button
- Booking bar: frosted glass with ambient shadow, Booking.com-inspired date/guest selectors

**Component library:**
- Website: HeroSection, FadeIn (scroll animation)
- Booking: BookingBar, BookingBarLuxury, BookingBarCompact, BookingBarWarm, BookingProgress, AvailabilityResults (with RatePlanList), ExtrasPanel, StickyBookingBar, PriceCompare, GuestDetailsForm, BookingSummary (`childCount` prop, not `children` — React reserves that name), BookingWidget, BookingFlow
- Layout: ThemeProvider, NavBar (default/booking variants, hideCta option), Footer
- Admin: ThemeEditor
- PageRenderer (JSON config → component composition)

**Headless booking library (`src/lib/booking/`):**
- `types.ts` — canonical `AvailabilityResult`, `Extra`, `BookingDraft`, `GuestDetails`, `NightlyRate`. Components import from here (the old per-component type definitions in `AvailabilityResults.tsx` and `ExtrasPanel.tsx` now re-export the canonical type).
- `useAvailability(args)` — cancelable fetch of `/api/availability`, returns `{ results, loading, error }`
- `useExtras(propertyId)` — fetch of `/api/extras` (60s `unstable_cache` server-side)
- `useBookingDraft(extras)` — selection state + memoized totals (`extrasTotal`, `grandTotal`)
- `usePersistedDraft(ctx, draft)` + `loadPersistedDraft()` + `clearPersistedDraft()` — sessionStorage mirror, 30-min TTL
- `savePersistedConfirmation()` + `loadPersistedConfirmation()` — same pattern for the post-booking payload, 2h TTL (so a refresh on `/confirmation` still renders the stay details)
- `submitBooking(args)` — typed POST to `/api/bookings`. Signature reserves slots for `paymentIntentId` / `setupIntentId` / `paymentMethodId` / `customerId` so when Stripe lands (Step 10/11), this is the only place that needs to learn the new shape.

### Database Schema (live on Neon)

- `properties` — multi-tenant config, theme JSONB, domain, encrypted Cloudbeds tokens, `cloudbedsPropertyId`, Stripe fields (still empty)
- `pages` — page layouts per property (JSON composition)
- `content_blocks` — key-value content per property
- `images` — image references per property
- `room_types` — mirrored from Cloudbeds (`otaRoomId` = Cloudbeds `roomTypeID`, numeric)
- `rate_plans` — mirrored from Cloudbeds (`otaRateId` = Cloudbeds `rateID`); `isRefundable` + `cancellationPolicy` are admin-managed (not in CB API), seeded from a name heuristic on first sync
- `inventory` — ARI cache (date × room × rate → units, rate, restrictions); upserted by `syncInventoryForProperty`
- `property_extras` — Cloudbeds addon catalog mirrored per property (`cloudbedsAddonId`, `cloudbedsProductId`, `name`, `description`, `priceMinorUnits`, `currency`, `lastSyncedAt`); populated by `syncExtrasForProperty` from `/addons/v1/addons`. Unique on (`propertyId`, `cloudbedsAddonId`); deletes rows whose addon no longer appears in CB.
- `bookings` + `booking_day_rates` + `booking_extras` — guest bookings with nightly breakdown and folio extras (`booking_extras` populated when booking flow lands in Step 11)
- `payment_events` — Stripe + auto-charge audit trail (empty until Phase 3)
- `cloudbeds_webhook_subscriptions` — one row per (property, object, action); persisted so we can `deleteWebhook` on disconnect. Subscription endpoint URLs include the `CLOUDBEDS_WEBHOOK_TOKEN` segment.

### Test Data

**The Kensington Arms** (slug: `demo`, GBP, `cloudbedsPropertyId=302817`) — connected to Cloudbeds
- 3 room types from CB: Single Room, Double Room, Triple Room
- 8 rate plans from CB: 3 master rates (Standard) + 2 derived (`Non refundable -10%`) + 3 master ("Direct Rate - 72h cancelation")
- 720 inventory rows (8 plans × 90 days) auto-synced
- 1 extra in `property_extras`: "Continental Breakfast" ($10.00, addon ID 234169) — note CB returns USD on the partner test account; the booking flow uses `properties.currency` (GBP) for charging, per spec
- 8 webhook subscriptions live (reservation/* × 6, availability/closeout_changed, api_queue_task/rate_status_changed) — pointing at the tokenized URL after the 2026-04-29 rotation
- Old hand-seeded room types / rate plans cleaned up (script: `cleanup-demo-seed.ts`)
- Hero image: boutique hotel room (from House on Warwick)
- Font: Inter
- Theme: Navy (#2C3E50) primary, warm border (#E5E0D8)

**UrbanStay Apartments** (slug: `urbanstay`, EUR)
- 2 rooms: Studio (€89), One-Bedroom (€129)
- Weekend rates +15%
- Slate + blue theme, system font, rounded corners

### Deployment

- **Railway URL:** `https://booking-engine-production-b11b.up.railway.app`
- **Admin panel:** `/admin` (token rotated to a 32-byte random value on 2026-04-29; `B2U_SHARED_SECRET` removed)
- **Dev convenience:** `?property=urbanstay` switches property on localhost or Railway URL
- **Environment variables on Railway:**
  - `DATABASE_URL`, `ADMIN_TOKEN` — core
  - `CLOUDBEDS_CLIENT_ID`, `CLOUDBEDS_CLIENT_SECRET`, `CLOUDBEDS_REDIRECT_URI`, `CLOUDBEDS_TOKEN_KEY` — OAuth + AES-GCM token encryption
  - `CRON_SECRET` — Bearer token for `/api/cron/inventory-sync`
  - `CLOUDBEDS_WEBHOOK_TOKEN` — random 24-byte hex value used as the dynamic segment in `/api/cloudbeds/webhooks/[token]`. Wrong token → 404. Compared with `timingSafeEqual`.
  - `CLOUDBEDS_WEBHOOK_URL` — optional explicit override for the URL passed to `postWebhook`; if unset, the subscription helper builds `${origin of CLOUDBEDS_REDIRECT_URI}/api/cloudbeds/webhooks/${CLOUDBEDS_WEBHOOK_TOKEN}`
- **Railway services in the project:**
  - `booking-engine` — main Next.js app
  - `inspiring-trust` — cron service running `0 */6 * * *` UTC; image `alpine:latest`, start command runs `apk add --no-cache curl && curl -fS -X POST -H "Authorization: Bearer $CRON_SECRET" <url>` against `/api/cron/inventory-sync`. Logs visible in Railway → service → Deployments.
- **Cloudbeds OAuth scopes currently requested** (`SCOPES` in `src/app/api/cloudbeds/oauth/start/route.ts`):
  `read:addon, read:currency, read:dataInsightsGuests, read:dataInsightsOccupancy, read:dataInsightsReservations, read:guest, write:guest, read:hotel, read:rate, write:rate, read:reservation, write:reservation, read:room, read:taxesAndFees, read:user`. **Adding any new scope requires re-OAuth on every connected property** — old tokens don't carry it.

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Server component → resolves property
│   ├── home-client.tsx             # Homepage: hero + below-fold sections
│   ├── rooms/
│   │   ├── page.tsx                # Server component
│   │   └── rooms-client.tsx        # Room selection + extras + basket
│   ├── checkout/
│   │   ├── page.tsx                # Server component
│   │   └── checkout-client.tsx     # Guest details + payment (mock — Stripe Elements TBD)
│   ├── confirmation/
│   │   ├── page.tsx                # Server component
│   │   └── confirmation-client.tsx # Booking confirmed
│   ├── pickers/                    # DEV: booking bar variants (legacy)
│   ├── bars/                       # DEV: 6 booking bar concepts on hero
│   ├── compare/                    # DEV: 15 price comparison banners
│   ├── compare-live/               # DEV: 5 banners in full page context
│   ├── fonts/                      # DEV: font comparison on room cards
│   ├── rates/                      # DEV: rate plan display concepts
│   ├── enhance/                    # DEV: extras panel concepts
│   ├── rooms-mockup/               # DEV: room card layout concepts
│   ├── admin/
│   │   ├── layout.tsx              # Auth context + nav
│   │   ├── page.tsx                # Properties list
│   │   ├── properties/[id]/page.tsx # Property editor
│   │   └── bookings/page.tsx       # Bookings list
│   └── api/
│       ├── availability/route.ts            # Cold-starts inventory sync if window is empty
│       ├── extras/route.ts                  # Per-property addon catalog (60s unstable_cache); cold-starts sync if empty
│       ├── bookings/route.ts                # Currently stubs Cloudbeds — TODO Step 11 rewrites
│       ├── cloudbeds/
│       │   ├── oauth/start/route.ts         # Admin-only, redirects to Cloudbeds authorize
│       │   ├── oauth/callback/route.ts      # Token exchange + auto-subscribes webhooks
│       │   └── webhooks/[token]/route.ts    # Receives Cloudbeds events, fires sync. Token-gated (404 on mismatch).
│       ├── cron/
│       │   └── inventory-sync/route.ts      # Bearer-protected, runs full sweep (Railway cron)
│       └── admin/                           # Admin CRUD endpoints
├── components/
│   ├── layout/                     # ThemeProvider, NavBar, Footer
│   ├── website/                    # HeroSection
│   ├── booking/                    # BookingBar*, BookingProgress, AvailabilityResults,
│   │                               # ExtrasPanel (Cloudbeds-driven), StickyBookingBar,
│   │                               # PriceCompare, GuestDetailsForm, BookingSummary
│   │                               # (childCount prop, not children — React reserves it), etc.
│   ├── ui/                         # FadeIn (scroll animation)
│   ├── admin/                      # ThemeEditor
│   └── PageRenderer.tsx            # JSON → components
├── db/
│   ├── schema.ts                   # Drizzle schema (10 tables; pushed via drizzle-kit push, no migrations dir)
│   └── index.ts                    # Neon connection
├── lib/
│   ├── theme.ts                          # PropertyTheme type + CSS vars
│   ├── get-property.ts                   # Multi-tenant resolver (reads x-property-host / x-property-slug from proxy)
│   ├── admin-auth.ts                     # Bearer token check
│   ├── crypto.ts                         # AES-256-GCM token at-rest encryption + signed OAuth state
│   ├── booking/                          # Headless booking hooks — see "Headless booking library" section
│   │   ├── types.ts
│   │   ├── useAvailability.ts
│   │   ├── useExtras.ts
│   │   ├── useBookingDraft.ts
│   │   ├── usePersistedDraft.ts          # sessionStorage mirror + load/clear + confirmation helpers
│   │   ├── submitBooking.ts              # Typed POST to /api/bookings; reserves Stripe ID slots
│   │   └── index.ts                      # Barrel export — `import { ... } from "@/lib/booking"`
│   └── cloudbeds/
│       ├── client.ts                     # OAuth refresh + cloudbeds(propertyId, path) v1.3 wrapper
│       ├── sync-inventory.ts             # Pulls room types / rate plans / inventory; calls sync-extras at the end
│       ├── sync-extras.ts                # Pages /addons/v1/addons (api.cloudbeds.com host, x-property-id header); upsert + delete-missing
│       ├── webhook-handler.ts            # Shared handler logic — invoked from the [token] route
│       └── webhook-subscriptions.ts      # subscribe / unsubscribe / track in DB. deleteWebhook needs the full triple (subscriptionID + endpointUrl + object + action) — undocumented.
├── scripts/
│   ├── seed.ts                           # Kensington Arms test data (legacy — Cloudbeds is now source of truth for demo)
│   ├── seed-second.ts                    # UrbanStay test data (no Cloudbeds connection)
│   ├── seed-rate-plans.ts                # 4 rate plans per room + inventory (legacy — for non-CB properties)
│   ├── cloudbeds-smoke.ts                # Read-only smoke test against all CB endpoints we use
│   ├── cloudbeds-sync.ts                 # Manual trigger for inventory sync (also pulls extras)
│   ├── cloudbeds-subscribe.ts            # Manual trigger for webhook subscription
│   ├── cloudbeds-rotate-webhooks.ts      # Unsubscribe + resubscribe — use after the webhook URL changes
│   ├── check-inventory.ts                # DB inspection helper
│   ├── cleanup-demo-seed.ts              # One-shot script that removed old hand-seeded rows from demo
│   ├── reset-db.ts                       # DROP all tables (dev only)
│   ├── update-font.ts                    # Update property font in DB
│   └── update-themes.ts                  # Theme migration script
└── proxy.ts                         # Next.js 16 proxy (renamed from middleware): host header → property + dev-route 404 in production
```

---

## How to Pick Up Development

### Local dev
```bash
cd /Users/karolmarcu/Documents/booking-engine
npm run dev
# → http://localhost:3000 (resolves to first property in DB)
# → http://localhost:3000/?property=urbanstay (switch property)
```

### Dev pages (design comparison tools)
- `/bars` — 6 booking bar concepts on full hero folds
- `/compare` — 15 price comparison banner concepts
- `/compare-live` — 5 shortlisted banners in full page context (with switcher)
- `/fonts` — font comparison on full room cards
- `/rates` — rate plan display concepts
- `/enhance` — extras panel concepts
- `/rooms-mockup` — 4 room card layout concepts in full page (with switcher)
- `/pickers` — legacy booking bar variants

### Deploy
```bash
railway up
```

### Push schema changes
```bash
npx drizzle-kit push
```

### Cloudbeds operational scripts

```bash
# Run all of these with: set -a && source .env.local && set +a && npx tsx <script>
src/scripts/cloudbeds-smoke.ts demo               # Read-only; saves raw responses to tmp/cloudbeds-smoke/
src/scripts/cloudbeds-sync.ts demo 90             # Run full inventory + extras sync for 90 days
src/scripts/cloudbeds-subscribe.ts demo           # Subscribe webhooks (idempotent)
src/scripts/cloudbeds-rotate-webhooks.ts demo     # Unsubscribe + resubscribe (use after webhook URL changes)
src/scripts/check-inventory.ts demo               # Inspect DB state + most recent updatedAt
```

For `cloudbeds-subscribe.ts` / `cloudbeds-rotate-webhooks.ts`, the registered URL is built from `CLOUDBEDS_WEBHOOK_URL` (if set), or `${origin of CLOUDBEDS_REDIRECT_URI}/api/cloudbeds/webhooks/${CLOUDBEDS_WEBHOOK_TOKEN}` as fallback. Both env vars must be present locally to run these scripts against the production Railway URL.

### Seed legacy properties (UrbanStay only — demo is Cloudbeds-driven)
```bash
source .env.local && export $(grep -v '^#' .env.local | xargs) && npx tsx src/scripts/seed-rate-plans.ts
```

### Update font
```bash
source .env.local && export $(grep -v '^#' .env.local | xargs) && npx tsx src/scripts/update-font.ts
```

---

## Design conventions (do not relitigate)

These are the outcomes of the design overhaul. Follow them unless explicitly redesigning.

- **Hosting:** Railway (not Vercel)
- **DB:** Neon Postgres 17, AWS eu-central-1
- **Design:** Conversion-first, not content-first. Homepage = booking engine.
- **Page flow:** Separate pages (`/` → `/rooms` → `/checkout` → `/confirmation`), not single-page scroll
- **Font:** Inter (via Google Fonts link in layout.tsx, stored in DB theme)
- **Booking bar:** Icon-led — tinted icon squares, small gray labels, no underlines, glow button
- **Room card layout:** Dark Header concept (navy band with room name + urgency tags, image left, rates right)
- **Rate plan buttons:** Outline "Reserve" style (`border: 1px solid primary, borderRadius: 2px`)
- **Extras:** Card grid with navy header, toggle on/off, sticky navy basket bar below
- **Price compare:** Emerald gradient banner with OTA rates in frosted pills
- **Trust signals:** "Official Site" badge in nav, "Official Website — Lowest Price Guaranteed" on hero, "Best rate guaranteed" on rooms header
- **Page backgrounds:** Homepage = white + #F2F2F2 alternating, booking flow = #F2F2F2 throughout
- **Dev mockup pages:** Pattern is to create comparison pages with multiple concepts, then pick the winner and apply to live. All dev pages have links in the NavBar dev section. This process works well — keep doing it for future design decisions.

---

## Notes for Next Agent

**Design iteration process:** Karol prefers to see multiple options side by side before committing. The pattern that works:
1. Create a dev mockup page (e.g. `/bars`, `/compare`) with 10-15 static concepts
2. Karol shortlists to 4-5 favourites
3. Create a "live" mockup page showing the shortlisted options in full page context with a switcher
4. Karol picks the winner, you apply it to the real components

**Karol's design preferences (learned through iteration):**
- Dislikes: emojis, too much navy/dark, magnolia (#FAF8F5) as standalone background, heavy borders, uppercase values, card-per-section on homepage
- Likes: clean white + #F2F2F2, navy used sparingly (headers, one full section), outline buttons, subtle trust signals, Inter font, frosted/glass effects, icon-led UI
- Homepage should feel like a hotel website, booking flow should feel like a polished product
- The dark header pattern on room cards is the signature — navy band with room name, white body below
- Sticky basket bar should feel substantial (navy bg, white button) not shy

**Current state:** Pages are functional and styled, the headless booking hooks are extracted, and the canonical `/rooms`, `/checkout`, `/confirmation` clients are the reference pattern for porting per-hotel bespoke front-ends. The integration write-side (postReservation / postCustomItem / postPayment) is gated on Stripe — see `TODO.md` for the sequenced rebuild.
