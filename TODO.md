# Build Plan

A sequenced plan to take the booking engine to launch-ready (Cloudbeds REST API, Stripe Connect, Flex auto-charge, per-hotel bespoke front-ends).

Earlier steps are concrete because the work is well-scoped. Later steps are looser because the design will be informed by what we learn earlier (especially the sandbox smoke-test in Step 5 and the Stripe Connect setup in Phase 3). Tighten them up as we go.

**Phase status (2026-05-07):**

| Phase | Steps | Status |
|---|---|---|
| 1. Foundation | 1, 2, 3 | ✅ Done |
| 2. Cloudbeds REST API | 4, 5, 6, 7 | ✅ Done |
| 2.5 Per-hotel front-end architecture | Headless hooks, sessionStorage drafts | ✅ Hooks done; `src/hotels/<slug>/` scaffold pending |
| 3. Stripe Connect | 8, 9, 10 | ✅ Done — UAE sandbox platform, Standard accounts, Stripe Elements working end-to-end (test card `4242…`) |
| 4. Booking flow rewrite | 11, 12 | ✅ Done — postReservation/postCustomItem/postPayment + confirmation page polish + SendGrid email all live |
| 5. Flex auto-charge | 13, 14, 15 | ⛔ Not started |
| 6. Cancellation + launch hardening | 16, 17 | 🟡 Quick wins shipped earlier; availability perf A+B shipped 2026-05-04; R2 image hosting shipped 2026-05-07 (Phase 6.5); domains / JSON-LD / `next/font` still TODO |
| 6.5 Admin v3 + R2 + Content CMS | shipped 2026-05-07 | ✅ Done — Linear-style sidebar shell, all 9 hotel tabs (Overview, Bookings, Content, Photos, Rates, Cloudbeds, Stripe, Domain, Alerts), Cloudflare R2 + sharp variants, content blocks → Portico Home wired |
| 6.6 Cloudbeds metadata auto-sync | shipped 2026-05-08 | ✅ Done — `/getHotelDetails` fields flow into content blocks (address, phones, email, lat/lon, check-in/out) and `properties` (name, currency, timezone); read-only Rooms section in content admin |
| 7. Post-launch features | WhatsApp · Welcome Pickups · GEO/AI content · Corporate portal · Tiqets · Guest accounts | 🟡 Scoping — see Phase 7 section |

---

## Before you start

- Manuel's email (2026-04-24) confirmed REST API path. No further green light needed.
- Cloudbeds has TWO API surfaces and we use both:
    - **v1.3 (legacy, action-style)** at `https://hotels.cloudbeds.com/api/v1.3` — `getRatePlans`, `getReservations`, `postReservation`, `postCustomItem`, `postPayment`, `postWebhook`. `propertyID` goes in the query string. Response is `{ success, data, ... }`.
    - **New modular API** at `https://api.cloudbeds.com` — REST paths like `/addons/v1/addons`. `propertyId` goes in the `x-property-id` header. Response is `{ offset, limit, data }`. Prices are returned as strings in **minor units** (e.g. `"1500"` = £15.00) — divide by 100 when displaying.
    - Both share one OAuth flow + one set of tokens. Just request the union of scopes.
- Next.js docs: per `AGENTS.md`, this is Next.js 16 with breaking changes from prior versions. Check `node_modules/next/dist/docs/` before writing route handlers, middleware, or server actions.

---

## Phase 1 — Foundation

### Step 1: Git setup + commit current state

Goal: get every existing file under version control and pushed to a remote before we start changing things.

1. Create a new private GitHub repo (`rockenue/booking-engine` or similar).
2. Stage everything currently uncommitted (`git status` shows ~30 files dirty + several untracked dev folders under `src/app/`).
3. Commit in two passes for cleanliness:
   - First commit: untracked dev mockup pages (`src/app/bars`, `compare`, `compare-live`, `enhance`, `pickers`, `rates`, `rooms-mockup`) + their dev-only components in `src/components/booking/BookingBar*.tsx`, `BookingProgress.tsx`, `ExtrasPanel.tsx`, `PriceCompare.tsx`, `StickyBookingBar.tsx`, `src/components/ui/`. Plus `public/hero-room.jpg`, `public/hotel/`, `src/app/fonts/`, `src/scripts/seed-rate-plans.ts`, `src/scripts/update-font.ts`.
   - Second commit: modifications to existing files (the booking flow, layout, nav, build plan, etc.).
4. Add the remote, push `main`.
5. Connect Railway to the repo so future deploys are auto-triggered.

Deliverable: GitHub repo with full history, Railway auto-deploying on push to `main`.

### Step 2: Delete B2U code

Goal: remove dead code paths that read DB fields about to be dropped in Step 3, so the migration is safe.

Files to delete:
- `src/app/api/b2u/ari-update/route.ts`
- `src/app/api/b2u/get-booking-id/route.ts`
- `src/app/api/b2u/get-booking-list/route.ts`
- `src/app/api/b2u/get-rate-plans/route.ts`
- `src/app/api/b2u/get-room-types/route.ts`
- `src/app/api/b2u/health-check/route.ts`
- `src/app/api/b2u/setup-property/route.ts`
- `src/lib/b2u-auth.ts`

Other:
- Remove `B2U_SHARED_SECRET` from Railway env vars.
- Grep for any stragglers (`b2u`, `B2U`, `mya_`, `myaStatus`, `myaResponse`, `myaPropertyId`, `otaPropertyId`, `hotelKey`, `ari-update`) and clear them.
- The mock payment "TODO: Call Cloudbeds BookingCreate" stub in `src/app/api/bookings/route.ts:140-145` stays for now (Step 11 replaces it).

Verify: `npm run build` passes; dev server starts; `/api/availability` still works (it never depended on B2U).

### Step 3: Schema migration

Goal: one Drizzle migration that drops B2U fields, adds Cloudbeds + Stripe fields, and creates the two new tables. Existing bookings are test data — destructive migration is fine.

Edit `src/db/schema.ts`:

**`properties`**
- Drop: `myaPropertyId`, `otaPropertyId`, `hotelKey`.
- Add: `cloudbedsPropertyId` (text), `cloudbedsAccessToken` (text, encrypted at app layer — see Step 4), `cloudbedsRefreshToken` (text, encrypted), `cloudbedsTokenExpiresAt` (timestamp with tz), `stripeAccountId` (text), `stripeAccountCurrency` (text — pulled from Stripe at onboarding), `stripeAccountStatus` (text: `pending` | `active` | `restricted`), `platformFeePercent` (decimal(5,2), default `3.00`), `payoutSchedule` (text, default `weekly`).

**`ratePlans`**
- Add: `cancellationPolicy` (jsonb), `isRefundable` (boolean, default `true`).

**`bookings`**
- Drop: `myaStatus`, `myaResponse`, `totalPrice`.
- Add: `cloudbedsReservationId` (text), `stripeSetupIntentId` (text), `stripePaymentMethodId` (text), `stripeCustomerId` (text), `chargeAt` (timestamp with tz, null until known), `cancellationPolicySnapshot` (jsonb), `rateType` (text: `flex` | `nr`), `status` (text — see lifecycle below).
- Add price breakdown columns (all decimal(10,2)): `roomTotal`, `extrasTotal`, `taxesTotal`, `applicationFee`, `grandTotal`.

