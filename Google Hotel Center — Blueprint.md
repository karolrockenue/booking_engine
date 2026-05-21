# Google Hotel Center Integration — Blueprint

> **Scope:** Direct integration with Google Hotel Center for **Free Booking Links** (FBL) primarily, **Paid Hotel Ads** later. Single-purpose document for an AI agent picking up this work stream.
>
> **Last updated:** 2026-05-19
> **Status:** Pre-application. No engineering started. Decision made to begin Sprint 1 (Hotel List XML feed generator) before submitting the Connectivity Partner interest form.

---

## 1. Platform context

### What Rockenue is

Rockenue is a hotel revenue management agency with 8+ years operating history, official Booking.com chain status, and ≈40 properties under management contracts across the UK (mostly London) and US. £400k+ ARR. Three entities:

- **Rockenue International Group LLC FZ (UAE)** — main operating company, hotel agency / commercial business
- **Rockenue Tech sp. z o.o. (Poland)** — newly incorporated (deed signed 2026-05-19), this is the entity that owns the booking engine platform and will hold the Google Hotel Center account
- Rockenue Ltd (UK) — dissolved 2025

### What the booking engine ("the IBE") is

Rockenue Tech sp. z o.o. operates a multi-tenant direct booking engine ("internet booking engine" / IBE) for its hotel clients. Architecture:

- **Each hotel runs on its own custom domain** (e.g. `www.theporticohotel.com`) — bespoke marketing surface, consistent booking flow underneath
- **Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM · PostgreSQL (Neon) · Railway · Cloudbeds REST API · Stripe Connect
- **Theme system:** Public-facing flow (`/`, `/book`, `/rooms`, `/extras`, `/checkout`, `/confirmation`) selected per Railway service via `THEME` env var. Backend identical across deployments. First production theme: `portico-ivory`.
- **Cloudbeds integration:** OAuth2 per property; full inventory + rates + extras sync; webhook-driven; both v1.3 (legacy action-style) and the new modular API used. Read/write paths live (postReservation, postCustomItem, postPayment).
- **Stripe Connect:** Standard accounts, direct charges with `application_fee_amount`, `on_behalf_of` mandatory for cross-region. Currently on UAE sandbox; Polish sp. z o.o. production application pending KRS registration.
- **3% platform fee is baked into the rate** displayed to guests. Hotels uplift their public rate to account for it, just as they do for OTA commissions. The displayed price = feed price = booking price. This matters for Google's price-accuracy compliance.

For full IBE architecture, see `Booking Engine — Blueprint.md` in the repo root.

### Why Google integration matters

Google Hotel Search displays direct booking rates alongside OTAs in the "All options" panel under each hotel listing. The hotel's direct rate appears with an "Official site" badge, deep-linked to our booking flow.

- **Free Booking Links (FBL)** — zero commission, zero CPC, free clicks to our `/rooms` flow.
- **Paid Hotel Ads** — same infrastructure, optional Phase 2, costs CPC.

For an independent boutique hotel, FBL is the single highest-leverage marketing surface that doesn't pay OTA commission. Our 40 properties need to be on it.

---

## 2. Scope of this integration

In scope:

- Hotel List XML feed (40 properties → Google)
- ARI Push pipeline (rates, availability, inventory → Google in real time)
- Landing Pages XML (Google → our `/rooms` flow with correct query params)
- JSON-LD hotel-price structured data on every tenant `/rooms` page
- OAuth 2.0 service account for Travel Partner API
- UK 20% VAT handling in feeds (all-inclusive baked into rate)
- Operational dashboards (feed health, match rate, accuracy score)
- Connectivity Partner application

Out of scope (Phase 2):

- Paid Hotel Ads campaign management via Google Ads API
- Performance Max for travel goals
- US Free Booking Links (UK-only for v1)
- Multi-language feeds

---

## 3. Decisions made (binding for this work stream)

### Entity and account

- **Account holder: Rockenue Tech sp. z o.o.** (Polish entity), not the UAE Rockenue. Cleaner EU GDPR/VAT posture, aligns with Stripe platform.
- **One Hotel Center account for all 40 properties** (not 40 separate accounts).
- **One verified Google Business Profile per hotel.** Each hotel's GBP "Website" field must equal their customer-facing apex domain (e.g. `theporticohotel.com`), NOT a Rockenue subdomain. This unlocks the "Official site" badge.

### Integration path

