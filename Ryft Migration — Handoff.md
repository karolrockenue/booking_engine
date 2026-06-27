# Ryft Migration — Handoff

Branch: `ryft-migration`. Last verified end-to-end **2026-06-27**.

This is the handoff for replacing **Stripe Connect** with **Ryft** as the booking-engine payment rail (Stripe won't onboard the UAE platform to pay UK hotels; Ryft will). Read this before touching payment code.

---

## 1. Where we are — TL;DR

**NR (pay-now) is proven end-to-end live. Flex (refundable) is built, pending a live storefront proof.**

- **NR — proven live (2026-06-27).** A real guest booked on the live Portico storefront, paid via Ryft, our fee was skimmed, the card fee was booked to the hotel, and it posted into Cloudbeds — reservation + folio payment — automatically. Booking `order_id f80df0b5…`: Ryft session **Captured**, £108.00 GBP, `platformFee` £3.24 (3%); Cloudbeds reservation **`5828976389743`** + folio payment **`232986678`**; status **`pms_synced`**.
- **Flex — built (2026-06-27), not yet proven live.** Ryft has no Stripe-SetupIntent 1:1, so Flex runs as **Credential-on-File / Merchant-Initiated Transactions**: a zero-value `verifyAccount` card-save session establishes a COF mandate at checkout, and the auto-charge cron charges the saved card off-session once the cancellation window closes. Contract is sandbox-proven; the only thing left is one live booking (the sandbox forces a 3DS step that needs a real browser — same as how NR was proven). See §7 + §9.
- **Refunds/cancellations on Ryft — done (2026-06-27).** The cancel route refunds (Captured) or voids (Approved) via Ryft, falling back to Stripe.

**Migration is phased:** Stripe columns/code are kept ALONGSIDE Ryft (additive schema) so the live storefront keeps transacting. Per-property rail selection decides which rail a hotel uses. Stripe is deleted only in the final cutover pass.

---

## 2. The model (how the money flows)

- **Platform = Rockenue** (main Ryft account). **Each hotel = a Ryft "sub-account"** (`ac_…`). Money settles to the hotel; we skim a platform fee.
- Guest pays full amount → we keep `platformFee` (per-hotel `platformFeePercent`, default 3%, editable in admin) → **Ryft's card processing fee is booked to the HOTEL** via `platformSettings.paymentFees.combined.bookTo = <hotel ryftAccountId>`.
- `combined` overrides the granular per-fee fields and works on both Blended and ICC++ pricing — the safe default. (Old `passThroughProcessingFee` boolean is deprecated.)
- Net: hotel receives `amount − platformFee − processingFee`. Confirmed live.

---

## 3. How to develop / run the demo (no public tunnel needed)

The app's DB (Neon) and Ryft are both cloud — you need internet, but **not** a tunnel.

**Local HTTPS** (required for the card SDK / 3DS — Ryft rejects http return URLs):
```
npx next dev --experimental-https \
  --experimental-https-key .certs/key.pem \
  --experimental-https-cert .certs/cert.pem
```
- Cert is a self-signed openssl cert in `.certs/` (gitignored). Regenerate if missing:
  `openssl req -x509 -newkey rsa:2048 -nodes -keyout .certs/key.pem -out .certs/cert.pem -days 60 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`
- Next's `--experimental-https` alone needs `mkcert` (not installed); the explicit key/cert flags avoid that.
- Set `PUBLIC_APP_URL="https://localhost:3000"` in `.env.local`.
- Browser will warn "not secure" (self-signed) → Advanced → Proceed. Fine; it's localhost.
- **Do NOT use cloudflared tunnels** — they die on flaky wifi (`530 origin unregistered`). Local HTTPS is strictly better.

**This machine's proxy quirk:** the shell inherits a dead `ALL_PROXY` that blocks outbound. Prefix commands with `unset ALL_PROXY HTTP_PROXY HTTPS_PROXY http_proxy https_proxy all_proxy` and run with sandbox disabled. The dev server must be started with the proxy cleared too. (See `booking-engine-dead-proxy` memory.)

**Rockenue demo data:**
- Property `15cece68-d3da-4970-8aaf-46b025274d4e`, slug `rockenue-partner-account-15cece68`, theme `portico-ivory`.
- Ryft sub-account `ac_34d2ae56-3f0c-4835-9780-f4278e8dd6c3` (status active, GBP).
- NR rate `7ff9bd08-a4f8-4132-925a-7048378a3cc5` (Non Ref) on room `a225e5c5-3b78-4349-8bb4-6ed6d3ebecc1` (Double Room). **Inventory is only loaded ~May 2026.**
- Ryft sandbox keys + sub-account id are in `.env.local` (`RYFT_SECRET_KEY`, `NEXT_PUBLIC_RYFT_PUBLIC_KEY`, `RYFT_TEST_SUBACCOUNT_ID`).

**Test cards (ALL Ryft sandbox cards require 3DS):**
- Frictionless Visa: `4012000000060085` — captures without a challenge.
- CVC: any 3 digits **except** 100/001/222/1000 (those are decline triggers). Expiry: any future (`12/30`).
- With `customerEmail` set on the session, the frictionless card Captures with no challenge and no tunnel.

---

## 4. Ryft API contract (verified)

- Sandbox base `https://sandbox-api.ryftpay.com/v1`, live `https://api.ryftpay.com/v1`. Inferred from key prefix (`sk_live_` → live).
- Auth = **raw secret key** in `Authorization` (no `Bearer`). Public key (`pk_…`) used by the browser SDK / `attempt-payment`.
- Sub-account routing = **`Account: ac_…` header** (not body). Amounts in **MINOR units**.
- Endpoint map (Stripe → Ryft): `accounts.create` → `POST /accounts`; onboarding link → `POST /account-links`; create intent → `POST /payment-sessions`; capture → `/payment-sessions/{id}/captures`; refund → `/refunds`; void → `/voids`; **patch session** → `PATCH /payment-sessions/{id}`; **server attempt** → `POST /payment-sessions/attempt-payment`.
- Spec source: `https://developer.ryftpay.com/_bundle/documentation/api/reference/openapi.yaml`.
- React SDK: `@ryftpay/react` (`RyftProvider` + `CardForm`, `fieldLayout:"separated"`). Docs at web-sdk.ryftpay.com 403 to bots — read the package `index.d.ts` instead.
- Webhooks: `Signature` header = HMAC-SHA256 of the RAW body, secret `whs_…` (returned only at creation). Events `PaymentSession.approved|captured|declined|refunded|voided`, `Account.created|updated`, etc. Signature digest encoding (hex vs base64) undocumented — verifier accepts both; confirm against first live delivery.

---

## 5. CRITICAL gotchas (each cost real debugging time — don't re-derive)

1. **`customerEmail` MUST be on the SESSION** or every payment attempt 400s (`"customerEmail is missing… in order for payment to be actioned"`). The storefront creates the session *before* the guest types their email, so `/api/bookings/[id]/details` PATCHes the session email (`updateSessionEmail`) right before card confirm. Passing it only to the SDK's `attemptPayment` is NOT enough — it must be on the session.
2. **Currency: Cloudbeds sandbox forces `property.currency` → USD**, but the Ryft sub-account settles **GBP only** → `currency must be one of: [GBP]`. Two-layer fix: (a) guard in `sync-hotel-details.ts` skips the currency overwrite when `ryftAccountStatus==='active'`; (b) the real fix — `createBookingPaymentSession` charges in `property.ryftAccountCurrency` (GBP, sync never touches it), not `property.currency`. **Consequence:** confirmation page still *displays* USD (cosmetic) while charging GBP.
3. **There are TWO checkout UIs.** The live storefront renders the **theme** screen (`src/themes/<theme>/screens/Checkout.tsx`), NOT the fallback `src/app/[property]/checkout/checkout-client.tsx`. Rockenue = Portico. Any checkout change must go in the theme screen. Likewise admin has a **legacy** property editor (`/admin/properties/[id]`) AND the live one (`/admin/[propertyId]` with the Sidebar) — the live one is what's used.
4. **Ryft return URL / account-link must be HTTPS.** On http/localhost the connect flow can't create a hosted-onboarding link; `connect/start` falls back to marking the sub-account active directly (sandbox accounts are card-enabled on creation). The payment session omits `returnUrl` on non-https origins (the SDK does 3DS inline).
5. **All sandbox cards require 3DS** (no non-3DS card exists). Frictionless still needs the SDK to complete 3DS in-browser; works on local https once `customerEmail` is on the session.
6. **Neon driver = one HTTP fetch per query** → flaky networks throw `TypeError: fetch failed` intermittently (random 500s). `src/db/index.ts` sets `neonConfig.fetchFunction` to retry 4× with backoff.
7. **Long-running dev server across wifi reconnects** wedges its DB sockets → persistent `fetch failed`. Restart fixes it.

---

## 6. Architecture map (key files)

**Ryft lib** (`src/lib/ryft/`)
- `client.ts` — `ryftFetch` (env-aware base URL, Account header), `publicOrigin`.
- `sessions.ts` — NR: `createBookingPaymentSession` (pay-now + fee split + fee-to-hotel). Flex: `createBookingCardSave` (zero-value COF mandate, `paymentType:Unscheduled`, sub-account), `getCustomerPaymentMethods` (resolve saved `pmt_`), `chargeSavedCard` (off-session MIT charge), `deletePaymentMethod`. Shared: `getPaymentSession`, `updateSessionEmail` (PATCH), `capture/refund/void`.
- `auto-charge.ts` — Flex off-session cron logic (`findEligibleRyftBookings`, `chargeRyftBooking`, 24h grace → `autoCancelAfterGrace`). Mirrors `lib/stripe/auto-charge.ts`.
- `accounts.ts` — `createSubAccount`, `createAccountLink`, `getAccount`, `resolveRyftAccountStatus` (active = card capability Enabled, since sandbox accounts are "Unverified" yet chargeable).
- `webhook.ts` — signature verifier + event taxonomy.
- `amounts.ts` — `toMinorUnits`.

**API routes** (`src/app/api/ryft/`)
- `booking-init` — create-before-pay, **rate-aware**: NR → pay-now session, stamps `ryftPaymentSessionId`; Flex → card-save session, stamps `ryftVerifySessionId` + `ryftCustomerId`.
- `booking-finalise` — **rate-aware**: NR verifies paid → fulfil; Flex verifies the card-save Approved, resolves + persists `ryftPaymentMethodId`, fulfils WITHOUT charging (cron charges later). Runs `fulfilBooking` INLINE (no webhook needed for happy path).
- `webhooks` — PaymentSession.approved/captured → fulfil (backstop). **Card-save events** (amount 0 / matches `ryftVerifySessionId`) persist the saved card + fulfil but do NOT mark paid. Account.* → refresh status.
- `connect/start` + `connect/return` — onboarding (admin).
- `session/route.ts` — standalone spike session (used by `/ryft-spike`).
- `../cron/auto-charge` — hourly; runs the Stripe AND Ryft Flex sweeps side by side (rails disambiguated by saved-card state).

**Checkout (storefront)**
- `src/components/checkout/RyftPaymentSection.tsx` — `@ryftpay/react` CardForm, separated fields, `confirm()` → `attemptPayment`. (Was the v2 embedded `ryft.min.js` — replaced; that was the cramped white-on-white single line.)
- `src/themes/{portico,street,editorial-calm}/screens/Checkout.tsx` — all three **branched by `property.paymentRail`** (Ryft vs Stripe).
- `src/app/[property]/checkout/checkout-client.tsx` — fallback, also branched.
- `src/lib/booking/submitBooking.ts` — `ryftInitBooking`, `ryftFinaliseBooking` helpers.
- `src/lib/get-property.ts` — `ResolvedProperty.paymentRail` = `ryftAccountStatus==='active' ? 'ryft' : 'stripe'`.
- `src/app/api/bookings/[id]/details/route.ts` — patches guest details AND the Ryft session email.

**Admin**
- `src/app/admin/[propertyId]/ryft/page.tsx` — Connect-to-Ryft + status. `src/components/admin/Sidebar.tsx` — "Ryft" nav item.

**Fulfilment / shared**
- `src/lib/pms/fulfil-booking.ts` — payment posting is rail-agnostic (prefers Ryft session id, falls back to Stripe).
- `src/db/schema.ts` — additive: `ryft_account_*` on properties, `ryft_*` on bookings, `ryft_id` on paymentEvents, all ALONGSIDE the stripe_* columns. (DB columns were added via ad-hoc `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; no migration file — project uses drizzle push.)
- `src/db/index.ts` — Neon retry wrapper.

---

## 7. What's left before "Ryft completed"

### Cosmetic (small)
- [ ] **Currency display USD→GBP** — charge is GBP, storefront/confirmation shows USD. Fix display to use charge currency, or set the demo hotel to GBP in Cloudbeds.
- [ ] *(optional)* re-add **name-on-card** field (stripped during debugging; `collectNameOnCard:false` in `RyftPaymentSection`).

### Functional (real gaps)
- [x] **Flex / refundable rates** — BUILT (2026-06-27), pending live storefront proof. Ryft has no SetupIntent 1:1, so Flex runs as **Credential-on-File / Merchant-Initiated Transactions**: a zero-value `verifyAccount` card-save session with `paymentType:"Unscheduled"` on the hotel sub-account establishes the COF mandate; the auto-charge cron later charges the saved card off-session (`paymentType:"Unscheduled"` + `previousPayment` = the mandate + saved `pmt_`). Both constraints (sub-account scope for mandate+charge; mandate must be `Unscheduled` not Standard) were proven in sandbox. Files: `lib/ryft/sessions.ts` (`createBookingCardSave`, `getCustomerPaymentMethods`, `chargeSavedCard`, `deletePaymentMethod`), `lib/ryft/auto-charge.ts` (mirrors the Stripe cron), `cron/auto-charge` (runs both rails), `ryft/booking-init`+`booking-finalise` (rate-aware), `ryft/webhooks` (card-save backstop), Portico + fallback checkout un-gated. **Deferred sub-piece:** a Ryft "re-enter your card" page for a failed off-session charge (the Stripe `payment-update` page equivalent) — grace retries + auto-cancel cover it for now.
- [x] **Street + Editorial-Calm themes** — DONE (2026-06-27). Both checkout screens now branch by `property.paymentRail`, same pattern as Portico. All three storefront themes can transact NR + Flex on Ryft.
- [x] **Cancellations / refunds on Ryft** — DONE (2026-06-27). `api/bookings/cancel/route.ts` refund branch is now rail-aware: refunds (Captured) or voids (Approved) via Ryft, falls back to the Stripe paths. (Note: NR self-cancel is still punted to the hotel before the refund branch, so this activates for Flex/refundable bookings.)
- [ ] **Production webhook** — register `POST /api/ryft/webhooks` against a stable HTTPS prod domain (inline finalise covers the happy path; webhook is the durable backstop if the guest tab dies post-charge). Store the `whs_…` secret as `RYFT_WEBHOOK_SECRET`.
- [ ] **Real hotel onboarding** — `connect/start` shortcuts on localhost (no hosted KYC). In prod (https), the hosted-onboarding link + `Account.updated` webhook drive real verification → active.
- [ ] **Final Stripe removal (cutover)** — once all themes + Flex + refunds run on Ryft: delete `src/lib/stripe`, the `/api/stripe/*` routes, the admin Stripe page, and the `stripe_*` schema columns. ~65 files reference Stripe today.
- [ ] **Migrations** — the Ryft columns were added by ad-hoc ALTERs; fold them into the project's drizzle migration workflow for other environments/prod.

---

## 8. Commit trail (ryft-migration, newest first)

```
dba64cb Docs: Flex on Ryft built + Ryft refunds done (handoff update)
c1a79db Ryft webhook: don't mark Flex card-save as a payment
b6206bd Ryft Flex: un-gate refundable rates in checkout
fcc32c0 Ryft Flex: off-session card-save + auto-charge (backend)
89a1241 Ryft: refund/void on cancel (rail-aware refund branch)
---- (earlier: NR proven live) ----
a1d6299 charge in the sub-account's settlement currency (currency fix, real)
1b4e207 db: retry transient Neon fetch failures
055139d attach customer email to session before payment   ← the real payment unblocker
caf4d4d RyftPaymentSection: switch to @ryftpay/react separated fields
2279bb7 Cloudbeds sync: don't flip a Ryft-active hotel's currency
3023ddc omit returnUrl on non-https origins
04e5ab4 Portico theme checkout: branch by payment rail
38bd43c Storefront checkout on Ryft (per-property rail, NR pay-now)
80b1ec2 connect: work on localhost
1e405cb Admin: Ryft integrations nav + onboarding page
b8eec2e Ryft onboarding + wire spike to real booking
b8136bb Ryft rail: webhook → fee split → Cloudbeds posting (backend)
```
(Plus several RyftPaymentSection iteration commits — styling, validation, name-on-card.)

---

## 9. What's next (recommended order)

1. **Prove Flex live** (the gating item — code is done, never run end-to-end). On a Ryft-active hotel, book a **refundable** rate on the storefront:
   - Card-save: the Ryft CardForm should complete (3DS in-browser) and the confirmation page should render — booking ends `pms_synced`, `rateType=flex`, with `ryftVerifySessionId` + `ryftCustomerId` + `ryftPaymentMethodId` set and NO `ryftPaymentSessionId`. Status must NOT be `paid` yet.
   - Off-session charge: set `chargeAt` in the past (or wait for the window) and POST `/api/cron/auto-charge` with the `CRON_SECRET` bearer. Expect a `chargeSavedCard` MIT → session `Captured`, booking `paid`, folio payment posted, `auto_charge_succeeded` event.
   - Throwaway sandbox proof of the MIT contract lived in the scratchpad (`ryft-mit-proof.mjs`); the 3DS step is why it can't run fully headless.
2. **Production webhook** — register `/api/ryft/webhooks` on the prod HTTPS domain; store `whs_…` as `RYFT_WEBHOOK_SECRET`. Confirm the signature digest encoding against the first live delivery (verifier accepts hex+base64).
3. **Ryft "re-enter card" page** for a failed off-session charge (the Stripe `payment-update` equivalent) — currently deferred; grace retries + auto-cancel cover it.
4. **Cutover** — once Flex is proven live: delete Stripe (~65 files + `stripe_*` columns) and fold the ad-hoc Ryft ALTERs into drizzle migrations.
