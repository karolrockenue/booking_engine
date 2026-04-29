# Hotel Website + Booking Engine Platform — Reference

> **Last updated:** 2026-04-29
> **Status:** Core platform built and deployed. Design overhaul complete. Cloudbeds rebuild Phase 1–2 done: schema migrated, OAuth working, inventory + rate plans + webhooks live and syncing in production. Step 6 (inventory sync) fully shipped; Step 7 (extras catalog) next. Stripe Connect not yet started. See `TODO.md` for the live build plan.

This doc is a **snapshot of the current platform** — what's built, how it's organised, the design conventions that hold across pages. For the forward plan (rebuild steps, sequencing, design questions), see `TODO.md`.

---

## Product Vision

A multi-tenant hotel website platform with an integrated booking engine, connected to Cloudbeds. Each hotel gets a fully bespoke website on their own domain (`www.thehotel.com`) with a seamlessly integrated booking flow — not a generic widget bolted on, but a native part of the site. You design and manage all ~20 sites as the webmaster.

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

Next.js middleware reads `Host` header → resolves property from DB → serves correct theme + content. For dev, `?property=slug` overrides domain lookup. Fallback: if no domain matches, serves the first property (covers Railway preview URL).

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
| **PMS Integration** | Cloudbeds REST API (OAuth2) | 🟢 Inventory + webhooks live, extras + write paths next |
| **Payments** | Stripe Connect (Express, direct charges) | 🔲 Not started |
| **Image Storage** | Cloudflare R2 (planned) | 🔲 Not started |
| **DNS/Domains** | Cloudflare (planned) | 🔲 Not started |

---

## What's Built

### Pages (booking flow + dev tools)

| Route | Purpose | Status |
|---|---|---|
| `/` | Hero image + booking bar + about/gallery/amenities/location/CTA | ✅ |
| `/rooms` | Room selection with rate plans, extras, price comparison | ✅ |
| `/checkout` | Guest details + payment form + booking summary sidebar | ✅ (mock card form) |
| `/confirmation` | Booking confirmed with reference, stay details, nightly breakdown | ✅ |
| `/admin` | Admin dashboard (token-protected) | ✅ |
| `/admin/properties/[id]` | Property editor (general, rooms, theme) | ✅ |
| `/admin/bookings` | Bookings list across all properties | ✅ |
| `/pickers` | DEV: 4 booking bar style variants (legacy, see /bars) | ✅ Dev |
| `/bars` | DEV: 6 booking bar concepts on full hero folds | ✅ Dev |
| `/compare` | DEV: 15 price comparison banner concepts | ✅ Dev |
| `/compare-live` | DEV: 5 shortlisted banners in full page context with switcher | ✅ Dev |
| `/fonts` | DEV: 10 font options rendered on full room cards | ✅ Dev |
| `/rates` | DEV: 6 rate plan display concepts | ✅ Dev |
| `/enhance` | DEV: 8 extras/upsell panel concepts | ✅ Dev |
| `/rooms-mockup` | DEV: 4 full-page room card layout concepts with switcher | ✅ Dev |

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
- Extras panel: "Enhance your stay" with card grid (currently hardcoded list — being moved to Cloudbeds `getItems`)
- Sticky basket bar: navy background, shopping bag icon, itemised extras as removable pills, running total, white "Continue" button

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
- Booking: BookingBar, BookingBarLuxury, BookingBarCompact, BookingBarWarm, BookingProgress, AvailabilityResults (with RatePlanList), ExtrasPanel, StickyBookingBar, PriceCompare, GuestDetailsForm, BookingSummary, BookingWidget, BookingFlow
- Layout: ThemeProvider, NavBar (default/booking variants, hideCta option), Footer
- Admin: ThemeEditor
- PageRenderer (JSON config → component composition)

### Database Schema (live on Neon)

- `properties` — multi-tenant config, theme JSONB, domain, encrypted Cloudbeds tokens, `cloudbedsPropertyId`, Stripe fields (still empty)
- `pages` — page layouts per property (JSON composition)
- `content_blocks` — key-value content per property
- `images` — image references per property
- `room_types` — mirrored from Cloudbeds (`otaRoomId` = Cloudbeds `roomTypeID`, numeric)
- `rate_plans` — mirrored from Cloudbeds (`otaRateId` = Cloudbeds `rateID`); `isRefundable` + `cancellationPolicy` are admin-managed (not in CB API), seeded from a name heuristic on first sync
- `inventory` — ARI cache (date × room × rate → units, rate, restrictions); upserted by `syncInventoryForProperty`
- `bookings` + `booking_day_rates` + `booking_extras` — guest bookings with nightly breakdown and folio extras (extras table populated when booking flow lands in Step 11)
- `payment_events` — Stripe + auto-charge audit trail (empty until Phase 3)
- `cloudbeds_webhook_subscriptions` — one row per (property, object, action); persisted so we can `deleteWebhook` on disconnect

### Test Data

