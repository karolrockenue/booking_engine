# Themes — Portico Ivory (working draft)

> **Status: testing phase, not set in stone.** Most of what's described below is the current state of the Portico Ivory theme as of 2026-05-06. Copy, photography, OTA price multipliers, layout decisions, and the rate-plan note mapping are all live but expected to change as we collect feedback. The architecture (env-var-per-deployment, file layout, headless booking hooks underneath) is intended to be stable.

The booking engine ships **one codebase, many designs**. The look/layout of the public-facing flow (`/`, `/rooms`, `/book`, `/extras`, `/checkout`, `/confirmation`) is selected per Railway service via the `THEME` env var. Backend, database, Cloudbeds, Stripe, and email are identical across every deployment.

| `THEME`           | Design                                  | Status     |
|-------------------|-----------------------------------------|------------|
| `default` (unset) | Original live design                    | shipped    |
| `portico-ivory`   | The Portico Hotel — Editorial Ivory     | testing    |

The Portico components are token-driven (`src/themes/portico/tokens.ts`), so adding a future palette variant is a token-only change. A previous `portico-dark` variant was prototyped and dropped — see git history if needed.

## Per-deployment setup on Railway

For each new design link:

1. **Create a new Railway service** (or add the env var to an existing one) pointing at the same GitHub repo.
2. **Reuse all existing env vars** from your live service — `DATABASE_URL`, `CLOUDBEDS_*`, `STRIPE_*`, `SENDGRID_*`, etc. Same backend, same data.
3. **Add one extra env var**:
   ```
   THEME=portico-ivory
   ```
4. **Map a domain** (Railway-provided `*.up.railway.app` is fine for testing).
5. **Set `properties.domain`** for the property you want this URL to resolve to. `resolveProperty()` matches by domain first.
6. Deploy. Admin/internal routes (`/admin`, `/bars`, `/compare*`, `/pickers`, `/rates`, `/rooms-mockup`, `/enhance`, `/fonts`) remain identical across every deployment — they don't fork on theme.

The active theme is read at request time from `process.env.THEME` (see `src/lib/active-theme.ts`). Restart the Railway service after changing it.

## Local preview — flipping themes without restarting

Run `npm run dev` once. Visit `http://localhost:3000/dev/themes` and pick a theme — it sets a session cookie and reloads the homepage in that design. Every Portico screen also has a small floating badge in the bottom-right that links back to `/dev/themes`. Cookie persists for 30 days; clear with the link on `/dev/themes` or by deleting cookies for `localhost`.

The dev cookie has **no effect in production**: on Railway the env var is the only source of truth, so accidentally setting the cookie in a deployed build does nothing.

## Property resolution

`src/lib/get-property.ts` resolves which property the public flow renders against. Order:

1. `?property=<slug>` query param (set by the proxy via `x-property-slug` header) — useful for forcing a property in dev or testing.
2. `properties.domain` exact match against the request `Host`.
3. `properties.slug` match against the host's domain part.
4. **Fallback**: first property with `cloudbedsPropertyId` set (preferred — bookings actually work).
5. **Final fallback**: any property at all (covers fresh DBs).

So in a multi-property setup, set `domain` per environment to control which property each Railway service serves. Localhost dev typically falls through to step 4 — i.e., picks the Cloudbeds-connected property automatically.

## What's themed vs. shared

**Themed (changes per deployment):**
- Public marketing & booking flow: `/`, `/rooms`, `/book`, `/extras`, `/checkout`, `/confirmation`
- Photography in `public/portico/*.jpg`
- Logo PNGs in `public/portico/portico-logo*.png`

**Shared (identical across every deployment):**
- All API routes (`src/app/api/*`)
- Database schema, Cloudbeds sync, Stripe Connect, webhooks, email
- Headless booking hooks (`useAvailability`, `useBookingDraft`, `useExtras`, `usePersistedDraft`, `submitBooking`)
- Admin dashboard (`/admin`)
- Internal/dev routes (`/bars`, `/compare`, `/compare-live`, `/pickers`, `/rates`, `/rooms-mockup`, `/enhance`, `/fonts`)

## Portico Ivory — flow walk-through

