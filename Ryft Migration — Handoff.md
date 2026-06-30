# Ryft Migration — Handoff

Status: **CUTOVER COMPLETE — Ryft is the sole payment rail.** Merged to `main` (tip `80c50f5`) and deploying to Railway (app.rockenue.tech) on **sandbox** keys, **2026-06-29/30**. Pre-launch: no live Ryft account, no live hotels, no real bookings yet.

This is the handoff for the migration that replaced **Stripe Connect** with **Ryft** as the booking-engine payment rail (Stripe won't onboard the UAE platform to pay UK hotels; Ryft will). Read this before touching payment code.

---

## 1. Where we are — TL;DR

**Stripe is fully deleted. Ryft is the only rail, end-to-end, code-complete and sandbox-proven on both Cloudbeds and Mews. Merged to `main`; Railway deploys it on sandbox keys.**

What's proven (sandbox):
- **NR (pay-now)** — storefront checkout → Ryft `Captured` (platform fee skimmed, card fee booked to hotel) → Cloudbeds reservation + folio payment. Originally proven live `order_id f80df0b5…` (session Captured, £108 GBP, Cloudbeds res `5828976389743`).
- **Flex (refundable)** — zero-value card-save (Credential-on-File mandate) + off-session Merchant-Initiated auto-charge. Both halves proven (`order_id c2da9d1d…`, charge session `ps_01KW7NKD…`). Plus a **re-enter-card recovery page** for a failed off-session charge (`/payment-update/[token]`, now Ryft) and a guest-facing decline email that links to it.
- **Mews end-to-end** — `mews-fulfil-smoke` PASS: reservation + folio payment + extras land and are idempotent on re-run (the payment half is rail-agnostic; this proved the Mews write path under Ryft).
- **Refunds / void / cancel** — rail-native (`refundPaymentSession` on Captured, `voidPaymentSession` on Approved, `deletePaymentMethod` for pre-charge Flex).
- **Settlement-currency fix** — bookings are denominated in `ryftAccountCurrency` at creation (`prepareBooking`), so the displayed currency now matches the charge (no more USD-shown-while-GBP-charged).

**No longer phased.** The dual-rail period is over: `src/lib/stripe/*`, `src/app/api/stripe/*`, the Stripe checkout routes, `StripePaymentSection`, the theme `stripe-appearance` files, and the admin Stripe pages are all deleted; `paymentRail` was removed from `ResolvedProperty` (checkout is unconditionally Ryft); `@stripe/*` + `stripe` deps are gone. The `stripe_*` schema columns were removed from `schema.ts`; the DB columns were dropped, then re-added empty so the old `main` code kept working during the transition — they're now harmless dead columns the Ryft code ignores (drop them any time post-deploy, or leave them).

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

**Ryft-active demo properties (sandbox):**
- **Rockenue Partner Account** — `15cece68-…`, slug `rockenue-partner-account-15cece68`, theme `portico-ivory`, PMS **Cloudbeds**. Ryft sub-account `ac_34d2ae56-…` (active, GBP). NR rate `7ff9bd08-…` on room `a225e5c5-…` (Double Room). Inventory loaded ~May 2026.
- **Mason & Fifth** — slug `mews-demo-hotel`, theme `editorial-calm`, PMS **Mews**, currency GBP. Activated 2026-06-29 against the standalone test sub-account `ac_1dde8dc2-…` (`RYFT_TEST_SUBACCOUNT_ID`). Full inventory (121 room types, 15 rate plans) — but the **Mews demo dataset has wild prices** (£40k+); pick "Half Board" (~£300) for a sane test charge.
- Ryft sandbox keys + test sub-account id are in `.env.local` (`RYFT_SECRET_KEY`, `NEXT_PUBLIC_RYFT_PUBLIC_KEY`, `RYFT_TEST_SUBACCOUNT_ID`).

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
2. **Currency: Cloudbeds sandbox forces `property.currency` → USD**, but the Ryft sub-account settles **GBP only** → `currency must be one of: [GBP]`. Layered fix: (a) guard in `sync-hotel-details.ts` skips the currency overwrite when `ryftAccountStatus==='active'`; (b) `createBookingPaymentSession`/`chargeSavedCard` charge in `property.ryftAccountCurrency` (GBP), not `property.currency`; (c) **the display fix** — `prepareBooking` now *denominates the booking row* in `ryftAccountCurrency`, so the confirmation page + email show the same currency that's charged. (The old "confirmation shows USD" cosmetic bug is resolved.)
3. **There are TWO checkout UIs.** The live storefront renders the **theme** screen (`src/themes/<theme>/screens/Checkout.tsx`), NOT the fallback `src/app/[property]/checkout/checkout-client.tsx`. Rockenue = Portico. Any checkout change must go in the theme screen. Likewise admin has a **legacy** property editor (`/admin/properties/[id]`) AND the live one (`/admin/[propertyId]` with the Sidebar) — the live one is what's used.
4. **Ryft return URL / account-link must be HTTPS.** On http/localhost the connect flow can't create a hosted-onboarding link; `connect/start` falls back to marking the sub-account active directly (sandbox accounts are card-enabled on creation). The payment session omits `returnUrl` on non-https origins (the SDK does 3DS inline).
5. **All sandbox cards require 3DS** (no non-3DS card exists). Frictionless still needs the SDK to complete 3DS in-browser; works on local https once `customerEmail` is on the session.
6. **Neon driver = one HTTP fetch per query** → flaky networks throw `TypeError: fetch failed` intermittently (random 500s). `src/db/index.ts` sets `neonConfig.fetchFunction` to retry 4× with backoff.
7. **Long-running dev server across wifi reconnects** wedges its DB sockets → persistent `fetch failed`. Restart fixes it.
8. **Customer create 409s on a duplicate email** — emails are unique per Ryft account, so a repeat guest (or a re-test) already has a customer and `POST /customers` 409s. `createBookingCardSave` does get-or-create: on 409, `GET /customers?email=` (returns `{items:[…]}`) and reuse the existing customer.
9. **The off-session MIT does NOT auto-charge on session create.** `POST /payment-sessions` with a stored `paymentMethod.id` only opens the session (`PendingPayment`). You must then call **`POST /payment-sessions/attempt-payment`** (PUBLIC-key auth, `Account` header, body `{clientSecret, paymentMethod:{id}}`) to action it → `Captured`. `chargeSavedCard` now does create→attempt; `ryftFetch` gained an `auth:"public"` mode. (The old `ryft-mit-proof.mjs` only logged the *created* session status, so it never actually proved Capture.)
10. **Charging a stored card needs `customerDetails:{id}`**, not a top-level `customerId` (which isn't in the create schema and is silently ignored) — else `400 "must provide customerDetails.id when paying with a stored payment method"`. The zero-value verify session tolerates top-level `customerId`; the charge does not.
11. **Resolve the saved `pmt_` from the verify session** (`session.paymentMethod.tokenizedDetails.id`, gated on the `stored` flag), not `getCustomerPaymentMethods()[0]` — a reused customer (gotcha 8) can hold several cards, so `[0]` could pick a stale one. `booking-finalise` prefers the session's card, falling back to the customer list.

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
- `../cron/auto-charge` — hourly; runs the Ryft Flex sweep (`findEligibleRyftBookings` → `chargeRyftBooking`). Stripe sweep removed.

**Re-enter-card recovery** (failed off-session charge)
- `src/app/payment-update/[token]/page.tsx` — for a Ryft-active Flex booking, mints a fresh card-save (verifyAccount/COF) session and renders the Ryft CardForm. `ryft-payment-update-client.tsx` drives it.
- `src/app/api/bookings/payment-update/route.ts` — verifies the new verify session, swaps BOTH `ryftPaymentMethodId` + `ryftVerifySessionId` (the new mandate) onto the booking, re-arms the cron.
- `lib/ryft/auto-charge.ts` emails this link to the guest on the first decline (`sendReEnterCardEmail`).

**Checkout (storefront)**
- `src/components/checkout/RyftPaymentSection.tsx` — `@ryftpay/react` CardForm, separated fields, `confirm()` → `attemptPayment`. `saveCard` prop switches it to setup-card usage for Flex.
- `src/themes/{portico,street,editorial-calm}/screens/Checkout.tsx` + `src/app/[property]/checkout/checkout-client.tsx` — all four run the Ryft path **unconditionally** (no rail branch — Stripe is gone).
- `src/lib/booking/submitBooking.ts` — `ryftInitBooking`, `ryftFinaliseBooking` (returns `cancelUrl` for Flex), `patchBookingDetails`. The Stripe `initBooking`/`submitBooking` helpers are deleted.
- `src/lib/get-property.ts` — `paymentRail` removed; checkout is always Ryft.
- `src/app/api/bookings/[id]/details/route.ts` — patches guest details AND the Ryft session email.

**Admin**
- `src/app/admin/[propertyId]/ryft/page.tsx` — Connect-to-Ryft + status. `src/components/admin/Sidebar.tsx` — "Ryft" nav item (Stripe nav removed). Overview/list/super-admin/bookings pages all read `ryftAccount*`.

**Fulfilment / shared**
- `src/lib/pms/fulfil-booking.ts` — posts the external payment from the Ryft session id (Stripe fallback removed). `retry-pms.ts` give-up refunds/deletes via Ryft.
- `src/db/schema.ts` — `ryft_account_*` on properties, `ryft_*` on bookings, `ryft_id` on paymentEvents. `stripe_*` columns removed. Project uses **drizzle push** (no migrations folder — deliberate at this scale).
- `src/db/index.ts` — Neon retry wrapper.

---

## 7. What's left

The **code side is finished.** Everything below is operational / go-live work that needs a live Ryft account (which doesn't exist yet — still sandbox).

### Done (this migration)
- [x] NR + Flex on Ryft, refunds/void/cancel, off-session auto-charge.
- [x] **Re-enter-card recovery page** (`/payment-update/[token]`, Ryft) + decline email that links to it.
- [x] **Currency display fix** — bookings denominated in `ryftAccountCurrency` at creation; confirmation/email now match the charge.
- [x] **Flex self-cancel link** on the confirmation screen (`booking-finalise` returns `cancelUrl` → all 4 checkout screens).
- [x] **All three themes + fallback** run Ryft unconditionally.
- [x] **Stripe deleted** (`lib/stripe`, `api/stripe`, Stripe checkout routes, `StripePaymentSection`, theme appearances, admin Stripe pages, `stripe_*` schema columns, `@stripe/*` deps).
- [x] **Mews end-to-end** proven (`mews-fulfil-smoke`).
- [x] **Merged to `main`** → Railway deploys on sandbox keys.

### Go-live (blocked on a live Ryft account)
- [ ] **Live keys** — swap `sk_sandbox_*`/`pk_sandbox_*` → `sk_live_*`/`pk_live_*` on Railway (client auto-switches base URL by prefix; no code change).
- [ ] **Production webhook** — run `src/scripts/ryft-register-webhook.ts` with the live key + `https://app.rockenue.tech/api/ryft/webhooks`, store the `whs_…` as `RYFT_WEBHOOK_SECRET`. (Inline finalise covers the happy path; the webhook is the durable backstop.)
- [ ] **First-delivery signature check** — confirm the digest encoding (hex vs base64); the verifier accepts both meanwhile.
- [ ] **Per-hotel onboarding** — each real hotel runs the Ryft connect flow (`/admin/[propertyId]/ryft`) to get its own sub-account. Today the demos (`rockenue-partner-account-15cece68`, `mews-demo-hotel`) share sandbox sub-accounts; checkout is Ryft-only so only Ryft-active properties can take payment.
- [ ] **Custom-domain 3DS** — verify a real-card challenge-flow 3DS (which redirects to `PUBLIC_APP_URL`) works when the guest started on a hotel's own domain. Frictionless 3DS (sandbox default) doesn't redirect, so this won't surface in sandbox testing.

### Optional cleanup
- [ ] **Drop the empty `stripe_*` DB columns** — safe any time now that `main` runs the Ryft code; or leave them (harmless, ignored).

---

## 8. Commit trail (ryft-migration, newest first)

```
2e389cc Ryft Flex: action the off-session MIT via attempt-payment  ← made the charge actually Capture
27479e2 Ryft Flex: get-or-create customer + resolve saved card from session  ← unblocked live card-save
9cb0a1e Ryft Flex: debounce email before card-save init
195ff01 Ryft Flex: save the card via setup-card usage (fix Unscheduled attempt)
e329e54 Ryft Flex: defer card-save init until guest email is entered
a655a7e Ryft Flex: patch customerEmail onto the verify session
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

## 9. What's next — the path to live

The code is done and deployed to `main` on sandbox keys. To go live (in order):

1. **Sandbox-test the Railway deploy** — confirm app.rockenue.tech runs the Ryft storefront end-to-end on the hosted environment (book on a Ryft-active property with the sandbox test card). Catches hosted-env issues (PUBLIC_APP_URL, 3DS returnUrl, Neon) before launch.
2. **Get a live Ryft account** → live keys.
3. **Swap keys on Railway** — `sk_sandbox_*`→`sk_live_*`, `pk_sandbox_*`→`pk_live_*`. Redeploy not needed for env-only changes (Railway restarts).
4. **Register the production webhook** — `ryft-register-webhook.ts` with the live key + prod URL; set `RYFT_WEBHOOK_SECRET`. Confirm signature encoding on the first delivery.
5. **Onboard each real hotel** — Ryft connect flow per hotel → its own sub-account. Until a hotel is Ryft-active its checkout 409s (Ryft-only).
6. **Custom-domain 3DS** — one real-card challenge-flow test from a hotel's own domain (see §7).

Local dev to re-run the Flex charge: a Flex booking must be `pms_synced` with `chargeAt <= NOW()` and `ryftPaymentMethodId` set, then `POST /api/cron/auto-charge` with the `CRON_SECRET` bearer (set a throwaway `CRON_SECRET` in `.env.local`).

---

## 10. Deployment

- **Railway service:** the app serving **app.rockenue.tech** (this repo). Deploys from `main`.
- **`main` is now the Ryft code** (fast-forwarded to `ryft-migration` tip `80c50f5`, 2026-06-29).
- **Env vars set (sandbox):** `RYFT_SECRET_KEY`, `NEXT_PUBLIC_RYFT_PUBLIC_KEY`, `PUBLIC_APP_URL=https://app.rockenue.tech`. Not yet set: `RYFT_WEBHOOK_SECRET` (only needed once a live webhook is registered).
- **Railway CLI** is installed (`/usr/local/bin/railway`) but its OAuth token may be expired — `railway login` to read/set vars from the CLI.
- **DB:** single shared Neon instance (local dev + Railway). **Lesson learned:** never drop columns before the code that stops using them is deployed everywhere — dropping `stripe_*` while `main` still ran Stripe broke the admin ("no hotels"); fixed by re-adding the (empty) columns.