- **Direct integration is the goal**, but acknowledged uphill at 40 properties (Google often pushes platforms our size to use a connectivity partner).
- **Parallel-track strategy:** build the technical infrastructure as if going direct, submit the Connectivity Partner application, and run commercial conversations with Cendyn and Adchieve as named fallbacks. Decision gate: if Google has not responded with a positive eligibility review within 30 days of application, sign with a partner under "feed-only, we keep our engine and Hotel Center" model.
- **Cloudbeds is NOT a viable connectivity partner for us.** Cloudbeds Payments / Cloudbeds Booking Engine partnership with Google only distributes properties that use Cloudbeds' own booking engine. We built our own engine on their REST API, so we are explicitly excluded from their auto-distribution. Confirmed verbatim in Cloudbeds FAQ.

### Pricing and compliance

- **Platform commission (3%) is baked into the rate**, not added at checkout. Feed price = displayed price = booking price. Avoids Google's "extra service charges at checkout" penalty.
- **UK 20% VAT is included in rate (all-inclusive)**, not added at checkout. Either via `<Baserate all_inclusive="true">` or split via `<Tax>` element — final choice deferred to implementation.
- **JSON-LD hotel-price structured data on every `/rooms` page** is mandatory (not optional) to keep price-accuracy score Excellent. Helps SEO regardless of Hotel Center status.
- **Mass property additions to feed must roll in batches of ≤10** to avoid Google's mass-change auto-block (triggers at ~10% delta).

### Build order

- **Sprint 1 first:** Hotel List XML feed generator. Smallest, most self-contained, validates against publicly available XSD. Build before submitting Google application.
- **Apply for Connectivity Partner status after Sprint 1 ships**, not before. Application narrative is stronger when infrastructure is in place.

### Operational prerequisite

- **GBP audit for all 40 hotels** runs in parallel with engineering. Hannah owns this. Document mismatches (name, address, "Website" field) per property. Each hotel's customer-facing apex domain is the value to set.

### What we explicitly are NOT doing

- ❌ Using Cloudbeds as connectivity partner (excluded from their FBL distribution)
- ❌ Going via UAE entity (no upside, weaker GDPR posture vs Polish entity)
- ❌ Pull/Live Pricing as primary delivery (EEA limitations under DMA — ARI Push is mandatory)
- ❌ Commission-based bidding (sunset Feb 20, 2025; not relevant anyway for FBL)
- ❌ Multi-language feeds in v1 (English only)
- ❌ US Free Booking Links in v1 (UK-only)

---

## 4. Technical architecture (high-level)

```
                                            ┌────────────────────────────┐
                                            │   GOOGLE HOTEL CENTER       │
                                            │   (after we're allowlisted) │
                                            └────────┬─────────┬─────────┘
                                                     │         │
                          (pull, daily)              │         │  (push, real-time)
                                                     │         │
            ┌────────────────────────────────────────┴───┐  ┌──┴────────────────────┐
            │ feeds.rockenue.tech                         │  │ prices.rockenue.tech  │
            │  /google/rockenue_local.xml.zip             │  │  ARI Push outbound    │
            │  (Hotel List feed)                          │  │  (OAuth 2.0)          │
            └────────────────────────────────────────┬───┘  └──┬────────────────────┘
                                                     │         │
                                                     ▼         ▼
                                            ┌──────────────────────────────┐
                                            │   BOOKING ENGINE PLATFORM     │
                                            │   (Next.js on Railway)        │
                                            │                                │
                                            │   - properties table → Hotel  │
                                            │     List feed generator        │
                                            │   - Cloudbeds webhooks →      │
                                            │     ARI message generator     │
                                            │   - /rooms with JSON-LD       │
                                            │   - per-tenant custom domains  │
                                            └──────────────────────────────┘
                                                     ▲
                                                     │  (click from Google)
                                                     │
                                            ┌────────┴────────────────────┐
                                            │   GUEST LANDING PAGE         │
                                            │   www.theporticohotel.com/   │
                                            │   rooms?checkIn=…&adults=…   │
                                            │   (deep-linked from FBL)    │
                                            └──────────────────────────────┘
```

### Components to build

1. **Hotel List feed generator** — Server route that emits XML from `properties` table, served at `feeds.rockenue.tech/google/rockenue_local.xml.zip` with HTTP BASIC auth.
2. **ARI Push pipeline** — Cloudbeds webhook → ARI message generator → POST to Google's ARI endpoint with OAuth 2.0 service-account credentials.
3. **Landing Pages XML** — Static config served once to Google, defining URL templates using Google's substitution macros (`(CHECKINYEAR)`, `(ALTERNATE-HOTEL-ID)`, etc.).
4. **JSON-LD on `/rooms`** — Structured `Hotel` + `Offer` schema injected into every theme's room-select page.
5. **OAuth 2.0 service account** — Google Cloud project, service account, JSON key. Scopes: `travelpartner` + `travel-partner-price-upload`.
6. **Operational dashboards** — Admin tab showing feed health, accuracy score, match rate per property.

