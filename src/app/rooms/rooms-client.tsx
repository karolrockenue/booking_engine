"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { AvailabilityResults } from "@/components/booking/AvailabilityResults";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { ExtrasPanel } from "@/components/booking/ExtrasPanel";
import { StickyBookingBar } from "@/components/booking/StickyBookingBar";
import { PriceCompare } from "@/components/booking/PriceCompare";
import {
  useAvailability,
  useBookingDraft,
  useExtras,
  usePersistedDraft,
} from "@/lib/booking";
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

  useEffect(() => {
    if (!checkIn || !checkOut) router.replace("/");
  }, [checkIn, checkOut, router]);

  const { results, loading } = useAvailability({
    propertyId: property.id,
    checkIn,
    checkOut,
    adults,
  });
  const { extras } = useExtras(property.id);
  const {
    draft,
    selectRoom,
    clearRoom,
    toggleExtra,
  } = useBookingDraft(extras);

  // Persist the draft to sessionStorage so /checkout can pick it up without
  // packing everything into URL params.
  usePersistedDraft(
    {
      propertyId: property.id,
      checkIn,
      checkOut,
      adults,
      children,
    },
    draft
  );

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

  function handleContinue() {
    if (!draft.result) return;
    router.push("/checkout");
  }

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar variant="booking" />
      <BookingProgress currentStep={1} />
      <main
        className="min-h-screen"
        style={{
          backgroundColor: "#F2F2F2",
          paddingBottom: draft.result ? "100px" : undefined,
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
              onSelect={selectRoom}
              selectedRatePlanId={draft.result?.ratePlan.id}
              onClearSelection={clearRoom}
              selectedSlot={
                <ExtrasPanel
                  extras={extras}
                  selectedExtras={draft.extras}
                  onToggle={toggleExtra}
                  currency={currency}
                />
              }
            />
            </>
          )}
        </div>
      </main>

      {draft.result && (
        <StickyBookingBar
          roomName={draft.result.roomType.name}
          rateName={draft.result.ratePlan.name}
          roomPrice={draft.result.totalPrice}
          extras={extras}
          selectedExtras={draft.extras}
          nights={nights}
          currency={currency}
          onContinue={handleContinue}
          onClear={clearRoom}
          onRemoveExtra={toggleExtra}
        />
      )}
      <Footer />
    </ThemeProvider>
  );
}
