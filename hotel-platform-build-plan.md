# Hotel Website + Booking Engine Platform — Build Plan

## Product Vision

A multi-tenant hotel website platform with an integrated booking engine, connected to Cloudbeds via the Myallocator Build-To-Us (B2U) API. Each hotel gets a fully bespoke website on their own domain (`www.thehotel.com`) with a seamlessly integrated booking flow — not a generic widget bolted on, but a native part of the site. You design and manage all ~20 sites as the webmaster.

---

## What Makes This Different From Cloudbeds' Booking Engine

| Cloudbeds BE | This Platform |
|---|---|
| Generic widget, color/logo swap only | Fully bespoke design per property |
| Separate look and feel from hotel website | Website and booking engine are one product |
| Hosted on Cloudbeds subdomain or iframe | Hosted on the hotel's own domain |
| Fixed layout, no creative control | Full creative freedom per property |
| No website — just a booking widget | Complete hotel website: homepage, rooms, gallery, about, contact |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    GUEST BROWSER                     │
│         www.thehotel.com (custom domain)             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              NEXT.JS APPLICATION                     │
│                (Railway / Vercel)                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Website  │  │ Booking  │  │  Admin Dashboard  │  │
│  │  Pages   │  │  Engine  │  │   (you only)      │  │
│  │          │  │  Flow    │  │                   │  │
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
   │   (Neon)   │ │  API   │  │  B2U API     │
   │            │ │        │  │ (myallocator)│
   └────────────┘ └────────┘  └─────────────┘
