"use client";

import { BookingBar } from "@/components/booking/BookingBar";
import { BookingBarLuxury } from "@/components/booking/BookingBarLuxury";
import { BookingBarCompact } from "@/components/booking/BookingBarCompact";
import { BookingBarWarm } from "@/components/booking/BookingBarWarm";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { defaultTheme } from "@/lib/theme";

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/pickers", label: "Pickers" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Rooms" },
  { href: "/admin", label: "Admin" },
];

export function PickersClient() {
  return (
    <ThemeProvider theme={defaultTheme}>
      {/* Dev nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">
            DEV
          </span>
          {devLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs text-gray-300 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="pt-10">
        {/* Variant 1 — Current (theme-aware white) */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
          <div className="absolute inset-0">
            <img
              src="/hero-room.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
          </div>
          <div className="relative w-full max-w-7xl mx-auto space-y-8">
            <div className="text-center">
              <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest bg-white/20 text-white rounded-full mb-4">
                Variant 1
              </span>
              <h2 className="text-white text-2xl mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                Classic White
              </h2>
              <p className="text-white/60 text-sm">
                White background, theme-aware accent colors, border-bottom fields
              </p>
            </div>
            <BookingBar />
          </div>
        </section>

        {/* Variant 2 — Luxury dark */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
          <div className="absolute inset-0">
            <img
              src="/hero-room.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
          </div>
          <div className="relative w-full max-w-7xl mx-auto space-y-8">
            <div className="text-center">
              <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest bg-white/20 text-white rounded-full mb-4">
                Variant 2
              </span>
              <h2 className="text-white text-2xl mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                Luxury Dark
              </h2>
              <p className="text-white/60 text-sm">
                Near-black with gold accents, glass effect, premium feel
              </p>
            </div>
            <BookingBarLuxury />
          </div>
        </section>

        {/* Variant 3 — Compact pill */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
          <div className="absolute inset-0">
            <img
              src="/hero-room.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
          </div>
          <div className="relative w-full max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest bg-white/20 text-white rounded-full mb-4">
                Variant 3
              </span>
              <h2 className="text-white text-2xl mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                Compact Pill
              </h2>
              <p className="text-white/60 text-sm">
                Airbnb-style rounded pill, no labels, minimal footprint
              </p>
            </div>
            <BookingBarCompact />
          </div>
        </section>

        {/* Variant 4 — Warm earthy */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
          <div className="absolute inset-0">
            <img
              src="/hero-room.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
          </div>
          <div className="relative w-full max-w-7xl mx-auto space-y-8">
            <div className="text-center">
              <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest bg-white/20 text-white rounded-full mb-4">
                Variant 4
              </span>
              <h2 className="text-white text-2xl mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                Warm Earthy
              </h2>
              <p className="text-white/60 text-sm">
                Cream background, cognac accents, organic boutique feel
              </p>
            </div>
            <BookingBarWarm />
          </div>
        </section>
      </main>
    </ThemeProvider>
  );
}
