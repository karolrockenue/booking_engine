"use client";

import type { NightlyRate } from "./AvailabilityResults";

interface BookingSummaryProps {
  hotelName: string;
  roomName: string;
  ratePlanName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  childCount: number;
  nightlyRates: NightlyRate[];
  totalPrice: number;
  currency?: string;
}

export function BookingSummary({
  hotelName,
  roomName,
  ratePlanName,
  checkIn,
  checkOut,
  nights,
  adults,
  childCount,
  nightlyRates,
  totalPrice,
  currency = "GBP",
}: BookingSummaryProps) {
  const symbol = currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div
      className="p-6"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        fontFamily: "var(--font-body)",
      }}
    >
      <h3
        className="text-lg mb-4"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--font-heading-weight)",
          color: "var(--color-text)",
        }}
      >
        Booking Summary
      </h3>

      <p
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--color-text)" }}
      >
        {hotelName}
      </p>

      <div
        className="flex flex-col gap-3 text-sm pb-4 mb-4"
        style={{
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <div className="flex justify-between">
          <span>Room</span>
          <span style={{ color: "var(--color-text)" }}>{roomName}</span>
        </div>
        <div className="flex justify-between">
          <span>Rate</span>
          <span style={{ color: "var(--color-text)" }}>{ratePlanName}</span>
        </div>
        <div className="flex justify-between">
          <span>Check-in</span>
          <span style={{ color: "var(--color-text)" }}>{formatDate(checkIn)}</span>
        </div>
        <div className="flex justify-between">
          <span>Check-out</span>
          <span style={{ color: "var(--color-text)" }}>{formatDate(checkOut)}</span>
        </div>
        <div className="flex justify-between">
          <span>Guests</span>
          <span style={{ color: "var(--color-text)" }}>
            {adults} adult{adults !== 1 ? "s" : ""}
            {childCount > 0 ? `, ${childCount} child${childCount !== 1 ? "ren" : ""}` : ""}
          </span>
        </div>
      </div>

      {/* Nightly breakdown */}
      <div
        className="flex flex-col gap-2 text-sm pb-4 mb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {nightlyRates.map((nr) => (
          <div
            key={nr.date}
            className="flex justify-between"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>{formatDate(nr.date)}</span>
            <span>{symbol}{nr.rate.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center">
        <span
          className="text-sm uppercase tracking-wider font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Total ({nights} night{nights !== 1 ? "s" : ""})
        </span>
        <span
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          {symbol}{totalPrice.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
