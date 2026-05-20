"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { CheckCircle2, Mail, Copy, CreditCard, Lock } from "lucide-react";
import type { ResolvedProperty } from "@/lib/get-property";
import {
  loadPersistedConfirmation,
  type PersistedConfirmation,
} from "@/lib/booking";

export function ConfirmationClient({
  property,
}: {
  property: ResolvedProperty;
}) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const currency = property.currency ?? "GBP";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  const [details, setDetails] = useState<PersistedConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPersistedConfirmation();
    // Only show details if they correspond to the orderId in the URL — guards
    // against stale sessionStorage from a previous booking. Hydration is a
    // one-shot synchronous read on mount; the cascading-render warning is the
    // accepted cost of doing it inside an effect (it has to be — sessionStorage
    // is browser-only).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (loaded && loaded.orderId === orderId) {
      setDetails(loaded);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [orderId]);

  // If we have no orderId at all, the user got here by accident.
  if (!orderId) {
    return (
      <ThemeProvider theme={property.theme}>
        <NavBar variant="booking" />
        <BookingProgress currentStep={4} />
        <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F2F2F2" }}>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No booking reference found.
          </p>
        </main>
        <Footer />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar variant="booking" />
      <BookingProgress currentStep={4} />
      <main className="min-h-screen" style={{ backgroundColor: "#F2F2F2" }}>
        {/* Page header */}
        <div style={{ backgroundColor: "var(--color-primary)" }}>
          <div
            className="mx-auto py-10 md:py-12"
            style={{ maxWidth: "var(--layout-max-width)", paddingLeft: "var(--container-padding)", paddingRight: "var(--container-padding)" }}
          >
            <h1 className="text-2xl md:text-3xl text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Booking Confirmed
            </h1>
          </div>
        </div>

        <div
          className="mx-auto pt-8 pb-24"
          style={{ maxWidth: "700px", paddingLeft: "var(--container-padding)", paddingRight: "var(--container-padding)" }}
        >
          {/* ── Success Card ── */}
          <div className="rounded-md overflow-hidden mb-6" style={{ border: "1px solid #E5E0D8" }}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: "#059669" }}>
              <CheckCircle2 className="w-5 h-5 text-white" />
              <h3 className="text-sm font-semibold text-white">Booking Successful</h3>
            </div>
            <div className="bg-white p-6 text-center">
              <p className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Thank you{details?.firstName ? `, ${details.firstName}` : ""}!
              </p>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                Your reservation has been confirmed. We look forward to welcoming you.
              </p>

              {/* References — hotel-facing reservation ID first (what guests
                  quote on arrival), our internal order ID second. */}
              <div className="flex flex-wrap items-stretch justify-center gap-3 mb-6">
                {details?.cloudbedsReservationId && (
                  <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg" style={{ backgroundColor: "#f5f5f5" }}>
                    <div className="text-left">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Reservation Number</p>
                      <p className="text-lg font-bold font-mono" style={{ color: "var(--color-text)" }}>{details.cloudbedsReservationId}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(details.cloudbedsReservationId ?? "")}
                      className="p-2 rounded hover:bg-gray-200 transition-colors"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                      title="Copy reservation number"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg" style={{ backgroundColor: "#f5f5f5" }}>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Order ID</p>
                    <p className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{orderId}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(orderId)}
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                    title="Copy order ID"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {details?.email && (
                <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <Mail className="w-4 h-4" />
                  <p>Confirmation sent to <strong style={{ color: "var(--color-text)" }}>{details.email}</strong></p>
                </div>
              )}
            </div>
          </div>

          {/* Details only render if we have them in sessionStorage; otherwise
              we show a compact "thanks, see your email" view since the URL
              alone doesn't carry stay details (by design — privacy + URL
              hygiene). */}
          {hydrated && details && (
            <>
              {/* Payment status — distinct pill for Flex (card on file) vs NR
                  (paid). Drives expectations for what the guest sees on their
                  statement and when. */}
              <div className="rounded-md overflow-hidden mb-6" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: "var(--color-primary)" }}>
                  <CreditCard className="w-4 h-4 text-white/70" />
                  <h3 className="text-sm font-semibold text-white">Payment</h3>
                </div>
                <div className="bg-white p-6">
                  {details.rateType === "nr" ? (
                    <div className="flex items-start gap-3">
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded font-semibold"
                        style={{ backgroundColor: "#059669", color: "#fff" }}
                      >
                        Paid in Full
                      </span>
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        <strong style={{ color: "var(--color-text)" }}>{symbol}{details.totalPrice.toFixed(2)}</strong>{" "}
                        was charged to your card. Non-refundable rate.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded font-semibold flex items-center gap-1"
                        style={{ backgroundColor: "#0369a1", color: "#fff" }}
                      >
                        <Lock className="w-3 h-3" />
                        Card on File
                      </span>
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Your card is securely saved. We&apos;ll charge{" "}
                        <strong style={{ color: "var(--color-text)" }}>{symbol}{details.totalPrice.toFixed(2)}</strong>{" "}
                        closer to your check-in date, per the cancellation policy.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md overflow-hidden mb-6" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4" style={{ backgroundColor: "var(--color-primary)" }}>
                  <h3 className="text-sm font-semibold text-white">Stay Details</h3>
                </div>
                <div className="bg-white p-6">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Hotel</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>{property.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Room</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>{details.roomName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Check-in</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                        {new Date(details.checkIn).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Check-out</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                        {new Date(details.checkOut).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Duration</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>{details.nights} night{details.nights !== 1 ? "s" : ""}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Rate</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>{details.rateName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Guests</p>
                      <p className="font-semibold" style={{ color: "var(--color-text)" }}>{details.adults} adult{details.adults !== 1 ? "s" : ""}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>{details.rateType === "nr" ? "Total Paid" : "Total Due"}</p>
                      <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{symbol}{details.totalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md overflow-hidden mb-8" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4" style={{ backgroundColor: "var(--color-primary)" }}>
                  <h3 className="text-sm font-semibold text-white">Price Breakdown</h3>
                </div>
                <div className="bg-white">
                  {details.nightlyRates.map((nr) => (
                    <div
                      key={nr.date}
                      className="px-6 py-3 flex items-center justify-between text-sm"
                      style={{ borderBottom: "1px solid #f0f0f0" }}
                    >
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {new Date(nr.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                        {symbol}{nr.rate.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {details.extras.length > 0 && (
                    <>
                      <div
                        className="px-6 py-2 text-[10px] uppercase tracking-wider"
                        style={{ color: "var(--color-text-muted)", backgroundColor: "#fafafa", borderBottom: "1px solid #f0f0f0" }}
                      >
                        Extras
                      </div>
                      {details.extras.map((extra, i) => (
                        <div
                          key={`${extra.name}-${i}`}
                          className="px-6 py-3 flex items-center justify-between text-sm"
                          style={{ borderBottom: "1px solid #f0f0f0" }}
                        >
                          <span style={{ color: "var(--color-text-muted)" }}>{extra.name}</span>
                          <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                            {symbol}{(extra.priceMinorUnits / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid #E5E0D8", backgroundColor: "#fafafa" }}>
                    <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>Total</span>
                    <span className="text-lg font-bold" style={{ color: "var(--color-text)" }}>{symbol}{details.totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Return ── */}
          <div className="text-center">
            <Link
              href={`/${property.slug}`}
              className="inline-block px-8 py-3 text-sm uppercase tracking-wider rounded transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
              }}
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
