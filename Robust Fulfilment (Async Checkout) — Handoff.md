# Robust Fulfilment / Async Checkout — Handoff

**Read this first if you're picking up the booking-fulfilment rework (0b + Phase 2).**
Last updated **2026-06-09**. Companion to `Booking Engine — Blueprint.md` (see its
**2026-06-09 session log "Robust fulfilment Step 0a"** for the dated entry).

This document is the **single source of truth** for the async-checkout work stream.
It records *exactly* what was built and verified in **Step 0a**, the design decisions
and references behind it, the invariants you must not break, and a precise plan for
the two remaining steps (**0b** and **Phase 2**). The person who wrote it had full
context; this file is meant to transfer that context losslessly.

---

## 1. Why this exists — the goal

The booking engine collects payment via **Stripe Connect** and creates the reservation
in the hotel's **PMS** (Cloudbeds or Mews) + records an external payment. Historically
that PMS write happened **inline and awaited** inside `POST /api/bookings`, which the
browser calls *after* confirming the card. Two problems:

1. **Durability.** If the browser dies (crash/close/network) after the card succeeds
   but before/while `/api/bookings` runs, you can take money with **no reservation**.
2. **Speed.** Checkout blocks on the slow PMS write (Mews has read-after-write lag),
   which the user experienced as "stuck processing for ages".

The fix is the industry-standard shape, in three principles:

1. **The payment provider is the source of truth — fulfil on the webhook, not the
   browser.** Stripe: *"fulfil orders asynchronously from `payment_intent.succeeded`,
   not the client/redirect."* ([Stripe — handling payment events](https://docs.stripe.com/payments/handling-payment-events))
2. **The checkout request returns fast (async request-reply / HTTP 202 + status poll).**
   ([Azure Architecture Center — Async Request-Reply](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply))
3. **The slow work runs in durable, idempotent background fulfilment with reconciliation.**

We also did market/precedent research confirming our money model (collect on our own
Stripe + record an external payment in Mews + take a platform fee) is permitted and
done in the market — see the separate Mews docs / the chat research summary. Not
needed to implement this; mentioned so you don't re-litigate it.