Booking `status` lifecycle (not strictly sequential — pms_synced and paid can occur in either order in the Flex flow):
- `pending` — created, no money or PMS yet
- `payment_authorized` — Flex SetupIntent saved, no charge yet
- `paid` — PaymentIntent succeeded (NR at checkout, or Flex at cutoff)
- `pms_synced` — `postReservation` succeeded (Cloudbeds reservation exists)
- `failed` — terminal; auto-charge gave up after 24h grace, or Stripe declined and we couldn't recover
- `cancelled` — guest self-cancelled or auto-cancelled after failure

**New `bookingExtras` table**
- Columns: `id` (uuid), `bookingId` (uuid → `bookings.id`), `cloudbedsItemId` (text), `name` (text), `qty` (integer), `unitPrice` (decimal(10,2)), `totalPrice` (decimal(10,2)), `currency` (text).

**New `paymentEvents` table**
- Columns: `id` (uuid), `bookingId` (uuid → `bookings.id`), `type` (text: `payment_intent_created` | `payment_intent_succeeded` | `payment_intent_failed` | `setup_intent_created` | `setup_intent_succeeded` | `auto_charge_attempt` | `auto_charge_succeeded` | `auto_charge_failed` | `refund` | `payment_method_detached`), `stripeId` (text), `amount` (decimal(10,2), nullable), `currency` (text, nullable), `status` (text), `errorCode` (text, nullable), `errorMessage` (text, nullable), `payload` (jsonb — raw Stripe object for audit), `createdAt` (timestamp with tz, default `NOW()`).

Push the schema:
```bash
npx drizzle-kit push
```

Re-seed the test properties (`src/scripts/seed.ts`, `seed-second.ts`, `seed-rate-plans.ts`) so `bookings`, `properties`, `ratePlans` reflect the new shape.

Deliverable: schema applied to Neon, types regenerated, app still builds. Existing `availability` route should compile against the new schema with no behavioural change (it only reads `inventory`, `roomTypes`, `ratePlans` — none of those are destructively changed).

---

## Phase 2 — Cloudbeds REST API integration

### Step 4: OAuth2 flow + token storage

Goal: per-property OAuth tokens stored encrypted, refresh handled silently, ready for any subsequent Cloudbeds call.

1. Add env vars on Railway: `CLOUDBEDS_CLIENT_ID` (`rockenue_be_cRtJg7K1HSUyBeYkbFLVhDMz`), `CLOUDBEDS_CLIENT_SECRET`, `CLOUDBEDS_REDIRECT_URI` (e.g. `https://booking-engine-production-b11b.up.railway.app/api/cloudbeds/oauth/callback`), and `CLOUDBEDS_TOKEN_KEY` (32-byte base64 — used for AES-256-GCM at-rest encryption of access/refresh tokens).
2. Add a small encryption helper at `src/lib/crypto.ts`: `encrypt(plaintext)` / `decrypt(ciphertext)` using `node:crypto`'s `createCipheriv("aes-256-gcm", ...)` with the key from `CLOUDBEDS_TOKEN_KEY`. Store output as `iv:tag:ciphertext` base64.
3. Add a Cloudbeds client at `src/lib/cloudbeds/client.ts`:
   - `getValidAccessToken(propertyId)` → reads encrypted token from DB, decrypts, refreshes via `POST /api/v1.3/access_token` if `cloudbedsTokenExpiresAt` is within 60 seconds of now, persists the new tokens, returns the access token.
   - `cloudbeds(propertyId, path, opts)` thin wrapper that injects the auth header and parses errors.
4. Add OAuth routes:
   - `src/app/api/cloudbeds/oauth/start/route.ts` — admin-only, takes `?propertyId=…`, redirects to Cloudbeds authorize URL with `state` set to a signed JWT containing the property ID (so the callback can verify intent).
   - `src/app/api/cloudbeds/oauth/callback/route.ts` — verifies `state`, exchanges code for tokens, encrypts and stores on the property, redirects back to `/admin/properties/[id]` with a success flag.
5. Add an admin-UI button on the property edit page: "Connect to Cloudbeds" → kicks off the OAuth flow. Show status (connected / disconnected / token expires at).

Deliverable: webmaster can click "Connect to Cloudbeds" in admin, complete OAuth, and the property has working tokens. `cloudbeds(propertyId, "/getHotelDetails")` returns the hotel info as a smoke-test endpoint.

### Step 5: Sandbox smoke-test — done

Read-only smoke test script lives at `src/scripts/cloudbeds-smoke.ts`; raw responses save to `tmp/cloudbeds-smoke/` (gitignored). Run with:

```bash
set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-smoke.ts demo
```

**Working as expected:**
- OAuth + token refresh.
- `getHotels` → `propertyID` for subsequent calls.
- `getHotelDetails`, `getRoomTypes`, `getRooms`, `getTaxesAndFees`, `getReservations` (returns `thirdPartyIdentifier` ✓), `getWebhooks` (subscription list — empty until we subscribe).
- `getRatePlans` with `startDate` + `endDate` and `detailedRates: true` returns `rateID`, `roomTypeID`, daily pricing, and per-date restrictions (`minLos`, `maxLos`, `closedToArrival`, `closedToDeparture`, `cutOff`).
- `/addons/v1/addons` on the new API host (with `x-property-id` header and `read:addon` scope) returns the property's add-on catalog. Price is a string in minor units (`"1000"` = $10.00); the `currencyCode` may not match the property's currency in the partner test account.

**Resolved questions** (folded into Steps 6 / 7 below):

- *Cancellation policy / `isRefundable`* — REST API does not expose this. Probed `/getRatePlanDetails`, `/getCancellationPolicies`, `/getCancellationPolicy`, `/getPolicies` — all 404. Even with rate plans named "Direct Rate - 72h cancelation" configured in CB, no policy fields come through `getRatePlans`. **Path:** configure these in our admin UI per rate plan; snapshot to `bookings.cancellationPolicySnapshot` at booking time. (See Step 6 for the seed heuristic.)
- *Items vs addons* — v1.3 `getItems` / `getItemCategories` are dead-ends for our use case (require POS scopes that aren't part of the public partner integration). Use `GET /addons/v1/addons` on the new API host for the read-only catalog. We still call v1.3 `postCustomItem` to attach extras to a reservation in Step 11 — but that needs `read:reservation`/`write:reservation` (which we have), not an item-specific scope.
- *`ratePlanAddOns`* — empty in our test data; deprioritised. If it turns out to be the right home for rate-bundled extras (e.g. "this rate includes breakfast"), revisit during Step 7.

**Webhook security model — confirmed by reading the official Cloudbeds webhook docs:**

Cloudbeds **does not sign webhooks**. There is no signature header, no HMAC, no shared secret. The official docs cover payload format, retries, the 2-second processing budget, and event reference — and never mention signing. Security therefore comes from:

- **URL obscurity** — current path is `/api/cloudbeds/webhooks`. Could be moved to `/api/cloudbeds/webhooks/<random-token>` for stronger obscurity if we ever feel exposed.
- **Property-ID cross-check** — every payload contains `propertyID` (or `propertyId` — Cloudbeds spells it both ways across events; our handler accepts either). We look it up against the `properties` table and ignore unknown properties.
- **IP allowlisting (optional, future)** — confirmed source IP `35.93.165.6` from a real inbound delivery. Cloudbeds may publish a list of webhook source IPs.
- **Idempotent sync** — Cloudbeds notes events are at-least-once delivered. Our `syncInventoryForProperty` is idempotent so replays are no-ops.

**Deferred — needs a sandbox / proper test setup:** `postReservation`, `postCustomItem`, `postPayment` write tests.

### Step 6: Inventory sync — DONE 🟢

Confirmed working end-to-end in production (2026-04-29).

**Shipped:**

- `src/lib/cloudbeds/sync-inventory.ts` → `syncInventoryForProperty(propertyId, days = 90)` and `syncInventoryForAllConnectedProperties(days)`.
    - Pulls `getRoomTypes` + `getRatePlans` (with `detailedRates: true`) and flattens into our `roomTypes`, `ratePlans`, `inventory` tables. Master rates (`isDerived: false`, no `ratePlanID`) get a synthesised name like `"Double Room Standard"`. Derived rates use `ratePlanNamePrivate` if present.
    - **`isRefundable` heuristic:** seeded `false` if `ratePlanNamePublic` matches `/non[- ]?ref/i`, otherwise `true`. **Sync only seeds on insert; updates do not clobber `isRefundable` or `cancellationPolicy`.** Admin UI overrides take precedence forever after.
    - **Bulk upsert per rate plan** (`db.insert(...).values(arrayOfRows).onConflictDoUpdate(...)` with `excluded.column_name` references). 90 days × 8 rate plans = 720 rows synced in ~3 seconds.
    - Idempotent: re-running adds zero rows. Backfills `cloudbedsPropertyId` on the property if it's missing (covers properties OAuth'd before that field was persisted).
