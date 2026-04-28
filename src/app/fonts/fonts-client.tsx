"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Coffee,
  Users,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";

const fonts = [
  { name: "Plus Jakarta Sans (current)", family: "'Plus Jakarta Sans', system-ui, sans-serif", hw: 600, bw: 400 },
  { name: "Inter", family: "'Inter', system-ui, sans-serif", hw: 600, bw: 400 },
  { name: "DM Sans", family: "'DM Sans', system-ui, sans-serif", hw: 600, bw: 400 },
  { name: "Poppins", family: "'Poppins', system-ui, sans-serif", hw: 600, bw: 400 },
  { name: "Outfit", family: "'Outfit', system-ui, sans-serif", hw: 600, bw: 400 },
  { name: "Libre Baskerville", family: "'Libre Baskerville', Georgia, serif", hw: 700, bw: 400 },
  { name: "Playfair Display", family: "'Playfair Display', Georgia, serif", hw: 700, bw: 400 },
  { name: "Cormorant Garamond", family: "'Cormorant Garamond', Georgia, serif", hw: 600, bw: 400 },
  { name: "Lora", family: "'Lora', Georgia, serif", hw: 700, bw: 400 },
  { name: "Source Serif 4", family: "'Source Serif 4', Georgia, serif", hw: 700, bw: 400 },
];

const roomImages = [
  "/hotel/classic-double-1.jpg",
  "/hotel/classic-double-2.jpg",
];

const rates = [
  { name: "Flexible — Room Only", price: 435, perNight: 145, flex: true, breakfast: false, best: true },
  { name: "Flexible — Breakfast Included", price: 487, perNight: 162, flex: true, breakfast: true, best: false },
];

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/pickers", label: "Pickers" },
  { href: "/fonts", label: "Fonts" },
  { href: "/rates", label: "Rates" },
  { href: "/enhance", label: "Enhance" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Rooms" },
];

export function FontsClient() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Playfair+Display:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Source+Serif+4:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">DEV</span>
          {devLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-xs text-gray-300 hover:text-white transition-colors">{link.label}</a>
          ))}
        </div>
      </nav>

      <main className="pt-16 pb-24 px-4" style={{ backgroundColor: "#F2F2F2" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-10 px-2">
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Font Comparison — Full Room Card</h1>
            <p className="text-sm text-gray-500">Same room card as on the real page, each in a different font. Same #F2F2F2 background.</p>
          </div>

          <div className="flex flex-col gap-10">
            {fonts.map((font, idx) => (
              <div key={font.name}>
                <div className="flex items-center gap-3 mb-3 px-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 bg-white px-2.5 py-1 rounded font-mono">{idx + 1}</span>
                  <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{font.name}</span>
                </div>
                <RoomCard font={font} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function RoomCard({ font }: { font: { family: string; hw: number; bw: number } }) {
  const [imgIdx, setImgIdx] = useState(0);

  return (
    <div
      className="transition-opacity"
      style={{
        backgroundColor: "#fff",
        border: "1px solid #E5E0D8",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Room header */}
      <div className="flex flex-col md:flex-row" style={{ borderBottom: "1px solid #E5E0D8" }}>
        {/* Image */}
        <div className="md:w-[360px] shrink-0 p-4">
          <div className="relative w-full overflow-hidden rounded-md" style={{ aspectRatio: "3/2" }}>
            <img src={roomImages[imgIdx]} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => setImgIdx((imgIdx - 1 + roomImages.length) % roomImages.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setImgIdx((imgIdx + 1) % roomImages.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {roomImages.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i === imgIdx ? "#fff" : "rgba(255,255,255,0.5)" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 p-5 md:pl-3 flex flex-col justify-center">
          <h3
            className="text-[26px] md:text-[28px] mb-3"
            style={{ fontFamily: font.family, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2 }}
          >
            Classic Double
          </h3>
          <p
            className="text-sm mb-4 line-clamp-3"
            style={{ fontFamily: font.family, fontWeight: font.bw, color: "#6B7280", lineHeight: "1.7" }}
          >
            A beautifully appointed room featuring a king-size bed with premium Egyptian cotton linen, an elegant en-suite bathroom with walk-in rain shower, and peaceful views over the private garden. Includes complimentary high-speed Wi-Fi, in-room safe, minibar, and Nespresso machine.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ color: "#6B7280", backgroundColor: "#FAF8F5", fontFamily: font.family }}>
              <Users className="w-3.5 h-3.5" />
              Sleeps 2
            </div>
            <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
              Most popular
            </div>
            <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
              <Flame className="w-3 h-3" />
              Only 2 left
            </div>
          </div>
        </div>
      </div>

      {/* Rate plans */}
      <div className="p-4 md:p-5 flex flex-col gap-3">
        {rates.map((r) => (
          <div
            key={r.name}
            className="rounded-lg overflow-hidden flex"
            style={{ border: "1px solid #e8e8e8", backgroundColor: "#fff" }}
          >
            <div className="w-1 shrink-0" style={{ backgroundColor: r.best ? "#2C3E50" : "#d1d5db" }} />
            <div className="flex-1 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[17px]" style={{ fontFamily: font.family, fontWeight: font.hw, color: "#1A1A1A" }}>
                    {r.name}
                  </p>
                  {r.best && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: "#2C3E50" }}>
                      Best price
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {r.breakfast ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                      <Coffee className="w-3 h-3" />Breakfast included
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#f5f5f5", color: "#888" }}>Room only</span>
                  )}
                  {r.flex ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />Free cancellation
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <XCircle className="w-3.5 h-3.5" />Non-refundable
                    </span>
                  )}
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <p className="text-[24px] leading-tight" style={{ fontFamily: font.family, fontWeight: font.hw, color: "#1A1A1A" }}>
                    £{r.price}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#999" }}>3 nights · £{r.perNight}/nt</p>
                  <p className="text-[10px]" style={{ color: "#bbb" }}>Incl. taxes</p>
                </div>
                <button
                  className="px-6 py-2.5 text-xs uppercase tracking-wider rounded font-semibold text-white"
                  style={{ backgroundColor: "#2C3E50" }}
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
