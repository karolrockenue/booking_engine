"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  clearPersistedDraft,
  loadPersistedDraft,
  savePersistedConfirmation,
  submitBooking,
  SubmitBookingError,
  useExtras,
  type PersistedBookingDraft,
} from "@/lib/booking";
import StripePaymentSection, {
  type IntentKind,
  type StripePaymentSectionHandle,
} from "@/components/checkout/StripePaymentSection";
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { Btn, Input } from "../components/primitives";
import { porticoStripeAppearance } from "../stripe-appearance";

interface CreatedIntent {
  kind: IntentKind;
  clientSecret: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  customerId?: string;
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
    if (draftHydrated && (!draft || !draft.result)) router.replace("/");
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
  const intentFetchedKeyRef = useRef<string | null>(null);

  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!draft?.result) return { extrasTotal: 0, total: 0, nights: 0 };
    const selected = extras.filter((e) => draft.extras.includes(e.id));
    const extrasTotal = selected.reduce((sum, e) => sum + e.priceMinorUnits / 100, 0);
    return {
      extrasTotal,
      total: draft.result.totalPrice + extrasTotal,
      nights: draft.result.nights,
    };
  }, [draft, extras]);

  const guestRef = useRef({ first, last, email, phone, country });
  guestRef.current = { first, last, email, phone, country };
  const totalsRef = useRef(totals);
  totalsRef.current = totals;

  const isRefundable = draft?.result?.ratePlan.isRefundable ?? true;
  const intentReady = !!intent && !intentLoading;

  useEffect(() => {
    if (!draftHydrated || !draft?.result) return;
    if (!orderIdRef.current) return;

    const orderId = orderIdRef.current;
    const ratePlanId = draft.result.ratePlan.id;
    const fetchKey = `${orderId}:${ratePlanId}`;
    if (intentFetchedKeyRef.current === fetchKey) return;
    intentFetchedKeyRef.current = fetchKey;

    const kind: IntentKind = isRefundable ? "setup" : "payment";
    const guest = guestRef.current;
    const tot = totalsRef.current;

    setIntentLoading(true);
    setIntentError(null);

    const url = kind === "setup" ? "/api/stripe/setup-intent" : "/api/stripe/payment-intent";
    const payload =
      kind === "setup"
        ? {
            propertyId: property.id,
            ratePlanId,
            orderId,
            guestEmail: guest.email,
            guestFirst: guest.first || undefined,
            guestLast: guest.last || undefined,
          }
        : {
            propertyId: property.id,
            ratePlanId,
            orderId,
            amount: tot.total,
            guestEmail: guest.email,
          };

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          clientSecret?: string;
          paymentIntentId?: string;
          setupIntentId?: string;
          customerId?: string;
        };
        if (!res.ok || !body.clientSecret) {
          setIntentError(body.error ?? `Failed to initialise payment (${res.status})`);
          setIntentLoading(false);
          intentFetchedKeyRef.current = null;
          return;
        }
        setIntent({
          kind,
          clientSecret: body.clientSecret,
          paymentIntentId: body.paymentIntentId,
          setupIntentId: body.setupIntentId,
          customerId: body.customerId,
        });
        setIntentLoading(false);
      })
      .catch((err) => {
        setIntentError(err instanceof Error ? err.message : "Network error");
        setIntentLoading(false);
        intentFetchedKeyRef.current = null;
      });
  }, [draftHydrated, draft, isRefundable, property.id]);

  async function handleSubmit() {
    if (!draft?.result || !orderIdRef.current) return;
    if (!intent || !stripeFormRef.current) {
      setError("Payment form is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const stripeResult = await stripeFormRef.current.confirm();
      const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));
      const result = await submitBooking({
        propertyId: property.id,
        orderId: orderIdRef.current,
        result: draft.result,
        extras: selectedExtras,
        guest: {
          firstName: first,
          lastName: last,
          email,
          phone,
          country,
          specialRequests: draft.specialRequests,
        },
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

      savePersistedConfirmation({
        orderId: result.orderId,
        bookingId: result.bookingId,
        cloudbedsReservationId: result.cloudbedsReservationId,
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
        extras: selectedExtras.map((e) => ({
          name: e.name,
          priceMinorUnits: e.priceMinorUnits,
          currency: e.currency,
        })),
        currency,
      });
      clearPersistedDraft();
      router.push(`/confirmation?orderId=${encodeURIComponent(result.orderId)}`);
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
              <Input t={t} label="Country" value={country} onChange={setCountry} required autoComplete="country-name" />
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
            {intent && (
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
            <Link href="/rooms" style={{ color: "inherit", textDecoration: "none", borderBottom: `1px solid ${t.summaryRule}` }}>
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
