# Mews PMS Integration — Design & Plan

**Status:** Revised after expert review · **Date:** 2026-06-05
**Author:** Rockenue Tech (booking-engine team)

> **Review outcome (2026-06-05).** This plan was checked two ways: against our own live Mews Connector integration in the Market Pulse product (`mewsAdapter.js` and `claude/pms/mews.md`), and against the current Mews docs. **Architecture approved** — adapter interface, native-shaped per-PMS storage, Connector + external-payment money model, and phasing are all sound. Six factual corrections from the review are now folded into the body below, and two items are elevated to **certification questions to put to Mews before we build the write path** (see §0a). Items the review explicitly confirmed correct are listed in §15 so we do not second-guess them.

---

## 0. How to read this document

This describes how we add **Mews** as a second PMS to a booking engine already live on **Cloudbeds**. No source access needed: §1–§2 give the product and the contract; §4–§9 give the Mews design mapped to specific Connector API operations; §13 lists what the review resolved; §0a lists what must still be confirmed with Mews.

## 0a. Certification questions to raise with Mews NOW (before building writes)

**No Mews contact is needed to build.** Mews publishes shared, public demo credentials (gross/net token sets + demo test properties) — we develop the entire integration (P1–P5) against `api.mews-demo.com` with zero outreach. Mews engagement is required only at **certification** (P6), where they issue the production `ClientToken` and the hotel admin issues the production `AccessToken`.

The two questions below cannot be answered from the demo environment, so they gate **production**, not building. CQ-1 is worth raising early as cheap risk-insurance because a "no" would change the write-path design; CQ-2 is handled defensively in code regardless.

