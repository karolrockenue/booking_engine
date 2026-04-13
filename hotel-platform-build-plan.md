# Hotel Website + Booking Engine Platform — Build Plan

> **Last updated:** 2026-04-13
> **Status:** Core platform built and deployed. Awaiting Cloudbeds integration path clarification.

---

## Product Vision

A multi-tenant hotel website platform with an integrated booking engine, connected to Cloudbeds. Each hotel gets a fully bespoke website on their own domain (`www.thehotel.com`) with a seamlessly integrated booking flow — not a generic widget bolted on, but a native part of the site. You design and manage all ~20 sites as the webmaster.

### Design Philosophy

**Conversion-first.** 99.9% of guests already know the hotel from OTAs. The website's job is to steal the booking, not showcase the hotel.

- Homepage = hero image + date picker. That's the first and only interaction above the fold.
- Below the fold: photos, location, about — for reassurance, but most won't scroll.
- Booking flow is separate pages: `/` → `/rooms` → `/checkout` → `/confirmation`
- No content-heavy sections, virtual tours, or 20-section homepages.

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
          ┌───────────┼───────────────┐
          ▼           ▼               ▼
   ┌────────────┐ ┌────────┐  ┌─────────────┐
   │ PostgreSQL │ │ Stripe │  │  Cloudbeds   │
   │   (Neon)   │ │  (TBD) │  │  (TBD path) │
   └────────────┘ └────────┘  └─────────────┘
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
| **Payments** | Stripe (deferred — awaiting Cloudbeds payment flow clarification) | ⏸ Deferred |
| **Image Storage** | TBD (Cloudflare R2 planned) | 🔲 Not started |
| **DNS/Domains** | Cloudflare (planned) | 🔲 Not started |

---

## What's Built

### Pages (4-page booking flow)

| Route | Purpose | Status |
|---|---|---|
| `/` | Hero image + date picker (above the fold only) | ✅ |
| `/rooms` | Available rooms + rates for selected dates | ✅ |
| `/checkout` | Guest details form + booking summary sidebar | ✅ |
| `/confirmation` | Booking confirmed with reference number | ✅ |
| `/admin` | Admin dashboard (token-protected) | ✅ |
| `/admin/properties/[id]` | Property editor (general, rooms, theme) | ✅ |
| `/admin/bookings` | Bookings list across all properties | ✅ |

### API Routes

| Route | Method | Purpose | Status |
|---|---|---|---|
| `/api/availability` | GET | Query inventory with restriction checks | ✅ |
| `/api/bookings` | POST | Create booking (validates, saves, generates order ID) | ✅ |
| `/api/b2u/health-check` | POST | Cloudbeds B2U health check | ✅ Ready |
| `/api/b2u/setup-property` | POST | B2U property link setup | ✅ Ready |
| `/api/b2u/get-room-types` | POST | Return room types to Cloudbeds | ✅ Ready |
| `/api/b2u/get-rate-plans` | POST | Return rate plans to Cloudbeds | ✅ Ready |
| `/api/b2u/ari-update` | POST | Receive + store ARI pushes | ✅ Ready |
| `/api/b2u/get-booking-list` | POST | Return bookings to Cloudbeds | ✅ Ready |
| `/api/b2u/get-booking-id` | POST | Return single booking to Cloudbeds | ✅ Ready |
| `/api/admin/properties` | GET/POST | List/create properties | ✅ |
| `/api/admin/properties/[id]` | GET/PATCH | Get/update property | ✅ |
| `/api/admin/properties/[id]/rooms` | GET/POST | List/create room types | ✅ |
| `/api/admin/properties/[id]/pages` | GET/POST | List/upsert page layouts | ✅ |
| `/api/admin/properties/[id]/content` | GET/POST | List/upsert content blocks | ✅ |
| `/api/admin/bookings` | GET | List all bookings | ✅ |

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

**Component library:**
- Website: HeroSection, ContentBlock, RoomCard, RoomShowcase, AmenitiesGrid, Gallery, TestimonialsSection, LocationMap, ContactSection, CTABanner
- Booking: DatePicker, GuestSelector, AvailabilityResults, GuestDetailsForm, BookingSummary, BookingWidget, BookingFlow
- Layout: ThemeProvider, NavBar, Footer
- Admin: ThemeEditor
- PageRenderer (JSON config → component composition)