- `src/app/api/cloudbeds/webhooks/route.ts` — receives webhooks, returns 200 in <600ms (well under the 2-second Cloudbeds budget), fires `void syncInventoryForProperty(...)` background. Handles 10 events (see file). Accepts both `propertyID` and `propertyId` field names since Cloudbeds spells it both ways.
- `src/app/api/availability/route.ts` cold-start path: if a connected property has no inventory rows in the requested window, runs the sync synchronously before computing availability.
- `src/app/api/cron/inventory-sync/route.ts` — Bearer-token-protected (`CRON_SECRET`) endpoint that runs the full sweep.
- `src/app/api/cloudbeds/oauth/callback/route.ts` now (a) persists `cloudbedsPropertyId` after token exchange and (b) auto-calls `subscribeWebhooksForProperty(...)` fire-and-forget so newly connected properties immediately receive events.
- `src/lib/cloudbeds/webhook-subscriptions.ts` → `subscribeWebhooksForProperty` and `unsubscribeWebhooksForProperty`. Persists subscription IDs in the new `cloudbeds_webhook_subscriptions` table so we can `deleteWebhook` later. Idempotent (skips already-subscribed events).
- New table: `cloudbeds_webhook_subscriptions` with unique index on (`propertyId`, `object`, `action`).
- Railway cron service `inspiring-trust` runs `0 */6 * * *` UTC against `/api/cron/inventory-sync`. Image `alpine:latest`, start command installs curl on each run. See build plan for full config.

**Verified live:**

- Demo property: 3 room types, 8 rate plans, 720 inventory rows, all from Cloudbeds.
- Real Cloudbeds webhook landed (`User-Agent: CloudBeds-Webhooks/4.0.0`, `srcIp: 35.93.165.6`), handler returned 200 in 591ms, sync ran 4s later. End-to-end loop confirmed.

**Carry-forward / known limitations:**

- **Stale-row cleanup pass on sync.** If a hotel deletes a rate plan or room type in Cloudbeds, our DB still holds it — sync only upserts, doesn't delete missing rows. Karol's reasoning was that this is mostly invisible because availability filters on positive `unitsAvailable`, and CB's `getRatePlans` only returns active rates so stale rows never get fresh inventory. True in steady state. But for hygiene, future work: at the end of `syncInventoryForProperty`, identify rate plans that exist in our DB for the property but weren't seen in this Cloudbeds response and delete them (cascade to inventory, block on bookings as `cleanup-demo-seed.ts` does). *(Note: `syncExtrasForProperty` already does this for the addon catalog — use that as the pattern.)*
- **`roomblock/created` / `roomblock/removed` webhooks — abandoned for now.** Added `read:roomBlock` to `SCOPES`, re-OAuth completed (consent screen skipped because previous scopes already granted; new scope checked in URL = `read%3AroomBlock` present), but `postWebhook` still returned `"Scope required for this call was not granted by property."` Same wording as the original `getItems` failure, but unlike that one (which `read:addon` resolved cleanly), this didn't unblock. Likely a property-feature gate on the partner test account, or Cloudbeds silently dropping an unrecognised scope. Reverted both `SCOPES` and `SUBSCRIBED_EVENTS` to remove the dead entries. Room blocks are OOO/maintenance only; `getRatePlans` already reflects what's saleable so we don't lose anything. Revisit if a real hotel relies on room blocks and the 6h cron window causes noticeable staleness.
- ~~**Webhook URL hardening**~~ — DONE 2026-04-29. Webhook handler is now at `/api/cloudbeds/webhooks/[token]` with `CLOUDBEDS_WEBHOOK_TOKEN` env var; mismatch returns 404. Token compared with `timingSafeEqual`. Live subscriptions rotated via `cloudbeds-rotate-webhooks.ts`. Note for future: Cloudbeds' `deleteWebhook` requires the full triple (`subscriptionID` + `endpointUrl` + `object` + `action`) — undocumented but enforced.
- **Cancellation policy admin UI** — schema fields are populated by heuristic only. Until Karol builds a small editor on the property edit page (per-rate-plan `isRefundable` toggle + `{deadlineHours, penaltyType}` JSONB), the heuristic's output is what guests will see. Karol asked for "something basic, single admin only" — low-priority polish.

### Step 7: Extras catalog sync — DONE 🟢

Confirmed working end-to-end in production (2026-04-29).

**Shipped:**

- New `propertyExtras` table per property: `id`, `propertyId`, `cloudbedsAddonId`, `cloudbedsProductId`, `name`, `description`, `priceMinorUnits`, `currency`, `lastSyncedAt`. Unique on (`propertyId`, `cloudbedsAddonId`); indexed on `propertyId`.
- `src/lib/cloudbeds/sync-extras.ts` → `syncExtrasForProperty(propertyId)` pages `https://api.cloudbeds.com/addons/v1/addons` (different host from v1.3, uses `x-property-id` header), upserts on (`propertyId`, `cloudbedsAddonId`), and **hard-deletes** rows whose `cloudbedsAddonId` no longer appears in CB. Called at the end of `syncInventoryForProperty` and as cold-start from the new `/api/extras` route.
- `GET /api/extras?propertyId=…` returns `{ extras: [{ id, name, description, priceMinorUnits, currency }] }`. DB read wrapped in `unstable_cache` keyed by `propertyId`, `revalidate: 60`. Cold-start sync runs synchronously if the property is OAuth'd but `propertyExtras` is empty.
- `ExtrasPanel.tsx` no longer has `AVAILABLE_EXTRAS` or `priceType: per_stay/per_night`. Cloudbeds returns flat-priced addons in **minor units** (string, divide by 100). The panel takes `extras` as a prop and renders prices via the property's currency formatter. The `image` field is gone — addons don't carry images.
- `StickyBookingBar.tsx` takes `extras` as a prop instead of importing the constant.
- `rooms-client.tsx` fetches extras via the headless `useExtras(propertyId)` hook.

**Verified live:**

- Demo property: 1 extra in `property_extras` ("Continental Breakfast" addon ID 234169, $10.00 / 1000 minor units, USD per CB partner test account).
- Cron sync now reports `extrasUpserted` / `extrasDeleted` totals.