- **CQ-1 — API choice (the make-or-break).** Mews docs position the **Connector API** as server-to-server and steer *guest-facing booking engines* to the **Booking Engine API**. But our money model — collect via our own Stripe Connect and **record** the charge with `payments/addExternal` — is a **Connector** capability the Booking Engine API does not expose the same way. Genuine doctrine-vs-requirement conflict. Get Mews to bless a public booking engine on Connector or define a hybrid. Raise early (one paragraph); it does not block demo development.
- **CQ-2 — Customer-read scope.** Our **own** scope set is granted at certification (we do **not** inherit Market Pulse's, where `customers/getAll` is blocked). Demo tokens may have it open even though production gates it, so the email-dedupe path must **degrade gracefully** regardless (see §7.1). Request customer-read explicitly at certification.

## 0b. Scopes — we negotiate our own

The booking-engine integration gets a **dedicated** Connector scope set at certification, distinct from Market Pulse's. We will request, at minimum:
`read:reservations`, `write:reservations`, `write:customers`, **`read:customers`** (CQ-2), `read:rates`, `read:services` / availability, `read:products`, `write:payments` (external), and `read:configuration`/accounting.
Until granted, every read scope is treated as **not available by default** and the code degrades (notably customer dedupe — §7.1).

---

## 1. Context — the product and the one hard constraint

Rockenue Tech runs a **direct booking engine** for independent hotels: a hotel-branded site where a guest searches dates, picks a room and rate, adds extras, pays by card, and gets a confirmed reservation in the hotel's PMS.

**The hard constraint:** we collect money ourselves via **Stripe Connect** (funds settle to the hotel's own connected Stripe account; we take a platform fee). The PMS must **not** collect money. Its job is to hold the **reservation** plus a **record that payment was taken externally**, so the front desk and night audit see a paid, reconciled booking. This is exactly how our Cloudbeds integration works today, and it is why we lean on Connector's `payments/addExternal` rather than the Booking Engine API (see CQ-1).

---

## 2. The integration "contract" (from our Cloudbeds integration)

Any second PMS must provide:

**Connection** — connect a property, store credentials, validate, maintain auth.
**Read → our DB** — room types, rate plans, daily availability, daily price, extras catalogue, hotel details (name, currency, timezone, address, check-in/out).
**Write** — `createReservation`, `postExtra` (folio add-on), `recordPayment` (external — no money moves in the PMS), `cancelReservation`, `postReservationNote`.
**Webhooks** — receive PMS-side changes and keep our cached availability correct.

**Money model (all PMSs):** Stripe Connect collects → create the reservation in the PMS → record an external payment referencing the Stripe PaymentIntent. Flex (refundable) rates save the card and charge later via Stripe; non-refundable charge immediately.

---

## 3. Locked decisions

1. **Clean `PmsAdapter` interface**; Cloudbeds and Mews are two implementations behind a factory on `properties.pms_type`.
2. **Connector API** for Mews — **pending CQ-1**.
3. **Stripe Connect stays the money rail**; Mews gets the reservation + an external-payment record.
4. **Per-PMS native storage** (§5); availability reads move behind the adapter.
5. **Manual AccessToken onboarding** for v1 (no OAuth in Mews).
6. **Dev on `api.mews-demo.com` only, using Mews's own published demo credentials** — no Mews contact needed to build. Use the **gross-pricing** published token set (M&F UK is gross), with our own `Client: "Rockenue BookingEngine 1.0.0"`. Mews engagement happens only at **certification**, where they issue the production `ClientToken` and the hotel admin issues the production `AccessToken`.
7. **First target:** a Mason & Fifth property (Mews), demo-only for now.

---

## 4. Architecture — `PmsAdapter` + per-PMS native storage

```
interface PmsAdapter {
  readonly type: "cloudbeds" | "mews"
  validateConnection(property): { ok, enterpriseName, currency, timezone, taxMode }
  syncInventory(property, days)     // room types, rate plans, daily availability, daily price
  syncExtras(property)
  syncHotelDetails(property)
  getAvailability(property, dateRange, occupancy): AvailabilityResult[]   // behind the adapter
  createReservation(property, params): { pmsReservationId, pmsGroupId? }
  postExtra(property, params): { pmsItemId }
  recordPayment(property, params): { pmsPaymentId }
  cancelReservation(property, params)
  postReservationNote(property, params)
  subscribeWebhooks(property) / unsubscribeWebhooks(property)
}
```

Storefront, Stripe layer, and booking-submit flow stay PMS-agnostic and call `getPmsAdapter(property).*`. Only the booking/cancel routes, sync crons, and admin connect screens change.

---

## 5. Database design

Store each PMS in its **native shape**; normalise only at read time inside the adapter.

- `properties.pms_type` — `'cloudbeds' | 'mews'`.
- `properties.pms_credentials` (encrypted JSON) — Mews: `{ accessToken, serviceId, timezone, enterpriseId, taxMode, externalPaymentType }`. Cloudbeds keeps its OAuth columns.
- `room_types.ota_room_id` = Mews **ResourceCategory Id**; `rate_plans.ota_rate_id` = Mews **Rate Id** (already provider-neutral).

> **Rate↔category model (locked P3, 2026-06-05).** A Mews **Rate is service-wide, not bound to a category** — confirmed three ways: live `rates/getAll` (rates carry `ServiceId`+`BaseRateId`, no category field), Mews docs ("a rate applies service-wide; per-category price varies via adjustments"), and our own Market Pulse production adapter (`roomTypeID: null`, reads/writes `(rateId, categoryId)` pairs). So for Mews we store **one `rate_plans` row per Rate with `room_type_id = NULL`** (sync only the active/enabled rates of the chosen service), and the adapter **joins category × rate at read time** via `mews_rate_prices` (keyed `rate × category × date`). We do **not** explode rate×category into `rate_plans` (would need a fake composite `ota_rate_id`, breaking the "= real Rate Id" contract and the write path, which passes Rate Id + Category Id separately).

**Cloudbeds** keeps its combined `inventory` table (`rate × date → units + price`), untouched.

**Mews** native tables:
- `mews_category_availability` — `(property_id, category_id, date) → sellable_units`, derived from `getAvailability/2024-01-22` (§8).
- `mews_rate_prices` — `(property_id, rate_id, category_id, date) → price`, from `rates/getPricing`.

Booking-side IDs (additive, both PMSs): `bookings.pms_reservation_id`, `bookings.pms_payment_id`, `booking_extras.pms_item_id`. Mews needs **no** per-property webhook-subscription table (events are per-integration — §9).

---

## 6. Mews mapping — read path

`POST [PlatformAddress]/api/connector/v1/{operation}` with `{ ClientToken, AccessToken, Client, ... }`. Demo base `https://api.mews-demo.com`. Pagination `Limitation { Count, Cursor }`. All timestamps UTC via `toMewsUtc(localDate, timezone)`.

| Our method | Mews operation | Stored as |
|---|---|---|
| `validateConnection` / `syncHotelDetails` | `configuration/get` | name, currency, **timezone**, **tax mode**, address/contact, **`AccountingConfiguration.EnabledExternalPaymentTypes`** (§7.3) |
| `syncInventory` (rooms) | `resourceCategories/getAll` | `room_types` (`ota_room_id`=`Category.Id`, name `Names.en`, occupancy `Capacity`) |
| `syncInventory` (rates) | `rates/getAll` (`Extent:{Rates,RateGroups}`) | `rate_plans` (`ota_rate_id`=`Rate.Id`; sellable root rates of the chosen service) |
| `syncInventory` (availability) | **`getAvailability/2024-01-22`** (§8) | `mews_category_availability` (computed sellable count) |
| `syncInventory` (price) | `rates/getPricing` (`RateId`, `First/LastTimeUnitStartUtc`) | `mews_rate_prices` |
| `syncExtras` | products operations | `property_extras` |
| age categories | `ageCategories/getAll` | cached for `PersonCounts` |
| services (connect) | `services/getAll` | admin picks the single Reservable service the engine sells (§7/§13.8) |

---

## 7. Mews mapping — write path

### 7.1 Create reservation
1. **Guest:** `customers/add` (only `LastName` required; plus `FirstName`, `Email`, `Phone`, `NationalityCode`, `PreferredLanguageCode`) → use returned `Id` as `CustomerId`. Customer creation is **mandatory** (the external payment needs an `AccountId` — §7.3). **Dedupe** via `customers/getAll` (filter `Emails`) **only if** the customer-read scope is granted (CQ-2); otherwise skip dedupe and accept that repeat guests may create duplicate profiles. **Never assume `customers/getAll` is available.**
2. **Reservation:** `reservations/add` (no versioned variant) with `ServiceId` and one reservation:
   - `Identifier` = our orderId — **correlation only, NOT an idempotency key** (see idempotency below)
   - `State` = `"Confirmed"`
   - `StartUtc` / `EndUtc` = check-in/out as UTC (hotel timezone + configured times)
   - `CustomerId`, `RequestedCategoryId` = `ota_room_id`, `RateId` = `ota_rate_id`
   - `PersonCounts` = `[{ AgeCategoryId, Count }]`
   - `TimeUnitPrices` = the **exact per-night prices charged via Stripe**, **one entry per night with a 0-based `Index`**
   - `CheckRateApplicability: false` — required so Mews accepts our free-form Stripe-matching prices instead of enforcing rate alignment
   - `CheckOverbooking: true` (default; keep — fail rather than oversell)
   - `Notes` = special requests
   - Response: `Reservations[].Reservation.Id` (+ `GroupId`, `Number`) → `pms_reservation_id`.
3. **Idempotency (ours, not Mews's):** persist the returned reservation `Id` immediately. Before any retry of `reservations/add`, look up by our stored external reference via `reservations/getAll/2023-06-06`; only add if absent. A naive retry **will create a duplicate**.
4. **Sold-out race:** `CheckOverbooking:true` makes Mews fail rather than oversell; the exact error code is undocumented — capture its shape on demo and map it to our "room just sold out" UX.

### 7.2 Post extras
Catalogue add-ons via `ProductOrders` on `reservations/add` (preferred) or `orders/add` after the fact. Per-guest-per-night items (breakfast) — model per the idiomatic Mews product/posting rule confirmed in §13.5.

### 7.3 Record the (already-taken) payment
`payments/addExternal`:
- `AccountId` = the `CustomerId` (**required** — Customer or Company)
- `Amount` = `{ Currency, GrossValue }` for **gross-tax** enterprises, `{ Currency, NetValue }` for **net-tax** — selected by `properties.pms_credentials.taxMode`, **never hardcoded** (M&F UK is gross; US is net)
- `Type` = an **enabled** external payment type (read `AccountingConfiguration.EnabledExternalPaymentTypes` at connect)
- `ExternalIdentifier` = Stripe PaymentIntent id
- `ReservationId` (pass this; **`BillId` optional** — Mews resolves the bill internally)
- Flex rates: call this at later Stripe charge time; non-refundable: at booking.

### 7.4 Cancel
Use the **dedicated** `reservations/cancel` — `ReservationIds`, `Notes` (**required**), `PostCancellationFee` (default **false**), `SendEmail` (default true). **Do not** use `reservations/update` with `State:"Canceled"` — its fee default is inverted (it applies the fee unless told otherwise). Refund happens in **Stripe**; record the reversal in Mews as a **compensating external payment**.

---

## 8. Availability — versioned endpoint, compute sellable

Cloudbeds returns availability+price together; Mews splits them. `MewsAdapter.getAvailability()` joins them by **category + date**, stored natively (§5).

> **Endpoint choice (corrected P3, 2026-06-05).** Plan originally specified `getAvailability/2024-01-22` to "compute sellable ourselves." On the demo it **rejects our call with `"Invalid Metrics"`** — the versioned op requires an explicit `Metrics` param and is more involved. The **legacy `services/getAvailability`** works cleanly and returns `CategoryAvailabilities[].Availabilities[]` = the **absolute, already-netted sellable count** per category/day (nets out OOO + other services server-side) — exactly the no-oversell primitive we want, and the path Market Pulse runs fleet-wide (verified ±0–1 rooms vs Mews Availability Reports). **P3 uses the legacy endpoint** and stores `Availabilities[i]` directly as `sellable_units`.

Do **not** subtract `Adjustments` from the legacy endpoint: `Availabilities` is already the absolute, netted sellable count and `Adjustments` are informational deltas.

UTC↔local conversion follows the confirmed pattern (§15) to avoid the DST/BST off-by-one night.

---

## 9. Webhooks — there is no "availability changed" event

Mews General Webhooks expose: `ServiceOrderUpdated`, `ResourceUpdated`, `ResourceBlockUpdated`, `CustomerAdded`/`Updated`, `PaymentUpdated`, `MessageAdded`. **There is no `*AvailabilityUpdated`.** So our cache-correctness strategy is:
- React to **`ServiceOrderUpdated`** (reservation change) and **`ResourceBlockUpdated`** (OOO/block change) by re-running availability sync for that property.
- **Poll `getAvailability/2024-01-22` on a schedule** as the real safety net — webhooks alone cannot guarantee no-oversell.

Endpoint: one per-integration `POST /api/mews/webhooks`, secured only by a **shared-secret token in the URL** (no HMAC/signature/IP allow-list). **5s SLA**, respond `2xx/3xx` immediately and process async; Mews discards messages after repeated failures, so the endpoint must be fast and reliable. We fetch change detail via `reservations/getAll/2023-06-06`. (This matches our Market Pulse webhook design.)

---

## 10. Onboarding, credentials, environments

- **Onboarding (manual):** admin selects Mews, pastes the enterprise `AccessToken`, we call `configuration/get` + `services/getAll`, admin picks the Service and we read the enabled external payment type + tax mode, store encrypted credentials, run initial sync.
- **Auth:** `ClientToken` (our integration, per-environment), `AccessToken` (per enterprise), `Client` (`"Rockenue BookingEngine 1.0.0"`).
- **Rate limits:** **200 requests / AccessToken / rolling 30s → 429 with `Retry-After`.** Reuse the existing adapter's 429 handling **and** the 403 "conflicting operation" backoff.
- **Environments:** demo for all dev; production swap gated on a dedicated integration + certification (CQ-1).

---

## 11. Phasing

- **P1 — Interface + Cloudbeds refactor** behind `PmsAdapter`, zero behaviour change. ✅ **DONE 2026-06-05.** New `src/lib/pms/` (`types.ts` interface, `cloudbeds-adapter.ts` thin delegating wrapper, `index.ts` factory `getPmsAdapter`). Write path migrated to the adapter: `bookings/route.ts`, `bookings/cancel/route.ts`, `stripe/auto-charge.ts`, `cloudbeds/sync-pending-extras`, plus the OAuth-callback post-connect sync/subscribe. `tsc` clean project-wide; migrated routes compile + respond at runtime. **Remaining call-site migration (deferred to later phases, still Cloudbeds-native):** admin manual-sync route, `/api/extras` sync, `availability.ts` cold-start, the inventory-sync + pms-retry crons, OAuth start/install/scopes, the Cloudbeds webhook route, and disconnect — these fold into P2/P3/P5 as those areas are touched.
- **P2 — DB migration + admin Mews connect** (manual token; Service, external payment type, tax mode). ✅ **DONE 2026-06-05.** Migration applied to Neon (additive, all `IF NOT EXISTS`): `properties.pms_type` (default `cloudbeds`) + `pms_credentials` jsonb; native `mews_category_availability` + `mews_rate_prices` tables; neutral `bookings.pms_reservation_id`/`pms_payment_id` + `booking_extras.pms_item_id`. `schema.ts` in sync; factory now branches on `pms_type` (Mews → throws until P3/P4). Connect flow: `POST …/mews/validate` (pulls enterprise + Reservable services + enabled external payment types) → `POST …/mews/connect` (re-validates, stores `pms_type=mews` + **encrypted** AccessToken + service/tax/payment in `pms_credentials`, aligns tz/currency), `GET …/mews` status. Admin **Mews** tab under Integrations. Verified end-to-end against the gross demo enterprise (connect stored encrypted token; throwaway property cleaned up); existing Cloudbeds hotels untouched (`pms_type=cloudbeds`).
- **P3 — Mews reads** → native tables. ✅ **DONE 2026-06-05.** `MewsAdapter` (`src/lib/pms/mews-adapter.ts`) read path live; factory now returns it for `pms_type='mews'` (writes/webhooks throw until P4/P5). New modules: `mews/credentials.ts` (decrypt the stored AccessToken), `mews/sync-inventory.ts`, `mews/availability.ts`, `mews/sync-hotel-details.ts`. **Rate model locked to Option A** (§5): `resourceCategories/getAll` → `room_types`; `rates/getAll` (active+enabled+public of the service) → `rate_plans` with **`room_type_id = NULL`**; legacy `services/getAvailability` `Availabilities[]` → `mews_category_availability`; `rates/getPricing` `CategoryPrices[].AmountPrices[]` (Gross/Net by tax mode) → `mews_rate_prices`. `getAvailability` joins category × rate at read time into the storefront's `AvailabilityResultRow[]`. **Wiring:** `computeAvailability` (the shared read used by the storefront, Google JSON-LD, and ARI) now dispatches to the Mews adapter on `pms_type`, so all consumers are PMS-agnostic. **Verified** end-to-end on the gross demo enterprise via `scripts/mews-sync-smoke.ts`: 121 room types, 15 rate plans, ~15.5k native rows for a 7-day window, `getAvailability` returned 1,065 room×rate options with correct joined nightly prices; throwaway property cleaned up, Cloudbeds properties untouched. **Deferred:** `syncExtras` is a no-op (`property_extras` is Cloudbeds-shaped; neutral extras model lands with P4). `tsc` clean. 1:1 reconciliation against a tidy M&F demo property still pending a cleaner demo enterprise (shared demo is a junk drawer).
- **Gate — resolve CQ-1 + CQ-2 with Mews before PRODUCTION** (building on demo needs neither — §0a). P4 was built against demo in parallel by explicit decision (2026-06-05), accepting that a CQ-1 "no" could force write-path rework.
- **P4 — Mews writes.** ✅ **DONE (demo) 2026-06-05** (`448a41c`). `mews/reservations.ts` + `MewsAdapter` write methods, all verified through `getPmsAdapter` on the gross demo (`scripts/mews-write-smoke.ts`: sync → getAvailability → create → external payment → cancel, self-cleaning). **createReservation:** `customers/add` with email dedupe (`customers/getAll` filtered by Emails; degrades to blind add if CQ-2 withheld — note `customers/add` enforces email uniqueness, so a repeat guest *must* be reused) → `reservations/add` (Identifier=orderId correlation-only, State=Confirmed, per-night `TimeUnitPrices` with `CheckRateApplicability:false` + `CheckOverbooking:true`, adult `AgeCategoryId` from `ageCategories/getAll`). **Prices:** GrossValue/NetValue by `taxMode`; **`TaxCodes` are required** (Mews 400s "Invalid TaxCodes" without them) — pulled from `rates/getPricing` for the stay so our Stripe-matching prices are accepted. **recordPayment:** `payments/addExternal` (AccountId resolved via `reservations/getAll/2023-06-06`, which needs a `Limitation`; `ExternalIdentifier`=Stripe PI). **cancel:** dedicated `reservations/cancel` (`PostCancellationFee:false`; refunds in Stripe). Interface: `CreateReservationParams.nightlyRates` + `RecordPaymentParams.externalIdentifier` (Cloudbeds ignores both), wired at the booking-route + auto-charge call sites; `autoCancelAfterGrace` no longer hard-requires `cloudbedsPropertyId`. **Deferred (non-fatal, logged):** `postExtra` + `postReservationNote` — Mews posts extras on a separate product/POS service (`orders/add` rejects the accommodation ServiceId) and the per-guest-per-night shape + note-update shape need confirming with Mews (§13.5). **Sold-out error shape:** not yet captured (abundant demo inventory makes it nondeterministic) — `CheckOverbooking:true` already fails safe; map the error when hit.
- **P5 — Webhooks (`ServiceOrderUpdated` + `ResourceBlockUpdated`) + availability polling + cron parity.**
- **P6 — Pre-production:** dedicated integration (own `ClientToken`/Client name), certification, demo→prod, enable external payment type on the live enterprise.

---

## 12. Risks

- **CQ-1** API-choice doctrine conflict (can change the whole approach).
- **CQ-2** customer-read scope (affects dedupe; mitigated by graceful degrade).
- Availability join correctness + sellable computation from the versioned endpoint (§8).
- Price fidelity — folio must equal Stripe (`TimeUnitPrices` + `CheckRateApplicability:false`, Gross/Net by tax mode) (§7).
- Our own reservation idempotency on retry (§7.1).
- Cancel fee-default trap; refund/reversal modelling (§7.4).
- Multi-service M&F — restrict to the single Short Stay service; never sum occupancy across services (§13.8).
- Rate limits (§10).

---

## 13. Resolved by review (corrected answers)

- **13.1 API choice** → escalated to **CQ-1**; build on Connector against demo, certify with Mews's explicit answer.
- **13.2 External payment** → `AccountId` required (so customer creation mandatory); pass `ReservationId`, `BillId` optional; gate on `EnabledExternalPaymentTypes` (not just an accounting category); `ExternalIdentifier` = Stripe PI is correct; Gross/Net by tax mode.
- **13.3 Price fidelity** → `TimeUnitPrices` per night with 0-based `Index`, plus `CheckRateApplicability:false`; do not hardcode `GrossValue`.
- **13.4 Cancellation** → dedicated `reservations/cancel` (`Notes` required, `PostCancellationFee` default false), not `reservations/update`; refund in Stripe + compensating external payment.
- **13.5 Extras/products** → prefer `ProductOrders`; confirm the idiomatic per-guest-per-night representation with Mews during build.
- **13.6 Availability semantics** → use `getAvailability/2024-01-22` and compute sellable; never subtract `Adjustments`.
- **13.7 Timezones** → confirmed correct (§15).
- **13.8 Services** → restrict to one Short Stay Reservable service; ensure `RateId` + `RequestedCategoryId` belong to it; never sum occupancy across services.
- **13.9 Webhooks** → no availability event; react to `ServiceOrderUpdated` + `ResourceBlockUpdated` and **poll** availability; shared-secret URL token, 5s SLA, async processing.
- **13.10 Dev integration identity** → reusing Market Pulse's demo `ClientToken` on demo is fine; prod needs a dedicated one issued at certification.
- **13.11 Idempotency** → `Identifier` is correlation only; build our own dedup via stored reservation Id + `reservations/getAll`; `CheckOverbooking:true`; capture the sold-out error shape on demo.

---

## 14. References (official Mews docs)

- Authentication: https://docs.mews.com/connector-api/guidelines/authentication
- Environments: https://docs.mews.com/connector-api/guidelines/environments
- Requests/guidelines (rate limits): https://docs.mews.com/connector-api/guidelines/requests
- Reservations: https://docs.mews.com/connector-api/operations/reservations
- Customers: https://docs.mews.com/connector-api/operations/customers
- Services / availability: https://docs.mews.com/connector-api/operations/services
- Payments (external): https://docs.mews.com/connector-api/operations/payments
- Orders / order items: https://docs.mews.com/connector-api/operations/orders · https://docs.mews.com/connector-api/operations/orderitems
- Accounting items: https://docs.mews.com/connector-api/operations/accountingitems
- Events / webhooks: https://docs.mews.com/connector-api/use-cases/events
- Booking Engine Guide: https://docs.mews.com/booking-engine-guide/booking-engine-api

---

## 15. Confirmed correct by review — do not second-guess

- **Timezone** local↔UTC: `Intl.DateTimeFormat('en-CA', { timeZone })` for UTC→local, `fromZonedTime` for local→UTC (matches Market Pulse; avoids the BST off-by-one).
- `reservations/getAll/2023-06-06` for change-detail fetch.
- `reservations/add` has no versioned variant.
- Native per-PMS storage; adapter factory on `pms_type`; manual AccessToken onboarding; demo-first + certification gate; reusing the sister `ClientToken` on demo (dedicated one for prod).

*End of document.*
