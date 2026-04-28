"use client";

import { useState } from "react";
import {
  Check, ArrowDown, BadgeCheck, Star, Users, Flame,
  CheckCircle2, XCircle, Coffee, ChevronDown, ChevronUp,
} from "lucide-react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { defaultTheme } from "@/lib/theme";

const navy = "#2C3E50";
const sym = "£";
const direct = 128;
const saving = 45;
const otas = [
  { name: "Booking.com", rate: 147 },
  { name: "Expedia", rate: 151 },
  { name: "Hotels.com", rate: 143 },
];

const conceptNames = ["Emerald", "Dark Slate", "Indigo", "Blue-Teal", "Split"];

// ── Compare banner variants ──

function Banner2() {
  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
      <div className="flex items-center gap-4 px-5 py-4">
        <Check className="w-5 h-5 text-white shrink-0" />
        <p className="text-sm font-semibold text-white flex-1">You&apos;re saving {sym}{saving} — best rate guaranteed</p>
        <div className="flex items-center gap-4">{otas.map(o => <span key={o.name} className="text-xs text-white/40">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white px-2 py-1 rounded" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>Direct {sym}{direct}/nt</span></div>
      </div>
    </div>
  );
}

function Banner8() {
  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ backgroundColor: "#1e293b" }}>
      <div className="flex items-center gap-5 px-5 py-4">
        <div><p className="text-2xl font-bold text-white leading-none">{sym}{saving}</p><p className="text-[10px] text-white/40 uppercase tracking-wider">saving</p></div>
        <div className="h-8 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        <div className="flex-1 flex items-center gap-5">{otas.map(o => <div key={o.name}><p className="text-[10px] text-white/30">{o.name}</p><p className="text-sm text-white/40 line-through">{sym}{o.rate}</p></div>)}<div className="px-3 py-1.5 rounded" style={{ backgroundColor: "#059669" }}><p className="text-[10px] text-white/80">Direct</p><p className="text-sm font-bold text-white">{sym}{direct}/nt</p></div></div>
      </div>
    </div>
  );
}

function Banner10() {
  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
      <div className="flex items-center gap-4 px-5 py-4">
        <Star className="w-5 h-5 text-white shrink-0" />
        <div className="flex-1"><p className="text-sm font-semibold text-white">Official rate — {sym}{saving} less than OTAs</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/40">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white">{sym}{direct}/nt direct</span></div></div>
      </div>
    </div>
  );
}

function Banner14() {
  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #0284c7, #0891b2)" }}>
      <div className="flex items-center gap-5 px-5 py-4">
        <div className="shrink-0"><p className="text-3xl font-bold text-white leading-none">-{sym}{saving}</p></div>
        <div className="h-8 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        <div className="flex-1"><p className="text-sm text-white/80">vs booking sites</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/35">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}</div></div>
        <div className="px-4 py-2 rounded-lg shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}><p className="text-[10px] text-white/60">Your price</p><p className="text-lg font-bold text-white">{sym}{direct}<span className="text-xs font-normal">/nt</span></p></div>
      </div>
    </div>
  );
}

function Banner15() {
  return (
    <div className="rounded-lg overflow-hidden flex mb-6" style={{ border: "1px solid #e0e0e0" }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "#059669" }}>
        <ArrowDown className="w-5 h-5 text-white" />
        <div><p className="text-xl font-bold text-white leading-none">{sym}{saving}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">saved</p></div>
      </div>
      <div className="flex-1 bg-white px-5 py-4 flex items-center gap-5">
        {otas.map(o => <div key={o.name}><p className="text-[10px] text-gray-400">{o.name}</p><p className="text-sm text-gray-400 line-through">{sym}{o.rate}</p></div>)}
        <div className="ml-auto"><p className="text-[10px] text-gray-400">Direct</p><p className="text-sm font-bold" style={{ color: "#059669" }}>{sym}{direct}/nt</p></div>
      </div>
    </div>
  );
}

