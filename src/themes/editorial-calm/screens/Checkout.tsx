"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  clearPersistedDraft,
  extraQuantity,
  extrasSubtotal,
  loadPersistedDraft,
  savePersistedConfirmation,
  submitBooking,
  initBooking,
  ryftInitBooking,
  ryftFinaliseBooking,
  patchBookingDetails,
  SubmitBookingError,
  useExtras,
  type PersistedBookingDraft,
} from "@/lib/booking";
import StripePaymentSection, {
  type IntentKind,
  type StripePaymentSectionHandle,
} from "@/components/checkout/StripePaymentSection";
import RyftPaymentSection, {
  type RyftPaymentSectionHandle,
} from "@/components/checkout/RyftPaymentSection";
import { COUNTRIES } from "@/lib/countries";
import type { ResolvedProperty, PropertyPhotos } from "@/lib/get-property";
import type { EditorialCalmTokens } from "../tokens";
import { ecImg, ecLayout } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav } from "../components/Nav";
import { StepBar, StepDots, PageHeading } from "../components/BookingChrome";
import { CTA, Mono, Bracket, Field, SelectField } from "../components/primitives";
import { editorialCalmStripeAppearance } from "../stripe-appearance";
import { FineFooter } from "./RoomSelect";

// Screen 3 · Confirm & pay — guest details + Stripe-secured card on the
// left, the booking summary rail on the right. Same create-before-pay
// contract as the Street checkout (initBooking → patch details → confirm).

interface CreatedIntent {
  kind: IntentKind;
  clientSecret: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  customerId?: string;
  // Ryft rail only.
  paymentSessionId?: string;
  accountId?: string | null;
  publicKey?: string | null;
}