---

## 5. Sprint 1 — Hotel List XML feed generator

**Scope:** Generate valid Hotel List XML from `properties` table. Validate against Google's published XSD. Serve at a hidden admin route. ~5 engineering days.

### Inputs

`properties` table has the relevant columns. Each property needs at minimum:

- Unique stable ID (`properties.id` or slug — never reuse across hotels)
- `name`
- Address (currently in `content_blocks.contact.addressLines` for Portico theme; sources vary)
- Country code (ISO-2 — "GB" for UK hotels)
- Latitude / longitude (currently in `content_blocks.neighbourhood.mapLat/mapLon`)
- Phone (currently in `content_blocks.contact.reservationsPhone`)
- Website (customer-facing apex domain — `properties.domain` if set)
- Category ("hotel" for our use)

### Output XML structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<listings xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="http://www.gstatic.com/localfeed/local_feed.xsd">
  <language>en</language>
  <listing>
    <id>roc-hotel-7a3b9c12</id>
    <name>The Portico Hotel</name>
    <address format="simple">
      <component name="addr1">32 Sussex Gardens</component>
      <component name="city">London</component>
      <component name="province">Greater London</component>
      <component name="postal_code">W2 1UJ</component>
    </address>
    <country>GB</country>
    <latitude>51.5145</latitude>
    <longitude>-0.1733</longitude>
    <phone type="main">+44 20 7402 0190</phone>
    <category>hotel</category>
    <content>
      <attributes>
        <website>https://www.theporticohotel.com</website>
        <client_attr name="alternate_hotel_id">theporticohotel.com</client_attr>
        <client_attr name="rating">9.1</client_attr>
      </attributes>
    </content>
  </listing>
  <!-- repeat per property -->
</listings>
```

### Delivery

- Single zipped XML file: `rockenue_local.xml.zip`
- Compression: STORED or DEFLATED only
- Uncompressed size limit: 100 MB (we'll be miles under)
- Hosted at `feeds.rockenue.tech/google/rockenue_local.xml.zip`
- HTTP BASIC auth (credentials registered in Hotel Center later)
- Google pulls daily once approved

For Sprint 1: ship at a hidden admin route, no auth yet, no zip wrapper. Just emit valid XML. Productionise once Google's involved.

### Validation

```bash
xmllint --schema http://www.gstatic.com/localfeed/local_feed.xsd rockenue_local.xml --noout
```

Should output `rockenue_local.xml validates`.

### Acceptance criteria

- Emits valid XML for all 40 properties
- Validates against `http://www.gstatic.com/localfeed/local_feed.xsd`
- Stable IDs (never reused if a property churns)
- Each `<website>` matches the customer-facing apex domain
- Lat/long present for every property
- Country code is ISO-2

### Where to put it in the codebase

Proposed:

```
src/lib/google-hotels/
├── hotel-list-feed.ts        # generator function
├── types.ts                  # XML node types
└── README.md                 # what this does

src/app/api/google/feeds/
└── hotel-list/route.ts       # serves XML (admin-only for now)
```

---

## 6. Roadmap (after Sprint 1)

| Sprint | Description | Est. eng-days |
|---|---|---|
| 1 | Hotel List XML feed generator | 5 |
| 2 | JSON-LD on `/rooms` pages | 3 |
| 3 | UK VAT inclusion review + rate display audit | 3 |
| 4 | Landing Pages XML + URL routing | 4 |
| 5 | ARI Push pipeline (Property/Rate/Avail/Inv) | 15 |
| 6 | Operational dashboards | 3 |
| 7 | OAuth 2.0 service account + token refresh | 2 |
| 8 | Hotel Center match-status poller | 4 |
| 9 | Submit Connectivity Partner application (parallel) | 0.5 |
| 10 | Certification iteration (with Google) | variable |

Total: ~70-80 engineering days to first hotel live on FBL. **Realistic calendar timeline: 12-24 weeks** (3-6 months) for direct integration including Google's eligibility review and certification. 3-9 weeks if routed to partner.

---

## 7. Documentation (verified live as of May 2026)

### Hotel APIs and Hotel Center