```

### How Data Flows

**Cloudbeds → You (via B2U — push model):**
Cloudbeds' channel manager calls your B2U endpoints whenever ARI (availability, rates, inventory) changes. You store this in Postgres. The guest-facing site reads from your DB — fast, no API latency.

**You → Cloudbeds (via B2U callbacks):**
When a guest books, you call `BookingCreate` on myallocator. The reservation appears in Cloudbeds PMS like any OTA booking.

**Stripe:**
Guest pays on your site via Stripe Elements. You process the payment, then post the reservation to Cloudbeds with payment confirmation.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | SSR for SEO, API routes for B2U endpoints, single deployable unit |
| **Language** | TypeScript | Type safety across the theming system and API contracts |
| **Database** | PostgreSQL on Neon | Already familiar, serverless-friendly, handles multi-tenant well |
| **Hosting** | Railway Pro or Vercel | Custom domain support, easy deploys. Vercel is natural for Next.js but Railway keeps everything in one place |
| **Payments** | Stripe (Elements + PaymentIntents) | PCI compliant, well-documented, supports authorize-then-capture |
| **Image Storage** | Cloudflare R2 + CDN | Cheap, fast, S3-compatible. Hotel photos are the heaviest asset |
| **DNS/Domains** | Cloudflare | Each hotel's domain points to your app via CNAME. Free SSL |

---

## Design System — The Smart Theming Approach

### Three Layers

#### Layer 1: Shared Component Library

A library of ~20-30 React components that every hotel site can use. These are **design-agnostic** — they accept theme tokens and render accordingly.

**Website components:**
- `HeroSection` — full-bleed image/video with overlay text, CTA
- `NavBar` — responsive navigation with booking CTA button
- `RoomCard` / `RoomShowcase` — room type display with images, description, pricing
- `Gallery` — image grid/lightbox/carousel (configurable layout)
- `AmenitiesGrid` — icons + labels for property amenities
- `TestimonialsSection` — guest reviews
- `LocationMap` — embedded map with surrounding area
- `ContactSection` — address, phone, email, form
- `Footer` — links, social, legal
- `ContentBlock` — flexible text + image section (left/right/stacked)
- `CTABanner` — promotional banner with action button

**Booking engine components:**
- `DatePicker` — check-in/out selection
- `GuestSelector` — adults/children
- `AvailabilityResults` — room list with rates from cached ARI
- `RoomDetailModal` — expanded room info, photos, rate plan selection
- `GuestDetailsForm` — name, email, phone, country
- `PaymentForm` — Stripe Elements integration
- `BookingConfirmation` — success page with booking reference
- `BookingSummary` — sticky sidebar showing selection + price breakdown

#### Layer 2: Design Token System

Each property gets a theme config that controls how every component renders. This is not just colors — it defines the entire visual language.

```typescript
// Example: theme config for a boutique hotel
const theme: PropertyTheme = {
  // Identity
  name: "The Kensington Arms",
  slug: "kensington-arms",
  domain: "www.thekensingtonarms.com",

  // Color palette
  colors: {
    primary: "#2C3E50",        // Deep navy
    secondary: "#C9A96E",      // Warm gold
    accent: "#8B4513",         // Leather brown
    background: "#FAF8F5",     // Warm white
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textMuted: "#6B7280",
    border: "#E5E0D8",
    error: "#DC2626",
    success: "#059669",
  },

  // Typography
  typography: {
    headingFont: "Playfair Display",   // Serif for elegance
    bodyFont: "Inter",                  // Clean sans-serif
    headingWeight: "700",
    bodyWeight: "400",
    baseSize: "16px",
    scale: 1.25,                        // Type scale ratio
    headingLetterSpacing: "-0.02em",
    bodyLineHeight: "1.6",
  },

  // Spacing & Layout
  layout: {
    maxWidth: "1280px",
    borderRadius: "2px",        // Sharp corners = luxury feel
    buttonRadius: "0px",        // Square buttons
    cardRadius: "4px",
    sectionPadding: "120px",    // Generous whitespace
    containerPadding: "24px",
  },

  // Visual style
  style: {
    imageAspectRatio: "3:2",
    imageTreatment: "none",     // vs "rounded", "shadow", "border"
    buttonStyle: "outline",     // vs "solid", "ghost"
    navStyle: "transparent",    // vs "solid", "sticky"
    heroStyle: "fullbleed",     // vs "contained", "split"
    animationLevel: "subtle",   // vs "none", "rich"
  },

  // Social & contact
  social: {
    instagram: "https://instagram.com/kensingtonarms",
    facebook: null,
    tripadvisor: "https://...",
  },
};
```

#### Layer 3: Page Compositions

Each property has a page config that defines which components appear on each page and in what order, with property-specific content references.

```typescript
// Example: homepage composition for a property
const homepageLayout: PageLayout = {
  sections: [
    {
      component: "HeroSection",
      props: {
        imageKey: "hero-main",        // references image in DB
        headline: "A Timeless Retreat in Kensington",
        subheadline: "Boutique luxury in the heart of London",
        ctaText: "Check Availability",
        ctaTarget: "/book",
        overlayOpacity: 0.4,
      }
    },
    {
      component: "BookingWidget",     // Inline date picker + search
      props: { variant: "compact" }
    },
    {
      component: "ContentBlock",
      props: {
        contentKey: "about-intro",    // references copy in DB
        layout: "text-left-image-right",
        imageKey: "lobby-lounge",
      }
    },
    {
      component: "RoomShowcase",
      props: {
        limit: 3,
        showPriceFrom: true,
        layout: "grid",               // vs "carousel", "stacked"
      }
    },
    {
      component: "AmenitiesGrid",
      props: { columns: 4 }
    },
    {
      component: "TestimonialsSection",
      props: { source: "manual", limit: 3 }
    },
    {
      component: "LocationMap",
      props: { showNearby: true }
    },
    {
      component: "CTABanner",
      props: {
        headline: "Book Direct for the Best Rate",
        ctaText: "Reserve Now",
        ctaTarget: "/book",
      }
    },
  ]
};
```

### Why This Works For You

- **Creative freedom**: Each property gets a unique visual identity through theme tokens — not just "blue vs green" but entirely different typographic and spatial personalities
- **Fast to build new sites**: Once the component library is solid, a new hotel site is: define theme tokens → compose page layouts → add content/images → point domain. No new code needed for most sites
- **Consistent booking engine**: The booking flow is the same everywhere (tested, reliable, PCI compliant) but visually adapts to each property's theme
- **Easy to maintain**: Update a component once, all 20 sites benefit. Fix a bug in the booking flow, fixed everywhere
- **No rebuild for content changes**: Swap images, update copy, adjust pricing display — all via the admin panel, no deploy needed

---

## B2U Integration — Technical Detail

### Endpoints You Host (Cloudbeds calls these)

All endpoints live under a single API route group, e.g. `https://api.yourplatform.com/b2u/`