**The Kensington Arms** (slug: `demo`, GBP, `cloudbedsPropertyId=302817`) — connected to Cloudbeds
- 3 room types from CB: Single Room, Double Room, Triple Room
- 8 rate plans from CB: 3 master rates (Standard) + 2 derived (`Non refundable -10%`) + 3 master ("Direct Rate - 72h cancelation")
- 720 inventory rows (8 plans × 90 days) auto-synced
- 8 webhook subscriptions live (reservation/* × 6, availability/closeout_changed, api_queue_task/rate_status_changed)
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
- **Admin panel:** `/admin` (token: `change-me-before-deploy` — needs changing before sharing)
- **Dev convenience:** `?property=urbanstay` switches property on localhost or Railway URL
- **Environment variables on Railway:**
  - `DATABASE_URL`, `ADMIN_TOKEN` — core
  - `CLOUDBEDS_CLIENT_ID`, `CLOUDBEDS_CLIENT_SECRET`, `CLOUDBEDS_REDIRECT_URI`, `CLOUDBEDS_TOKEN_KEY` — OAuth + AES-GCM token encryption
  - `CRON_SECRET` — Bearer token for `/api/cron/inventory-sync`
  - `CLOUDBEDS_WEBHOOK_URL` — optional override for the URL passed to `postWebhook`; falls back to `${origin of CLOUDBEDS_REDIRECT_URI}/api/cloudbeds/webhooks` if unset
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
│       ├── bookings/route.ts                # Currently stubs Cloudbeds — TODO Step 11 rewrites
│       ├── cloudbeds/
│       │   ├── oauth/start/route.ts         # Admin-only, redirects to Cloudbeds authorize
│       │   ├── oauth/callback/route.ts      # Token exchange + auto-subscribes webhooks
│       │   └── webhooks/route.ts            # Receives Cloudbeds events, fires sync
│       ├── cron/
│       │   └── inventory-sync/route.ts      # Bearer-protected, runs full sweep (Railway cron)
│       └── admin/                           # Admin CRUD endpoints
├── components/
│   ├── layout/                     # ThemeProvider, NavBar, Footer
│   ├── website/                    # HeroSection
│   ├── booking/                    # BookingBar*, BookingProgress, AvailabilityResults,
│   │                               # ExtrasPanel (hardcoded list), StickyBookingBar,
│   │                               # PriceCompare, GuestDetailsForm, BookingSummary, etc.
│   ├── ui/                         # FadeIn (scroll animation)
│   ├── admin/                      # ThemeEditor
│   └── PageRenderer.tsx            # JSON → components
├── db/
│   ├── schema.ts                   # Drizzle schema (8 tables — being reworked)
│   └── index.ts                    # Neon connection
├── lib/
│   ├── theme.ts                          # PropertyTheme type + CSS vars
│   ├── get-property.ts                   # Multi-tenant resolver
│   ├── admin-auth.ts                     # Bearer token check
│   ├── crypto.ts                         # AES-256-GCM token at-rest encryption + signed OAuth state
│   └── cloudbeds/
│       ├── client.ts                     # OAuth refresh + cloudbeds(propertyId, path) v1.3 wrapper
│       ├── sync-inventory.ts             # Pulls room types / rate plans / inventory; idempotent batched upsert
│       └── webhook-subscriptions.ts      # subscribe / unsubscribe / track in DB
├── scripts/
│   ├── seed.ts                           # Kensington Arms test data (legacy — Cloudbeds is now source of truth for demo)
│   ├── seed-second.ts                    # UrbanStay test data (no Cloudbeds connection)
│   ├── seed-rate-plans.ts                # 4 rate plans per room + inventory (legacy — for non-CB properties)
│   ├── cloudbeds-smoke.ts                # Read-only smoke test against all CB endpoints we use
│   ├── cloudbeds-sync.ts                 # Manual trigger for inventory sync
│   ├── cloudbeds-subscribe.ts            # Manual trigger for webhook subscription
│   ├── check-inventory.ts                # DB inspection helper
│   ├── cleanup-demo-seed.ts              # One-shot script that removed old hand-seeded rows from demo
│   ├── update-font.ts                    # Update property font in DB
│   └── update-themes.ts                  # Theme migration script
└── middleware.ts                    # Host header + ?property= override
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
src/scripts/cloudbeds-smoke.ts demo        # Read-only; saves raw responses to tmp/cloudbeds-smoke/
src/scripts/cloudbeds-sync.ts demo 90      # Run full inventory sync for 90 days
src/scripts/cloudbeds-subscribe.ts demo    # Subscribe webhooks (idempotent)
src/scripts/check-inventory.ts demo        # Inspect DB state + most recent updatedAt
```

For `cloudbeds-subscribe.ts`, prefix with `CLOUDBEDS_WEBHOOK_URL=https://<railway-url>/api/cloudbeds/webhooks` if your `.env.local` doesn't have either that var or `CLOUDBEDS_REDIRECT_URI` set — the script needs a publicly reachable URL to register with Cloudbeds.

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

**Current state:** Pages are functional and styled. Design is ~90% there. The integration layer is the active work — see `TODO.md` for the sequenced rebuild.