**Admin theme editor** — visual editor with:
- Color pickers with hex input + swatch preview
- Font dropdowns, weight selector
- Spacing/radius inputs with visual preview
- Style selectors (nav, button, hero, image treatment)
- Hero config (headline, subheadline, image, overlay slider)
- Contact info + social links

### Database Schema (8 tables, all live on Neon)

- `properties` — multi-tenant config, theme JSONB, domain, Cloudbeds IDs
- `pages` — page layouts per property (JSON composition)
- `content_blocks` — key-value content per property
- `images` — image references per property
- `room_types` — mirrored from Cloudbeds
- `rate_plans` — mirrored from Cloudbeds, linked to room types
- `inventory` — ARI cache (date × room × rate → units, price, restrictions)
- `bookings` + `booking_day_rates` — guest bookings with nightly breakdown

### Test Data

Two seeded properties with full inventory (90 days):

1. **The Kensington Arms** (slug: `demo`, GBP)
   - 3 rooms: Classic Double (£145), Deluxe Suite (£225), Superior Twin (£165)
   - Weekend rates +20%
   - Navy + gold theme, serif headings, sharp corners

2. **UrbanStay Apartments** (slug: `urbanstay`, EUR)
   - 2 rooms: Studio (€89), One-Bedroom (€129)
   - Weekend rates +15%
   - Slate + blue theme, system font, rounded corners

### Deployment

- **Railway URL:** `https://booking-engine-production-b11b.up.railway.app`
- **Admin panel:** `/admin` (token: `change-me-before-deploy` — CHANGE THIS)
- **Dev convenience:** `?property=urbanstay` switches property on localhost or Railway URL
- **Environment variables:** DATABASE_URL, ADMIN_TOKEN, B2U_SHARED_SECRET (all set on Railway)

---

## Cloudbeds Integration — Current Status

### What We Have
- **App Type:** Booking Engine (registered as "Rockenue Booking Engine")
- **Integration Status:** In Development
- **Credentials:** REST API / OAuth (Client ID + Secret)
- **Client ID:** `rockenue_be_cRtJg7K1HSUyBeYkbFLVhDMz`

### What We Need to Clarify (email sent to Manuel)
The credentials we have are **REST API/OAuth**, not **B2U/MyAllocator**. These are two different integration paths:

| | B2U (MyAllocator) | REST API (OAuth) |
|---|---|---|
| **Data flow** | Cloudbeds pushes ARI to you | You pull from Cloudbeds |
| **Auth** | Channel ID + Shared Secret | OAuth2 access tokens |
| **Endpoints** | You host them, Cloudbeds calls | Cloudbeds hosts, you call |
| **Certification** | Self-certification wizard | Standard OAuth flow |
| **What we built** | All 7 B2U endpoints ready | Not yet built |

**If B2U:** Wire in the shared secret, run self-certification, done.
**If REST API:** Need to build OAuth flow, polling for ARI data, and adapt the booking submission to use the REST API instead of B2U callbacks. More work but doable.

### OAuth Redirect URI (if REST API path)
```
https://booking-engine-production-b11b.up.railway.app/api/auth/callback
```

---

## What's NOT Built Yet

### Blocked on Cloudbeds answer
- [ ] Cloudbeds data connection (B2U or REST — waiting on Manuel)
- [ ] BookingCreate callback to Cloudbeds (stubbed, needs real API path)

### Blocked on payment clarification
- [ ] Stripe integration (authorize → capture flow)
- [ ] Payment form (Stripe Elements)
- [ ] Channel Collect / Strike Token handling with Cloudbeds