| Endpoint | What Cloudbeds Sends | What You Return | Purpose |
|---|---|---|---|
| `HealthCheck` | Ping with shared_secret | `{ success: true }` | Verify your service is alive |
| `SetupProperty` | `mya_property_id` + hotel credentials | Success + your `ota_property_id` | Establish property link |
| `GetRoomTypes` | `mya_property_id` | Your room type list | Room mapping |
| `GetRatePlans` | `mya_property_id` | Your rate plan list | Rate plan mapping |
| `ARIUpdate` | Date ranges with units, rates, restrictions per room/rate | Acknowledge receipt | **Core data feed** |
| `GetBookingList` | Date range filter | List of bookings | Fallback booking sync |
| `GetBookingId` | Specific booking ID | Full booking detail | Fallback booking sync |

### Callbacks You Make (You call Cloudbeds)

| Callback | When | Payload |
|---|---|---|
| `BookingCreate` | Guest completes booking | Full booking JSON: guest, rooms, dates, day rates, payment |
| `BookingCreate` (cancel) | Guest cancels | Same structure with `IsCancellation: 1` |

### Authentication

- Cloudbeds assigns you a **Channel ID** and **Shared Secret** during partner onboarding
- Each property connection uses a `mya_property_id` (Cloudbeds side) + `ota_property_id` (your side)
- All B2U requests include the `shared_secret` for verification

### ARIUpdate Payload Structure (what you receive and store)

```json
{
  "mya_property_id": "12345",
  "ota_property_id": "your-internal-id",
  "Rooms": [
    {
      "RoomId": "ota-room-type-id",
      "StartDate": "2026-05-01",
      "EndDate": "2026-05-31",
      "Units": "5",
      "Price": "150.00",
      "MinStay": "2",
      "MaxStay": "14",
      "ClosedToArrival": false,
      "ClosedToDeparture": false
    }
  ]
}
```

### BookingCreate Payload (what you send)

```json
{
  "shared_secret": "your-secret",
  "mya_property_id": "12345",
  "ota_property_id": "your-internal-id",
  "booking_json": {
    "OrderId": "BK-20260413-001",
    "OrderDate": "2026-04-13",
    "OrderTime": "14:30:00",
    "IsCancellation": 0,
    "TotalCurrency": "GBP",
    "TotalPrice": 450,
    "Customers": [
      {
        "CustomerFName": "John",
        "CustomerLName": "Smith",
        "CustomerEmail": "john@example.com",
        "CustomerCountry": "GB"
      }
    ],
    "Rooms": [
      {
        "ChannelRoomType": "ota-room-type-id",
        "StartDate": "2026-05-10",
        "EndDate": "2026-05-12",
        "Price": 450,
        "Units": 1,
        "Currency": "GBP",
        "DayRates": [
          { "Date": "2026-05-10", "Rate": 225, "Currency": "GBP", "RateId": "rate-123" },
          { "Date": "2026-05-11", "Rate": 225, "Currency": "GBP", "RateId": "rate-123" }
        ]
      }
    ]
  }
}
```

---

## Database Schema

### Multi-Tenant Structure

