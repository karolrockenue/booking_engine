"use client";

import { useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface HeroSectionProps {
  onSearch?: (checkIn: string, checkOut: string, adults: number) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const theme = useTheme();
  const headline = theme.hero?.headline ?? theme.name;
  const subheadline = theme.hero?.subheadline ?? "";
  const imageUrl = theme.hero?.imageUrl ?? null;
  const overlayOpacity = theme.hero?.overlayOpacity ?? 0.45;
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const today = new Date().toISOString().split("T")[0];

  function handleSearch() {
    if (!checkIn || !checkOut) return;
    if (onSearch) {
      onSearch(checkIn, checkOut, adults);
    }
  }

  return (
    <section
      className="relative flex flex-col items-center justify-center text-center"
      style={{
        minHeight: "100vh",
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "var(--color-primary)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />

      <div className="relative z-10 w-full px-6 max-w-2xl mx-auto">
        {/* Hotel name + tagline */}
        <h1
          className="text-4xl md:text-5xl lg:text-6xl mb-3"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
            letterSpacing: "var(--font-heading-letter-spacing)",
            color: "#FFFFFF",
          }}
        >
          {headline}
        </h1>
        {subheadline && (
          <p
            className="text-base md:text-lg mb-10 max-w-lg mx-auto"
            style={{
              fontFamily: "var(--font-body)",
              color: "rgba(255,255,255,0.8)",
              lineHeight: "var(--font-body-line-height)",
            }}
          >
            {subheadline}
          </p>
        )}

        {/* Date picker card — the main action */}
        <div
          className="rounded-lg p-6 md:p-8 text-left"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-2 font-medium"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
              >
                Check-in
              </label>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  // Auto-set checkout to next day if empty or before new checkin
                  if (!checkOut || e.target.value >= checkOut) {
                    const next = new Date(e.target.value);
                    next.setDate(next.getDate() + 1);
                    setCheckOut(next.toISOString().split("T")[0]);
                  }
                }}
                className="w-full px-3 py-3 text-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-2 font-medium"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
              >
                Check-out
              </label>
              <input
                type="date"
                value={checkOut}
                min={checkIn || today}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-3 text-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-2 font-medium"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
              >
                Guests
              </label>
              <select
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value))}
                className="w-full px-3 py-3 text-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSearch}
              disabled={!checkIn || !checkOut}
              className="w-full px-6 py-3 text-sm uppercase tracking-wider font-semibold transition-colors disabled:opacity-40"
              style={{
                fontFamily: "var(--font-body)",
                borderRadius: "var(--radius-button)",
                backgroundColor: "var(--color-primary)",
                color: "#FFFFFF",
                border: "none",
                cursor: !checkIn || !checkOut ? "not-allowed" : "pointer",
              }}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div
          className="w-5 h-8 rounded-full border-2 border-white/40 flex items-start justify-center pt-1"
        >
          <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