### The phased plan
- **0a — DONE & VERIFIED.** Extract one idempotent `fulfilBooking()`; drive it from
  three triggers (inline, Stripe webhook, retry cron). Backend only. Checkout UX
  **unchanged** (still synchronous, still returns the reservation #).
- **0b — DONE & BACKEND-VERIFIED (2026-06-09).** Create-before-pay: the booking row +
  extras intent are persisted at `init` time (email entry), guest details patched
  before the card is charged, finalise verifies + fulfils. Webhook hardened to backfill
  Stripe state (esp. the Flex saved payment method) + flip status on a browser-death
  rescue. **Backend + browser-death smoke pass; awaiting Karol's 3-theme UI click-
  throughs** (see §5 "SHIPPED" + §10). Checkout UX still synchronous (still returns the
  reservation #).
- **Phase 2 — NOT STARTED.** `/api/bookings` returns **202**; the confirmation page
  polls `/status` ("finalising…"). The actual fast-checkout win. **Needs a confirmation
  -page mockup first** (house rule: UX changes get an HTML mockup before code). 0b is now
  in place as its prerequisite.

**0a alone is a real, shippable robustness win** even if Phase 2 never happens; 0b closes
the browser-death-before-`/api/bookings` window and unblocks Phase 2.

---

## 2. Step 0a — what was shipped (the current state of `main`/working tree)

> All of §2 is **implemented and verified** (see §4) and **committed** (2026-06-09,
> direct to `main` with the rest of the day's Mews-hardening work).

### 2.1 `src/lib/pms/fulfil-booking.ts` — the one idempotent fulfilment unit (NEW)

`fulfilBooking(bookingId: string): Promise<FulfilResult>` does the entire PMS side of a
booking and is **safe to call from anywhere, concurrently, repeatedly**:

create-or-adopt reservation → post folio extras (from persisted intent) → record the
external payment (NR) → staff note → guest confirmation email → set status `pms_synced`.

`FulfilResult.outcome` is one of: `"synced" | "locked" | "sold_out" | "failed"`
(+ `pmsReservationId`, `cancelUrl`, `reason`).

**Concurrency / idempotency model (do NOT weaken this):**
- **Optimistic claim lock.** First thing it does is atomically set
  `bookings.fulfilment_locked_at = now()` *only if* the lock is null or older than
  `LOCK_STALE_MS` (2 min). If it doesn't win the claim → returns `outcome:"locked"`
  and does nothing (another trigger is handling it). The lock is released in a
  `finally`. This is what stops two triggers creating two reservations.
- **Every step is individually guarded**, so a re-run only does what's missing:
  - reservation: skipped if `bookings.cloudbeds_reservation_id` already set; otherwise
    `pms.findExistingReservation()` (adopt — Mews has no idempotency key) then
    `pms.createReservation()`. The id is **persisted immediately** (persist-first)
    before anything else, so a crash can't cause a duplicate create.
  - extras: per `booking_extras` row, skipped if `cloudbeds_item_id` already set.
  - payment: skipped if `bookings.pms_payment_id` already set (NR only; Flex records
    payment later at auto-charge).
  - email: `bookings.confirmation_email_sent_at` is claimed atomically *before* the
    send, so it sends **exactly once**; the send itself is **fire-and-forget** (so it
    never blocks the checkout response) and **rolls the slot back** if it throws.
- **Sold-out**: a `PmsSoldOutError` from `createReservation` returns `outcome:"sold_out"`
  (mapped to a 409 upstream), it is NOT a `failed`.

**Neutral PMS id columns:** `bookings.cloudbeds_reservation_id` is the *neutral* PMS
reservation id (it holds the **Mews** reservation GUID for Mews properties — this naming
is legacy, see the Mews handoff). `pms_payment_id` is the external payment id.

### 2.2 Schema additions (additive, already `drizzle-kit push`ed to Neon)

- `bookings.fulfilment_locked_at timestamptz` — the optimistic claim lock.
- `bookings.confirmation_email_sent_at timestamptz` — the send-once guard.
- `booking_extras.property_extra_id uuid → property_extras(id)` — links the booking's
  extra to the catalogue row so fulfilment can resolve the Mews product/service id (or
  Cloudbeds addon) at post time.
- `booking_extras.posting_plan jsonb` — the resolved posting plan:
  `{ model: "per_stay" | "per_guest_per_night", perMorning?: number, mornings?: string[] }`.

### 2.3 `src/app/api/bookings/route.ts` — refactored (CERTIFIED PATH — be careful)

The big inline `try { createReservation … postExtra … recordPayment … email } catch`
block is **gone**. The route now:
1. (unchanged) validates, idempotent-short-circuits on existing `orderId`, re-checks
   availability (PMS-aware), verifies the Stripe PI/SI, computes the price split +
   cancellation snapshot + `chargeAt`, inserts the `bookings` row + `booking_day_rates`.
2. **NEW:** inserts the **extras intent** — one `booking_extras` row per selected extra,
   carrying `property_extra_id` + `posting_plan` (per-morning plan resolved server-side
   from the trusted catalogue + sanitised guest config). **No PMS calls here.**
3. **NEW:** `const result = await fulfilBooking(booking.id)` — fulfils inline (happy path).
4. Maps the outcome: `sold_out` → **409 `{code:"room_sold_out"}`**; not `synced` → **502**
   (booking + intent are persisted, so the webhook/cron will finish it); `synced` → **200**
   with `cloudbedsReservationId` + `cancelUrl`.

**Observable behaviour is identical to before** (synchronous, returns the reservation #).
**Bonus:** this fixes the old *"extras list is lost if the PMS write fails"* limitation —
extras are persisted *before* the post, so a retry can complete them.

### 2.4 `src/app/api/stripe/webhooks/route.ts` — fulfilment trigger added

`payment_intent.succeeded` and `setup_intent.succeeded` now call `rescueStuckBooking(orderId)`
(was log-only). It loads the booking by `orderId` and fires `void fulfilBooking(id)` **only if**:
the row exists, isn't already synced, isn't cancelled/failed, and is **older than
`WEBHOOK_FULFIL_MIN_AGE_MS` (60s)**. The age-gate means it **never races the inline
`/api/bookings` path** — it only rescues genuinely stuck or webhook-re-delivered bookings.
Fire-and-forget keeps the webhook fast (Stripe 2xx SLA); the cron is the final backstop.

> **0a limitation (closed by 0b):** in 0a the booking row is still created *inside*
> `/api/bookings`. So if the browser dies *before* `/api/bookings` runs, there is **no
> row** for the webhook to rescue (Stripe metadata carries only `orderId`, not the full
> booking). The webhook wiring is in place; 0b makes it fully effective by persisting the
> row at payment-intent time.

### 2.5 `src/lib/pms/retry-pms.ts` — simplified to use `fulfilBooking`

`retryPmsForBooking()` previously duplicated the create/adopt/payment/email logic (and
**did not** post extras). It now: bumps the attempt counter + anchors `first_pms_failure_at`;
if `> MAX_ATTEMPTS` (12 ≈ 1h) → `giveUpAndUnwind()` (refund NR / detach Flex PM → status
`failed`, unchanged); else → `await fulfilBooking(booking.id)` and maps the outcome.
`findEligibleBookings()` is unchanged (`status IN ('paid','payment_authorized')` AND
`cloudbeds_reservation_id IS NULL` AND `created_at < now()-60s`). **Recovered bookings now
also restore their extras + the rich confirmation email** (previously omitted).
The cron route `src/app/api/cron/pms-retry/route.ts` is unchanged (still calls
`findEligibleBookings` + `retryPmsForBooking`).

### 2.6 `src/app/api/bookings/[id]/status/route.ts` — poll endpoint (NEW)

`GET /api/bookings/[id]/status` → `{ bookingId, orderId, state, status, rateType,
reservationNumber }` where `state ∈ pending | confirmed | failed | cancelled`
(`confirmed` once `cloudbeds_reservation_id` is set). Built for Phase 2's polling; not
yet consumed by any UI.

### 2.7 `src/scripts/mews-fulfil-smoke.ts` — new smoke (keep)

Persists a booking + day-rates + a `per_guest_per_night` extras intent on
`mews-demo-hotel`, runs `fulfilBooking` twice, asserts the 2nd run creates **no** second
reservation / payment / email / extra (idempotency), then self-cleans. Run:
`set -a && source .env.local && set +a && npx tsx src/scripts/mews-fulfil-smoke.ts`.

---

## 3. Invariants you MUST preserve in 0b / Phase 2

1. **`fulfilBooking` stays the only place that writes a reservation/extra/payment to the
   PMS.** Don't reintroduce inline PMS calls in routes. Add triggers, not parallel logic.
2. **The claim lock + per-step guards are the anti-double-book mechanism.** If you add a
   trigger (e.g. Phase 2's `after()`), it must go through `fulfilBooking` so the lock holds.
3. **A booking is only fulfillable once its guest details are persisted.** Mews requires
   `LastName`; Cloudbeds requires an ISO country. In 0b the row is created before details
   are known — so **fulfilment must not run until details are patched** (see §5 ordering).
4. **The retry cron gates on `status IN ('paid','payment_authorized')`.** A `pending`
   (pre-payment) row is correctly ignored by the cron until it's flipped post-payment.
   Keep that gate; it's how create-before-pay stays safe.
5. **`orderId` is the cross-cutting idempotency key** (Stripe idempotency key + metadata +
   `bookings.order_id` unique). Don't mint a second id.

---

## 4. How 0a was verified (so you can trust it)

- `tsc --noEmit` clean; `eslint` clean on all changed files.
- Smokes (all against the public Mews gross demo via the real adapter):
  - `mews-fulfil-smoke` — **PASS**, idempotent (1st run creates everything, 2nd run no
    duplicates).
  - `mews-write-smoke`, `mews-extras-smoke` — **PASS** (adapter unchanged).
  - `mews-retry-smoke` — **13/13** (now routed through `fulfilBooking`).
- **Live end-to-end through the real `/api/bookings` HTTP route** (storefront, dev server):
  a Flex booking on `mews-demo-hotel` → **Mews reservation #77001, State Confirmed**,
  22–24 Jun, service `Accommodation (real)`; confirmation email sent; status `pms_synced`.
  (Earlier the same day, pre-0a, booking #76602 verified the old path.)

Note: `mews-demo-hotel` now has extras wired (`extrasServiceIds` = the `breakfast - FnB`
Orderable service; 2 products: `Breakfast-test-qa £20`, `desayuno €20`). The €-priced one
is junk demo data — pick a clean service per real hotel.

---

## 5. Step 0b — create-before-pay — **SHIPPED 2026-06-09** (backend-verified)

> The plan below (kept for context) was implemented with one refinement: the "confirm"
> step is **two calls** around the card charge — a lightweight **details patch** (before
> charge) and the existing **finalise** (after charge) — not one. And the webhook needed
> **hardening** to make the rescue complete for Flex. What actually shipped:
>
> **New/changed files**
> - `src/lib/booking/prepare-booking.ts` (NEW) — shared validation + availability
>   re-check + price split + cancellation snapshot + `chargeAt` + extras-intent builder.
>   Used by **both** `init` and finalise so they can't drift. Throws `PrepareBookingError`.
> - `src/lib/stripe/intents.ts` (NEW) — `createBookingPaymentIntent` /
>   `createBookingSetupIntent`. The two standalone intent routes are now thin wrappers;
>   `init` reuses the same functions (no drift on settlement routing / idempotency keys).
> - `src/app/api/bookings/init/route.ts` (NEW) — fires on email entry. `prepareBooking`
>   → insert **`status:"pending"`** row (name placeholders, email optional — some themes
>   render Stripe before email) + day-rates + extras intent → create Stripe PI/SI →
>   persist intent ids → return `{ bookingId, clientSecret, paymentIntentId|setupIntentId,
>   customerId }`. Idempotent on `orderId` (re-fires reuse the row + re-issue the intent).
> - `src/app/api/bookings/[id]/details/route.ts` (NEW) — patches guest name/country/phone
>   onto the **pending** row, called **before** the card is charged. Guarded to
>   `status:"pending"` (won't rewrite a finalised reservation). Idempotent.
> - `src/app/api/bookings/route.ts` (REFACTORED) — now **verify-and-fulfil**: find row by
>   `orderId` (created by `init`); already-synced → idempotent return; else patch final
>   details + verify the Stripe intent + flip `pending → paid/payment_authorized` +
>   `fulfilBooking`. **Create-if-absent fallback** via `prepareBooking` kept for pre-0b /
>   standalone callers. The big inline block is gone.
> - `src/lib/stripe/rescue-booking.ts` (NEW) — extracted the webhook rescue so it's unit-
>   testable. On `payment_intent.succeeded` / `setup_intent.succeeded` it now **(1)
>   backfills** missing Stripe ids — critically the **Flex saved payment method**
>   (`si.payment_method`), without which the auto-charge cron skips the booking forever —
>   and **(2) flips** `pending → paid/payment_authorized` so the row becomes retry-cron-
>   eligible even if the immediate (age-gated) rescue defers. `src/app/api/stripe/webhooks
>   /route.ts` now imports it.
> - `src/lib/booking/submitBooking.ts` (+`index.ts`) — added `initBooking()` +
>   `patchBookingDetails()` (throws on failure → we never charge a card we couldn't attach
>   details to). `submitBooking()` unchanged (still the finalise call).
> - The **3 checkout clients** (default / Portico / Street) — email-time fetch now calls
>   `initBooking` (stores `bookingId` in a ref); `handleSubmit` calls
>   `patchBookingDetails` **before** `stripeForm.confirm()`, then `submitBooking`.
>
> **No schema change** (reused 0a's columns). **Verification:** `tsc` + `eslint` clean
> (only the 2 pre-existing `property.slug` warnings); new
> `src/scripts/bookings-init-smoke.ts` PASS (prepareBooking correctness; NR + Flex
> browser-death rescue through the **real** `rescueStuckBooking` incl. the Flex PM
> backfill + age-gate; idempotency); `mews-fulfil-smoke` PASS; `mews-retry-smoke` 13/13.
> **Still needs Karol:** the 3-theme × NR+Flex × Mews+Cloudbeds **visual click-throughs**
> (see §10), incl. the kill-the-tab-after-charge durability check.

**Goal:** the full booking row + extras intent exist server-side **before** the card is
confirmed, so fulfilment never depends on the browser. This is also the foundation
Phase 2 builds on.

### The wrinkle that shapes the design (important)
In the current checkout, the Stripe **intent is created when the guest types their email**
— at which point we only know `orderId` + email. The guest's **name / country** are filled
later, and only sent at the final click. But fulfilment **needs** name + country. So
create-before-pay is **two server writes**, in this order:

1. **`init`** (fires when email is entered, replacing the current intent-route call):
   persist the `bookings` row with `status:"pending"` (guest name/last stored as `""`
   placeholders — columns are `NOT NULL`), `booking_day_rates`, and the **extras intent**
   rows; create the Stripe PI/SI. Return `{ clientSecret, bookingId, paymentIntentId |
   setupIntentId, customerId }`.
2. **`confirm`** (fires on the final click, **before** `stripeFormRef.confirm()` charges
   the card): patch `guest_first/last/country/phone` onto the row and flip `status` to
   `paid`/`payment_authorized`-equivalent **only after** verifying the intent. Then trigger
   fulfilment.

**Ordering invariant (this is the whole point):** guest details must be persisted
**before** the card is confirmed, so that if the browser dies right after the charge, the
webhook has everything it needs. Concretely the client does:
`init` → user fills details → click → **`POST confirm` (patch details)** → **`stripeForm.confirm()`** →
verify + `fulfilBooking` (inline, to keep the synchronous reservation-# UX in 0b) — and
the **webhook/cron** are the backstop if that last step is lost.

Keep `status:"pending"` until details are patched + payment verified, so the retry cron
(which only picks `paid`/`payment_authorized`) never fulfils a detail-less row (invariant §3.3/§3.4).

### Files to touch
- **`src/app/api/stripe/payment-intent/route.ts` + `setup-intent/route.ts`** — either fold
  their logic into a new `POST /api/bookings/init`, or have `init` call them. `init` is the
  new single entry the checkout clients hit when email is entered. It must do the same
  server-side validation `/api/bookings` does today (availability re-check, price split,
  cancellation snapshot, `chargeAt`) — **extract that into a shared helper** so `init` and
  `/api/bookings` don't drift.
- **`src/app/api/bookings/route.ts`** — becomes "verify + fulfil an existing row":
  find the row by `orderId` (now created by `init`), patch any final guest details, verify
  the Stripe intent, call `fulfilBooking`, return the reservation #. (Its current
  create-if-absent behaviour can stay as a fallback for safety.)
- **`src/lib/booking/submitBooking.ts`** — split into `initBooking()` (or extend) +
  `confirmBooking()`, or keep `submitBooking` as the confirm step and add an init call.
- **The THREE checkout clients** (each calls the intent route + `submitBooking` today):
  - `src/app/[property]/checkout/checkout-client.tsx` (default theme)
  - `src/themes/portico/screens/Checkout.tsx`
  - `src/themes/street/screens/Checkout.tsx`
  Each must: call `init` when email is entered (instead of the raw intent route, getting
  back `bookingId` + clientSecret), then on submit call `confirm` (patch details) → confirm
  the card → finalise. The Stripe mount + `StripePaymentSection` are shared and don't change.

### Verification (this is the part that can't be smoked)
0b is **frontend across 3 themes** → it needs **real browser click-throughs**, NR + Flex,
on each theme (default, Portico, Street). That's the testing split: the implementing AI
does the backend/CLI checks; the human does the visual UI confirmation (give them the URL +
what to look at). Use `mews-demo-hotel` (Mews) and a Cloudbeds property (e.g. Lancaster /
the test hotel) to cover both PMSs.

### Definition of done for 0b
- Booking row + extras intent exist after `init`, before any card confirm.
- Killing the browser between card-confirm and the finalise call still results in a
  fulfilled booking (via the webhook) — test by simulating (e.g. don't call the finalise
  step; confirm the webhook/cron completes it).
- All 3 themes book NR + Flex end-to-end with reservation # shown, unchanged UX.

---

## 6. Phase 2 — 202 + status polling (NOT STARTED) — plan

Once 0b persists the row pre-pay, make checkout **fast**:
- After `confirm` (details patched + intent verified), return **HTTP 202** + `bookingId`
  immediately instead of awaiting `fulfilBooking`. Run fulfilment via the webhook (already
  wired) and/or Next 16 `after()` (must still go through `fulfilBooking` — invariant §3.2).
- The confirmation page polls **`GET /api/bookings/[id]/status`** (already built) until
  `state:"confirmed"` (show reservation #) or `state:"failed"`. Show a **"finalising your
  reservation…"** interim state.
- **Mockup first** for the confirmation "finalising…" state (house rule). Then wire it.

### The honest trade-off to surface to Karol again at Phase 2
Async fulfilment means the guest is told "confirmed" *before* the PMS write, so a room that
sells out in that window becomes a **post-hoc unwind (auto-refund) + apology** instead of the
current inline "pick another room" 409. The pre-pay availability re-check + `CheckOverbooking`
shrink the race; the grace/refund path (`giveUpAndUnwind`) handles the residue. Mews Connector
has no clean inventory-hold primitive, so this residual race is accepted + documented, not
eliminated. Don't ship Phase 2 without Karol re-confirming he's OK with that.

---

## 7. Gotchas / lessons from 0a (save yourself the debugging)

- **Dev server compiles routes on first hit** — a cold `/api/bookings` in `npm run dev`
  takes seconds the first time. Don't mistake that for the architecture being slow; prod
  is pre-compiled. (This was part of the original "stuck for ages" report.)
- **Deleting a test booking hits FK constraints**: `email_sends` and `payment_events`
  reference `bookings`. Delete those children first (see `mews-fulfil-smoke` cleanup).
- **The confirmation "Reservation Number" shown to the guest is the PMS reservation GUID**
  (`cloudbeds_reservation_id`), not the human Mews number. The human number (e.g. 77001)
  comes from `reservations/getAll` `.Number`. Fine as-is, just know it.
- **Mews read-after-write lag** is everywhere — any verify-after-write must poll (the
  smokes do). See the Mews handoff for the full quirk list.
- **`fulfilBooking`'s email is fire-and-forget on purpose** — don't `await` it back into the
  request path or you re-add checkout latency.
- **`getPmsAdapter` is still imported in `/api/bookings`** for the availability re-check —
  that's expected; the reservation/extra/payment calls all moved into `fulfilBooking`.

---

## 8. Open decisions for Karol (don't assume)

- **Whether to do 0b at all now.** 0a already delivered ~90% of the durability win; 0b only
  closes the ~1–2s browser-death-before-`/api/bookings` window. Its main value is being the
  **prerequisite for Phase 2 (fast checkout)**. If fast checkout matters → do 0b. If only
  robustness mattered → 0b is optional polish.
- **Phase 2's sold-out trade-off** (§6) — needs explicit sign-off.
- **Commit cadence** — 0a is committed (2026-06-09, direct to `main`). 0b/Phase 2 are
  unstarted.

---

## 9. File map (touched/added in 0a)

```
NEW   src/lib/pms/fulfil-booking.ts            the idempotent fulfilment unit
NEW   src/app/api/bookings/[id]/status/route.ts  poll endpoint (Phase 2)
NEW   src/scripts/mews-fulfil-smoke.ts          idempotency smoke
EDIT  src/app/api/bookings/route.ts             persist-then-fulfil (certified path)
EDIT  src/app/api/stripe/webhooks/route.ts      rescueStuckBooking on PI/SI success
EDIT  src/lib/pms/retry-pms.ts                  delegates to fulfilBooking
EDIT  src/db/schema.ts                          +4 additive columns (pushed to Neon)

For 0b you'll touch:
      src/app/api/stripe/payment-intent/route.ts, setup-intent/route.ts
      src/app/api/bookings/route.ts (→ verify+fulfil existing row) + a new init endpoint
      src/lib/booking/submitBooking.ts
      src/app/[property]/checkout/checkout-client.tsx
      src/themes/portico/screens/Checkout.tsx
      src/themes/street/screens/Checkout.tsx
```

## 10. 0b — Karol's manual UI checklist (the part smokes can't cover)

Run on the dev server (`npm run dev`). Cover **both PMSs** and **both rate types** on
**each theme** (default, Portico, Street).

1. **Happy path (each theme × NR + Flex × Mews `mews-demo-hotel` + a Cloudbeds hotel):**
   book end-to-end. Expect unchanged UX — confirmation page shows the reservation #.
   - DB sanity: one `bookings` row per booking, `status = pms_synced`,
     `cloudbeds_reservation_id` set, guest name correct (not blank).
2. **Create-before-pay is real:** enter only the **email** on checkout, then check the DB —
   a `bookings` row exists at `status:"pending"` with **no** `cloudbeds_reservation_id`
   *before* you ever click Pay. (Portico/Street render the card before email, so their
   row may show `guest_email = ""` until you type it — that's expected; it backfills.)
3. **Browser-death durability (the whole point):** start a Flex booking, fill details,
   click Pay, and **kill the tab the instant the card confirms** (before the confirmation
   page loads). Then either wait for the Stripe webhook or run the retry cron
   (`/api/cron/pms-retry`). Expect: the reservation still appears in the PMS with the
   **correct guest name**, and (Flex) the row has `stripe_payment_method_id` set so the
   auto-charge cron can later collect.
4. **Extras + breakfast (per-guest-per-night):** book with an Early-Check-In (per_stay)
   and a breakfast (per_guest_per_night) extra; confirm both land on the PMS folio.
5. **Sold-out race:** (Cloudbeds) drop inventory to 0 between landing on checkout and
   paying; expect the "pick another room" 409, not a charge-without-room.

**Edge cases to also hit:**
6. **Failed details-save blocks the charge:** `patchBookingDetails` throws on failure —
   confirm that if it can't save (simulate by killing the network for that one call) you
   see an error and the card is **not** charged.
7. **Email edited / back-and-forward:** change the email after the card mounts, or go back
   to the room page and return. Expect **no duplicate** `bookings` row (init is idempotent
   on `orderId`) and the booking still completes.
8. **Fast-checkout death (<60s):** if you go email→pay→kill-tab in under ~60s, the
   immediate webhook rescue is age-gated; it still flips status to paid/authorized, so the
   **retry cron** completes it on its next run. Verify the booking lands after the cron,
   not just after the webhook.
9. **NR receipt email on Portico/Street:** these create the intent before email, so the
   Stripe receipt may go out without one on a pure NR flow — confirm the **guest
   confirmation email** (our own, sent at fulfilment) still arrives correctly.

**Known follow-up (not a test, a cleanup):** abandoned `init` rows (guest types email,
never pays) now linger as `status:"pending"` forever. Harmless (cron/webhook ignore them)
but they accumulate — worth a TTL sweep eventually.

Report back which theme/PMS/rate combos you ran; I'll fix anything that surfaces.

*End of handoff.*
