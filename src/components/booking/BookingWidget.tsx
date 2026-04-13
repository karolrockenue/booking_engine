"use client";

import { useState } from "react";

interface BookingWidgetProps {
  variant?: "compact" | "full";
}

export function BookingWidget({ variant = "compact" }: BookingWidgetProps) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const today = new Date().toISOString().split("T")[0];

  function handleSearch() {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("adults", adults.toString());
    window.location.href = `/book?${params}`;
  }

  return (
    <section
      className="py-6"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        <div
          className="flex flex-col md:flex-row items-end gap-4 p-6"
          style={{
            backgroundColor: "var(--color-background)",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex-1 w-full">
            <label
              className="block text-xs uppercase tracking-wider mb-1 font-medium"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Check-in
            </label>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
              }}
            />
          </div>
          <div className="flex-1 w-full">
            <label
              className="block text-xs uppercase tracking-wider mb-1 font-medium"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Check-out
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn || today}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
              }}
            />
          </div>
          <div className="w-full md:w-24">
            <label
              className="block text-xs uppercase tracking-wider mb-1 font-medium"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
            >
              Guests
            </label>
            <select
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="w-full md:w-auto px-8 py-2 text-sm uppercase tracking-wider"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "600",
              borderRadius: "var(--radius-button)",
              backgroundColor: "var(--color-secondary)",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Check Availability
          </button>
        </div>
      </div>
    </section>
  );
}
