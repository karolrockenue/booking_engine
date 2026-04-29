"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import {
  AvailabilityResults,
  type AvailabilityResult,
} from "@/components/booking/AvailabilityResults";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { ExtrasPanel, type Extra } from "@/components/booking/ExtrasPanel";
import { StickyBookingBar } from "@/components/booking/StickyBookingBar";
import { PriceCompare } from "@/components/booking/PriceCompare";
import type { ResolvedProperty } from "@/lib/get-property";

export function RoomsClient({ property }: { property: ResolvedProperty }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const adults = parseInt(searchParams.get("adults") ?? "2");
  const children = parseInt(searchParams.get("children") ?? "0");
  const roomsCount = parseInt(searchParams.get("rooms") ?? "1");
  const currency = property.currency ?? "GBP";

  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [extras, setExtras] = useState<Extra[]>([]);

  // Selection state
  const [selectedResult, setSelectedResult] =
    useState<AvailabilityResult | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!checkIn || !checkOut) {
      router.replace("/");
      return;
    }
    // The cascading-render warning here is acceptable: one extra render per
    // param change is the price of showing a loading state during refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({
      propertyId: property.id,
      checkIn,
      checkOut,
      adults: adults.toString(),
    });
    fetch(`/api/availability?${params}`)
      .then((r) => r.json())
      .then((data) => setResults(data.results ?? []))
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, adults, property.id, router]);

  useEffect(() => {
    fetch(`/api/extras?propertyId=${property.id}`)
      .then((r) => r.json())
      .then((data) => setExtras(data.extras ?? []))
      .catch(() => setExtras([]));
  }, [property.id]);

  const nights =
    checkIn && checkOut
      ? (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
      : 0;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function handleSelect(result: AvailabilityResult) {
    setSelectedResult(result);
    setSelectedExtras(new Set());
  }

  function handleClear() {
    setSelectedResult(null);
    setSelectedExtras(new Set());
  }

  function handleToggleExtra(extraId: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(extraId)) {
        next.delete(extraId);
      } else {
        next.add(extraId);
      }
      return next;
    });
  }

  function calcExtrasTotal() {
    let total = 0;
    for (const id of selectedExtras) {
      const extra = extras.find((e) => e.id === id);
      if (extra) {
        total += extra.priceMinorUnits / 100;
      }
    }
    return total;
  }

  function handleContinue() {
    if (!selectedResult) return;
    const extrasTotal = calcExtrasTotal();
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: adults.toString(),
      roomTypeId: selectedResult.roomType.id,
      ratePlanId: selectedResult.ratePlan.id,
      roomName: selectedResult.roomType.name,
      rateName: selectedResult.ratePlan.name,
      totalPrice: (selectedResult.totalPrice + extrasTotal).toString(),
      nights: selectedResult.nights.toString(),
      nightlyRates: JSON.stringify(selectedResult.nightlyRates),
    });
    if (selectedExtras.size > 0) {
      params.set("extras", JSON.stringify(Array.from(selectedExtras)));
      params.set("extrasTotal", extrasTotal.toString());
    }
    router.push(`/checkout?${params}`);
  }

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar variant="booking" />
      <BookingProgress currentStep={1} />
      <main
        className="min-h-screen"
        style={{
          backgroundColor: "#F2F2F2",
          paddingBottom: selectedResult ? "100px" : undefined,
        }}
      >
        {/* Page header with accent band */}
        <div
          style={{
            backgroundColor: "var(--color-primary)",
          }}
        >
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
                  className="text-2xl md:text-3xl mb-2"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                    letterSpacing: "var(--font-heading-letter-spacing)",
                    color: "#FFFFFF",
                  }}
                >
                  Select Your Room
                </h1>
                <p
                  className="text-sm"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {formatDate(checkIn)} &rarr; {formatDate(checkOut)} &middot;{" "}
                  {nights} night{nights !== 1 ? "s" : ""} &middot;{" "}
                  {adults} adult{adults !== 1 ? "s" : ""}
                  {children > 0 && <>, {children} child{children !== 1 ? "ren" : ""}</>}
                  {" "}&middot; {roomsCount} room{roomsCount !== 1 ? "s" : ""}
                  <span className="ml-3 hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    Best rate guaranteed
                  </span>
                </p>
              </div>
              <Link
                href="/"
                className="text-sm px-4 py-2 rounded transition-colors self-start"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "")
                }
              >
                Change dates
              </Link>
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

          {loading ? (
            <div className="text-center py-16">
              <p
                className="text-base"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text-muted)",
                }}
              >
                Checking availability...
              </p>
            </div>
          ) : (
            <>
            <PriceCompare
              directRate={
                results.length > 0
                  ? Math.min(...results.map((r) => r.totalPrice / r.nights))
                  : 0
              }
              currency={currency}
              nights={nights}
            />
            <AvailabilityResults
              results={results}
              currency={currency}
              onSelect={handleSelect}
              selectedRatePlanId={selectedResult?.ratePlan.id}
              onClearSelection={handleClear}
              selectedSlot={
                <ExtrasPanel
                  extras={extras}
                  selectedExtras={selectedExtras}
                  onToggle={handleToggleExtra}
                  currency={currency}
                />
              }
            />
            </>
          )}
        </div>
      </main>

      {selectedResult && (
        <StickyBookingBar
          roomName={selectedResult.roomType.name}
          rateName={selectedResult.ratePlan.name}
          roomPrice={selectedResult.totalPrice}
          extras={extras}
          selectedExtras={selectedExtras}
          nights={nights}
          currency={currency}
          onContinue={handleContinue}
          onClear={handleClear}
          onRemoveExtra={handleToggleExtra}
        />
      )}
      <Footer />
    </ThemeProvider>
  );
}
