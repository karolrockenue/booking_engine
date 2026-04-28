# Build Plan

A sequenced plan to take the booking engine from its current state (B2U-built, mock payments, hardcoded extras) to launch-ready (Cloudbeds REST API, Stripe Connect, Flex auto-charge).

Earlier steps are concrete because the work is well-scoped. Later steps are looser because the design will be informed by what we learn earlier (especially the sandbox smoke-test in Step 5 and the Stripe Connect setup in Phase 3). Tighten them up as we go.

---

## Before you start

- Manuel's email (2026-04-24) confirmed REST API path. No further green light needed before starting. Take him up on the call offer only if a blocker surfaces during Step 5.
- Current branch is `main` with a lot of uncommitted work. Don't begin the schema migration before Step 1 (git setup) — losing the current state is not recoverable.
- Cloudbeds API docs: pull endpoint references straight from `https://hotels.cloudbeds.com/api/v1.3/docs/` as you go. Don't rely on memorised shapes.
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

### Step 5: Sandbox smoke-test — partially done

Read-only smoke test script lives at `src/scripts/cloudbeds-smoke.ts`; raw responses save to `tmp/cloudbeds-smoke/` (gitignored). Run with:

```bash
set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-smoke.ts demo
```

**Working as expected:**
- OAuth + token refresh.
- `getHotels` → `propertyID` for subsequent calls.
- `getHotelDetails`, `getRoomTypes`, `getRooms`, `getTaxesAndFees`, `getReservations` (returns `thirdPartyIdentifier` ✓), `getWebhooks` (subscription list — empty until we subscribe).
- `getRatePlans` with `startDate` + `endDate` (note: not `resultsFrom`/`resultsTo` as originally guessed) and `detailedRates: true` returns `rateID`, `roomTypeID`, daily pricing, and per-date restrictions (`minLos`, `maxLos`, `closedToArrival`, `closedToDeparture`, `cutOff`).

**Open questions surfaced — see the "Open questions — Cloudbeds API discovery" section at the bottom.** Don't build Step 6 / 7 against assumptions about cancellation policy and items until those are answered. Re-run this script after rate plans + cancellation policies are properly configured in Cloudbeds — fields that look missing now may simply not be populated in the partner test account.

**Deferred — needs a sandbox / proper test setup:** `postReservation`, `postCustomItem`, `postPayment` write tests, webhook subscription via `postWebhook`-equivalent.

### Step 6: Inventory sync

Goal: the existing `inventory` table gets populated from Cloudbeds, with webhooks for invalidation and a 6-hourly safety-net poll.

1. Build `src/lib/cloudbeds/sync-inventory.ts` — `syncInventoryForProperty(propertyId, days = 90)`:
   - Fetch `getRatePlans` with `startDate`, `endDate`, and `detailedRates: true`.
   - Upsert `roomTypes` (from `getRoomTypes`).
   - Upsert `ratePlans`. Handle the master/derived split: master rates have only `rateID` + pricing (no name — synthesise "Standard Rate" or use the `roomTypeName`); derived rates carry `ratePlanID`, `ratePlanNamePublic`, `derivedType`, `derivedValue`. **`cancellationPolicy` + `isRefundable` source is open question Q1** — for now, leave nullable and populate manually until Q1 is resolved.
   - Upsert `inventory` rows from the per-date entries in `roomRateDetailed` (per room × per rate × per date), including restrictions.
2. Build `src/app/api/cloudbeds/webhooks/route.ts` — receives Cloudbeds webhooks, verifies signature, queues invalidation. Exact event names + signature verification depend on **open questions Q3 + Q4** below.
3. Cold-start path: when `/api/availability` is called for a property and `inventory` has no rows for the requested dates, run `syncInventoryForProperty` synchronously then schedule it into the rolling job.
4. 6-hourly safety-net: cron entry that calls `syncInventoryForProperty(p.id, 90)` for every property.
5. Subscribe to Cloudbeds webhooks per property (call their subscribe endpoint after OAuth — exact endpoint name TBD per Q4).

Deliverable: when a rate or availability changes in Cloudbeds, our `inventory` reflects it within seconds via webhook. Worst case (webhook missed), it self-heals within 6 hours.

### Step 7: Extras catalog sync

Goal: replace the hardcoded `AVAILABLE_EXTRAS` in `src/components/booking/ExtrasPanel.tsx:11` with per-property data from Cloudbeds.

**Blocked on open questions Q2 + Q5:** the smoke test got `Scope required for this call was not granted by property` from `getItems` / `getItemCategories`. Need the right scope name + confirmation that items is the right home for our extras model (vs. `ratePlanAddOns`).

Once unblocked:

