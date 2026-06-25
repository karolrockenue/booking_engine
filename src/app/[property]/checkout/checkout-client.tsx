"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import {
  GuestDetailsForm,
  type GuestDetails as GuestDetailsForm$Details,
} from "@/components/booking/GuestDetailsForm";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { CreditCard, Lock, ShieldCheck, User, ArrowLeft } from "lucide-react";
import type { ResolvedProperty } from "@/lib/get-property";
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
  type PersistedBookingDraft,
} from "@/lib/booking";
import { useExtras } from "@/lib/booking";
import StripePaymentSection, {
  type StripePaymentSectionHandle,
  type IntentKind,
} from "@/components/checkout/StripePaymentSection";
import RyftPaymentSection, {
  type RyftPaymentSectionHandle,
} from "@/components/checkout/RyftPaymentSection";

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

export function CheckoutClient({ property }: { property: ResolvedProperty }) {
  const router = useRouter();

  const [draft, setDraft] = useState<PersistedBookingDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPersistedDraft();
    setDraft(loaded);
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (draftHydrated && (!draft || !draft.result)) {
      router.replace(`/${property.slug}`);
    }
  }, [draftHydrated, draft, router]);

  const { extras } = useExtras(property.id);

  const [guestDetails, setGuestDetails] = useState<GuestDetailsForm$Details>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    specialRequests: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable orderId for the entire checkout session — used as Stripe
  // idempotency key + the booking's orderId.
  const orderIdRef = useRef<string | null>(null);
  if (orderIdRef.current === null && typeof window !== "undefined") {
    orderIdRef.current = crypto.randomUUID();
  }

  const stripeFormRef = useRef<StripePaymentSectionHandle | null>(null);
  const ryftFormRef = useRef<RyftPaymentSectionHandle | null>(null);
  const rail = property.paymentRail;

  // Booking row id returned by initBooking() — the row exists server-side before
  // the card is confirmed (create-before-pay), so the patch + finalise calls and
  // the Stripe webhook can all reference it.
  const bookingIdRef = useRef<string | null>(null);

  // One-shot guard: ensures we only fire one fetch per (orderId, ratePlanId)
  // combo. Prevents the cancellation-race that left intentLoading stuck true
  // when the user typed during an in-flight fetch.
  const intentFetchedKeyRef = useRef<string | null>(null);

  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const currency = property.currency ?? "GBP";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

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

  // Read-latest refs so the fetch effect can grab current form values without
  // taking them as dependencies (which would re-fire the fetch on every
  // keystroke and create a cancellation race).
  const guestDetailsRef = useRef(guestDetails);
  guestDetailsRef.current = guestDetails;
  const totalsRef = useRef(totals);
  totalsRef.current = totals;

  const isRefundable = draft?.result?.ratePlan.isRefundable ?? true;
  const emailReady = guestDetails.email.includes("@");
  const intentReady = !!intent && !intentLoading;

  // Create-before-pay: once we have draft + email, persist the booking row +
  // extras intent + Stripe intent server-side via initBooking(). One-shot per
  // (orderId, ratePlanId): once fired we never re-fire, so subsequent edits to
  // email/name/extras don't race with an in-flight call.
  useEffect(() => {
    if (!draftHydrated || !draft?.result || !emailReady) return;
    if (!orderIdRef.current) return;

    const orderId = orderIdRef.current;
    const result = draft.result;
    const ratePlanId = result.ratePlan.id;
    const fetchKey = `${orderId}:${ratePlanId}`;
    if (intentFetchedKeyRef.current === fetchKey) return;
    intentFetchedKeyRef.current = fetchKey;

    const kind: IntentKind = isRefundable ? "setup" : "payment";
    const guest = guestDetailsRef.current;
    const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));

    // Flex (refundable) on Ryft needs the off-session saved-card redesign that
    // isn't built yet — block here rather than init a path that can't charge.
    if (rail === "ryft" && isRefundable) {
      setIntentError(
        "Refundable rates aren’t available for online payment yet — please choose a non-refundable rate."
      );
      setIntentLoading(false);
      intentFetchedKeyRef.current = null;
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
      guestFirst: guest.firstName || undefined,
      guestLast: guest.lastName || undefined,
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
        // Allow a retry on next email change since the call failed.
        intentFetchedKeyRef.current = null;
      });
  }, [draftHydrated, draft, emailReady, isRefundable, property.id, extras, currency, rail]);

  async function handleSubmit() {
    if (!draft?.result || !orderIdRef.current) return;
    const activeFormRef = rail === "ryft" ? ryftFormRef : stripeFormRef;
    if (!intent || !activeFormRef.current) {
      setError("Payment form is not ready yet.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const guest = {
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        email: guestDetails.email,
        phone: guestDetails.phone,
        country: guestDetails.country,
      };

      // Persist guest details onto the row BEFORE charging — if the tab dies
      // right after the charge, the webhook still has the name/country it
      // needs to fulfil. Throws (blocking the charge) if it can't save.
      if (bookingIdRef.current) {
        await patchBookingDetails(bookingIdRef.current, guest);
      }

      const selectedExtras = extras.filter((e) => draft.extras.includes(e.id));

      let result: {
        orderId: string;
        bookingId: string;
        cloudbedsReservationId?: string | null;
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
        const confirmResult = await stripeFormRef.current!.confirm();
        result = await submitBooking({
          propertyId: property.id,
          orderId: orderIdRef.current,
          result: draft.result,
          extras: selectedExtras,
          guest,
          checkIn: draft.checkIn,
          checkOut: draft.checkOut,
          adults: draft.adults,
          children: draft.children,
          currency,
          paymentIntentId: confirmResult.paymentIntentId,
          setupIntentId: confirmResult.setupIntentId,
          paymentMethodId: confirmResult.paymentMethodId,
          customerId: intent.customerId,
        });
      }

      savePersistedConfirmation({
        orderId: result.orderId,
        bookingId: result.bookingId,
        cloudbedsReservationId: result.cloudbedsReservationId ?? undefined,
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        email: guestDetails.email,
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

  const roomName = draft.result.roomType.name;
  const rateName = draft.result.ratePlan.name;
  const checkIn = draft.checkIn;
  const checkOut = draft.checkOut;
  const adults = draft.adults;
  const nights = totals.nights;

  const isValid =
    guestDetails.firstName &&
    guestDetails.lastName &&
    guestDetails.email &&
    guestDetails.country &&
    intentReady;

  const buttonLabel = isRefundable
    ? `Save Card & Confirm`
    : `Pay ${symbol}${totals.total.toFixed(2)} & Confirm`;

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar variant="booking" />
      <BookingProgress currentStep={3} />
      <main className="min-h-screen" style={{ backgroundColor: "#F2F2F2" }}>
        <div style={{ backgroundColor: "var(--color-primary)" }}>
          <div
            className="mx-auto py-10 md:py-12"
            style={{
              maxWidth: "var(--layout-max-width)",
              paddingLeft: "var(--container-padding)",
              paddingRight: "var(--container-padding)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl md:text-3xl text-white font-semibold"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Your Details &amp; Payment
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {roomName} · {rateName} · {nights} night
                  {nights !== 1 ? "s" : ""}
                </p>
              </div>
              <a
                href={`/${property.slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`}
                className="text-sm px-4 py-2 rounded transition-colors text-white flex items-center gap-2 self-start"
                style={{ border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to rooms
              </a>
            </div>
          </div>
        </div>

        <div
          className="mx-auto pt-8 pb-24"
          style={{
            maxWidth: "var(--layout-max-width)",
            paddingLeft: "var(--container-padding)",
            paddingRight: "var(--container-padding)",
          }}
        >
          {error && (
            <div
              className="p-4 mb-6 text-sm rounded"
              style={{ backgroundColor: "#dc2626", color: "#fff" }}
            >
              {error}
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-6">
              {/* ── Guest Details ── */}
              <div
                className="rounded-md overflow-hidden"
                style={{ border: "1px solid #E5E0D8" }}
              >
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <User className="w-4 h-4 text-white/70" />
                  <h3 className="text-sm font-semibold text-white">
                    Guest Details
                  </h3>
                </div>
                <div className="bg-white p-6">
                  <GuestDetailsForm
                    details={guestDetails}
                    onChange={setGuestDetails}
                    onSubmit={() => {}}
                    hideSubmit
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGuestDetails({
                        firstName: "John",
                        lastName: "Smith",
                        email: "john@test.com",
                        phone: "+44 7700 900000",
                        country: "GB",
                        specialRequests: "",
                      })
                    }
                    className="mt-3 text-[11px] underline"
                    style={{
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                    }}
                  >
                    Fill test data
                  </button>
                </div>
              </div>

              {/* ── Payment ── */}
              <div
                className="rounded-md overflow-hidden"
                style={{ border: "1px solid #E5E0D8" }}
              >
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-white/70" />
                    <h3 className="text-sm font-semibold text-white">
                      Payment
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    {["Visa", "Mastercard", "Amex"].map((brand) => (
                      <span
                        key={brand}
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.15)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6">
                  <p
                    className="text-xs mb-5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {isRefundable ? (
                      <>
                        Your card will be saved now. You won&apos;t be charged
                        until close to your check-in date (per the cancellation
                        policy). Total at charge:{" "}
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                          {symbol}
                          {totals.total.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        Your card will be charged{" "}
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                          {symbol}
                          {totals.total.toFixed(2)}
                        </span>{" "}
                        upon confirmation.
                      </>
                    )}
                  </p>

                  {!emailReady && (
                    <div
                      className="text-sm p-4 rounded text-center"
                      style={{
                        backgroundColor: "#fafafa",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Enter your email above to load the secure payment form.
                    </div>
                  )}

                  {emailReady && intentLoading && (
                    <div
                      className="text-sm p-4 rounded text-center"
                      style={{
                        backgroundColor: "#fafafa",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Loading secure payment form…
                    </div>
                  )}

                  {emailReady && intentError && (
                    <div
                      className="text-sm p-4 rounded"
                      style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
                    >
                      {intentError}
                    </div>
                  )}

                  {emailReady && intent && rail === "ryft" && (
                    <RyftPaymentSection
                      ref={ryftFormRef}
                      clientSecret={intent.clientSecret}
                      publicKey={intent.publicKey ?? ""}
                      accountId={intent.accountId}
                    />
                  )}

                  {emailReady && intent && rail === "stripe" && (
                    <StripePaymentSection
                      ref={stripeFormRef}
                      kind={intent.kind}
                      clientSecret={intent.clientSecret}
                    />
                  )}

                  <div
                    className="flex items-center gap-2 mt-4 pt-4"
                    style={{ borderTop: "1px solid #f0f0f0" }}
                  >
                    <Lock
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Secured by {rail === "ryft" ? "Ryft" : "Stripe"} · 256-bit SSL encryption
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !isValid}
                className="w-full py-4 text-sm uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 rounded"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  backgroundColor: "var(--color-primary)",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: submitting || !isValid ? "not-allowed" : "pointer",
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting ? "Processing..." : buttonLabel}
              </button>
              <p
                className="text-center text-[11px] -mt-3"
                style={{ color: "var(--color-text-muted)" }}
              >
                By confirming, you agree to the{" "}
                <a href="#" className="underline">
                  booking terms
                </a>{" "}
                and{" "}
                <a href="#" className="underline">
                  cancellation policy
                </a>
                .
              </p>
            </div>

            <div className="md:sticky md:top-8 self-start">
              <div
                className="rounded-md overflow-hidden"
                style={{ border: "1px solid #E5E0D8" }}
              >
                <div
                  className="px-6 py-4"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <h3 className="text-sm font-semibold text-white">
                    Booking Summary
                  </h3>
                </div>
                <div className="bg-white">
                  <BookingSummary
                    hotelName={property.name}
                    roomName={roomName}
                    ratePlanName={rateName}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    nights={nights}
                    adults={adults}
                    childCount={0}
                    nightlyRates={draft.result.nightlyRates}
                    totalPrice={totals.total}
                    currency={currency}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