| Path | Component | What you see |
|------|-----------|--------------|
| `/` | `screens/Home.tsx` | Long scrollable page: hero (full-bleed photo + headline + scroll cue) → 01 Neighbourhood (drawing-room photo + Carto Positron map, 50/50 vertical split) → 02 Inside (editorial gallery + lightbox) → 03 Good to know (check-in/out/wifi/etc) → cinematic dark footer with contact + fine print. |
| `/book` | `screens/Dates.tsx` | Step 01. Two-pane: wardrobe-doors photo left, calendar + guest steppers right. Compact stepper on mobile. |
| `/rooms?checkIn=&checkOut=&adults=&children=` | `screens/RoomSelect.tsx` | Step 02. Each room block: 460px gallery (1 hero + 5 thumbnails, prev/next chevrons) on the left, room name + Sleeps pill + rate-plan ladder + "Best rate guaranteed" OTA strip on the right. Sticky basket appears when a rate is selected. |
| `/extras` | `screens/Extras.tsx` | Step 03. Two-pane: phone photo left ("Curate your stay · Small touches. Lasting *memories*."), Cloudbeds extras list with tick-boxes + special-requests textarea right. |
| `/checkout` | `screens/Checkout.tsx` | Step 04. Two-pane: form left (guest details + Stripe Element themed to Portico — ivory wrapper, white inputs), cinematic dark summary panel right with selected room + extras + total + "Confirm booking" CTA. |
| `/confirmation?orderId=` | `screens/Confirmation.tsx` | Cinematic hero strip ("*Reserved.* / We have you for X nights.") + reference + summary rows + "Return home" CTA. |

## Customization points (likely to change)

These all live in code today and are the most obvious knobs:

### Photography
`public/portico/*.jpg`. Web-resized originals (≤500 KB each). Pulled in via `porticoImg` in `src/themes/portico/tokens.ts`. Per-room galleries are mocked from this same pool — see `ROOM_GALLERY_SETS` in `src/themes/portico/screens/RoomSelect.tsx`. Replace with actual per-room photography when available.

### Logo
`public/portico/portico-logo.png` (dark ink, light surfaces) and `portico-logo-white.png` (light ink, dark surfaces). Transparent backgrounds. SVG with `currentColor` would be cleaner — open follow-up.

### Mock copy
Hardcoded in `src/themes/portico/screens/Home.tsx` (and a couple of other screens):
- Hero headline, press quote ("Conde Nast Traveller")
- Neighbourhood "behind a Paddington portico…" + nearby places
- Good to know rows (check-in 4pm, etc.)
- Footer fine-print links (Terms, Privacy, etc — `href="#"`)
- Footer social links (Instagram, Journal, Newsletter — `href="#"`)
- Contact: address `32 Sussex Gardens, Paddington, London W2 1UJ`, phone `+44 20 7402 0190`, emails `stay@theporticohotel.com` / `hello@theporticohotel.com`
- Property name `The Portico Hotel` shows on Portico-themed pages even when the connected Cloudbeds property is the rockenue demo (`The Kensington Arms`)

### OTA price comparison
`src/themes/portico/screens/RoomSelect.tsx` — `OTA_MARKUP` constant. Currently mocks Booking.com / Expedia / Hotels.com prices as multipliers of the cheapest direct rate (1.12 / 1.09 / 1.10). When a real rate-shopping integration lands (OTA Insight, RateGain, RateShop, etc.), swap these for live values. The "Best rate guaranteed — direct only" strip uses plain prices, no strikethroughs.

### Rate plan supporting notes
`src/lib/booking/rate-plan-notes.ts`. Pattern-based mapping from rate plan name → note shown under the rate name on `/rooms`. First match wins. Current patterns cover `breakfast`, `member/loyalty/portico saver`, `early bird/advance purchase`, `non-refundable`, `flexible/refundable/best available`. Falls back to a refundable / non-refundable default based on the rate plan's `isRefundable` flag.

To add a mapping: append a `{ test: /pattern/i, note: "…" }` to `PATTERNS` (specific patterns first, broader patterns last).

### Stripe Element appearance
`src/themes/portico/stripe-appearance.ts`. Ivory wrapper (`t.bg`), white input fields, hairline borders, terracotta focus rings, all-caps spaced labels. Stripe Element mounts eagerly on `/checkout` (no email gate) — the setup-intent API was loosened to accept optional `guestEmail` (`src/app/api/stripe/setup-intent/route.ts`). Email backfills via `submitBooking` at confirm time.

### Cinematic dark surface
The dark teal `#15252a` (`tokens.ts → summaryBg`) is reused in three places: the checkout summary panel, the sticky basket bar across `/rooms` and `/extras`, and the homepage footer. Picking a different colour means changing `summaryBg`/`summaryInk`/`summaryRule` in one file.

