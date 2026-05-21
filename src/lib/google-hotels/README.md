# google-hotels

Google Hotel Center integration. Full work stream + decisions live in
**`Google Hotel Center — Blueprint.md`** at the repo root — read it first, and
follow the plan → execute → update process documented there (§11 Progress log).

## What's here (Sprint 1)

- **`hotel-list-feed.ts`** — `buildHotelListFeed()` emits the Hotel **List** XML
  (`<listings>`) Google pulls to learn which properties exist and match them to
  Google Maps / Business Profiles. Identity only — **not** prices/availability
  (that's the ARI Push pipeline, a later sprint). Reads each `properties` row +
  its `content_blocks` (`contact`, `neighbourhood`).
- **`types.ts`** — node/result types.
- Served (admin-gated) by `src/app/api/google/feeds/hotel-list/route.ts`.

## Field mapping

| Feed element | Source |
|---|---|
| `<id>` | `roc-<properties.id>` (permanent, never reused) |
| `<name>` | `properties.name` |
| `<address>` | `content_blocks.contact.addressLines`, parsed → `addr1` / `city` / `postal_code` |
| `<country>` | trailing 2-letter code in `addressLines`, else `GB` |
| `<latitude>`/`<longitude>` | `content_blocks.neighbourhood.mapLat` / `mapLon` |
| `<phone type="main">` | `content_blocks.contact.reservationsPhone` |
| `<website>` + `client_attr alternate_hotel_id` | `properties.domain` (omitted when null) |

A hotel with neither phone nor lat/long is skipped (Google requires one).
Per-property data gaps come back in `HotelListFeedResult.warnings` and the
route's `X-Feed-*` headers.

## Validate

```bash
# generate to a file (write a small tsx that calls buildHotelListFeed), then:
curl -s -o /tmp/local_feed.xsd http://www.gstatic.com/localfeed/local_feed.xsd
xmllint --schema /tmp/local_feed.xsd hotel-list.xml --noout   # → "validates"
```

## Known limitations (Sprint 1)

- Address parsing is heuristic (UK-focused). Structured per-field address
  columns are a future improvement.
- `<website>` requires `properties.domain`; until per-hotel domains are wired,
  listings emit without it (won't match/badge on Google yet).
- No zip wrapper / HTTP BASIC auth yet — that's productionising before Google
  actually pulls the feed.