### Not started
- [ ] Image upload pipeline (Cloudflare R2)
- [ ] Confirmation emails to guests
- [ ] Custom domain setup (Cloudflare DNS + SSL per hotel)
- [ ] UI polish / responsive refinement
- [ ] Real hotel content (photos, copy, room descriptions)
- [ ] Cancellation flow
- [ ] Booking modification flow

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Server component → resolves property
│   ├── home-client.tsx             # Hero + date picker
│   ├── rooms/
│   │   ├── page.tsx                # Server component
│   │   └── rooms-client.tsx        # Availability results
│   ├── checkout/
│   │   ├── page.tsx                # Server component
│   │   └── checkout-client.tsx     # Guest details + summary
│   ├── confirmation/
│   │   ├── page.tsx                # Server component
│   │   └── confirmation-client.tsx # Booking confirmed
│   ├── book/page.tsx               # Redirects to /
│   ├── admin/
│   │   ├── layout.tsx              # Auth context + nav
│   │   ├── page.tsx                # Properties list
│   │   ├── properties/[id]/page.tsx # Property editor
│   │   └── bookings/page.tsx       # Bookings list
│   └── api/
│       ├── availability/route.ts
│       ├── bookings/route.ts
│       ├── b2u/                    # 7 B2U endpoints
│       └── admin/                  # Admin CRUD endpoints
├── components/
│   ├── layout/                     # ThemeProvider, NavBar, Footer
│   ├── website/                    # HeroSection, Gallery, etc.
│   ├── booking/                    # DatePicker, AvailabilityResults, etc.
│   ├── admin/                      # ThemeEditor
│   └── PageRenderer.tsx            # JSON → components
├── db/
│   ├── schema.ts                   # Drizzle schema (8 tables)
│   └── index.ts                    # Neon connection
├── lib/
│   ├── theme.ts                    # PropertyTheme type + CSS vars
│   ├── get-property.ts             # Multi-tenant resolver
│   ├── admin-auth.ts               # Bearer token check
│   └── b2u-auth.ts                 # Shared secret check
├── scripts/
│   ├── seed.ts                     # Kensington Arms test data
│   ├── seed-second.ts              # UrbanStay test data
│   └── update-themes.ts            # Theme migration script
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

### Deploy
```bash
railway up
```

### Push schema changes
```bash
npx drizzle-kit push
```

### Admin panel
- Local: `http://localhost:3000/admin`
- Production: `https://booking-engine-production-b11b.up.railway.app/admin`
- Token: stored in `ADMIN_TOKEN` env var

### Adding a new property
1. Go to `/admin` → "New Property"
2. Set name, slug, domain
3. Go to the property → "Theme" tab → configure colors, fonts, hero, contact
4. Go to "Rooms" tab → add room types with OTA Room IDs
5. Rate plans and inventory come from Cloudbeds via ARI updates (or will need manual seeding until Cloudbeds is connected)

### Key decisions
- **Hosting:** Railway (not Vercel)
- **DB:** Neon Postgres 17, AWS eu-central-1
- **Payment:** Deferred until Cloudbeds confirms payment flow
- **Design:** Conversion-first, not content-first. Homepage = booking engine.
- **Page flow:** Separate pages (`/` → `/rooms` → `/checkout` → `/confirmation`), not single-page scroll

---

## Original Build Phases (Updated)

### Phase 1: Foundation — ✅ COMPLETE
- [x] Next.js project with TypeScript
- [x] Neon database with full schema
- [x] B2U endpoint handlers (all 7)
- [x] Basic admin panel
- [ ] B2U self-certification (blocked on credentials)

### Phase 2: Design System + First Hotel Site — ✅ COMPLETE
- [x] Shared component library (~15 core components)
- [x] Theme token system with CSS custom properties
- [x] Multi-tenant routing middleware
- [x] First hotel website end-to-end
- [x] Second hotel with different theme (proves multi-tenant)

### Phase 3: Booking Engine MVP — ✅ COMPLETE (minus payment)
- [x] Booking flow: search → results → details → confirmation
- [x] Availability search from inventory table
- [x] Booking submission API with order ID generation
- [ ] Stripe Elements for payment (deferred)
- [ ] BookingCreate to Cloudbeds (stubbed)

### Phase 4: Admin Panel + Image Pipeline — 🟡 PARTIAL
- [x] Theme editor (visual, with previews)
- [x] Property CRUD + room management
- [x] Booking management view
- [ ] Image upload to R2
- [ ] Content editing UI (page compositions)
- [ ] B2U health monitoring

### Phase 5: Production Pilot — 🔲 NOT STARTED
- [ ] Deploy first real hotel on its own domain
- [ ] Real ARI data flowing from Cloudbeds
- [ ] Real bookings with real payments
- [ ] Edge case handling

### Phase 6: Scale — 🔲 NOT STARTED
- [ ] Build remaining hotel sites
- [ ] Refine components based on real designs

---

## Open Questions

1. **Cloudbeds integration path:** B2U (MyAllocator) or REST API? Email sent to Manuel. If REST, significant new work needed (OAuth flow, ARI polling, different booking submission).
2. **Payment flow:** Channel Collect (we process via Stripe, Cloudbeds gets pre-paid reservation)? Strike Token passthrough? Refund handling? — Blocked until Cloudbeds answers.
3. **Image hosting:** Cloudflare R2 planned but not set up. Could also use Railway's built-in storage or a simpler solution.
