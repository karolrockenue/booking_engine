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
import type { ResolvedProperty } from "@/lib/get-property";

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
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!checkIn || !roomTypeId) {
    if (typeof window !== "undefined") router.replace("/");
    return null;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          roomTypeId,
          ratePlanId,
          checkIn,
          checkOut,
          adults,
          children: 0,
          guestFirst: guestDetails.firstName,
          guestLast: guestDetails.lastName,
          guestEmail: guestDetails.email,
          guestPhone: guestDetails.phone || undefined,
          guestCountry: guestDetails.country || undefined,
          nightlyRates,
          totalPrice,
          currency: property.currency ?? "GBP",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const params = new URLSearchParams({
        orderId: data.orderId,
        firstName: guestDetails.firstName,
        email: guestDetails.email,
        roomName,
        rateName,
        checkIn,
        checkOut,
        nights: nights.toString(),
        adults: adults.toString(),
        totalPrice: totalPrice.toString(),
        nightlyRates: JSON.stringify(nightlyRates),
      });
      router.push(`/confirmation?${params}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
          <h1
            className="text-2xl md:text-3xl mb-8"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
              letterSpacing: "var(--font-heading-letter-spacing)",
              color: "var(--color-text)",
            }}
          >
            Your Details
          </h1>

          <div className="grid gap-8 md:grid-cols-[1fr_380px]">
            <div>
              <a
                href={`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`}
                className="inline-block mb-6 text-sm underline"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                &larr; Back to rooms
              </a>

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
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            </div>

            <div className="md:sticky md:top-8 self-start">
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
                currency={property.currency ?? "GBP"}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