```sql
-- Property configuration & theming
CREATE TABLE properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,         -- URL slug
  name            TEXT NOT NULL,
  domain          TEXT UNIQUE,                  -- www.thehotel.com
  mya_property_id TEXT,                         -- Cloudbeds myallocator ID
  ota_property_id TEXT,                         -- Our internal ID sent to Cloudbeds
  hotel_key       TEXT,                         -- Encrypted credentials for B2U setup
  currency        TEXT DEFAULT 'GBP',
  timezone        TEXT DEFAULT 'Europe/London',
  stripe_account  TEXT,                         -- Stripe Connect account or direct
  theme           JSONB NOT NULL,               -- Full theme config (Layer 2)
  status          TEXT DEFAULT 'draft',         -- draft, live, paused
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Page layouts per property
CREATE TABLE pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  slug            TEXT NOT NULL,                -- "home", "rooms", "about", "contact", "book"
  title           TEXT,
  meta_description TEXT,
  layout          JSONB NOT NULL,               -- Page composition (Layer 3)
  UNIQUE(property_id, slug)
);

-- Content blocks (copy, text sections)
CREATE TABLE content_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  key             TEXT NOT NULL,                -- "about-intro", "hero-headline"
  content         JSONB NOT NULL,               -- { headline, body, etc. }
  UNIQUE(property_id, key)
);

-- Images
CREATE TABLE images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  key             TEXT NOT NULL,                -- "hero-main", "room-deluxe-1"
  url             TEXT NOT NULL,                -- R2/CDN URL
  alt_text        TEXT,
  width           INT,
  height          INT,
  UNIQUE(property_id, key)
);

-- Room types (mirrored from Cloudbeds via B2U)
CREATE TABLE room_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  ota_room_id     TEXT NOT NULL,                -- ID sent to/from Cloudbeds
  name            TEXT NOT NULL,
  description     TEXT,
  max_occupancy   INT,
  base_occupancy  INT,
  amenities       JSONB,
  sort_order      INT DEFAULT 0,
  UNIQUE(property_id, ota_room_id)
);

-- Rate plans (mirrored from Cloudbeds via B2U)
CREATE TABLE rate_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  room_type_id    UUID REFERENCES room_types(id),
  ota_rate_id     TEXT NOT NULL,
  name            TEXT NOT NULL,
  name_public     TEXT,                         -- Guest-facing name
  is_public       BOOLEAN DEFAULT true,         -- Show on booking engine
  UNIQUE(property_id, ota_rate_id)
);

-- Inventory cache (populated by ARIUpdate pushes)
CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  room_type_id    UUID REFERENCES room_types(id),
  rate_plan_id    UUID REFERENCES rate_plans(id),
  date            DATE NOT NULL,
  units_available INT NOT NULL DEFAULT 0,
  rate            DECIMAL(10,2),
  min_stay        INT DEFAULT 1,
  max_stay        INT,
  closed_arrival  BOOLEAN DEFAULT false,
  closed_departure BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, room_type_id, rate_plan_id, date)
);

-- Index for fast availability lookups
CREATE INDEX idx_inventory_search
  ON inventory(property_id, date, units_available)
  WHERE units_available > 0 AND closed_arrival = false;

-- Bookings
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id),
  order_id        TEXT UNIQUE NOT NULL,         -- BK-20260413-001
  room_type_id    UUID REFERENCES room_types(id),
  rate_plan_id    UUID REFERENCES rate_plans(id),
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  adults          INT DEFAULT 1,
  children        INT DEFAULT 0,
  guest_first     TEXT NOT NULL,
  guest_last      TEXT NOT NULL,
  guest_email     TEXT NOT NULL,
  guest_phone     TEXT,
  guest_country   TEXT,
  total_price     DECIMAL(10,2) NOT NULL,
  currency        TEXT NOT NULL,
  stripe_pi_id    TEXT,                         -- Stripe PaymentIntent ID
  mya_status      TEXT DEFAULT 'pending',       -- pending, confirmed, failed, cancelled
  mya_response    JSONB,                        -- Raw response from BookingCreate
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Per-night rate breakdown for bookings
CREATE TABLE booking_day_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id),
  date            DATE NOT NULL,
  rate            DECIMAL(10,2) NOT NULL,
  rate_id         TEXT                          -- Cloudbeds rate ID
);
```

---

## Guest Booking Flow (Detailed)

### Step 1: Search
Guest is on `www.thehotel.com`, clicks "Book Now" or uses the inline booking widget.
→ Selects check-in, check-out, number of guests.
→ Frontend calls `GET /api/availability?propertyId=X&checkIn=2026-05-10&checkOut=2026-05-12&adults=2`

### Step 2: Availability Query
API queries the `inventory` table:
- Filter by property, date range, `units_available > 0`
- Respect `min_stay` / `max_stay` against the length of stay
- Exclude dates where `closed_arrival = true` (for the check-in date)
- Exclude dates where `closed_departure = true` (for the check-out date)
- Sum daily rates per room type + rate plan for total price
- Return available room types with: name, description, images, total price, per-night breakdown

### Step 3: Room Selection
Guest picks a room type and rate plan.
→ Frontend shows room details, photos, rate breakdown, cancellation policy.

