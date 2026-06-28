"use client";

import Image from "next/image";
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
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { Btn, Input, Select } from "../components/primitives";
import { COUNTRIES } from "@/lib/countries";
import { porticoStripeAppearance } from "../stripe-appearance";

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

export function PorticoCheckout({ t, property }: { t: PorticoTokens; property: ResolvedProperty }) {
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
  }, [draftHydrated, draft, router]);

  const { extras } = useExtras(property.id);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  // specialRequests is captured on the /extras step and read from the
  // persisted draft below.

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
  // Booking row id from initBooking() — created before the card is confirmed.
  const bookingIdRef = useRef<string | null>(null);

  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!draft?.result) return { extrasTotal: 0, total: 0, nights: 0 };
    const nights = draft.result.nights;
    const guests = draft.adults + draft.children;
    const extrasTotal = extrasSubtotal(extras, draft.extras, nights, guests, draft.extrasConfig);
    return {
      extrasTotal,
      total: draft.result.totalPrice + extrasTotal,
      nights,
    };
  }, [draft, extras]);

  const guestRef = useRef({ first, last, email, phone, country });
  guestRef.current = { first, last, email, phone, country };
  const totalsRef = useRef(totals);
  totalsRef.current = totals;

  const isRefundable = draft?.result?.ratePlan.isRefundable ?? true;
  const intentReady = !!intent && !intentLoading;

  // Create-before-pay: persist the booking row + extras intent + Stripe intent
  // server-side via initBooking(). Fires once per (orderId, ratePlanId). Email
  // may still be empty here (this theme renders the card before it's typed) —
  // init stores "" and the details-patch backfills it before any charge.
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

    // Ryft refundable (Flex) saves the card to a Ryft customer, which REQUIRES
    // the guest email at card-save-session creation time. This form renders
    // before the email is typed, so wait for it — the effect re-runs when the
    // email is entered. (NR has no customer, so it can init immediately.)
    if (
      rail === "ryft" &&
      isRefundable &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestRef.current.email)
    ) {
      intentFetchedKeyRef.current = null;
      setIntentLoading(false);
      setIntentError("Enter your email above to load the secure card form.");
      return;
    }

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
  }, [draftHydrated, draft, isRefundable, property.id, extras, currency, rail, email]);

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

      // Persist guest details onto the row BEFORE charging — so a tab-death
      // right after the charge still leaves the webhook everything it needs.
      // Throws (blocking the charge) if it can't save.
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
        // (verify paid + fulfil to the PMS). Webhook is the async backstop.
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
  const isValid = first && last && email && country && intentReady;
  const buttonLabel = isRefundable ? "Save card & confirm →" : `Pay ${fmt.format(totals.total)} & confirm →`;

  return (
    <PorticoShell t={t}>
      <BookingNav t={t} step={3} />

      <div
        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", flex: 1 }}
        className="portico-checkout-grid"
      >
        {/* Left: form */}
        <section style={{ padding: "40px 48px", overflow: "auto" }} className="portico-checkout-form">
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: t.inkSoft,
              marginBottom: 8,
              fontFamily: "var(--portico-sans)",
            }}
          >
            Final details
          </div>
          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 36,
              margin: "0 0 32px",
              letterSpacing: "-0.01em",
              fontWeight: 400,
            }}
          >
            Almost <span style={{ fontStyle: "italic", color: t.accent }}>there</span>.
          </h1>

          <Section t={t} title="Guest details">
            <Row>
              <Input t={t} label="First name" value={first} onChange={setFirst} required autoComplete="given-name" />
              <Input t={t} label="Last name" value={last} onChange={setLast} required autoComplete="family-name" />
            </Row>
            <Row>
              <Input t={t} label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" />
              <Input t={t} label="Phone" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
            </Row>
            <Row>
              <Select
                t={t}
                label="Country"
                value={country}
                onChange={setCountry}
                options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                placeholder="Select country"
                required
                autoComplete="country"
              />
              <span />
            </Row>
          </Section>

          <Section t={t} title="Payment">
            {intentLoading && !intent && (
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: t.inkSoft,
                  margin: 0,
                  fontFamily: "var(--portico-sans)",
                }}
              >
                Preparing secure payment…
              </p>
            )}
            {intentError && (
              <p style={{ fontSize: 12, color: "#c25a4d", margin: 0 }}>{intentError}</p>
            )}
            {intent && rail === "ryft" && (
              <div style={{ marginTop: 8, maxWidth: 460 }}>
                <RyftPaymentSection
                  ref={ryftFormRef}
                  clientSecret={intent.clientSecret}
                  publicKey={intent.publicKey ?? ""}
                  accountId={intent.accountId}
                  customerEmail={email}
                  saveCard={isRefundable}
                  brand={{ accent: t.accent, ink: t.ink, rule: t.rule }}
                />
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: t.inkSoft,
                    fontFamily: "var(--portico-sans)",
                  }}
                >
                  Secured by Ryft · 256-bit encryption
                </p>
              </div>
            )}
            {intent && rail === "stripe" && (
              <div style={{ marginTop: 8 }}>
                <StripePaymentSection
                  ref={stripeFormRef}
                  kind={intent.kind}
                  clientSecret={intent.clientSecret}
                  appearance={porticoStripeAppearance(t)}
                />
              </div>
            )}
          </Section>

          {error && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                border: `1px solid ${t.rule}`,
                borderLeft: `2px solid #c25a4d`,
                fontSize: 13,
                color: t.ink,
              }}
            >
              {error}
            </div>
          )}
        </section>

        {/* Right: summary — always dark surface (cinematic punctuation) */}
        <aside
          style={{
            background: t.summaryBg,
            color: t.summaryInk,
            padding: "40px 48px",
            borderLeft: `1px solid ${t.rule}`,
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--portico-sans)",
          }}
          className="portico-checkout-summary"
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "5 / 3",
              overflow: "hidden",
              marginBottom: 22,
            }}
          >
            <Image src={porticoImg.roomTwin} alt="" fill sizes="40vw" style={{ objectFit: "cover" }} />
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              opacity: 0.7,
              marginBottom: 6,
            }}
          >
            Your stay
          </div>
          <div
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 28,
              marginBottom: 22,
              letterSpacing: "-0.01em",
            }}
          >
            {draft.result.roomType.name} · {totals.nights} {totals.nights === 1 ? "night" : "nights"}
          </div>

          <SumRow t={t} label="Arrive" value={fmtDate(draft.checkIn, "EEE d MMM, 'from 4pm'")} />
          <SumRow t={t} label="Depart" value={fmtDate(draft.checkOut, "EEE d MMM, 'by 11am'")} />
          <SumRow t={t} label="Guests" value={`${draft.adults} ${draft.adults === 1 ? "adult" : "adults"}${draft.children ? ` · ${draft.children} children` : ""}`} />
          <SumRow t={t} label="Plan" value={draft.result.ratePlan.name} />

          <div style={{ borderTop: `1px solid ${t.summaryRule}`, marginTop: 18, paddingTop: 16 }}>
            <Line label={`Room × ${totals.nights} ${totals.nights === 1 ? "night" : "nights"}`} value={fmt.format(draft.result.totalPrice)} />
            {totals.extrasTotal > 0 && <Line label="Extras" value={fmt.format(totals.extrasTotal)} />}
          </div>

          <div
            style={{
              borderTop: `1px solid ${t.summaryRule}`,
              marginTop: 10,
              paddingTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" }}>Total</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.005em",
              }}
            >
              {fmt.format(totals.total)}
            </div>
          </div>

          <Btn
            t={t}
            primary
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{ marginTop: 22, padding: "16px 22px", fontSize: 11, letterSpacing: "0.28em" }}
          >
            {submitting ? "Confirming…" : buttonLabel}
          </Btn>

          {isRefundable && (
            <div
              style={{
                marginTop: 12,
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              Card is held — no charge until 48h before arrival.
            </div>
          )}

          <div style={{ marginTop: 28, fontSize: 11, opacity: 0.6 }}>
            <Link href={`/${property.slug}/rooms`} style={{ color: "inherit", textDecoration: "none", borderBottom: `1px solid ${t.summaryRule}` }}>
              ← Change room
            </Link>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-checkout-grid {
            grid-template-columns: 1fr !important;
          }
          .portico-checkout-form {
            padding: 32px 24px !important;
          }
          .portico-checkout-summary {
            padding: 32px 24px !important;
            border-left: none !important;
            border-top: 1px solid ${t.rule};
          }
        }
      `}</style>
    </PorticoShell>
  );
}

function Section({
  t,
  title,
  children,
}: {
  t: PorticoTokens;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: t.inkSoft,
          marginBottom: 14,
          paddingBottom: 8,
          borderBottom: `1px solid ${t.rule}`,
          fontFamily: "var(--portico-sans)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 22,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function SumRow({ t, label, value }: { t: PorticoTokens; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "12px 0",
        borderBottom: `1px solid ${t.summaryRule}`,
      }}
    >
      <span
        style={{
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: 0.65,
          fontSize: 10,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: "0.005em",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0" }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function fmtDate(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