- **Hotel APIs root** — https://developers.google.com/hotels
- **Hotel Prices dev guide** — https://developers.google.com/hotels/hotel-prices
- **Hotel List XML reference** — https://developers.google.com/hotels/hotel-prices/xml-reference/hotel-list-feed
- **ARI overview** — https://developers.google.com/hotels/hotel-prices/xml-reference/ari-overview
- **Transactions XML** — https://developers.google.com/hotels/hotel-prices/xml-reference/transaction-messages
- **Queries and Hints** — https://developers.google.com/hotels/hotel-prices/xml-reference/queries
- **Landing pages syntax** — https://developers.google.com/hotels/hotel-prices/dev-guide/pos-syntax
- **URL substitution variables / conditional URLs** — https://developers.google.com/hotels/hotel-prices/dev-guide/pos-urls
- **API authentication (OAuth 2.0)** — https://developers.google.com/hotels/hotel-prices/dev-guide/api-auth
- **Travel Partner API REST reference** — https://developers.google.com/hotels/hotel-prices/api-reference/rest
- **Lodging proto reference** (optional Base64 amenity blob — skip in v1) — https://developers.google.com/hotels/hotel-content/proto-reference/lodging-proto
- **Hotel Price Structured Data (JSON-LD)** — https://developers.google.com/hotels/hotel-prices/structured-data/hotel-price-structured-data
- **XSD for Hotel List feed validation** — http://www.gstatic.com/localfeed/local_feed.xsd

### Onboarding and policy

- **Connectivity Partner starter (6-step process)** — https://support.google.com/hotelprices/topic/11957396
- **Interest form (Connectivity Partner application)** — https://services.google.com/fb/forms/hoteladsfreebookinglinksinterestformforhotelowners/
- **Approved partner directory** — https://developers.google.com/hotels/connectivity-partners
- **Price Accuracy Policy** — https://support.google.com/hotelprices/answer/6064419
- **Taxes and Fees Policy** — https://support.google.com/hotelprices/answer/6064432
- **Prohibited Practices** — https://support.google.com/hotelprices/answer/10227462
- **Categories for lodging** — https://support.google.com/hotelprices/answer/9970971
- **Property matching troubleshooting** — https://support.google.com/hotelprices/answer/6329692
- **Live on Google status** — https://support.google.com/hotelprices/answer/10981242
- **Price XML Validator** — https://support.google.com/hotelprices/answer/15745253
- **Listing Feed Status** — https://support.google.com/hotelprices/answer/14299750
- **Listing Feed Troubleshooting** — https://support.google.com/hotelprices/answer/15972631
- **Brand support / ALTERNATE-HOTEL-ID macro** — https://support.google.com/hotelprices/answer/9919249
- **Free Booking Links eligibility** — https://support.google.com/hotelprices/answer/10472393
- **Listing requirements** — https://support.google.com/hotelprices/answer/6280644

### Paid Hotel Ads (Phase 2)

- **Google Ads API — Hotel Ads overview** — https://developers.google.com/google-ads/api/docs/hotel-ads/overview
- **Performance Max for travel goals (API)** — https://developers.google.com/google-ads/api/performance-max/travel-goals
- **Travel Feeds in Search Ads** — https://developers.google.com/google-ads/api/docs/hotel-ads/travel-feeds
- **Hotel Ads commission sunset (Feb 20 2025)** — https://support.google.com/google-ads/answer/14280291
- **Performance Max for travel goals (Help)** — https://support.google.com/google-ads/answer/12200336
- **PMax travel goals setup** — https://support.google.com/google-ads/answer/13189989

### Deprecated / do not build against

- Travel Partner API v2.1 (migrated to Google Ads API + Travel Partner API v3)
- "Hotel Ads Center" (renamed Hotel Center)
- Commission (per stay) and Commission (per conversion) bidding (sunset Feb 20, 2025)
- "Pull with Hints" naming (now "Changed Pricing")
- "Point of Sale" naming (renamed "Landing Pages" — the `<PointsOfSale>` XML root retained for backward compatibility)

### Anchor URL

Google reorganises these docs roughly quarterly. If any link 404s, the durable anchor is:

**https://developers.google.com/hotels**

— everything else is reachable from there.

---

## 8. Known gotchas and pitfalls

Surface these early so the AI agent doesn't trip on them mid-build:

