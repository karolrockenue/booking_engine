"use client";

import { useRef } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { BookingBar } from "@/components/booking/BookingBar";

interface HeroSectionProps {
  onSearch?: (
    checkIn: string,
    checkOut: string,
    adults: number,
    children: number,
    rooms: number
  ) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const theme = useTheme();
  const headline = theme.hero?.headline ?? theme.name;
  const subheadline = theme.hero?.subheadline ?? "";
  const imageUrl = theme.hero?.imageUrl ?? "/hotel/hero.jpg";
  const address = theme.contact?.address ?? "";
  const datePickerRef = useRef<HTMLButtonElement>(null);

  return (
    <section
      className="relative min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--color-primary)",
      }}
    >
      {/* Background Image */}
      {imageUrl && (
        <div className="absolute inset-0">
          <img
            src={imageUrl}
            alt={theme.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />

      {/* Spacer for nav */}
      <div className="h-[72px] shrink-0" />

      {/* Content — shifted up from center */}
      <div className="relative flex-1 flex flex-col justify-center px-4 pb-[100px]">
        {/* Hotel name + tagline */}
        <div className="text-center space-y-3 mb-10 md:mb-14">
          <h1
            className="text-white text-5xl lg:text-7xl tracking-tight drop-shadow-2xl"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
              letterSpacing: "var(--font-heading-letter-spacing)",
            }}
          >
            {headline}
          </h1>
          <div className="h-px w-24 bg-white/80 mx-auto" />

          {address && (
            <p
              className="text-white/40 text-[10px] uppercase tracking-[0.3em] pt-1"
              style={{ fontFamily: "var(--font-body)", fontWeight: 300 }}
            >
              {address}
            </p>
          )}

          {subheadline && (
            <p className="text-white text-sm uppercase tracking-widest drop-shadow-lg pt-1">
              {subheadline}
            </p>
          )}

          {/* Trust badges */}
          <div className="pt-5 flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              <span
                className="text-white/90 text-xs tracking-wide"
                style={{ fontFamily: "var(--font-body)", fontWeight: 300 }}
              >
                Official Website — Lowest Price Guaranteed
              </span>
            </div>
          </div>
        </div>

        {/* Booking Bar */}
        <div className="w-full max-w-7xl mx-auto">
          <BookingBar onSearch={onSearch} datePickerRef={datePickerRef} />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="w-5 h-8 rounded-full border-2 border-white/40 flex items-start justify-center pt-1">
          <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