**Carry-forward:**

- CB returns USD on the partner test account even though the property currency is GBP. The booking flow uses the **property's** `currency` field at charge time (per spec), not the addon's. When connecting a real hotel, expect their addons' currency to match their property currency in nearly all cases — but don't trust it.

---

## Phase 2.5 — Per-hotel front-end architecture

Karol manages ~40 independent hotels (luxury → near-hostel). They are not a chain. Each must read as its own brand to a guest. Some may share a design (~20 of 40 expected to use one of a small number of shared designs); the rest are fully bespoke.

**Design pipeline:**
1. Karol designs a hotel website in Claude Design (visual references, full layouts).
2. Replicates it in Claude Code as a 4-step static HTML mockup (`/`, `/rooms`, `/checkout`, `/confirmation`). Mock-only but pixel-perfect.
3. Hotel owner signs off.
4. Mockup is ported to React: each hotel slug gets a directory under `src/hotels/<slug>/` with `Home.tsx`, `Rooms.tsx`, `Checkout.tsx`, `Confirmation.tsx`. Pages either implement bespoke or re-render a shared template at `src/hotels/_templates/<name>/`.
5. Per-hotel components consume the booking flow's data + state via the headless hooks library. JSX + CSS are bespoke; logic is shared.

### Headless booking hooks (`src/lib/booking/`) — DONE 🟢

Shipped 2026-04-29. Extract data + state + side effects so per-hotel page components own only presentation.

- `types.ts` — canonical `AvailabilityResult`, `Extra`, `BookingDraft`, `GuestDetails`, `NightlyRate`, `PersistedBookingDraft`, `PersistedConfirmation`. `AvailabilityResults.tsx` and `ExtrasPanel.tsx` re-export from here (they used to define their own types).
- `useAvailability(args)` — cancelable fetch of `/api/availability`, `{ results, loading, error }`.
- `useExtras(propertyId)` — fetch of `/api/extras`.
- `useBookingDraft(extras)` — selection state + memoized `extrasTotal` and `grandTotal`.
- `usePersistedDraft(ctx, draft)` + `loadPersistedDraft()` + `clearPersistedDraft()` — sessionStorage mirror with 30-min TTL.
- `savePersistedConfirmation()` + `loadPersistedConfirmation()` — same pattern for the booking confirmation, 2h TTL. Survives a refresh on `/confirmation`.
- `submitBooking(args)` — typed POST to `/api/bookings`. Signature reserves slots for `paymentIntentId` / `setupIntentId` / `paymentMethodId` / `customerId` so when Stripe lands (Step 10/11), `submitBooking` is the **only** place the per-hotel front-ends need to learn the new shape. Throws `SubmitBookingError` with status on non-2xx.

The existing `/rooms`, `/checkout`, `/confirmation` clients are now the canonical pattern: they consume the hooks, persist via sessionStorage, and contain no inline fetch / state-machine logic.

**Bonus: URL-stuffing pattern is gone.** Rooms used to pack `roomTypeId`, `ratePlanId`, `roomName`, `rateName`, `totalPrice`, `nights`, `nightlyRates` into checkout URL params and similar into confirmation URL params. Now the draft lives in sessionStorage and only the `orderId` ends up in the confirmation URL. Cleaner URLs, no race-on-refresh, and `extras` finally propagate from rooms to checkout (the URL-param flow had been silently dropping them).

### Per-hotel directory scaffold — TODO

Not yet implemented. The `src/hotels/<slug>/` and `src/hotels/_templates/<name>/` directory pattern lands when the first real hotel mockup is ready to port.

Plan:

```
src/hotels/
  _templates/
    boutique-1/         # shared design used by N hotels
      Home.tsx          # receives `config: HotelConfig` prop
      Rooms.tsx
      Checkout.tsx
      Confirmation.tsx
      theme.css
  abc-hotel/
    config.ts           # copy, image paths, hotel slug, theme overrides
    Home.tsx            # 1-line passthrough: <BoutiqueHome config={abcConfig} />
    Rooms.tsx           # bespoke override of just this page (optional)
  xyz-hotel/
    config.ts
    Home.tsx            # fully bespoke, no template
    Rooms.tsx
    Checkout.tsx
    Confirmation.tsx
```

Routes will resolve via `[propertySlug]` dispatch reading the slug, dynamic-importing the right hotel module.

**Discipline rules:**

1. **API contract is sacred.** Per-hotel UI can render however it wants but must speak to `/api/availability`, `/api/extras`, `/api/bookings` with the same shape. Backend validates everything.
2. **Headless hooks > shared components.** Don't try to build a shared `<RoomCard>` that all 40 hotels theme — that fights the bespoke goal. Per-hotel components consume `useAvailability` + `useBookingDraft` and render results freeform. Exceptions: a few stubborn primitives (date picker, country/phone input, Stripe Elements wrapper) stay shared and hotels override styling via CSS.
3. **CSS isolation.** Pick one of: CSS Modules, scoped stylesheets, or Tailwind w/ per-hotel layers — global CSS will leak across 40 hotels. Pick before hotel #2.
4. **Booking flow stays consistent.** The marketing surface (homepage, hero, gallery, story) is fully bespoke per hotel. The booking flow itself (rooms → checkout → confirmation) is theme-only — same UX, different colours / fonts / copy. Don't reinvent the booking mechanics per hotel: consistency = trust + smaller bug surface.

### When to start porting hotels

Right now the existing `/rooms`, `/checkout`, `/confirmation` are doing double duty as the live demo flow AND the canonical "first hotel" example. When the first real mockup is ready:
1. Create `src/hotels/demo/` with the existing JSX moved into it.
2. The `[propertySlug]` route resolves "demo" → `src/hotels/demo/Rooms.tsx`.
3. The current `src/app/rooms/rooms-client.tsx` becomes the fallback (or gets deleted once every property has its own directory).

---

## Phase 3 — Stripe Connect — DONE 🟢

Working end-to-end on the **UAE sandbox** as of 2026-05-01. (Real Polish platform account is being opened later this month — see "Carry-forward" below for the swap.)

### Step 8: Stripe platform setup — DONE 🟢

- UAE sandbox (`ROCKENUE INTERNATIONAL GROUP L.L.C-FZ`) used for dev. Will swap to a Polish platform account when it's live.
- **Account type: Standard** (NOT Express). Switched from the build-plan default after reviewing tradeoffs — hotels are real businesses; full Stripe Dashboard + ability to connect existing Stripe accounts > simplified Express dashboard. See "Carry-forward".
- **No `STRIPE_CONNECT_CLIENT_ID` needed.** That's only required for OAuth-based Standard onboarding. Express + accountLinks (which we use) is API-only — `accounts.create({ type: 'standard' })` + `accountLinks.create({ type: 'account_onboarding' })`. Ignored the client_id field in the dashboard.
- Env vars: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (still empty locally — Stripe CLI install blocked on outdated Xcode CLT, see follow-up below), `PUBLIC_APP_URL`.
- Webhook endpoint at `/api/stripe/webhooks` handles `account.updated`, `payment_intent.succeeded/failed`, `setup_intent.succeeded/failed`. Logs payment-related events to `payment_events` table for audit.

### Step 9: Per-property onboarding — DONE 🟢