1. **Google Business Profile verification is the slowest path-item.** Per-hotel admin work, 14 days for postcard or video verification. Must start in parallel.
2. **NAP (Name, Address, Phone) mismatches** between feed and Google Maps cause "Not matched" → no listing appears. "Ltd" vs "Limited", "St" vs "Street" — Google is unforgiving.
3. **Map overlap** for London hotels sharing an apartment block address requires manual GBP-pin disambiguation tickets.
4. **`<id>` is permanent.** Reusing an ID after a hotel churns is forbidden — generate a new one.
5. **Mass feed changes (>10% delta) auto-block** the entire feed pending manual approval. Roll new hotels in batches of ≤10.
6. **UK 20% VAT must be in price.** Cannot omit. Either all-inclusive Baserate or explicit `<Tax>` element. UK ASA rules also enforce VAT-inclusive display.
7. **Stripe Connect platform fee cannot appear only at checkout.** Decision made: bake into rate. Cloudbeds explicitly warns: hidden checkout fees cause Google to suppress Free Booking Link in US/Canada.
8. **Live on Google status must propagate within minutes** when a hotel leaves the platform. Build the toggle endpoint.
9. **GDPR + Consent Mode v2 + IAB TCF v2.2** required on each tenant domain for paid traffic tracking. Preserve `gclid`/`srsltid` via cookieless ping when consent gate is up.
10. **"Official site" badge requires GBP website = customer-facing apex domain.** Hannah's audit must verify this per hotel.
11. **Live Pricing limited in EEA** post-DMA. ARI Push is mandatory for European traffic — do not rely on pull.
12. **`<Refundable>` declarations must match real cancellation policy** on the booking page. Mismatches trigger accuracy violations.
13. **`<lodging>` Base64 proto is easy to corrupt.** Only emit if rich amenity model is needed. Skip in v1.
14. **40 hotels = small** by Google's standards. Expect eligibility-review pushback.

---

## 9. Fallback plan (Connectivity Partner route)

If Google denies direct integration or routes us to a partner:

**Named candidates** (all in Google's approved directory):

- **Cendyn** (formerly WIHP) — strong UK/London presence; supports CPC, Target ROAS, PMax-T; can manage Hotel Center on our behalf
- **Adchieve** (Netherlands) — explicitly markets "feed-only, partner keeps own booking engine" pattern; 4-6 week onboarding
- **Bookassist** (Dublin) — UK/Ireland focus, boutique-friendly
- **Profitroom** (Polish HQ) — relevant for our Polish entity
- **D-EDGE** — large European CRS+channel manager

**Partnership model to request:** "Feed-only — partner handles price feed and Hotel Center; we keep our booking engine and customer-facing flow."

**Typical commercials (sales-quote-based, no public rate cards):**

- Monthly platform fee €100-500/property/month
- Paid Hotel Ads management ~5-15% of ad spend
- Or per-booking commission ~3-7%
- FBL itself is always free (Google's policy)

**Industry benchmark:** D-EDGE published Jan 2023 study of ~1,000 hotels — average distribution cost for paid Hotel Ads was 8% of revenue; when Free Booking Links factored in at zero distribution cost, blended average dropped to 5.2%.

The technical work we build is the same regardless — Hotel List XML, ARI Push, Landing Pages XML, JSON-LD. Only difference is whose Hotel Center receives the feed.

---

## 10. Notes for the next AI agent

- **Start with Sprint 1.** Hotel List XML feed generator. Smallest, most self-contained. Validates against publicly available XSD. Read `https://developers.google.com/hotels/hotel-prices/xml-reference/hotel-list-feed` first.
- **The 3% platform fee is already baked into the rate** by the hotel when they set their Cloudbeds rates. No code change needed for compliance — but verify with Karol when in doubt that no extra fees are added at checkout.
- **Cloudbeds is the source of truth** for inventory, rates, and extras. Cloudbeds webhooks fire when anything changes. Use existing `syncInventoryForProperty` patterns in `src/lib/cloudbeds/`.
- **Themes don't fork on Google integration.** All themed routes (`/rooms`, `/checkout`, etc.) need JSON-LD; admin and API routes are shared. Build JSON-LD into the shared rendering layer or a HOC, not per theme.
- **Polish sp. z o.o. is brand new** (incorporated 2026-05-19). The application narrative must lead with Rockenue's existing UAE history, Booking.com chain status, and 40 hotel contracts — not with the new Polish entity in isolation.
- **For full IBE architecture and Stripe Connect details**, see `Booking Engine — Blueprint.md` in the repo root. This document focuses solely on the Google integration.

---

*Last updated: 2026-05-19. Updated whenever a binding decision is made or a sprint completes.*
