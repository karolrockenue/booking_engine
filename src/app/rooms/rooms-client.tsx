"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import {
  AvailabilityResults,
  type AvailabilityResult,
} from "@/components/booking/AvailabilityResults";
import type { ResolvedProperty } from "@/lib/get-property";

export function RoomsClient({ property }: { property: ResolvedProperty }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const adults = parseInt(searchParams.get("adults") ?? "2");

  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checkIn || !checkOut) {
      router.replace("/");
      return;
    }
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
  }, [checkIn, checkOut, adults, property.id]);

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
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: adults.toString(),
      roomTypeId: result.roomType.id,
      ratePlanId: result.ratePlan.id,
      roomName: result.roomType.name,
      rateName: result.ratePlan.name,
      totalPrice: result.totalPrice.toString(),
      nights: result.nights.toString(),
      nightlyRates: JSON.stringify(result.nightlyRates),
    });
    router.push(`/checkout?${params}`);
  }

  return (
    <ThemeProvider theme={property.theme}>
      <NavBar />
      <main
        className="min-h-screen"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div
          className="mx-auto pt-32 pb-24"
          style={{
            maxWidth: "var(--layout-max-width)",
            paddingLeft: "var(--container-padding)",
            paddingRight: "var(--container-padding)",
          }}
        >
          <div
            className="flex items-center justify-between mb-10 pb-4"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div>
              <h1
                className="text-2xl md:text-3xl mb-1"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                  letterSpacing: "var(--font-heading-letter-spacing)",
                  color: "var(--color-text)",
                }}
              >
                Select Your Room
              </h1>
              <p
                className="text-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text-muted)",
                }}
              >
                {formatDate(checkIn)} &rarr; {formatDate(checkOut)} &middot;{" "}
                {nights} night{nights !== 1 ? "s" : ""} &middot; {adults} guest
                {adults !== 1 ? "s" : ""}
              </p>
            </div>
            <a
              href="/"
              className="text-sm underline"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
              }}
            >
              Change dates
            </a>
          </div>

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
            <AvailabilityResults
              results={results}
              currency={property.currency ?? "GBP"}
              onSelect={handleSelect}
            />
          )}
        </div>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