1. Add a `propertyExtras` cache table (or jsonb column on `properties` if simpler — decide based on whether we want per-extra rows): `cloudbedsItemId`, `categoryId`, `name`, `description`, `price`, `priceType`, `currency`. Refreshed alongside inventory in Step 6 (extras don't change as fast, but piggybacking is cheap).
2. Create `src/lib/cloudbeds/sync-extras.ts` — fetches `getItems` / `getItemCategories`, upserts into `propertyExtras`.
3. Add `/api/extras?propertyId=…` route that returns the cached extras list.
4. Update `ExtrasPanel.tsx`:
   - Replace `AVAILABLE_EXTRAS` constant with a `useEffect` fetch from `/api/extras`.
   - Make the panel render from the fetched list.
   - Update `StickyBookingBar.tsx` (which currently imports `AVAILABLE_EXTRAS` directly) to take the extras list as a prop or read from the same source.
5. The existing rooms client at `src/app/rooms/rooms-client.tsx:97-98` reads `AVAILABLE_EXTRAS.find(...)` to compute extras totals — rewire to use the fetched list.

Deliverable: extras shown to the guest are pulled from the property's Cloudbeds setup. No hardcoded list.

---

## Phase 3 — Stripe Connect

(Detail tightens once we've actually configured the platform account and seen the live onboarding shape.)

### Step 8: Stripe platform setup

- Create / configure the Stripe platform account for Rockenue. Enable Stripe Connect with **Express** account type.
- Decide and document: live vs test mode strategy. Probably: test mode while building, live mode behind a env-var flag for first real hotel.
- Add env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`.
- Webhooks: register the platform's webhook endpoint at `/api/stripe/webhooks` and at minimum subscribe to: `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `setup_intent.succeeded`, `setup_intent.setup_failed`, `charge.refunded`, `payment_method.detached`. (More may be added in Phase 5.)

Deliverable: Stripe platform configured, webhook endpoint stub returns 200.

### Step 9: Per-property onboarding

- Admin UI on the property edit page: "Connect to Stripe" → calls our backend, which creates a Stripe Express account (`account.create`), generates an account link (`accountLinks.create`), redirects the hotel rep to Stripe's hosted form.
- Return URL → `/admin/properties/[id]?stripe=onboarded`.
- On `account.updated` webhook: pull the connected account's default currency and `capabilities.transfers`, persist `stripeAccountCurrency` and `stripeAccountStatus`. **If the connected account's currency doesn't match `properties.currency`, mark `stripeAccountStatus = 'restricted'` and show a warning in admin** — don't silently mismatch.
- Apply payout schedule from the property's `payoutSchedule` field via `accounts.update` once the account is active.

Deliverable: webmaster can onboard a property to Stripe Connect from admin; status reflects Stripe webhook events; currency mismatch is caught.

### Step 10: Stripe Elements + dual checkout flow

Replaces the mock card form at `src/app/checkout/checkout-client.tsx:194-213`.

Two flows, branched on the selected rate plan's `isRefundable`:

**Non-Refundable (`isRefundable: false`):**
- On `/checkout` mount: call `/api/stripe/payment-intent` (new route) with `propertyId`, `bookingDraft` (room, rate, dates, extras totals). Server creates a `PaymentIntent` with `amount = grandTotal`, `currency = stripeAccountCurrency`, `application_fee_amount`, `transfer_data: { destination: stripeAccountId }`, `statement_descriptor_suffix: "ROCKENUE"`, and idempotency key derived from a generated `orderId`.
- Render Stripe Elements `PaymentElement` bound to the client_secret.
- On submit: `stripe.confirmPayment(...)`, 3DS flows in the browser. On success, post to `/api/bookings` (which now does the postReservation work — see Step 11) with the PI id and the booking details.

**Flexible (`isRefundable: true`):**
- On `/checkout` mount: call `/api/stripe/setup-intent` (new route). Server creates a `Customer` (on the platform, not the connected account, since direct charges still need a saved PM keyed to the destination account — check Stripe docs for the right pattern; **this is the bit most likely to need adjustment after Step 8**). Returns client_secret with `usage: 'off_session'`.
- Render Stripe Elements bound to the SetupIntent.
- On submit: `stripe.confirmSetup(...)`, 3DS flows. On success, post to `/api/bookings` with the SetupIntent id, payment method id, customer id, computed `chargeAt = checkIn - cancellationDeadlineHours`.

Both flows pass the booking through to Step 11 where `postReservation` runs.

Deliverable: real payment / card-save flow, end to end, in test mode. Mock form gone.

---

## Phase 4 — Booking flow rewrite

(Looser detail — exact shape depends on what Step 5 + Step 10 reveal.)

### Step 11: postReservation, postCustomItem, postPayment

Rewrite `src/app/api/bookings/route.ts`:

1. Validate the request (existing logic stays).
2. Re-verify availability (existing logic stays).
3. Generate internal `orderId` (existing logic stays — used as `thirdPartyIdentifier` and Stripe idempotency key).
4. Call `postReservation` with guest details, room, rate, dates, `thirdPartyIdentifier: orderId`, `sendEmailConfirmation: false`. Persist `cloudbedsReservationId` on the booking and set `status = 'pms_synced'`.
5. For each selected extra: call `postCustomItem` with the cached price and quantity. Persist to `bookingExtras`.
6. NR: call `postPayment` with the PaymentIntent ID in the description, mark `status = 'paid'`. Flex: skip — `postPayment` happens in the auto-charge cron (Phase 5).
7. Send the confirmation email (Step 12).
8. Return `{ orderId, cloudbedsReservationId }`.

**Carry as a flag — do not implement retry yet:** Stripe charge succeeded, `postReservation` failed. We've taken money, no booking exists in Cloudbeds. Land the happy path first; revisit before launch with a proper "reservation pending" state + retry queue + admin alert + auto-refund fallback.

### Step 12: Confirmation page + email

- `/confirmation` (`src/app/confirmation/confirmation-client.tsx`): show `orderId` immediately on submit; once the API response includes `cloudbedsReservationId`, swap the displayed reference. (Both will exist by the time the page renders, since `/api/bookings` blocks on `postReservation`. So this is just "show the cloudbeds one".)
- Send confirmation email on success. Email always uses `cloudbedsReservationId`. Plain HTML for v1; transactional provider TBD (Resend, Postmark, etc. — pick during this step).

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

- Change `ADMIN_TOKEN` away from `change-me-before-deploy`.
- 404 the dev mockup pages (`/bars`, `/compare`, `/compare-live`, `/fonts`, `/rates`, `/enhance`, `/rooms-mockup`, `/pickers`) when `NODE_ENV === 'production'`.
- Cloudflare R2 image hosting; admin upload UI per property.
- Custom domains per hotel (Cloudflare DNS → Railway).
- Real copy + room descriptions in DB (move out of `AvailabilityResults.tsx` `ROOM_DESCRIPTIONS`).
- JSON-LD Hotel schema on each homepage.
- `next/font` swap for the Google Fonts `<link>` in `layout.tsx`.

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

## Open questions — Cloudbeds API discovery

Karol is investigating these directly via the Cloudbeds dashboard + dev portal — no need to involve Manuel. Block Steps 6 / 7 on the relevant answers.

- **Q1 — Cancellation policy + `isRefundable` source.** `getRatePlans` (with `detailedRates: true`) doesn't return cancellation policy fields. Probed `/getCancellationPolicies`, `/getRatePlanDetails`, `/getPolicies` — all 404. The smoke test ran against a partner test account where rate plans aren't fully configured, so missing data may simply be missing config. Two paths:
    - Set up a real rate plan with a cancellation policy in Cloudbeds, re-run the smoke test, and inspect what comes through. Likely there's a field we haven't seen yet.
    - If the API genuinely doesn't expose policy at all: configure cancellation policy + `isRefundable` in our admin UI per rate plan; snapshot to `bookings.cancellationPolicySnapshot` at booking time. (`ratePlans.cancellationPolicy` + `ratePlans.isRefundable` schema fields stay either way — only the population path changes.)

- **Q2 — Items scope name.** `getItems` / `getItemCategories` returned `Scope required for this call was not granted by property`. Our current scopes don't include any item-related entry. Need to check the dev portal scope list for the right names (likely `read:item` / `write:item`) and add them to both the dev portal config + `SCOPES` in `src/app/api/cloudbeds/oauth/start/route.ts`. Re-OAuth required afterwards (old tokens won't carry the new scopes).

- **Q3 — Are items property-feature-gated?** The error message says "by property", which could mean per-property feature toggle vs. just app-level scope. Confirm in Cloudbeds — if some properties don't expose items at all, the extras workstream needs a fallback (e.g. our own minimal extras catalog when Cloudbeds doesn't have one).