### Step 4: Guest Details
Guest enters: first name, last name, email, phone, country.
→ All validated client-side and server-side.

### Step 5: Payment
Stripe Elements renders the card form (PCI compliant — card data never touches your server).
→ Frontend creates a PaymentIntent via your API
→ Your API calls `stripe.paymentIntents.create({ amount, currency, capture_method: 'manual' })` — **authorize only**
→ Frontend confirms the PaymentIntent with Stripe.js
→ Card is authorized but not charged yet

### Step 6: Booking Submission
Your API:
1. Creates the booking record in your database
2. Calls `BookingCreate` on myallocator with the full booking payload
3. If Cloudbeds confirms → capture the Stripe payment → return confirmation
4. If Cloudbeds rejects → cancel the Stripe PaymentIntent → return error
5. Guest sees confirmation page with booking reference

### Step 7: Post-Booking
- Confirmation email sent to guest (from your platform or via Cloudbeds — configurable)
- Booking appears in Cloudbeds PMS
- Inventory auto-decrements on Cloudbeds side → next ARIUpdate push reflects reduced availability

---

## Payment Flow — Open Questions & Plan

### What We Know
- B2U API supports a **Payments** section in the booking JSON
- **Strike Tokens** (Stripe tokens) can be passed for new reservations via B2U
- The Marketplace API (Option 2) does **not** support transferring credit cards or processing payments
- Cloudbeds booking engine uses Stripe internally for some properties

### Recommended Approach
**You process the payment via Stripe, Cloudbeds gets the reservation marked as pre-paid (Channel Collect).** This mirrors how Booking.com and Expedia work — the OTA/channel collects payment, the reservation arrives in the PMS as "Channel Collect" (pre-paid). The property doesn't need to charge the guest again.

### What To Clarify With Cloudbeds
1. Can you pass a Stripe token/PaymentIntent in the BookingCreate Payments section so Cloudbeds stores the payment reference?
2. Or should the reservation simply arrive as "Channel Collect" with no card details, and you handle all payment settlement outside Cloudbeds?
3. What's the recommended approach for refunds on cancellations — do you handle via Stripe directly, or does Cloudbeds trigger anything?

---

## Admin Dashboard (Your Webmaster Panel)

A protected `/admin` route in the Next.js app. Not exposed to hotel staff — just for you.

### Features
- **Properties list**: See all 20 properties, their status (draft/live), domain, last ARI update
- **Property editor**: Edit theme tokens, page compositions, content blocks
- **Image manager**: Upload/replace images to R2, preview on the live theme
- **Room type config**: Edit descriptions, images, sort order, amenity tags (supplementing what comes from Cloudbeds)
- **Inventory viewer**: See current ARI data per property — useful for debugging sync issues
- **Bookings list**: See all bookings, status, Stripe payment status, Cloudbeds sync status
- **B2U health**: Monitor last HealthCheck, last ARIUpdate timestamp per property

---

## Domain & Hosting Setup

### Per-Property Domain Flow
1. Hotel owns `www.thehotel.com`
2. In Cloudflare (or their DNS), add a CNAME: `www.thehotel.com → your-app.railway.app` (or Vercel equivalent)
3. In your app config, add the domain to the property record
4. Next.js middleware reads the `Host` header → looks up property by domain → serves the correct theme and content
5. SSL is automatic via Cloudflare or your hosting provider

### Multi-Tenant Routing (Next.js Middleware)
```
Request: www.thekensingtonarms.com/rooms
  → Middleware reads Host header
  → Looks up property where domain = "www.thekensingtonarms.com"
  → Sets property context (ID, theme, etc.)
  → Renders /rooms page with that property's theme + content
```

---

## Certification Process (B2U)

You already have test credentials. The self-certification wizard in myallocator admin:

| Step | Endpoint | What Happens | Effort |
|---|---|---|---|
| 1 | HealthCheck | They ping you, you respond | Trivial |
| 2 | CreateProperty | Optional, skip initially | — |
| 3 | SetupProperty | They send property ID + creds, you validate | Simple |
| 4 | GetRoomTypes | They request your room types, you return list | Simple |
| 5 | GetRatePlans | They request your rate plans, you return list | Simple |
| 6 | ARIUpdate | They push ARI data, you store it. They ask you to confirm specific values | Medium |
| 7 | BookingCreate | You send a test booking, they verify it arrives in Cloudbeds | Medium |
| 8 | GetBookingList/Id | They pull bookings from you as fallback | Simple |
| 9 | BookingCancellation | You send BookingCreate with `IsCancellation: 1` | Simple |

