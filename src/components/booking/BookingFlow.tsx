"use client";

import { useState, useEffect, useRef } from "react";
import { AvailabilityResults, type AvailabilityResult } from "./AvailabilityResults";
import { GuestDetailsForm, type GuestDetails } from "./GuestDetailsForm";
import { BookingSummary } from "./BookingSummary";

type Step = "idle" | "loading" | "results" | "details" | "confirmed";

interface BookingFlowProps {
  propertyId: string;
  propertyName: string;
  currency?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
}

export function BookingFlow({
  propertyId,
  propertyName,
  currency = "GBP",
  checkIn = "",
  checkOut = "",
  adults = 2,
}: BookingFlowProps) {
  const [step, setStep] = useState<Step>("idle");
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [selected, setSelected] = useState<AvailabilityResult | null>(null);
  const [guestDetails, setGuestDetails] = useState<GuestDetails>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    specialRequests: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // When dates are passed in, auto-search
  useEffect(() => {
    if (checkIn && checkOut) {
      search();
    }
  }, [checkIn, checkOut, adults]);

  async function search() {
    setStep("loading");
    try {
      const params = new URLSearchParams({
        propertyId,
        checkIn,
        checkOut,
        adults: adults.toString(),
      });
      const res = await fetch(`/api/availability?${params}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setStep("results");
      // Scroll to results
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      setResults([]);
      setStep("results");
    }
  }

  function handleSelect(result: AvailabilityResult) {
    setSelected(result);
    setStep("details");
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function handleGuestSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          roomTypeId: selected.roomType.id,
          ratePlanId: selected.ratePlan.id,
          checkIn,
          checkOut,
          adults,
          children: 0,
          guestFirst: guestDetails.firstName,
          guestLast: guestDetails.lastName,
          guestEmail: guestDetails.email,
          guestPhone: guestDetails.phone || undefined,
          guestCountry: guestDetails.country || undefined,
          nightlyRates: selected.nightlyRates,
          totalPrice: selected.totalPrice,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setOrderId(data.orderId);
      setStep("confirmed");
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "idle") return null;

  const nights = checkIn && checkOut
    ? (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        {/* Date summary bar */}
        {step !== "confirmed" && (
          <div
            className="flex items-center justify-between mb-8 pb-4"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <p
              className="text-sm"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              {formatDate(checkIn)} &rarr; {formatDate(checkOut)} &middot;{" "}
              {nights} night{nights !== 1 ? "s" : ""} &middot;{" "}
              {adults} guest{adults !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => {
                setStep("idle");
                setResults([]);
                setSelected(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-sm underline"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Change dates
            </button>
          </div>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="text-center py-12">
            <p
              className="text-base"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Checking availability...
            </p>
          </div>
        )}

        {/* Results */}
        {step === "results" && (
          <div>
            <h2
              className="text-2xl md:text-3xl mb-8"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                letterSpacing: "var(--font-heading-letter-spacing)",
                color: "var(--color-text)",
              }}
            >
              Select Your Room
            </h2>
            <AvailabilityResults
              results={results}
              currency={currency}
              onSelect={handleSelect}
            />
          </div>
        )}

        {/* Guest details */}
        {step === "details" && selected && (
          <div>
            <h2
              className="text-2xl md:text-3xl mb-8"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                letterSpacing: "var(--font-heading-letter-spacing)",
                color: "var(--color-text)",
              }}
            >
              Your Details
            </h2>
            <div className="grid gap-8 md:grid-cols-[1fr_380px]">
              <div>
                <button
                  onClick={() => setStep("results")}
                  className="mb-6 text-sm underline"
                  style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
                >
                  &larr; Back to rooms
                </button>
                {error && (
                  <div
                    className="p-4 mb-4 text-sm"
                    style={{
                      backgroundColor: "var(--color-error)",
                      color: "#FFFFFF",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    {error}
                  </div>
                )}
                <GuestDetailsForm
                  details={guestDetails}
                  onChange={setGuestDetails}
                  onSubmit={handleGuestSubmit}
                  submitting={submitting}
                />
              </div>
              <div className="md:sticky md:top-8 self-start">
                <BookingSummary
                  hotelName={propertyName}
                  roomName={selected.roomType.name}
                  ratePlanName={selected.ratePlan.name}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  nights={selected.nights}
                  adults={adults}
                  childCount={0}
                  nightlyRates={selected.nightlyRates}
                  totalPrice={selected.totalPrice}
                  currency={currency}
                />
              </div>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === "confirmed" && selected && (
          <div className="max-w-lg mx-auto text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
              style={{ backgroundColor: "var(--color-success)", color: "#FFFFFF" }}
            >
              &#10003;
            </div>
            <h2
              className="text-2xl md:text-3xl mb-4"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                color: "var(--color-text)",
              }}
            >
              Booking Confirmed
            </h2>
            <p
              className="text-base mb-2"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
            >
              Thank you, {guestDetails.firstName}!
            </p>
            <p
              className="text-sm mb-8"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Your booking reference is{" "}
              <strong style={{ color: "var(--color-text)" }}>{orderId}</strong>.
              A confirmation will be sent to{" "}
              <strong style={{ color: "var(--color-text)" }}>{guestDetails.email}</strong>.
            </p>
            <div className="max-w-sm mx-auto">
              <BookingSummary
                hotelName={propertyName}
                roomName={selected.roomType.name}
                ratePlanName={selected.ratePlan.name}
                checkIn={checkIn}
                checkOut={checkOut}
                nights={selected.nights}
                adults={adults}
                childCount={0}
                nightlyRates={selected.nightlyRates}
                totalPrice={selected.totalPrice}
                currency={currency}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