### Map
`src/themes/portico/components/Map.tsx`. Carto Positron tiles via Leaflet (free for non-commercial; attribution rendered automatically). Scroll-wheel zoom disabled to avoid trapping users on the long page. To swap to a darker/different style: change the tile URL — see `public/mockups/portico-map-concepts.html` for the alternatives we considered.

### Calendar
`src/themes/portico/components/Calendar.tsx`. Custom range-picker — Mon-start grid, hover tints, in-range fill in `accentSoft`, edge cells in `accent`. Past dates disabled. Lives apart from the booking-flow logic; replace if you want `react-day-picker` styling instead.

## Mockup pages

These standalone HTML pages live in `public/mockups/` and are visible at `/mockups/<file>` on any deployment. Used for picking design directions and showing options to stakeholders. They're decision tools, not part of the live flow:

| Path | Purpose |
|------|---------|
| `/mockups/portico-extras-concepts.html` | 5 concepts for displaying add-ons |
| `/mockups/portico-map-concepts.html` | 5 map style concepts |
| `/mockups/portico-footer-colors.html` | 5 footer colour options |
| `/mockups/portico-roomselect-concepts.html` | 4 rate-plan layouts |
| `/mockups/portico-roomblock-layout.html` | 5 room-block layouts (chose 05) |

## Open follow-ups

Things noted during the build that are deliberately deferred:

- **Real OTA rates.** The `OTA_MARKUP` mock should be replaced with live data (OTA Insight, RateGain, etc.) before the page is shown to actual guests.
- **Per-room photography.** Currently the same six Portico photos are rotated across every room block in different orders. Real galleries should be associated with each room type (probably keyed off `roomTypes.id` or pulled from a populated `roomTypes.images` field).
- **SVG logo.** The current PNGs work but an SVG with `currentColor` paths would be cleaner — same logo on any background, any tint.
- **Booking confirmation email.** Currently uses the default-theme template. Out of scope for the Ivory theme today (shared pipeline).
- **Stripe Customer email backfill.** Eager mount means we sometimes create a Stripe Customer without an email. The booking record has the email, but the Stripe Customer doesn't get it patched in. Minor data hygiene; adds a 2-line update call in `submitBooking`.
- **Rate-plan supporting notes via DB.** Currently a name-pattern config; could be promoted to a per-rate-plan column on `ratePlans` with admin UI editing if hand-crafted notes per plan become important.
- **Smoke test through real Cloudbeds + Stripe.** End-to-end booking has not been driven by a real card on the Portico flow yet.
- **Mobile fine-tuning.** Did a responsive sweep + overflow guards, but specific layouts at edge viewports (320px, very tall iPhones) haven't been audited on real devices.

## File structure

```
src/themes/portico/
├── PorticoShell.tsx                   # font scope + page bg + dev badge
├── index.ts                           # barrel + activePorticoTokens()
├── tokens.ts                          # colors, photo paths, layout tokens
├── fonts.ts                           # Cormorant Garamond + Inter via next/font
├── stripe-appearance.ts               # Stripe Element appearance config
├── components/
│   ├── Calendar.tsx                   # range date picker
│   ├── Gallery.tsx                    # editorial gallery + lightbox (used on home)
│   ├── Logo.tsx                       # wordmark PNG renderer
│   ├── Map.tsx                        # Leaflet + Carto Positron
│   ├── Nav.tsx                        # top nav + mobile hamburger + booking nav + stepper
│   ├── primitives.tsx                 # Btn, Pill, Field, Input, Eyebrow
│   ├── RoomGallery.tsx                # per-room hero + thumbnails (with arrows)
│   ├── StickyBar.tsx                  # selection basket on /rooms and /extras
│   └── Wordmark.tsx                   # placeholder SVG (unused since real PNG arrived)
└── screens/
    ├── Home.tsx                       # long scroll homepage + footer
    ├── RoomsIndex.tsx                 # /rooms (no params) — marketing index
    ├── Dates.tsx                      # /book — Step 01
    ├── RoomSelect.tsx                 # /rooms?checkIn=… — Step 02
    ├── Extras.tsx                     # /extras — Step 03
    ├── Checkout.tsx                   # /checkout — Step 04
    └── Confirmation.tsx               # /confirmation — done
```
