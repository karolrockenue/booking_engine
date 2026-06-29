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
  ryftInitBooking,
  ryftFinaliseBooking,
  patchBookingDetails,
  SubmitBookingError,
  useExtras,
  type PersistedBookingDraft,
} from "@/lib/booking";
import RyftPaymentSection, {
  type RyftPaymentSectionHandle,
} from "@/components/checkout/RyftPaymentSection";
import { COUNTRIES } from "@/lib/countries";
import type { ResolvedProperty } from "@/lib/get-property";
import type { StreetTokens } from "../tokens";
import { StreetShell } from "../StreetShell";
import { BookingNav } from "../components/BookingNav";
import { Btn, Input, Select, Eyebrow, SerifH } from "../components/primitives";
import { renderEmphasis } from "../components/emphasis";

interface CreatedIntent {
  kind: "setup" | "payment";
  clientSecret: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  customerId?: string;
  // Ryft rail only.
  paymentSessionId?: string;
  accountId?: string | null;
  publicKey?: string | null;
}

export function StreetCheckout({ t, property }: { t: StreetTokens; property: ResolvedProperty }) {
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

  const ryftFormRef = useRef<RyftPaymentSectionHandle | null>(null);
  const intentFetchedKeyRef = useRef<string | null>(null);
  // Booking row id from initBooking() — created before the card is confirmed.
  const bookingIdRef = useRef<string | null>(null);

  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  // Debounce the email so the Flex card-save — which creates a Ryft customer at
  // init time — fires on a settled address, not a half-typed one (the ".c" of
  // ".com" matches the email regex and would otherwise save a truncated email).
  const [settledEmail, setSettledEmail] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSettledEmail(email), 600);
    return () => clearTimeout(id);
  }, [email]);

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

    const guest = guestRef.current;
    const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));

    // Ryft refundable (Flex) saves the card to a Ryft customer, which REQUIRES
    // the guest email at card-save-session creation time. This form renders
    // before the email is typed, so wait for it — the effect re-runs when the
    // email is entered. (NR has no customer, so it can init immediately.)
    if (
      isRefundable &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(settledEmail)
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

    const initPromise = ryftInitBooking(initArgs).then((init) => {
      bookingIdRef.current = init.bookingId;
      setIntent({
        kind: "payment",
        clientSecret: init.clientSecret,
        paymentSessionId: init.paymentSessionId,
        accountId: init.accountId,
        publicKey: init.publicKey,
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
  }, [draftHydrated, draft, isRefundable, property.id, extras, currency, settledEmail]);

  async function handleSubmit() {
    if (!draft?.result || !orderIdRef.current) return;
    if (!intent || !ryftFormRef.current) {
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

      // Confirm the card via the Ryft SDK, then finalise server-side
      // (verify paid + fulfil to the PMS). Webhook is the async backstop.
      await ryftFormRef.current!.confirm();
      const finalised = await ryftFinaliseBooking(bookingIdRef.current!);
      result = {
        orderId: orderIdRef.current,
        bookingId: bookingIdRef.current!,
        cloudbedsReservationId: finalised.cloudbedsReservationId,
        cancelUrl: finalised.cancelUrl,
      };

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
    <StreetShell t={t} fullBleed>
      <BookingNav t={t} step={3} name={property.name} />

      <div
        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: "calc(100dvh - 61px)" }}
        className="street-checkout-grid"
      >
        {/* Left — form */}
        <section style={{ padding: "56px 56px 80px", overflow: "auto" }} className="street-checkout-form">
          <div style={{ maxWidth: 620 }}>
            <Eyebrow t={t}>Final details</Eyebrow>
            <SerifH t={t} size="lg" style={{ margin: "12px 0 40px" }}>
              {renderEmphasis("Almost *there.*", t.accent)}
            </SerifH>

            <FormSection t={t} title="Guest details">
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
            </FormSection>

            <FormSection t={t} title="Payment">
              {intentLoading && !intent && (
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: t.inkSoft,
                    margin: 0,
                    fontFamily: "var(--street-sans)",
                  }}
                >
                  Preparing secure payment…
                </p>
              )}
              {intentError && <p style={{ fontSize: 12, color: "#b54a3a", margin: 0 }}>{intentError}</p>}
              {intent && (
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
                      color: t.inkMuted,
                      fontFamily: "var(--street-sans)",
                    }}
                  >
                    Secured by Ryft · 256-bit encryption
                  </p>
                </div>
              )}
            </FormSection>

            {error && (
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  border: `1px solid ${t.rule}`,
                  borderLeft: `2px solid #b54a3a`,
                  fontSize: 13,
                  color: t.ink,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Right — summary on the alt cream surface */}
        <aside
          style={{
            background: t.bg2,
            color: t.ink,
            padding: "56px 48px 80px",
            borderLeft: `1px solid ${t.rule}`,
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--street-sans)",
          }}
          className="street-checkout-summary"
        >
          <Eyebrow t={t}>Your stay</Eyebrow>
          <div
            style={{
              fontFamily: "var(--street-serif)",
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: "12px 0 26px",
              color: t.ink,
            }}
          >
            {draft.result.roomType.name}
            <span style={{ color: t.inkMuted }}>
              {" "}
              · {totals.nights} {totals.nights === 1 ? "night" : "nights"}
            </span>
          </div>

          <SumRow t={t} label="Arrive" value={fmtDate(draft.checkIn, "EEE d MMM, 'from 4pm'")} />
          <SumRow t={t} label="Depart" value={fmtDate(draft.checkOut, "EEE d MMM, 'by 11am'")} />
          <SumRow
            t={t}
            label="Guests"
            value={`${draft.adults} ${draft.adults === 1 ? "adult" : "adults"}${draft.children ? ` · ${draft.children} children` : ""}`}
          />
          <SumRow t={t} label="Plan" value={draft.result.ratePlan.name} />

          <div style={{ borderTop: `1px solid ${t.rule}`, marginTop: 18, paddingTop: 16 }}>
            <Line
              t={t}
              label={`Room × ${totals.nights} ${totals.nights === 1 ? "night" : "nights"}`}
              value={fmt.format(draft.result.totalPrice)}
            />
            {totals.extrasTotal > 0 && <Line t={t} label="Extras" value={fmt.format(totals.extrasTotal)} />}
          </div>

          <div
            style={{
              borderTop: `1px solid ${t.rule}`,
              marginTop: 10,
              paddingTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: t.inkSoft }}>
              Total
            </div>
            <div
              style={{
                fontFamily: "var(--street-serif)",
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "-0.025em",
                fontFeatureSettings: '"tnum"',
                color: t.ink,
              }}
            >
              {fmt.format(totals.total)}
            </div>
          </div>

          <Btn
            t={t}
            filled
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{ marginTop: 24, width: "100%", padding: "16px 22px" }}
          >
            {submitting ? "Confirming…" : buttonLabel}
          </Btn>

          {isRefundable && (
            <div
              style={{
                marginTop: 12,
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: t.inkMuted,
                textAlign: "center",
              }}
            >
              Card is held — no charge until 48h before arrival.
            </div>
          )}

          <div style={{ marginTop: 28, fontSize: 11 }}>
            <Link
              href={`/${property.slug}/rooms`}
              style={{
                color: t.inkSoft,
                textDecoration: "none",
                borderBottom: `1px solid ${t.rule}`,
                paddingBottom: 2,
                letterSpacing: "0.04em",
              }}
            >
              ← Change room
            </Link>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .street-checkout-grid { grid-template-columns: 1fr !important; }
          .street-checkout-form { padding: 36px 24px 56px !important; }
          .street-checkout-summary {
            padding: 36px 24px 56px !important;
            border-left: none !important;
            border-top: 1px solid ${t.rule};
          }
        }
      `}</style>
    </StreetShell>
  );
}

function FormSection({ t, title, children }: { t: StreetTokens; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          marginBottom: 18,
          paddingBottom: 8,
          borderBottom: `1px solid ${t.rule}`,
          fontFamily: "var(--street-sans)",
          fontWeight: 500,
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginBottom: 22 }}>{children}</div>
  );
}

function SumRow({ t, label, value }: { t: StreetTokens; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "12px 0",
        borderBottom: `1px solid ${t.ruleSoft}`,
      }}
    >
      <span
        style={{
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontSize: 10,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--street-serif)",
          fontSize: 16,
          letterSpacing: "-0.005em",
          textAlign: "right",
          color: t.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Line({ t, label, value }: { t: StreetTokens; label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", color: t.inkSoft }}>
      <span>{label}</span>
      <span style={{ fontFeatureSettings: '"tnum"', color: t.ink }}>{value}</span>
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