- `POST /api/stripe/connect/start` — admin-only, creates a Standard connected account (idempotent — only on first call) and returns an `accountLink` URL.
- `GET /api/stripe/connect/start?refresh=1&propertyId=…` — handles Stripe's `refresh_url` callback if the link expires.
- `GET /api/stripe/connect/return` — the return URL Stripe redirects to after onboarding. Calls `accounts.retrieve`, derives status via `src/lib/stripe/status.ts`, persists `stripeAccountStatus` + `stripeAccountCurrency`.
- Admin UI on property edit page: "Connect to Stripe" / "Resume onboarding" / "Manage in Stripe" button + status pill + currency-mismatch warning.
- `account.updated` webhook handler refreshes status when Stripe updates the account out-of-band.

### Step 10: Stripe Elements + dual checkout flow — DONE 🟢

Mock card form replaced. Stripe Elements rendering live.

- `POST /api/stripe/payment-intent` (NR) — `application_fee_amount` from `properties.platformFeePercent`, `transfer_data.destination = stripeAccountId`, `on_behalf_of = stripeAccountId` (mandatory cross-region — see below), idempotent on `orderId`.
- `POST /api/stripe/setup-intent` (Flex) — creates platform-side Customer + SetupIntent with `usage: 'off_session'`. The off-session PI in Phase 5 will reference this customer + the saved payment method.
- `src/components/checkout/StripePaymentSection.tsx` — `<Elements>` + `<PaymentElement>` wrapper. `confirmPayment`/`confirmSetup` with `redirect: 'if_required'` so card payments stay inline.
- `src/app/checkout/checkout-client.tsx` — generates session orderId once, lazily creates the right intent (PI vs SI) when guest enters their email, branches button label on rate type. Forwards Stripe IDs to `/api/bookings`.
- `AvailabilityResult.ratePlan.isRefundable` now flows through `/api/availability` → headless hooks → checkout client (so the client knows which intent kind to request).

**Carry-forward (Stripe):**

- **Polish platform swap.** When the real platform account is opened: swap env vars, re-register webhook endpoint against the new account, re-onboard each property. Test connected accounts and PaymentIntents in UAE are throwaway. `on_behalf_of` keeps working but cross-region rules will differ — Polish (EU) platform has wide cross-border rights so most country combinations should work without further config.
- **Cross-region requires `on_behalf_of`.** Discovered the hard way: UAE platform → GB connected account fails with *"Cannot create a destination charge for connected accounts in GB because funds would be settled on the platform and the connected account is outside the platform's region"*. Fix: `on_behalf_of: stripeAccountId` makes the connected account the merchant of record so funds settle in their country. Safe to leave on permanently — explicit settlement is a feature even when same-region.
- **Stripe webhook secret + CLI.** Brew install of Stripe CLI failed (Command Line Tools too outdated). Skipped for now; the happy path works without webhooks because the return route does a synchronous `account.retrieve` and the checkout flow uses `confirmPayment` which is synchronous. To install later: download the binary directly from `https://github.com/stripe/stripe-cli/releases`, then `stripe login` + `stripe listen --forward-to localhost:3000/api/stripe/webhooks` → paste printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. Production webhook secret comes from the Stripe Dashboard webhook config, not `stripe listen`.
- **Standard vs Express mid-stream change.** Build plan said Express; we picked Standard. Steps 9–14 in this file may still mention Express in places — read with that in mind.

---

## Phase 4 — Booking flow rewrite

### Step 11: postReservation, postCustomItem, postPayment — DONE 🟢

Confirmed working end-to-end against the real Cloudbeds property (2026-05-01).

**Shipped:**

- `src/lib/cloudbeds/reservations.ts` — `postReservation`, `postCustomItem`, `postPayment` helpers. Form-encoded POST (NOT JSON, despite v1.3 sometimes accepting both), `propertyID` in query string, returns flat fields at top level (NOT wrapped in `{ data }` like most v1.3 endpoints — surprised us on first run).
- `src/app/api/bookings/route.ts` rewritten:
    - Client passes `orderId` (UUID, same one used as Stripe idempotency key + metadata). Drops the previous server-side `BK-DATE-XXX` format.
    - **Idempotent retry**: existing booking row with the same `orderId` is returned as-is. Covers double-submit, network retry, refresh-after-success.
    - **Server-side Stripe verification**: retrieves the PaymentIntent (NR) or SetupIntent (Flex) from Stripe and refuses unless `status === 'succeeded'`. Trusts nothing the client sends.
    - Splits `body.totalPrice` into `roomTotal` + `extrasTotal` correctly so application fee = grandTotal × platformFeePercent (not just room).
    - Snapshots cancellation policy onto the booking.
    - Calls `postReservation`, then loops extras into `postCustomItem` (logs per-extra failure but doesn't fail the whole booking — money's already taken; missing folio lines the hotel can fix manually). NR also calls `postPayment` with `description = "Stripe pi_..."` for reconciliation.
    - Updates booking with `cloudbedsReservationId` + `status = 'pms_synced'`.
- Cancellation policy admin UI (`src/app/admin/properties/[id]/page.tsx` Rooms tab + `RatePlanPolicyRow` component + `PATCH /api/admin/properties/[id]/rate-plans/[ratePlanId]`). Per-rate-plan toggle for `isRefundable` + `{deadlineHours, penaltyType, penaltyPercent}`. Granularity may be reduced — see "Open design questions: cancellation policy ergonomics" below.

**Carry-forward (Step 11):**

- **Postpartum reservation failure.** Original carry-as-flag still stands: Stripe succeeded but `postReservation` fails → money taken, no PMS reservation. Currently returns 502 with details and the booking row is left in DB. Pre-launch: design retry queue + admin alert + auto-refund fallback.
- **Per-extra failure handling is silent.** A failed `postCustomItem` is logged but not surfaced to admin. Pre-launch: visible queue / digest of failed extras so the hotel can manually re-add them.

### Step 12: Confirmation page + email — DONE 🟢

Shipped 2026-05-04. Confirmation page polished + transactional confirmation email going out via SendGrid.

**Shipped:**

- `PersistedConfirmation` (in `src/lib/booking/usePersistedDraft.ts`) gained `lastName`, `rateType`, `roomTotal`, `extrasTotal`, `extras[]` so the confirmation page + email have the data they need without round-tripping the DB. `savePersistedConfirmation` call in `src/app/checkout/checkout-client.tsx` populates them.
- `src/app/confirmation/confirmation-client.tsx`:
    - **Reservation Number** (Cloudbeds `cloudbedsReservationId`) is now the primary reference — what the guest quotes on arrival. Internal `orderId` is shown secondary.
    - **Payment status pill** branches on `rateType`: green "Paid in Full" for NR vs blue "Card on File" for Flex with the per-rate explanatory copy.
    - **Extras** render as a sub-section in the price breakdown.
    - "Total Paid" / "Total Due" header label flips by rate type.
