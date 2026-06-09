# Mews Integration — Quirks & Handoff

**Read this first if you're picking up the Mews PMS integration.** It is the
operational companion to the two design docs:
- **`Mews Integration — Plan for Review.md`** — the design + the §13 review corrections + the §0a/§0b certification questions. *Why* we built it this way.
- **`Booking Engine — Blueprint.md`** — dated session logs (newest at the top). *When* each piece landed.

This file is the **single consolidated list of hard-won Mews API quirks** (scattered across session logs otherwise) plus a precise **"where we are / what's left"**. Last updated **2026-06-08**.

---

## 1. Where we are — TL;DR

**Every demo + build item is DONE and verified on the public Mews demo.** The integration is functionally complete end-to-end: connect → sync (rooms/rates/availability/price/extras) → storefront availability → book → record external payment → post folio extras → cancel (reservation + Stripe refund + folio reversal) → webhooks + availability polling + write-recovery cron. Cloudbeds is untouched and still certified.

**What is LEFT is production-only** (no more demo building):
1. **Certification (P6)** — submit the Mews cert form (list operations + purpose). There is **no** API-choice gate (CQ-1 was resolved as a non-issue, 2026-06-08 — see §6). Request **CQ-2** (`read:customers` scope) explicitly: prod retry-dedup/orphan-adoption needs it.
2. **Prod config** — set `MEWS_WEBHOOK_TOKEN`, register the `/api/mews/webhooks/[token]` endpoint in the Mews integration config, get the dedicated production `ClientToken` + `Client` name, enable the external payment type on the live enterprise, hotel admin issues the prod `AccessToken`, demo→prod swap, delete the `mews-demo-hotel` test property.
3. **One cert-time verification** — confirm per-morning extra posting against a real **`PerPersonPerTimeUnit`** product (see §3, Extras). Everything else is verified.

There is **no half-finished code**. Adapters fully implement the `PmsAdapter` contract for both Cloudbeds and Mews; Mews methods that can't exist on Connector (`postReservationNote`, `subscribe/unsubscribeWebhooks`) are **documented no-ops**, not stubs.

---

## 2. How to develop (no Mews contact needed)

Mews publishes **public shared demo credentials**; you build the entire integration against `https://api.mews-demo.com` with zero outreach. Mews engagement happens only at certification.