export function EditorialCalmCheckout({
  t,
  property,
  photos,
}: {
  t: EditorialCalmTokens;
  property: ResolvedProperty;
  photos?: PropertyPhotos;
}) {
  const router = useRouter();
  const currency = property.currency ?? "GBP";

  const [draft, setDraft] = useState<PersistedBookingDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    setDraft(loadPersistedDraft());
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (draftHydrated && (!draft || !draft.result)) router.replace(`/${property.slug}`);
  }, [draftHydrated, draft, router, property.slug]);

  const { extras } = useExtras(property.id);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderIdRef = useRef<string | null>(null);
  if (orderIdRef.current === null && typeof window !== "undefined") {
    orderIdRef.current = crypto.randomUUID();
  }

  const stripeFormRef = useRef<StripePaymentSectionHandle | null>(null);
  const ryftFormRef = useRef<RyftPaymentSectionHandle | null>(null);
  const rail = property.paymentRail;
  const intentFetchedKeyRef = useRef<string | null>(null);
  const bookingIdRef = useRef<string | null>(null);

  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!draft?.result) return { extrasTotal: 0, total: 0, nights: 0 };
    const nights = draft.result.nights;
    const guests = draft.adults + draft.children;
    const extrasTotal = extrasSubtotal(extras, draft.extras, nights, guests, draft.extrasConfig);
    return { extrasTotal, total: draft.result.totalPrice + extrasTotal, nights };
  }, [draft, extras]);

  const guestRef = useRef({ first, last, email, phone, country });
  guestRef.current = { first, last, email, phone, country };

  const isRefundable = draft?.result?.ratePlan.isRefundable ?? true;
  const intentReady = !!intent && !intentLoading;

  // Create-before-pay: persist the booking row + Stripe intent server-side
  // before the card is confirmed. Fires once per (orderId, ratePlanId).
  useEffect(() => {
    if (!draftHydrated || !draft?.result) return;
    if (!orderIdRef.current) return;

    const orderId = orderIdRef.current;
    const result = draft.result;
    const ratePlanId = result.ratePlan.id;
    const fetchKey = `${orderId}:${ratePlanId}`;
    if (intentFetchedKeyRef.current === fetchKey) return;
    intentFetchedKeyRef.current = fetchKey;

    const kind: IntentKind = isRefundable ? "setup" : "payment";
    const guest = guestRef.current;
    const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));

    setIntentLoading(true);
    setIntentError(null);

    const initArgs = {
      propertyId: property.id,
      orderId,
      result,
      extras: selectedExtras,
      extrasConfig: draft.extrasConfig,
      guestEmail: guest.email,
      guestFirst: guest.first || undefined,
      guestLast: guest.last || undefined,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      adults: draft.adults,
      children: draft.children,
      currency,
    };

    const initPromise =
      rail === "ryft"
        ? ryftInitBooking(initArgs).then((init) => {
            bookingIdRef.current = init.bookingId;
            setIntent({
              kind: "payment",
              clientSecret: init.clientSecret,
              paymentSessionId: init.paymentSessionId,
              accountId: init.accountId,
              publicKey: init.publicKey,
            });
          })
        : initBooking(initArgs).then((init) => {
            bookingIdRef.current = init.bookingId;
            setIntent({
              kind,
              clientSecret: init.clientSecret,
              paymentIntentId: init.paymentIntentId,
              setupIntentId: init.setupIntentId,
              customerId: init.customerId,
            });
          });

    initPromise
      .then(() => setIntentLoading(false))
      .catch((err) => {
        setIntentError(
          err instanceof SubmitBookingError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Network error"
        );
        setIntentLoading(false);
        intentFetchedKeyRef.current = null;
      });
  }, [draftHydrated, draft, isRefundable, property.id, extras, currency, rail]);

  async function handleSubmit() {
    if (!draft?.result || !orderIdRef.current) return;
    const activeFormRef = rail === "ryft" ? ryftFormRef : stripeFormRef;
    if (!intent || !activeFormRef.current) {
      setError("Payment form is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const guest = {
        firstName: first,
        lastName: last,
        email,
        phone,
        country,
        specialRequests: draft.specialRequests,
      };

      // Persist guest details onto the row BEFORE charging — Ryft also needs the
      // guest email on the session before confirm.
      if (bookingIdRef.current) {
        await patchBookingDetails(bookingIdRef.current, guest);
      }

      const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));

      let result: {
        orderId: string;
        bookingId: string;
        cloudbedsReservationId?: string | null;
        cancelUrl?: string;
      };

      if (rail === "ryft") {
        // Confirm the card via the Ryft SDK, then finalise server-side
        // (verify + fulfil to the PMS). Webhook is the async backstop.
        await ryftFormRef.current!.confirm();
        const finalised = await ryftFinaliseBooking(bookingIdRef.current!);
        result = {
          orderId: orderIdRef.current,
          bookingId: bookingIdRef.current!,
          cloudbedsReservationId: finalised.cloudbedsReservationId,
        };
      } else {
        const stripeResult = await stripeFormRef.current!.confirm();
        result = await submitBooking({
          propertyId: property.id,
          orderId: orderIdRef.current,
          result: draft.result,
          extras: selectedExtras,
          extrasConfig: draft.extrasConfig,
          guest,
          checkIn: draft.checkIn,
          checkOut: draft.checkOut,
          adults: draft.adults,
          children: draft.children,
          currency,
          paymentIntentId: stripeResult.paymentIntentId,
          setupIntentId: stripeResult.setupIntentId,
          paymentMethodId: stripeResult.paymentMethodId,
          customerId: intent.customerId,
        });
      }

      savePersistedConfirmation({
        orderId: result.orderId,
        bookingId: result.bookingId,
        cloudbedsReservationId: result.cloudbedsReservationId ?? undefined,
        cancelUrl: result.cancelUrl,
        firstName: first,
        lastName: last,
        email,
        roomName: draft.result.roomType.name,
        rateName: draft.result.ratePlan.name,
        rateType: isRefundable ? "flex" : "nr",
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        nights: draft.result.nights,
        adults: draft.adults,
        roomTotal: draft.result.totalPrice,
        extrasTotal: totals.extrasTotal,
        totalPrice: totals.total,
        nightlyRates: draft.result.nightlyRates,
        extras: selectedExtras.map((e) => {
          const quantity = extraQuantity(
            e.pricingModel,
            draft.result!.nights,
            draft.adults + draft.children,
            draft.extrasConfig?.[e.id]
          );
          return {
            name: e.name,
            priceMinorUnits: e.priceMinorUnits,
            currency: e.currency,
            quantity,
            lineTotal: (e.priceMinorUnits / 100) * quantity,
          };
        }),
        currency,
      });
      clearPersistedDraft();
      router.push(`/${property.slug}/confirmation?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      const msg =
        e instanceof SubmitBookingError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!draftHydrated || !draft?.result) return null;

  const fmt = makeFormatter(currency);
  const isValid = !!(first && last && email && country && intentReady);
  const buttonLabel = isRefundable ? "Save card & confirm →" : `Pay ${fmt.format(totals.total)} & confirm →`;

  const roomPhoto =
    photos?.byRoomType[draft.result.roomType.id]?.[0]?.urls.gallery ??
    photos?.gallerySlot[0]?.urls.gallery ??
    ecImg.roomFallback;

  const nights = totals.nights;
  const summary = `${fmtRange(draft.checkIn, draft.checkOut)} · ${nights} NIGHT${nights === 1 ? "" : "S"} · ${draft.adults} ADULT${draft.adults === 1 ? "" : "S"}${draft.children ? ` · ${draft.children} CHILDREN` : ""}`;

  return (
    <EditorialCalmShell t={t}>
      <Nav t={t} name={property.name} />
      <StepBar t={t} step={3} label="CONFIRM & PAY" summary={summary} editHref={`/${property.slug}/extras`} />
      <PageHeading
        t={t}
        title="Almost home"
        body={
          isRefundable
            ? "A few details and you're set. Your room is held while you finish — nothing leaves your account today."
            : "A few details and you're set. Your card is charged today at the rate you chose."
        }
        dots={<StepDots t={t} current={2} />}
      />

      <div
        style={{
          maxWidth: ecLayout.contentMax,
          margin: "0 auto",
          padding: "52px 40px 96px",
          display: "grid",
          gridTemplateColumns: `1fr ${ecLayout.railWidth}px`,
          gap: ecLayout.railGap,
          alignItems: "start",
          width: "100%",
        }}
        className="ec-checkout-grid"
      >
        <div>
          <Bracket t={t} size={11} style={{ marginBottom: 22, display: "inline-flex" }}>GUEST DETAILS</Bracket>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "26px 28px" }} className="ec-form-grid">
            <Field t={t} label="First name" value={first} onChange={setFirst} placeholder="Your first name" required autoComplete="given-name" />
            <Field t={t} label="Last name" value={last} onChange={setLast} placeholder="Your last name" required autoComplete="family-name" />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field t={t} label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" required autoComplete="email" hint="YOUR CONFIRMATION GOES HERE" />
            </div>
            <Field t={t} label="Mobile" value={phone} onChange={setPhone} type="tel" placeholder="+44 …" autoComplete="tel" />
            <SelectField
              t={t}
              label="Country"
              value={country}
              onChange={setCountry}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
              placeholder="Select country"
              required
              autoComplete="country"
            />
          </div>

          <div style={{ height: 1, background: t.line, margin: "44px 0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <Bracket t={t} size={11}>PAYMENT</Bracket>
            <Mono t={t} size={10} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: t.forest, display: "inline-block" }} />
              SECURED BY {rail === "ryft" ? "RYFT" : "STRIPE"}
            </Mono>
          </div>
          {intentLoading && !intent && <Mono t={t} size={10.5}>PREPARING SECURE PAYMENT…</Mono>}
          {intentError && <p style={{ fontSize: 13, color: "#B82626", fontFamily: "var(--ec-sans)", margin: 0 }}>{intentError}</p>}
          {intent && rail === "ryft" && (
            <div style={{ marginTop: 8, maxWidth: 460 }}>
              <RyftPaymentSection
                ref={ryftFormRef}
                clientSecret={intent.clientSecret}
                publicKey={intent.publicKey ?? ""}
                accountId={intent.accountId}
                customerEmail={email}
                brand={{ accent: t.forest, ink: t.ink, rule: t.line }}
              />
            </div>
          )}
          {intent && rail === "stripe" && (
            <div style={{ marginTop: 8 }}>
              <StripePaymentSection
                ref={stripeFormRef}
                kind={intent.kind}
                clientSecret={intent.clientSecret}
                appearance={editorialCalmStripeAppearance(t)}
              />
            </div>
          )}
          <p style={{ fontFamily: "var(--ec-mono)", fontSize: 12, lineHeight: 1.7, color: t.ink70, marginTop: 18, maxWidth: 460 }}>
            {isRefundable
              ? "Your card isn't charged today — we'll take payment closer to arrival, and you can cancel free per your rate's policy."
              : "Your card is charged today and the booking is non-refundable."}
          </p>

          {error && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                border: `1px solid ${t.line}`,
                borderLeft: "2px solid #B82626",
                borderRadius: 10,
                fontSize: 13.5,
                fontFamily: "var(--ec-sans)",
                color: t.ink,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── summary rail ── */}
        <aside style={{ position: "sticky", top: 28, alignSelf: "start" }} className="ec-pay-rail">
          <div style={{ border: `1px solid ${t.line}`, borderRadius: 20, overflow: "hidden", background: t.paper }}>
            <div style={{ display: "flex", gap: 16, padding: 20, borderBottom: `1px solid ${t.line}` }}>
              <div
                role="img"
                aria-label={draft.result.roomType.name}
                style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 12, background: `#E7E2D6 url(${JSON.stringify(roomPhoto)}) center/cover no-repeat` }}
              />
              <div style={{ paddingTop: 2 }}>
                <Bracket t={t} size={9.5} style={{ marginBottom: 9 }}>YOUR ROOM</Bracket>
                <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 400, fontSize: 18, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {draft.result.roomType.name}
                </div>
                <div style={{ marginTop: 7 }}>
                  <Mono t={t} size={9.5}>{fmtRange(draft.checkIn, draft.checkOut)}</Mono>
                </div>
              </div>
            </div>
            <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <PayLine t={t} label={rateLineLabel(draft.result.ratePlan.name)} sub={`${nights} NIGHTS`} amount={fmt.format(draft.result.totalPrice)} />
              {totals.extrasTotal > 0 && <PayLine t={t} label="Extras" amount={fmt.format(totals.extrasTotal)} muted />}
            </div>
            <div style={{ padding: "20px 20px 22px", borderTop: `1px solid ${t.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 16 }}>Total</span>
                <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 26, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                  {fmt.format(totals.total)}
                </span>
              </div>
              <div style={{ marginBottom: 18 }}>
                <Mono t={t} size={9.5}>{isRefundable ? "NOTHING DUE TODAY" : "CHARGED TODAY"}</Mono>
              </div>
              <CTA t={t} size="md" style={{ width: "100%", justifyContent: "center" }} onClick={handleSubmit} disabled={!isValid || submitting}>
                {submitting ? "Confirming…" : buttonLabel}
              </CTA>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: t.forest, display: "inline-block" }} />
                <Mono t={t} size={9.5}>SECURED BY {rail === "ryft" ? "RYFT" : "STRIPE"} · PCI-DSS</Mono>
              </div>
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <Link
                  href={`/${property.slug}/extras`}
                  style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 12.5, color: t.ink50, borderBottom: `1px solid ${t.line2}`, paddingBottom: 2, textDecoration: "none" }}
                >
                  ← Change rate or extras
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <FineFooter t={t} name={property.name} />
      <style>{`
        @media (max-width: 1020px) {
          .ec-checkout-grid { grid-template-columns: 1fr !important; padding: 32px 24px 64px !important; }
          .ec-pay-rail { position: static !important; }
        }
        @media (max-width: 640px) {
          .ec-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </EditorialCalmShell>
  );
}

function PayLine({
  t,
  label,
  sub,
  amount,
  muted,
}: {
  t: EditorialCalmTokens;
  label: string;
  sub?: string;
  amount: string;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <div>
        <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 14, color: muted ? t.ink70 : t.ink }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, marginTop: 4 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 15, fontVariantNumeric: "tabular-nums", color: muted ? t.ink70 : t.ink }}>{amount}</span>
    </div>
  );
}

function fmtRange(checkIn: string, checkOut: string): string {
  try {
    return `${format(parseISO(checkIn), "d MMM")} – ${format(parseISO(checkOut), "d MMM")}`.toUpperCase();
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

// "Flexible" → "Flexible rate", but "My rate" stays "My rate".
function rateLineLabel(name: string): string {
  return /rate$/i.test(name.trim()) ? name : `${name} rate`;
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