- SendGrid wiring (`@sendgrid/mail` installed):
    - `src/lib/email/sendgrid.ts` — thin wrapper, hardcoded From `noreply@em4689.market-pulse.io` (uses Karol's existing market-pulse SendGrid domain authentication).
    - `src/lib/email/booking-confirmation.ts` — HTML + text templates. Subject: `Booking confirmed at {hotel} — {reservationId}`. Branches body copy on `rateType`. Email always references `cloudbedsReservationId` as the canonical booking ref (orderId shown as secondary).
    - Wired in `src/app/api/bookings/route.ts` — fires after `status = 'pms_synced'`, fail-soft (logs on error, never blocks the response since the booking is already done).
- `src/scripts/test-confirmation-email.ts` — smoke test that sends one Flex + one NR email to a target address. Run with `set -a && source .env.local && set +a && npx tsx src/scripts/test-confirmation-email.ts <to>`.

**Verified live (2026-05-04):** Both Flex + NR test emails landed cleanly with correct rendering.

**Carry-forward:**

- **Per-hotel sender.** Currently every email comes from `noreply@em4689.market-pulse.io` regardless of which hotel is being booked. When real hotels onboard, replace with the hotel's own authenticated domain — needs a `properties.emailFromAddress` (or similar) field + per-hotel SendGrid sender authentication. Defer until hotel #1 lands.
- **Per-hotel reply-to.** Same shape — currently defaults to the From address. Should land at the same time as the sender field.

---

## Phase 5 — Flex auto-charge

(General — cron infra + observability shape decide together.)

### Step 13: Hourly cron job

- Find Flex bookings where `now > chargeAt`, `status = 'pms_synced'`, no successful `auto_charge_succeeded` event yet.
- For each: create off-session `PaymentIntent` with the saved `stripePaymentMethodId`, `stripeCustomerId`, `off_session: true`, `confirm: true`, application fee + transfer_data as Step 10. Idempotency key includes `bookingId` + attempt number.
- On success: `postPayment` to Cloudbeds, update booking to `status = 'paid'`, log a `paymentEvents` row.
- On failure: log `paymentEvents` row with error code, kick off Step 14.

### Step 14: Failure handling + guest re-auth page

- Email guest with a secure link (signed token) to `/payment-update?token=…`.
- That page lets them enter / update card → new SetupIntent → new payment method. Once the new PM is saved, reset `chargeAt = now + 5 minutes` so the next cron run picks it up.
- 24h grace timer (start at first failure). If still unresolved: cancel the Cloudbeds reservation, release inventory (handled by webhook from Step 6), set booking `status = 'cancelled'`, send the guest a cancellation email.

### Step 15: Monitoring + alerting

Day-one work, not a follow-up.

- Heartbeat: cron logs an event each run (success or failure). Alert if no heartbeat in 90 minutes.
- Per-run summary: count attempts, succeeded, failed, no-eligible-bookings.
- Alert on patterns: ≥5 failures in a single run, or any single property with all failures, or any auto-cancel.
- Surface the digest somewhere visible to Karol (admin dashboard panel + daily email summary).

---

## Phase 6 — Cancellation + launch hardening

(General — flesh out as Phases 1-5 land.)

### Step 16: Guest self-cancel

- New route for booking lookup (booking ref + email).
- Show the cancellation policy from `cancellationPolicySnapshot`.
- If within window: call Cloudbeds reservation cancel; if NR (already paid): refund via Stripe; if Flex (not yet charged): detach the saved payment method.
- If outside window: read-only view, "contact the hotel" message.

### Step 17: Production gates + content + infra

**Done (2026-04-29 quick-wins pass):**

- ✅ `ADMIN_TOKEN` rotated away from `change-me-before-deploy`. Also dropped `B2U_SHARED_SECRET` from `.env.local` and Railway.
- ✅ Dev mockup pages (`/bars`, `/compare`, `/compare-live`, `/fonts`, `/rates`, `/enhance`, `/rooms-mockup`, `/pickers`) now 404 in production via `src/proxy.ts`.
- ✅ `src/middleware.ts` renamed to `src/proxy.ts` (Next.js 16 deprecation), function `middleware` → `proxy`.
- ✅ Lint cleanup on `rooms-client.tsx` (`<a>` → `<Link>`, router added to effect deps, `setLoading` warning suppressed with rationale).

**Still TODO:**

- Cloudflare R2 image hosting; admin upload UI per property.
- Custom domains per hotel (Cloudflare DNS → Railway).
- Real copy + room descriptions in DB (move out of `AvailabilityResults.tsx` `ROOM_DESCRIPTIONS`).
- JSON-LD Hotel schema on each homepage.
- `next/font` swap for the Google Fonts `<link>` in `layout.tsx`.

### Availability performance — A + B done 🟢, C deferred

Original problem: `/api/availability` was noticeably slow (Karol's UX feedback 2026-05-01). Three causes were identified — A (cold-start in request path) and B (no response cache) shipped 2026-05-04. C (N+1 query) deferred.

**A. Cold-start sync moved out of request path — DONE 🟢**

`src/app/api/availability/route.ts` previously awaited `syncInventoryForProperty` inline if the queried window had no inventory rows (~3s for 8 rate plans × 90 days). Now fires `void syncInventoryForProperty(...).catch(...)` in the background and returns whatever inventory exists (empty for a true cold start). The sync, on completion, calls `revalidateTag` (see B) so the next request gets fresh data without waiting on the time-based revalidation.

Tradeoff accepted: first user on a property with zero inventory in the window sees "no availability" for ~3s while the background sync runs. The alternative (every first user of the day waiting 3s in-band) is worse. Steady-state coverage by the 6h cron + Cloudbeds webhooks means this only triggers for genuinely cold properties.

**B. `unstable_cache` wrapper + tag invalidation — DONE 🟢**

`/api/availability` response wrapped in `unstable_cache`:
- Key parts: `["availability", propertyId, checkIn, checkOut, adults]` (each unique combo is its own cache entry).
- `revalidate: 30` (caps staleness if a sync somehow misses calling revalidateTag).
- `tags: ['availability:${propertyId}']` (per-property scope).

`syncInventoryForProperty` (in `src/lib/cloudbeds/sync-inventory.ts`) now calls `revalidateTag('availability:${propertyId}', { expire: 0 })` after all DB writes complete. Used Next 16's two-arg signature with `{ expire: 0 }` per the docs' recommended pattern for webhook-triggered immediate expiration. (Single-arg `revalidateTag(tag)` is deprecated in Next 16.)

This means: any sync — whether triggered by a Cloudbeds webhook, the 6h cron, or the cold-start fire-and-forget — flushes the per-property availability cache the moment it completes. No 30-second stale window after a booking lands.

**Behavior summary post-A+B:**

- Repeat request, same date range: cache hit, ~ms.
- First request for a date range (cold cache): full DB query, ~200ms (N+1 still there).
- First-ever request on a brand-new OAuth'd property with no inventory: instant empty result + background sync; ~3s later sync's `revalidateTag` fires; next request recomputes against fresh data.
- Booking webhook lands → sync runs → `revalidateTag` flushes that property's entries → next request sees fresh inventory.

**C. Collapse N+1 to a single JOIN — DEFERRED**

Demo property still does ~28 sequential DB queries on a cold cache miss. A single JOIN would cut to 1 (~200ms → ~30ms). Skipped because B+30s caching covers most of the user-perceptible cost; revisit only if production numbers say cache misses are still painful.

**D. Per-hotel pre-rendering with ISR — DEFERRED**

Per the original plan, lands when Phase 2.5 (`src/hotels/<slug>/`) does. Homepage shows "from £X" pre-rendered; full availability call only fires when user picks dates.

---

## Phase 6.5 — Admin v3 + R2 + Content CMS — DONE 🟢

Shipped 2026-05-07 in one focused session. Replaces the old `/admin` shell entirely. Full reference in `hotel-platform-build-plan.md` ("Admin v3" section).

**Shipped:**

- **Sidebar shell** — Linear-flavoured. 240px persistent sidebar with hotel switcher card → Property nav (Overview · Bookings · Content · Photos · Rates · Alerts) → Integrations nav (Cloudbeds · Stripe · Domain) → user/logout chip. Light palette, `#5B5BD6` accent, JetBrains Mono for IDs/numerics. Tokens scoped under `.admin-root` in `globals.css`. Components in `src/components/admin/`.
- **Dashboard** at `/admin` — hotel tile grid with real status pills (Live / Cloudbeds / Stripe), bookings·7d, revenue·7d, search, 4 filter chips. Per-hotel data joined server-side in `/api/admin/properties` GET.
- **Overview tab** at `/admin/[id]` — stat grid with sparklines (bookings, revenue, avg booking, failed count), recent bookings, derived launch checklist (5 items), auto-generated alerts (stripe-restricted, cloudbeds-reauth, expiring-token, failed-bookings), quick actions. Endpoint: `/api/admin/properties/[id]/overview`.
- **Cloudbeds tab** — connection card with token expiry + scopes + re-authorise (real OAuth start), inventory sync card with last-synced timestamp + "Sync now" button (works), webhook subscriptions list. OAuth callback redirect migrated from `/admin/properties/[id]?cloudbeds=connected` to `/admin/[propertyId]/cloudbeds?connected=1`. Scopes extracted to `src/lib/cloudbeds/scopes.ts`.
- **Bookings tab** — siloed table with search, status filter chips, slide-over detail panel (stay / guest / folio / payment + Stripe deep-link). Resend / cancel-refund actions are placeholders.
- **Rate plans tab** — accordion editor for `isRefundable` + `cancellationPolicy` (deadline, penalty type, percent, internal note). Reuses existing PATCH endpoint.
- **Stripe tab** — split into "Your platform" (fees collected, platform fee %, account status) vs "Hotel side · read-only" (their payouts, balance, refunds, account meta). All from existing Stripe API via `Promise.allSettled` so one failure degrades gracefully. Verified £29.16 fees against £972 revenue = exactly 3%.
- **Domain & deploy tab** — stub for now (DNS / SSL / Railway service info — defer to dedicated step).
- **Alerts tab** — stub. Real alerts engine deferred to its own step (compute from operational signals).
- **Photos tab + Cloudflare R2** — `images` schema extended with `slot` (hero/gallery/room/neighbourhood), `roomTypeId`, `sortOrder`, `mimeType`, `sizeBytes`, `variants` JSONB. R2 bucket `rockenue-hotel-photos`. Upload endpoint resizes via `sharp` to 3 variants per photo (hero 1600w / gallery 800w / thumb 400w), uploads in parallel. DELETE cleans all variant keys. Originals NOT kept in R2 — local copies are the master. UI: drag-drop, slot assignment, per-room galleries. R2 client at `src/lib/r2/client.ts`. Public URL via R2.dev (`https://pub-...r2.dev`); custom domain swap is a one env-var change later.
- **Content CMS** — 5 content blocks per property: `hero`, `neighbourhood`, `goodToKnow`, `contact`, `footer`. Reuses existing `content_blocks` table + endpoints. Defaults file (`src/lib/content-defaults.ts`) seeded from Portico's hardcoded copy so empty DBs render identically. `getPropertyContent(propertyId)` helper merges DB blocks with defaults. Inline emphasis: `*word*` becomes italic+accent (`renderEmphasis` helper) — keeps Portico's distinctive italic style admin-editable.
- **Portico Home wired to DB** — Hero, Neighbourhood, GoodToKnow, Footer all read photos + content with fallbacks to bundled defaults. RoomSelect reads per-room photos from `photos.byRoomType[roomTypeId]`. Gallery / Image components got `unoptimized={src.startsWith("http")}` for R2 URLs (no `next.config` allowlist needed).
- **Property top-bar** — every per-hotel admin page renders a thin bar above the page TopStrip showing hotel name + status pill + domain + currency + "Open site ↗" (always opens in new tab).

**Carry-forward (Phase 6.5):**

- **Booking-flow screens still hardcoded** — Dates / Extras / Checkout / Confirmation use small bits of static copy that aren't in content blocks yet. Lower priority; promote when needed.
- **Domain & deploy + Alerts tabs are stubs** — Domain is mostly read-only display work (DNS / SSL / Railway probe); easy. Alerts needs the underlying alerts engine (compute from signals) — that's its own subsystem.
- **Resend confirmation + Cancel/refund actions** — placeholders on the booking detail panel. Resend = re-fire SendGrid template; cancel/refund = Cloudbeds reservation cancel + Stripe refund. Each merits its own focused step.
- **No image variants for next/image optimisation** — R2 URLs use `unoptimized`. If you ever want Next.js image optimisation back on, add R2 host to `next.config.ts` `images.remotePatterns`. Not critical since `sharp` already produces compressed JPEGs.
- **Custom domain for R2** — currently `pub-...r2.dev`. Swap to `images.rockenue.com` (or per-hotel) by changing `R2_PUBLIC_URL` once DNS is set.
- **Per-hotel onboarding wizard** — "+ New hotel" button on the dashboard is a placeholder. At hotel #21+ we'll want a wizard that guides through the full setup. Defer until needed.
- **`sharp` on Railway** — if a future Railway redeploy errors on platform-mismatch, add `optionalDependencies: { "@img/sharp-linux-x64": "*" }` to `package.json`.
- **Stale browser cache** — Portico content reads happen server-side per request, but browsers cache the rendered HTML. Hard refresh after content edits if you don't see changes.

---

## Phase 6.6 — Cloudbeds metadata auto-sync — DONE 🟢

Shipped 2026-05-08. Closes the manual data-entry gap on per-property metadata that Cloudbeds already knows about.

**What flows from Cloudbeds:**

`/getHotelDetails` now runs on every 6-hour inventory cron (and cold-start) via `src/lib/cloudbeds/sync-hotel-details.ts`, called from `syncInventoryForProperty` in a try/catch (a CB outage there can't break inventory).

Two write strategies:

1. **`content_blocks` — non-destructive merge.** A field is only filled when its current value still matches the Portico default in `src/lib/content-defaults.ts`. The moment the admin edits a field, they own it forever; subsequent syncs leave it alone. Fields:
    - `contact.addressLines` ← `propertyAddress` (street, city/state/zip, country)
    - `contact.reservationsPhone` ← `propertyPhone`
    - `contact.reservationsEmail`, `contact.generalEmail` ← `propertyEmail`
    - `neighbourhood.mapLat / mapLon` ← `propertyAddress.propertyLatitude / propertyLongitude`
    - `goodToKnow.rows[Check-in / Check-out]` ← `propertyPolicy.propertyCheckInTime / propertyCheckOutTime` (formatted as "From 14:00" / "By 12:00")
2. **`properties` — always overwrite.** Cloudbeds is source of truth for these; admin edits to `properties.name` will be re-synced. Fields: `name`, `currency`, `timezone`. Sandbox returns `USD` for non-USD properties — accepted during testing, will be correct on real connections.

**Deliberately NOT synced:**

- **Photos** — Cloudbeds photo APIs are unreliable (per Karol). Photos come from R2.
- **Amenities** — `propertyAmenities` returns empty in our test data; revisit if needed.
- **Property descriptions** — `propertyDescription` returns empty.

**Admin UI:**

- Per-field hints "auto-fills from Cloudbeds" on the affected fields (Address, Reservations phone/email, General email, Map lat/lon, Good-to-know rows).
- New **Rooms** card in the Content admin (left column) — read-only, hint reads "synced from Cloudbeds · read-only · edit in your PMS". Lists each `room_types` row with name, occupancy range, description, amenity chips. Empty-state: "No room types synced yet. Connect Cloudbeds and trigger a sync."

**Cron observability:**

`SyncResult` now carries `hotelDetailsContactUpdated`, `hotelDetailsNeighbourhoodUpdated`, `hotelDetailsGoodToKnowUpdated`, `hotelDetailsPropertyFieldsUpdated[]` — visible per-property in the cron response JSON.

**Scripts:**

- `src/scripts/cloudbeds-sync-hotel-details.ts [slug]` — smoke test; runs the sync and prints affected blocks.
- `src/scripts/cloudbeds-debug-hotel-details.ts [slug]` — raw response dumper (the v1.3 docs aren't fully reliable; keep around for schema verification when CB changes things).

**Carry-forward:**

- **Country code → name mapping.** CB returns `"GB"`, we render `"GB"` in the address. Acceptable; a small lookup table would polish this.
- **`propertyTimezone` field doesn't actually appear in the v1.3 response.** Our code handles this gracefully (skips the field). The existing `cloudbeds-update-name.ts` script's `--with-timezone` flag was based on stale docs. Remove or replace if/when CB exposes it.
- **Rooms description editability.** Currently read-only because the inventory sync overwrites `room_types.description` on every run. If admin override becomes useful, add the same default-comparison strategy used for content blocks.

---

## Phase 7 — Post-launch features

Loose direction for post-launch. Each item gets its own focused step when its time comes; this section is just to capture decisions made on 2026-05-07.

### Active (already in motion)

- **Welcome Pickups airport transfers** — Karol emailed them 2026-05-07. Once partnership confirmed, build:
    - New `transfer` extra type alongside Cloudbeds add-ons (separate booking surface — Welcome Pickups has its own booking flow / commission).
    - Surfaced at `/extras` (or its own step in the booking flow).
    - Pre-arrival WhatsApp prompt with the booking link (depends on WhatsApp landing first).

### Highest-leverage cheap wins

- **GEO / AI-friendly content** — single highest-leverage item in the roadmap. Make Portico (and every property) discoverable to AI agents, search, and direct queries.
    - **JSON-LD schema** on every property page. Types: `Hotel`, `FAQPage`, `AggregateRating`, `Offer`. Generated server-side from property data + content blocks.
    - **FAQ admin section** — pre-populated with 15 standard questions per property (check-in, parking, breakfast, accessibility, pets, etc.), editable. New content key `faq` in content blocks. Renders both as visible `/faq` page AND as `FAQPage` JSON-LD.
    - **5–10 specific factual claims** per property homepage — concrete, verifiable, citation-ready ("3 minutes from Paddington Station", "Eight rooms", etc.). Already partially shipped in the neighbourhood block; add a structured `facts` field.
    - **MCP endpoint** at `/mcp/server` — exposes availability + property details via Model Context Protocol so AI agents (ChatGPT, Claude, Perplexity, etc.) can query rooms directly. Probably wraps `/api/availability` + property meta.
    - **Per-property local-guide content** — owner-written ongoing copy. Adds depth + originality, not boilerplate. Lives in content blocks as `localGuide` (or split into multiple).

### Under consideration

- **WhatsApp Business API** — pre-arrival upsell, confirmations, review requests. **360dialog** as the BSP (Business Solution Provider). Foundation for Welcome Pickups + Tiqets flow. Decide before building those two.
- **Corporate / TMC portal** — open. Build only if demand emerges from business-traveler properties (and only the ones that need it). Not building speculatively.

### Defer

- **Tiqets / GetYourGuide attractions** — defer until WhatsApp flow exists. Pattern: pre-arrival WhatsApp surfaces curated experiences, links to Tiqets. Without WhatsApp the surface is wrong.
- **Guest accounts / cross-property identity** — note for future. Foundation for "welcome back" across the 39-property portfolio. Big enough that it deserves its own design pass. Not building now.

### Skipped / dropped

- ❌ **Stripe Identity** — would impact conversion. Identity verification, if ever needed, lives in a separate self-check-in app, not the booking engine.
- ❌ **JustPark / parking** — most properties have no parking. Per-property; optional add-on later if a specific hotel asks.
- ❌ **Onyx travel-agent commissions** — not now.

### Already in pipeline (no action needed here)

- Google Hotel Ads + Meta Travel Ads — paid acquisition handled separately.

---

## Out of scope for launch

- Modifications (force cancel-and-rebook).
- Partial refunds in the engine (hotel handles manually outside our system).
- Inventory holds during checkout (race conditions = polite "sold out" message).
- Adults/children occupancy split.
- Loyalty / member accounts.
- Multi-language.
- Abandoned cart recovery.
- Multi-property bookings in a single transaction.
- Guest "delete my data" UI (legally required — flag for v1.5).
- Hotel admin user accounts with roles (single admin token continues for now).

---

## Open questions — launch carry

All five original Cloudbeds-discovery questions (Q1–Q5) are resolved and folded into Steps 5–7. The only Cloudbeds-API thing carried forward is documented as a Step 6 follow-up (`roomblock/*` events; see Step 6 for context).

Webhook signature verification is **not** an open question — confirmed by the official Cloudbeds webhook docs that Cloudbeds doesn't sign webhooks at all. See Step 5 "Webhook security model" for the full rationale and our mitigations.

---

## Open design questions (do not build yet)

- **Reservation creation failure** (Stripe succeeds, `postReservation` fails). Happy path landed Step 11; design the retry / pending-state / auto-refund flow before launch.
- **Error state UX** — payment fails, room sold out between selection and payment, 3DS fails, Cloudbeds down. Decide during Phase 3 / Phase 4.
- **Address field in checkout** — TBD design.
- **Cancellation policy ergonomics** — the granular per-rate editor (`isRefundable` + `{deadlineHours, penaltyType, penaltyPercent}`) shipped in Step 11, but at 40 hotels each maintaining policy in *both* Cloudbeds *and* our admin, the duplication is friction. Options to evaluate before launch:
    - **A. Keep granular** — current shape. Maximum flexibility, maximum hotel-side maintenance burden.
    - **B. Simplify** — drop per-rate JSONB; keep `isRefundable` per rate (auto-detected from name); add one `cancellationDeadlineHours` per property. Refund logic: refundable + before deadline = full refund; else no refund. Covers ~95% of real direct-booking policies. **Karol's lean.** Hotels maintain real schedule in CB; our system enforces the simplified version for refunds.
    - **C. Drop entirely** — show "to cancel, contact the hotel" on bookings; no automated refund flow; push Step 16 self-cancel out of v1. Cleanest tech, worst guest UX.
    - **Underlying constraint:** Cloudbeds REST API doesn't expose policy fields (probed `/getRatePlanDetails`, `/getCancellationPolicies`, `/getCancellationPolicy`, `/getPolicies` — all 404), so we can't auto-sync. Re-probe periodically — if the new modular API at `api.cloudbeds.com` adds policy endpoints, we can swap to read-only sync and retire the editor.

---

## Engineering reminders

- **3DS on SetupIntent** runs at save; doesn't guarantee the off-session charge bypasses 3DS later. The Step 14 grace path covers issuer-required reauth.
- **Application fee currency** — fees come in the charge currency; Stripe FX-converts to the platform payout currency. Reporting/reconciliation awareness.
- **Statement descriptor** — on direct charges, the connected account's base descriptor dominates. We use `statement_descriptor_suffix: "ROCKENUE"` only, capped so combined ≤22 chars.