const banners = [Banner2, Banner8, Banner10, Banner14, Banner15];

// ── Fake room card ──

function RoomCard() {
  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: navy }}>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Classic Double</h3>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>Most popular</span>
        </div>
        <span className="text-xs text-white/50">Sleeps 2 · En-suite</span>
      </div>
      <div className="bg-white flex">
        <div className="w-[320px] shrink-0"><img src="/hotel/classic-double-1.jpg" className="w-full h-full object-cover" style={{ aspectRatio: "4/3" }} /></div>
        <div className="flex-1 p-5">
          <p className="text-sm text-gray-500 mb-5" style={{ lineHeight: 1.7 }}>A beautifully appointed room featuring a king-size bed with premium Egyptian cotton linen, an elegant en-suite bathroom with walk-in rain shower.</p>
          <div className="flex items-center py-3">
            <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Flexible — Room Only</p><div className="flex items-center gap-3 mt-1"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Room only</span><span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Free cancellation</span></div></div>
            <div className="text-right mr-5"><p className="text-lg font-bold">£435</p><p className="text-[10px] text-gray-400">£145/nt</p></div>
            <button className="px-6 py-2.5 text-xs uppercase tracking-[0.15em] font-medium" style={{ color: navy, border: `1px solid ${navy}`, borderRadius: "2px", backgroundColor: "transparent" }}>Reserve</button>
          </div>
          <div className="flex items-center py-3" style={{ borderTop: "1px solid #f0f0f0" }}>
            <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Flexible — Breakfast</p><div className="flex items-center gap-3 mt-1"><span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium"><Coffee className="w-3 h-3" />Breakfast</span><span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Free cancellation</span></div></div>
            <div className="text-right mr-5"><p className="text-lg font-bold">£487</p><p className="text-[10px] text-gray-400">£162/nt</p></div>
            <button className="px-6 py-2.5 text-xs uppercase tracking-[0.15em] font-medium" style={{ color: navy, border: `1px solid ${navy}`, borderRadius: "2px", backgroundColor: "transparent" }}>Reserve</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──

export function CompareFullClient() {
  const [idx, setIdx] = useState(0);

  const theme = {
    ...defaultTheme,
    typography: { ...defaultTheme.typography, headingFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", headingWeight: "600" },
  };

  const BannerComponent = banners[idx];

  return (
    <ThemeProvider theme={theme}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <NavBar variant="booking" />
      <BookingProgress currentStep={1} />

      <main style={{ backgroundColor: "#F2F2F2" }}>
        {/* Page header */}
        <div style={{ backgroundColor: navy }}>
          <div className="mx-auto py-10 md:py-12" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl mb-2 text-white font-semibold">Select Your Room</h1>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Sun 20 Apr → Wed 23 Apr · 3 nights · 2 adults · 1 room
                  <span className="ml-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    Best rate guaranteed
                  </span>
                </p>
              </div>
              <button className="text-sm px-4 py-2 rounded text-white" style={{ border: "1px solid rgba(255,255,255,0.3)" }}>Change dates</button>
            </div>
          </div>
        </div>

        <div className="mx-auto pt-6 pb-24" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
          <div className="flex items-center gap-2 mb-6 p-1 rounded-lg bg-white" style={{ border: "1px solid #e0e0e0", width: "fit-content" }}>
            {conceptNames.map((name, i) => (
              <button
                key={name}
                onClick={() => setIdx(i)}
                className="text-xs px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: idx === i ? navy : "transparent",
                  color: idx === i ? "#fff" : "#666",
                  cursor: "pointer",
                  border: "none",
                  fontWeight: idx === i ? 600 : 400,
                }}
              >
                {i + 1}. {name}
              </button>
            ))}
          </div>
          <BannerComponent />
          <div className="flex flex-col gap-8">
            <RoomCard />
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
