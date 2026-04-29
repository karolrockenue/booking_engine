"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { CheckCircle2, Mail, Copy } from "lucide-react";
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

              {/* Reference */}
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg mb-6" style={{ backgroundColor: "#f5f5f5" }}>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Booking Reference</p>
                  <p className="text-lg font-bold font-mono" style={{ color: "var(--color-text)" }}>{orderId}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(orderId)}
                  className="p-2 rounded hover:bg-gray-200 transition-colors"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                  title="Copy reference"
                >
                  <Copy className="w-4 h-4" />
                </button>
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
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>Total Paid</p>
                      <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{symbol}{details.totalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md overflow-hidden mb-8" style={{ border: "1px solid #E5E0D8" }}>
                <div className="px-6 py-4" style={{ backgroundColor: "var(--color-primary)" }}>
                  <h3 className="text-sm font-semibold text-white">Nightly Breakdown</h3>
                </div>
                <div className="bg-white">
                  {details.nightlyRates.map((nr, i) => (
                    <div
                      key={nr.date}
                      className="px-6 py-3 flex items-center justify-between text-sm"
                      style={{ borderBottom: i < details.nightlyRates.length - 1 ? "1px solid #f0f0f0" : "none" }}
                    >
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {new Date(nr.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                        {symbol}{nr.rate.toFixed(2)}
                      </span>
                    </div>
                  ))}
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
              href="/"
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
