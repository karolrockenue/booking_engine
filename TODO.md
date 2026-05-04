# Build Plan

A sequenced plan to take the booking engine to launch-ready (Cloudbeds REST API, Stripe Connect, Flex auto-charge, per-hotel bespoke front-ends).

Earlier steps are concrete because the work is well-scoped. Later steps are looser because the design will be informed by what we learn earlier (especially the sandbox smoke-test in Step 5 and the Stripe Connect setup in Phase 3). Tighten them up as we go.

**Phase status (2026-05-04):**

| Phase | Steps | Status |
|---|---|---|
| 1. Foundation | 1, 2, 3 | ✅ Done |
| 2. Cloudbeds REST API | 4, 5, 6, 7 | ✅ Done |
| 2.5 Per-hotel front-end architecture | Headless hooks, sessionStorage drafts | ✅ Hooks done; `src/hotels/<slug>/` scaffold pending |
| 3. Stripe Connect | 8, 9, 10 | ✅ Done — UAE sandbox platform, Standard accounts, Stripe Elements working end-to-end (test card `4242…`) |
| 4. Booking flow rewrite | 11, 12 | ✅ Done — postReservation/postCustomItem/postPayment + confirmation page polish + SendGrid email all live |
| 5. Flex auto-charge | 13, 14, 15 | ⛔ Not started |
| 6. Cancellation + launch hardening | 16, 17 | 🟡 Quick wins shipped earlier; R2 / domains / room descriptions / JSON-LD / `next/font` / availability perf still TODO |

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

### Availability performance — TODO

The `/api/availability` request is noticeably slow (Karol's UX feedback 2026-05-01). Three causes, ranked by impact:

1. **Cold-start sync inside the request.** If a property has no inventory in the requested window, `syncInventoryForProperty` runs synchronously inside the request (~3s for 8 rate plans × 90 days). First user of the day waits for everyone.
2. **No response cache.** Every request re-runs DB queries from scratch even though inventory only changes via webhook. Repeat hits on the same dates = full recompute every time.
3. **N+1 query pattern.** Per room type, separate queries for rate plans + inventory.

**Fix plan (in priority order):**

- Wrap `/api/availability` response in `unstable_cache`, keyed by `(propertyId, checkIn, checkOut, adults)`, `revalidate: 30s`, `tags: ['availability:${propertyId}']`. In `webhook-handler.ts` (Cloudbeds events that affect inventory) call `revalidateTag('availability:${propertyId}')` so the cache invalidates instantly when a booking lands.
- Move cold-start sync out of the request path. Return empty results immediately + trigger sync in the background. Steady state stays warm via the 6h cron + webhook events.
- Per-hotel pre-rendering (later, when Phase 2.5 lands) — homepage shows "from £X" badges pre-computed at edge with ISR. Full availability call only fires when user picks dates.
- Collapse N+1 to a single join. Marginal compared to the above two; do last.

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
