"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import {
  GuestDetailsForm,
  type GuestDetails,
} from "@/components/booking/GuestDetailsForm";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { CreditCard, Lock, ShieldCheck, User, ArrowLeft } from "lucide-react";
import type { ResolvedProperty } from "@/lib/get-property";

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  backgroundColor: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: "4px",
  color: "var(--color-text)",
};

export function CheckoutClient({ property }: { property: ResolvedProperty }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const adults = parseInt(searchParams.get("adults") ?? "2");
  const roomTypeId = searchParams.get("roomTypeId") ?? "";
  const ratePlanId = searchParams.get("ratePlanId") ?? "";
  const roomName = searchParams.get("roomName") ?? "";
  const rateName = searchParams.get("rateName") ?? "";
  const totalPrice = parseFloat(searchParams.get("totalPrice") ?? "0");
  const nights = parseInt(searchParams.get("nights") ?? "0");
  const nightlyRates = JSON.parse(searchParams.get("nightlyRates") ?? "[]");

  const [guestDetails, setGuestDetails] = useState<GuestDetails>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    specialRequests: "",
  });

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!checkIn || !roomTypeId) {
    if (typeof window !== "undefined") router.replace("/");
    return null;
  }

  const currency = property.currency ?? "GBP";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  function formatCardNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + " / " + digits.slice(2);
    return digits;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id, roomTypeId, ratePlanId, checkIn, checkOut,
          adults, children: 0,
          guestFirst: guestDetails.firstName, guestLast: guestDetails.lastName,
          guestEmail: guestDetails.email,
          guestPhone: guestDetails.phone || undefined,
          guestCountry: guestDetails.country || undefined,
          nightlyRates, totalPrice, currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      const params = new URLSearchParams({
        orderId: data.orderId, firstName: guestDetails.firstName, email: guestDetails.email,
        roomName, rateName, checkIn, checkOut,
        nights: nights.toString(), adults: adults.toString(),
        totalPrice: totalPrice.toString(), nightlyRates: JSON.stringify(nightlyRates),
      });
      router.push(`/confirmation?${params}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = guestDetails.firstName && guestDetails.lastName && guestDetails.email && guestDetails.country;

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar variant="booking" />
      <BookingProgress currentStep={3} />
      <main className="min-h-screen" style={{ backgroundColor: "#F2F2F2" }}>
        {/* Page header */}
        <div style={{ backgroundColor: "var(--color-primary)" }}>
          <div className="mx-auto py-10 md:py-12" style={{ maxWidth: "var(--layout-max-width)", paddingLeft: "var(--container-padding)", paddingRight: "var(--container-padding)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  Your Details &amp; Payment
                </h1>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {roomName} · {rateName} · {nights} night{nights !== 1 ? "s" : ""}
                </p>
              </div>
              <a
                href={`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`}
                className="text-sm px-4 py-2 rounded transition-colors text-white flex items-center gap-2 self-start"
                style={{ border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to rooms
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto pt-8 pb-24" style={{ maxWidth: "var(--layout-max-width)", paddingLeft: "var(--container-padding)", paddingRight: "var(--container-padding)" }}>
          {error && (
            <div className="p-4 mb-6 text-sm rounded" style={{ backgroundColor: "#dc2626", color: "#fff" }}>
              {error}
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-6">

              {/* ── Guest Details Card ── */}
              <div className="rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: "var(--color-primary)" }}>
                  <User className="w-4 h-4 text-white/70" />
                  <h3 className="text-sm font-semibold text-white">Guest Details</h3>
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
                    onClick={() => setGuestDetails({ firstName: "John", lastName: "Smith", email: "john@test.com", phone: "+44 7700 900000", country: "GB", specialRequests: "" })}
                    className="mt-3 text-[11px] underline"
                    style={{ color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Fill test data
                  </button>
                </div>
              </div>

              {/* ── Payment Card ── */}
              <div className="rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "var(--color-primary)" }}>
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-white/70" />
                    <h3 className="text-sm font-semibold text-white">Payment</h3>
                  </div>
                  <div className="flex gap-2">
                    {["Visa", "Mastercard", "Amex"].map((brand) => (
                      <span key={brand} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6">
                  <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
                    Your card will be charged <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{symbol}{totalPrice.toFixed(2)}</span> upon confirmation.
                  </p>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Card Number</label>
                      <input type="text" inputMode="numeric" placeholder="1234 5678 9012 3456" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} className="w-full px-4 py-3 text-sm" style={inputStyle} maxLength={19} />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Name on Card</label>
                      <input type="text" placeholder="J. Smith" value={cardName} onChange={(e) => setCardName(e.target.value)} className="w-full px-4 py-3 text-sm" style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Expiry</label>
                        <input type="text" inputMode="numeric" placeholder="MM / YY" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} className="w-full px-4 py-3 text-sm" style={inputStyle} maxLength={7} />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: "var(--color-text-muted)" }}>CVC</label>
                        <input type="text" inputMode="numeric" placeholder="123" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full px-4 py-3 text-sm" style={inputStyle} maxLength={4} />
                      </div>
                    </div>
                  </div>

                  <button type="button"
                    onClick={() => { setCardNumber("4242 4242 4242 4242"); setCardExpiry("12 / 28"); setCardCvc("123"); setCardName(guestDetails.firstName && guestDetails.lastName ? `${guestDetails.firstName} ${guestDetails.lastName}` : "Test User"); }}
                    className="mt-4 text-[11px] underline"
                    style={{ color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Use test card (4242...)
                  </button>

                  <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #f0f0f0" }}>
                    <Lock className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Secured with 256-bit SSL encryption</p>
                  </div>
                </div>
              </div>

              {/* ── Confirm Button ── */}
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
                {submitting ? "Processing..." : `Pay ${symbol}${totalPrice.toFixed(2)} & Confirm`}
              </button>
              <p className="text-center text-[11px] -mt-3" style={{ color: "var(--color-text-muted)" }}>
                By confirming, you agree to the <a href="#" className="underline">booking terms</a> and <a href="#" className="underline">cancellation policy</a>.
              </p>
            </div>

            {/* ── Sidebar ── */}
            <div className="md:sticky md:top-8 self-start">
              <div className="rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4" style={{ backgroundColor: "var(--color-primary)" }}>
                  <h3 className="text-sm font-semibold text-white">Booking Summary</h3>
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
                    children={0}
                    nightlyRates={nightlyRates}
                    totalPrice={totalPrice}
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