---

## Build Phases

### Phase 1: Foundation (Week 1-2)
- Set up Next.js project with TypeScript
- Set up Neon database with schema
- Implement B2U endpoint handlers (Express-style API routes)
- **Run through self-certification** with test data
- Basic admin panel: property CRUD, manual theme config

### Phase 2: Design System + First Hotel Site (Week 3-4)
- Build the shared component library (~15 core components)
- Implement the theme token system with CSS custom properties
- Build the multi-tenant routing middleware (domain → property lookup)
- **Create the first hotel website** end-to-end (homepage, rooms, gallery, about, contact)
- No booking engine yet — just the website

### Phase 3: Booking Engine MVP (Week 5-6)
- Build the booking flow components (search → results → details → confirmation)
- Wire availability search to the inventory table (populated by ARIUpdate)
- Integrate Stripe Elements for payment
- Implement BookingCreate callback
- **End-to-end test**: ARI push → guest searches → books → reservation appears in Cloudbeds

### Phase 4: Admin Panel + Image Pipeline (Week 7)
- Image upload to Cloudflare R2
- Content editing (copy, room descriptions, page compositions)
- Theme editor (visual preview of token changes)
- Booking management view
- B2U health monitoring

### Phase 5: Production Pilot (Week 8)
- Deploy first real hotel on its own domain
- Monitor ARI sync reliability
- Test real bookings with real Stripe payments
- Confirm reservations appear correctly in Cloudbeds PMS
- Handle edge cases: cancellations, modifications, payment failures

### Phase 6: Scale to Remaining Properties (Week 9-12)
- Design and build 4-5 more hotel sites (each gets faster as components mature)
- Refine the component library based on real design needs
- Roll out remaining properties over subsequent weeks

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Payment flow unclear with B2U | Blocks booking completion | Clarify with Cloudbeds integration contact ASAP |
| ARIUpdate data doesn't match expectations | Incorrect availability shown to guests | Build inventory viewer in admin; compare against Cloudbeds PMS during pilot |
| B2U certification takes longer than expected | Delays entire project | Start certification in Phase 1, don't wait |
| Stripe PCI compliance complexity | Could delay payment integration | Use Stripe Elements (client-side tokenization) — no card data touches your server |
| Custom domains + SSL at scale | Operational overhead | Cloudflare handles SSL automatically; document the DNS setup process |
| Component library isn't flexible enough for diverse hotel brands | Limits design quality | Start with 2-3 very different hotel designs to stress-test the system early |

---

## Key Links & Resources

- **B2U API Spec**: https://myallocator.github.io/build2us-apidocs/index.html
- **Cloudbeds Developer Portal**: https://developers.cloudbeds.com
- **Booking Engine Integration Guide**: https://developers.cloudbeds.com/docs/booking-engine
- **B2U Booking Format**: https://github.com/MyAllocator/build2us-apidocs/blob/gh-pages/booking_format_b2u.md
- **B2U Error Codes**: https://github.com/MyAllocator/myallocator-error-codes/blob/master/Errors.md
- **Booking Samples (JSON examples)**: https://github.com/MyAllocator/bookingsamples
- **RMS Integration Guide** (for reference): https://developers.cloudbeds.com/docs/revenue-management-system-rms
- **WebhookDB MyAllocator Guide** (implementation reference): https://docs.webhookdb.com/guides/myallocator/

---

## Immediate Next Steps

1. **Clarify payment flow** with your Cloudbeds integrations contact — ask specifically about Strike Token support and Channel Collect reservation handling
2. **Scaffold the Next.js project** with TypeScript, Neon connection, and B2U route stubs
3. **Start B2U self-certification** — even with placeholder logic, getting through HealthCheck → SetupProperty → GetRoomTypes proves the connection works
4. **Pick the first 2-3 hotels** with the most design contrast (e.g., a luxury boutique, a budget aparthotel, a serviced apartment) to stress-test the component library early