**Env vars** (`.env.local`):
- `MEWS_API_URL` — `https://api.mews-demo.com` (demo).
- `MEWS_CLIENT_TOKEN` — our integration token (demo reuses Market Pulse's; prod gets a dedicated one at cert).
- `MEWS_CLIENT_NAME` — `Rockenue BookingEngine 1.0.0`.
- `MEWS_DEMO_ACCESS_TOKEN` — the gross (UK) demo enterprise AccessToken.
- `MEWS_WEBHOOK_TOKEN` — **prod only**, not set on demo (live webhook delivery is untestable on the shared demo).

The shared demo enterprise ("Connector API Hotel (Gross Pricing)") is a **junk drawer** — ~494 services, thousands of products, abundant inventory, lots of inactive/garbage rows. Filter hard (`IsActive`, price, type) and don't expect tidy data. A 1:1 reconciliation against a clean M&F demo property is still pending a cleaner enterprise.

### Verification scripts (all self-cleaning, safe to re-run)

Run with: `set -a && source .env.local && set +a && npx tsx src/scripts/<file>`

| Script | Verifies |
|---|---|
| `mews-probe.ts` | Auth/pagination/timezone smoke against the demo |
| `mews-sync-smoke.ts` | P3 reads — rooms/rates/availability/pricing → native tables, `getAvailability` join |
| `mews-write-smoke.ts` | P4 — create → external payment → cancel via the adapter |
| `mews-refund-smoke.ts` | §7.4 — cancel → recordRefund nets the folio to zero |
| `mews-extras-smoke.ts` | Extras — syncExtras → postExtra (orders/add) → reverseExtra (orderItems/cancel) |
| `mews-soldout-probe.ts` | Sold-out — forces a 0-availability booking, asserts `PmsSoldOutError` |
| `mews-webhook-smoke.ts` | P5 — webhook parser + enterprise→property mapping + dispatched sync |
| `mews-retry-smoke.ts` | Write-recovery — orphan-adopt / fresh-create / no-double-book |
| `migrate-extras-neutral.ts` | One-off migration (already applied to Neon; idempotent) |

**Testing division:** do all backend/CLI verification yourself with these smokes. Only ask the user for visual UI checks (give a URL + what to look at).

---

## 3. The Mews API quirks — the consolidated list

These cost real debugging time. **Read before touching the relevant area.**

### Cross-cutting

- **Read-after-write lag is everywhere.** `reservations/getAll`, `payments/getAll`, and `orderItems/getAll` do **not** reflect a just-written record immediately (seconds of lag). Any verify-after-write must **poll**, not read once. In production the ≥60s `MIN_BOOKING_AGE_SECONDS` covers the retry path; smokes poll explicitly.
- **Operation version suffixes are inconsistent.** Some ops are dated, some not — and guessing wrong returns *"Requested resource does not exist."* Confirmed:
  - `reservations/getAll/2023-06-06` — **dated**.
  - `getAvailability/2024-01-22` — dated, but **don't use it** (see Availability).
  - `payments/getAll`, `orders/add`, `orderItems/getAll`, `orderItems/cancel`, `products/getAll`, `services/getAll`, `rates/getAll`, `rates/getPricing`, `resourceCategories/getAll`, `customers/add`, `customers/getAll`, `reservations/add`, `reservations/cancel`, `payments/addExternal`, `services/getAvailability` (legacy) — **no suffix**.
- **Rate limit:** 200 requests / AccessToken / rolling 30s → 429 with `Retry-After`. Also a **403 "conflicting operation"** when Mews serialises writes per-rate — needs a *longer* backoff than 429. Both are handled in `src/lib/pms/mews/client.ts`.
- **Timezones:** local↔UTC via `Intl.DateTimeFormat('en-CA',{timeZone})` (UTC→local) and `fromZonedTime` (local→UTC) — see `mews/timezone.ts`. Avoids the BST/DST off-by-one-night. `toMewsUtc` emits **milliseconds** (`…:00.000Z`) but Mews returns none (`…:00Z`) → **compare instants (`getTime()`), never strings.**

### Availability (read)

- The **versioned `getAvailability/2024-01-22` rejects our call with "Invalid Metrics"** (needs an explicit Metrics param). **Use the legacy `services/getAvailability`** instead — its `CategoryAvailabilities[].Availabilities[]` is the **absolute, already-netted sellable count** per category/day (nets OOO + other services server-side). Stored directly as `units_available` in `mews_category_availability`.
- **Do NOT subtract `Adjustments`** from the legacy endpoint — `Availabilities` is already absolute; `Adjustments` are informational deltas.

### Rates (read)

- A Mews **Rate is service-wide, not category-bound** (confirmed via live `rates/getAll` — no category field — Mews docs, and Market Pulse's adapter). So we store **one `rate_plans` row per Rate with `room_type_id = NULL`** and the adapter joins category × rate at read time via `mews_rate_prices` (keyed `rate × category × date`). Do **not** explode rate×category into `rate_plans` (would break the `ota_rate_id` = real Rate Id contract).
- **We are NOT bound by the Mews native Booking Engine's rate rules.** That product applies "public + cheapest-per-rate-group, Flex/NR must be in separate groups" logic. We use the **Connector `rates/getAll`** instead and sell **every** rate where `IsActive && IsEnabled && IsPublic` — each becomes its own rate plan, **no cheapest-per-group dedup**, Flex + NR can share a group (confirmed against the live demo: 1711 rates / 72 groups, multiple sellable rates per group; `sync-inventory.ts:174`, `availability.ts:58`). The only visibility gate is `IsPublic` (relaxable in code if a private rate ever needs surfacing).
- **Which-to-display + naming are admin-controlled and PMS-agnostic.** The admin Rates page writes the shared `rate_plans` columns: `is_public` (Shown/Hidden) and `display_name` (booking-engine name; storefront shows `display_name ?? name_public ?? name`). The Mews **sync never overwrites** `is_public` / `display_name` / `is_refundable` / `cancellation_policy` (only sets `is_public=true` on first import), so admin choices **survive every re-sync**. Same mechanism as Cloudbeds — the admin route + storefront read path are shared. (Admin Rates copy made PMS-aware 2026-06-09, commit `c7b1754`.)

### Reservations — create

- **`TimeUnitPrices` require valid `TaxCodes`** or Mews 400s *"Invalid TaxCodes."* Pull them from `rates/getPricing` for the same rate+category+nights and send our Stripe-matching price as `GrossValue`/`NetValue` (by tax mode) with Mews's tax codes.
- **`CheckRateApplicability: false`** is required so Mews accepts our free-form Stripe-matching prices instead of enforcing rate alignment.
- **`CheckOverbooking: true`** (keep) — fail rather than oversell. The sold-out failure shape: **HTTP 403** + Message *"We're very sorry, this property has no availability for the selected dates."* (`Details: null`). Mapped to `PmsSoldOutError` (see §4).
- **`customers/add` enforces email uniqueness** — a repeat guest **must** be reused. Dedupe via `customers/getAll` filtered by `Emails`, but that read is **CQ-2-gated** in prod; degrade to a blind add if the scope is withheld.
- **No idempotency key.** The `Identifier` on `reservations/add` is **transaction-local** and is **never returned** by `reservations/getAll` (no external-id filter). A naive retry **double-books.** See Retry dedup.
- **`PersonCounts` is occupancy only, not price** (we send explicit `TimeUnitPrices` + `CheckRateApplicability:false`). Send adults against the **Adult** age category and children against the **Child** one (`getAgeCategoryIds`, 2026-06-09). A service may have **no Child age category** — then fold children into the adult count so the headcount is still right (don't send a Child entry with an id that doesn't exist on the service). Verified on the gross demo (which has both).

### Reservations — retry dedup (anti-double-book)

- Because there's no idempotency key, the retry path does a **natural-key lookup** (`findMewsReservation`): `reservations/getAll/2023-06-06` filtered by `ServiceIds` + a `ScheduledStartUtc` window **widened ±1 day** + non-cancelled `States`, then matched client-side on **AccountId (= the email-resolved customer) + exact StartUtc/EndUtc + RequestedResourceCategoryId**.
- The `ScheduledStartUtc` **lower bound is EXCLUSIVE** — a reservation exactly on check-in is dropped unless you widen the window.
- **Adoption REQUIRES a resolved customer.** If the email can't be resolved (no email, or **CQ-2 withheld**), do **not** adopt on dates+category alone (could grab a *different* guest's identical booking and record this guest's payment on it) — create fresh instead. So **retry-dedup depends on CQ-2 in production.**

### External payments (the money record)

- **Stripe collects; Mews only records.** `payments/addExternal` with `AccountId` = the CustomerId (**required** — so customer creation is mandatory), `ReservationId` (BillId optional — Mews resolves the bill), `ExternalIdentifier` = Stripe PaymentIntent id, `Amount` = `{Currency, GrossValue|NetValue}` by **tax mode** (never hardcode), `Type` = an **enabled** external payment type (read `AccountingConfiguration.EnabledExternalPaymentTypes` at connect).
- **Refund = a second `payments/addExternal` with a NEGATIVE value.** Mews has **no refund op for external payments** (`payments/refund` only takes `CreditCardPayment`/`AlternativePayment`). Verified the negative add is accepted and nets the ledger to zero.
- **A received payment is reported as a NEGATIVE GrossValue** on `payments/getAll` (it's a credit). So the original +charge and the −reversal cancel to zero — don't be confused by the signs.

### Extras (products / folio add-ons)

- Extras are **products** on their own **Orderable** services (POS/F&B/Minibar), **never** the accommodation (Reservable) service. `orders/add` with the accommodation `ServiceId` → **"Invalid ServiceId."**
- A Mews enterprise has **many** Orderable services, so the **admin picks** which feed the booking engine (`pms_credentials.extrasServiceIds`, multi-select on the connect screen). `syncExtras` only pulls `products/getAll` for those.
- **Posting = `orders/add` `ProductOrders:[{ProductId,Count}]`** + `LinkedReservationId` + the product's `ServiceId` + `AccountId`. Decision (2026-06-08): **ProductOrders, not ad-hoc `Items`** — keeps Mews accounting/tax/reporting correct; price-match comes from syncing the product's gross price. (`Items` would need an `AccountingCategoryId` + `TaxCodes` per line and lose the product link.)
- `orders/add` returns an **`OrderId`** which **is the product service-order id**. We store it as the folio-line id.
- **Date a folio line via order-level `ConsumptionUtc`** (2026-06-09). Per-line `ProductOrder` `StartUtc/EndUtc` are **not** used with `orders/add` (Mews docs). Since per-guest-per-night extras post **one order per chosen morning**, set `ConsumptionUtc = toMewsUtc(morning, enterpriseTz)` on each call so every breakfast line lands on its own service date. Without it Mews dates them all to the order day.
- **Order items carry `ServiceOrderId` + `AccountingState`, NOT an `OrderId` field.** To reverse: `orderItems/getAll {ServiceOrderIds:[OrderId]}` → collect non-`Canceled`/`Inactive` item ids → **`orderItems/cancel {OrderItemIds}`** (this op is **beta**; max **10 ids/call**).
- Mews **auto-adds `CityTax`** line items to an order — cancelling the service order's items removes them too.
- **CAVEAT (verify at cert):** per-morning posting (one ProductOrder per chosen morning, `Count` = guests) is verified for **`Once`**-posting products. A **`PerPersonPerTimeUnit`** product might let Mews multiply by nights itself → risk of double-posting. Confirm against the real M&F breakfast product. `ChargingMode` values seen: `Once`, `PerTimeUnit` (docs also: `PerPerson`, `PerPersonPerTimeUnit`); we seed `pricingModel` from it (`PerPersonPerTimeUnit`→`per_guest_per_night`, else `per_stay`), admin override preserved on re-sync.

### Notes

- **Connector has NO post-creation note operation.** `Notes` exists **only** on `reservations/add`. The booking flow posts its staff note (the extras breakdown) *after* creating the reservation, so there's nowhere to put it on Mews → `MewsAdapter.postReservationNote` is a **documented no-op**. The breakdown is instead visible on the folio as the named ProductOrder lines. (There is currently **no** guest-special-requests field flowing to *either* PMS — a separate pre-existing gap, not Mews-specific.)

### Cancel

- Use the **dedicated `reservations/cancel`** (`ReservationIds`, `Notes` **required**, `PostCancellationFee` default **false**, `SendEmail` default true). **Do NOT** use `reservations/update` with `State:"Canceled"` — its fee default is **inverted** (applies the fee unless told otherwise).
- Refund happens in **Stripe**; the folio is reconciled by the §7.4 compensating external payment + (for extras) `orderItems/cancel`.

### Webhooks

- **No `*AvailabilityUpdated` event exists.** React to `ServiceOrderUpdated` (reservation change) + `ResourceBlockUpdated` (OOO/block change) by re-running availability sync, and **poll `services/getAvailability` on a schedule** as the real no-oversell safety net (the inventory-sync cron).
- Mews General Webhooks are **integration-level** (one endpoint for the whole `ClientToken`), configured in the Mews integration config at certification — **not** via a per-property Connector call. So `subscribe/unsubscribeWebhooks` are documented no-ops and there's no per-property subscription table.
- Endpoint security: a **shared-secret token in the URL** (`/api/mews/webhooks/[token]`, `MEWS_WEBHOOK_TOKEN`, `timingSafeEqual`, wrong token → 404). **No HMAC/signature/IP allow-list.** **5s SLA** — respond 2xx immediately, process async. Map enterprise→property via the **plaintext** `pms_credentials.enterpriseId` (only the AccessToken is encrypted — no decrypt needed).

### Tooling quirk (not Mews)

- The **neon-http driver chokes on a 3-column inner join** between `mews_category_availability` and `mews_rate_prices` (returns a bare "Failed query" with no PG detail). Split into two simple queries instead (see `mews-soldout-probe.ts`). Not a product-code path — only bit a smoke script.

---

## 4. Architecture map (key files)

- **Contract:** `src/lib/pms/types.ts` — the `PmsAdapter` interface + neutral param types. `src/lib/pms/index.ts` — `getPmsAdapter(property)` factory on `properties.pms_type`.
- **Errors:** `src/lib/pms/errors.ts` — `PmsSoldOutError` + `isMewsSoldOut`.
- **Cloudbeds adapter:** `src/lib/pms/cloudbeds-adapter.ts` — thin delegation to `src/lib/cloudbeds/*` (zero behaviour change). `findExistingReservation` + `recordRefund` return null (out of scope), `reverseExtra` = negative custom item.
- **Mews adapter:** `src/lib/pms/mews-adapter.ts` → `src/lib/pms/mews/`:
  - `client.ts` (auth triple, pagination, 429/403 backoff, `MewsApiError`), `timezone.ts`, `credentials.ts` (decrypt token + creds incl. `extrasServiceIds`), `config.ts` (connect-time facts incl. `orderableServices`).
  - `sync-inventory.ts`, `availability.ts`, `sync-hotel-details.ts`, `sync-extras.ts`.
  - `reservations.ts` — create / find / external payment / **external refund** / **product order** / **reverse extra** / cancel.
  - `webhooks.ts`.
- **Neutral DB columns** (so the booking flow is PMS-agnostic, reusing Cloudbeds-named columns as the neutral home):
  - `bookings.cloudbeds_reservation_id` holds the **Mews reservation id** for Mews properties (the neutral "pms reservation id"). `bookings.pms_payment_id` holds the external payment id.
  - `booking_extras.cloudbeds_item_id` holds the **Mews OrderId(s)** (comma-joined per morning) — reused as the neutral folio-line id.
  - `property_extras` neutralised: `cloudbeds_addon_id` nullable, **`ota_extra_id`** (Cloudbeds addon id OR Mews ProductId, unique per property), **`pms_service_id`** (Mews Orderable service).
  - Mews-native: `mews_category_availability` (`units_available`), `mews_rate_prices`.
  - `properties.pms_type` (`cloudbeds`|`mews`) + `properties.pms_credentials` (encrypted AccessToken + service/tax/payment/`extrasServiceIds`).

---

## 5. Certification checklist (P6)

- [ ] Submit the Mews certification form — list the operations we use + their purpose. **No API-choice approval is involved** (§6).
- [ ] Request **CQ-2** (`read:customers` / `customers/getAll`) explicitly — retry-dedup + extras email-dedupe need it; the code degrades gracefully without it but prod orphan-adoption can't run.
- [ ] Get the dedicated production `ClientToken` + `Client` name (demo reuses Market Pulse's).
- [ ] Set `MEWS_WEBHOOK_TOKEN` + register `/api/mews/webhooks/[token]` in the Mews integration config (live webhook *delivery* is untestable on the shared demo).
- [ ] Enable the external payment type on the live enterprise; hotel admin issues the prod `AccessToken`.
- [ ] Verify per-morning extra posting against a real **`PerPersonPerTimeUnit`** product (the one unverified extras path).
- [ ] Demo→prod swap; delete the `mews-demo-hotel` test property from prod DB before launch.
- [ ] (Optional enhancement) Immediately unwind a sold-out booking where money was taken, instead of waiting for the grace-expiry refund (`cron/pms-retry` → `giveUpAndUnwind`).

---

## 6. CQ-1 — resolved, do not re-raise

CQ-1 was originally framed as a "make-or-break" doctrine conflict: Mews docs steer guest-facing booking engines to the **Booking Engine API**, but our money model (`payments/addExternal`) is a **Connector** capability. **Resolved 2026-06-08** by checking the live docs: certification *"will be based on the information provided in the certification form regarding selected API operations and their purpose of use"* and *"does not question processes on the partner side."* **There is no certification gate on API choice** — Mews only checks the calls are technically correct, not which API you picked. The Connector→Booking Engine steering is a soft recommendation, not a rule. So building the booking engine on Connector is fine. **CQ-2 is the only open Mews question.**
