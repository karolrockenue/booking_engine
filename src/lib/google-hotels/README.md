# google-hotels

Google Hotel Center integration. Full work stream + decisions live in
**`Google Hotel Center — Blueprint.md`** at the repo root — read it first, and
follow the **plan → execute → update** process documented there (§11 Progress log).

## Modules

| File | Sprint | What it does |
|---|---|---|
| `hotel-list-feed.ts` | 1 | `buildHotelListFeed()` → the `<listings>` **identity** feed (properties + content_blocks). Validates vs `local_feed.xsd`. `alternate_hotel_id = slug` (the routing key Landing Pages uses). |
| `hotel-json-ld.ts` | 2 | `buildHotelJsonLd()` → schema.org `Hotel` + `makesOffer` JSON-LD for `/rooms` (price from the shared `computeAvailability`, so it matches the booking page). |
| `landing-pages.ts` | 4 | `buildLandingPagesFeed()` → the `<PointsOfSale>` config with a macro `<URL>` template that deep-links `(ALTERNATE-HOTEL-ID)` → `/<slug>/rooms?checkIn=…`. |
| `ari/transaction.ts` | 5 | Google `<Transaction>` generators: Property Data (rooms; hidden ones excluded) + price `<Result>` (all-inclusive `Baserate`). |
| `ari/oauth.ts` | 5 | Service-account JWT → access-token flow; mock-aware until `GOOGLE_ARI_OAUTH_KEY` is set. |
| `ari/client.ts` | 5 | `postAriMessage()` → POST to `GOOGLE_ARI_ENDPOINT` (default = mock) + log every attempt in `google_ari_messages`. |
| `types.ts` | — | shared node/result types. |

## Routes (all admin-gated; Bearer `ADMIN_TOKEN`)

- `GET /api/google/feeds/hotel-list` — Hotel List XML
- `GET /api/google/feeds/landing-pages` — Landing Pages XML
- `POST /api/google/ari/mock` — stand-in Google ARI endpoint (logs + 200) until allowlisted
- JSON-LD is injected server-side into `src/app/[property]/rooms/page.tsx`

## Status (2026-05-21)

Sprints 1–4 shipped; Sprint 5 **foundation** shipped (Transaction generators +
OAuth + mock loop, verified end-to-end). **Remaining in Sprint 5:** OTA
`OTA_HotelRate/Avail/InvCount` messages, delta/dedup, retry cron,
Cloudbeds-webhook→ARI fire, validation-schema confirmation. Going live = swap
`GOOGLE_ARI_ENDPOINT` / `GOOGLE_PARTNER_ID` / `GOOGLE_ARI_OAUTH_KEY` once Google
allowlists us. See the blueprint §11.

## Validate feeds

```bash
curl -s -o /tmp/local_feed.xsd http://www.gstatic.com/localfeed/local_feed.xsd
xmllint --schema /tmp/local_feed.xsd hotel-list.xml --noout   # → "validates"
xmllint --noout landing.xml                                    # well-formed check
```
