"use client";

import { useSearchParams } from "next/navigation";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { BookingSummary } from "@/components/booking/BookingSummary";
import type { ResolvedProperty } from "@/lib/get-property";

export function ConfirmationClient({
  property,
}: {
  property: ResolvedProperty;
}) {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId") ?? "";
  const firstName = searchParams.get("firstName") ?? "";
  const email = searchParams.get("email") ?? "";
  const roomName = searchParams.get("roomName") ?? "";
  const rateName = searchParams.get("rateName") ?? "";
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const nights = parseInt(searchParams.get("nights") ?? "0");
  const adults = parseInt(searchParams.get("adults") ?? "2");
  const totalPrice = parseFloat(searchParams.get("totalPrice") ?? "0");
  const nightlyRates = JSON.parse(searchParams.get("nightlyRates") ?? "[]");

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
            maxWidth: "600px",
            paddingLeft: "var(--container-padding)",
            paddingRight: "var(--container-padding)",
          }}
        >
          <div className="text-center mb-10">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
              style={{
                backgroundColor: "var(--color-success)",
                color: "#FFFFFF",
              }}
            >
              &#10003;
            </div>
            <h1
              className="text-2xl md:text-3xl mb-3"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                letterSpacing: "var(--font-heading-letter-spacing)",
                color: "var(--color-text)",
              }}
            >
              Booking Confirmed
            </h1>
            <p
              className="text-base mb-1"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text)",
              }}
            >
              Thank you, {firstName}!
            </p>
            <p
              className="text-sm"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
              }}
            >
              Your booking reference is{" "}
              <strong style={{ color: "var(--color-text)" }}>{orderId}</strong>.
              {email && (
                <>
                  {" "}
                  A confirmation will be sent to{" "}
                  <strong style={{ color: "var(--color-text)" }}>{email}</strong>
                  .
                </>
              )}
            </p>
          </div>

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

          <div className="text-center mt-8">
            <a
              href="/"
              className="text-sm underline"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
              }}
            >
              Return to homepage
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </ThemeProvider>
  );
}