- **Q4 — Webhook subscription endpoint + event names.** `getWebhooks` works (returns subscriptions list, currently empty). We need the corresponding subscribe endpoint name (likely `postWebhook`) plus the exact event names for `reservation/created`, `rate_status_changed`, etc. Check the dev portal webhook docs.

- **Q5 — `ratePlanAddOns` vs `getItems` for breakfast / similar.** The detailed rate plan response includes a `ratePlanAddOns` array (empty in the test account). It's possible breakfast and similar package add-ons live attached to rate plans rather than as standalone items. If yes, our extras model needs to distinguish "rate-bundled add-ons" (already priced into the rate the guest sees) from "standalone extras" (items the guest opts into).

When answers come in, fold the resolved fields back into Steps 6 / 7 and remove from this list.

---

## Open design questions (do not build yet)

- **Reservation creation failure** (Stripe succeeds, `postReservation` fails). Land the happy path in Step 11; design the retry / pending-state / auto-refund flow before launch.
- **Error state UX** — payment fails, room sold out between selection and payment, 3DS fails, Cloudbeds down. Decide during Phase 3 / Phase 4.
- **Address field in checkout** — TBD design.

---

## Engineering reminders

- **3DS on SetupIntent** runs at save; doesn't guarantee the off-session charge bypasses 3DS later. The Step 14 grace path covers issuer-required reauth.
- **Application fee currency** — fees come in the charge currency; Stripe FX-converts to the platform payout currency. Reporting/reconciliation awareness.
- **Statement descriptor** — on direct charges, the connected account's base descriptor dominates. We use `statement_descriptor_suffix: "ROCKENUE"` only, capped so combined ≤22 chars.
