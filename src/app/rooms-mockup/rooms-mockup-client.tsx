"use client";

import { useState } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Coffee,
  Wifi,
  Bath,
  Flame,
  BadgeCheck,
} from "lucide-react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { defaultTheme } from "@/lib/theme";

const img1 = "/hotel/classic-double-1.jpg";
const img2 = "/hotel/deluxe-suite-1.jpg";
const img3 = "/hotel/superior-twin-1.jpg";

const rooms = [
  {
    name: "Classic Double",
    desc: "A beautifully appointed room featuring a king-size bed with premium Egyptian cotton linen, an elegant en-suite bathroom with walk-in rain shower, and peaceful garden views.",
    img: img1,
    sleeps: 2,
    tags: [{ label: "Most popular", color: "#2563eb", bg: "#eff6ff" }],
    rates: [
      { name: "Flexible — Room Only", price: 435, pn: 145, flex: true, bf: false, best: true },
      { name: "Flexible — Breakfast", price: 487, pn: 162, flex: true, bf: true, best: false },
    ],
  },
  {
    name: "Deluxe Suite",
    desc: "Our most spacious accommodation with a separate living area, super-king bed, and a luxurious marble bathroom with freestanding soaking tub. Private balcony with panoramic views.",
    img: img2,
    sleeps: 3,
    tags: [{ label: "Only 2 left", color: "#dc2626", bg: "#fef2f2" }],
    rates: [
      { name: "Flexible — Room Only", price: 675, pn: 225, flex: true, bf: false, best: true },
      { name: "Flexible — Breakfast", price: 756, pn: 252, flex: true, bf: true, best: false },
    ],
  },
  {
    name: "Superior Twin",
    desc: "A light-filled corner room with two generous single beds. Features a modern en-suite with power shower, a dedicated workspace, and views over the quiet courtyard.",
    img: img3,
    sleeps: 2,
    tags: [],
    rates: [
      { name: "Flexible — Room Only", price: 495, pn: 165, flex: true, bf: false, best: true },
      { name: "Non-Refundable", price: 396, pn: 132, flex: false, bf: false, best: false },
    ],
  },
];

type Rate = (typeof rooms)[0]["rates"][0];

function BF({ bf }: { bf: boolean }) {
  return bf ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium"><Coffee className="w-3 h-3" />Breakfast</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Room only</span>
  );
}

function CX({ flex }: { flex: boolean }) {
  return flex ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Free cancellation</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><XCircle className="w-3.5 h-3.5" />Non-refundable</span>
  );
}

function ReserveBtn() {
  return (
    <button className="px-6 py-2.5 text-xs uppercase tracking-[0.15em] font-medium transition-colors shrink-0" style={{ color: "#2C3E50", border: "1px solid #2C3E50", borderRadius: "2px", backgroundColor: "transparent" }}>
      Reserve
    </button>
  );
}

function PageHeader() {
  return (
    <div style={{ backgroundColor: "#2C3E50" }}>
      <div className="mx-auto py-10 md:py-12" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl mb-2 text-white font-semibold">Select Your Room</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Sat 20 Apr → Tue 23 Apr · 3 nights · 2 adults · 1 room</p>
          </div>
          <button className="text-sm px-4 py-2 rounded transition-colors text-white" style={{ border: "1px solid rgba(255,255,255,0.3)" }}>Change dates</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Concept 1: Dark Header ════════════════ */
function Concept1({ room }: { room: typeof rooms[0] }) {
  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#2C3E50" }}>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">{room.name}</h3>
          {room.tags.map(t => <span key={t.label} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>{t.label}</span>)}
        </div>
        <span className="text-xs text-white/50">Sleeps {room.sleeps} · En-suite</span>
      </div>
      <div className="bg-white flex flex-col md:flex-row">
        <div className="md:w-[320px] shrink-0"><img src={room.img} className="w-full h-full object-cover" style={{ aspectRatio: "4/3" }} /></div>
        <div className="flex-1 p-5">
          <p className="text-sm text-gray-500 mb-5" style={{ lineHeight: 1.7 }}>{room.desc}</p>
          {room.rates.map((r, i) => (
            <div key={r.name} className="flex items-center py-3" style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}>
              <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p><div className="flex items-center gap-3 mt-1"><BF bf={r.bf} /><CX flex={r.flex} /></div></div>
              <div className="text-right mr-5"><p className="text-lg font-bold">£{r.price}</p><p className="text-[10px] text-gray-400">£{r.pn}/nt</p></div>
              <ReserveBtn />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Concept 2: Booking.com Inspired ════════════════ */
function Concept2({ room }: { room: typeof rooms[0] }) {
  return (
    <div className="bg-white rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
      <div className="flex gap-4 p-4" style={{ borderBottom: "1px solid #E5E0D8" }}>
        <img src={room.img} className="w-[180px] h-[120px] object-cover rounded" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>{room.name}</h3>
            {room.tags.map(t => <span key={t.label} className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: t.bg, color: t.color }}>{t.color === "#dc2626" && <Flame className="w-3 h-3" />}{t.label}</span>)}
          </div>
          <div className="flex gap-3 text-xs text-gray-400 mb-2"><span>{room.sleeps} guests</span><span>28m²</span><span>Garden view</span></div>
          <p className="text-xs text-gray-500 line-clamp-2">{room.desc}</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-gray-400 uppercase tracking-wider" style={{ borderBottom: "1px solid #f0f0f0" }}><th className="text-left px-4 py-2 font-medium">Rate</th><th className="text-left px-4 py-2 font-medium">Includes</th><th className="text-left px-4 py-2 font-medium">Policy</th><th className="text-right px-4 py-2 font-medium">Price</th><th className="px-4 py-2"></th></tr></thead>
        <tbody>
          {room.rates.map(r => (
            <tr key={r.name} className="hover:bg-gray-50" style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td className="px-4 py-3 font-medium" style={{ color: "#1a1a1a" }}>{r.name}</td>
              <td className="px-4 py-3"><BF bf={r.bf} /></td>
              <td className="px-4 py-3"><CX flex={r.flex} /></td>
              <td className="px-4 py-3 text-right"><p className="font-bold">£{r.price}</p><p className="text-[10px] text-gray-400">£{r.pn}/nt</p></td>
              <td className="px-4 py-3 text-right"><ReserveBtn /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════ Concept 3: Luxury Minimal ════════════════ */
function Concept3({ room }: { room: typeof rooms[0] }) {
  return (
    <div className="bg-white rounded-md overflow-hidden" style={{ border: "1px solid #E5E0D8" }}>
      <div className="p-8 md:p-12">
        <div className="grid md:grid-cols-2 gap-10 mb-10">
          <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3/2" }}><img src={room.img} className="w-full h-full object-cover" /></div>
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">Room</p>
            <h3 className="text-3xl font-light mb-4" style={{ color: "#1a1a1a", letterSpacing: "-0.02em" }}>{room.name}</h3>
            <div className="h-px w-10 bg-gray-300 mb-4" />
            <p className="text-sm text-gray-500" style={{ lineHeight: 1.8 }}>{room.desc}</p>
            <div className="flex gap-4 mt-5 text-xs text-gray-400">
              <span>Sleeps {room.sleeps}</span><span>28m²</span><span>En-suite</span>
              {room.tags.map(t => <span key={t.label} className="font-medium" style={{ color: t.color }}>{t.label}</span>)}
            </div>
          </div>
        </div>
        <div className="h-px bg-gray-200 mb-8" />
        {room.rates.map((r, i) => (
          <div key={r.name} className="flex items-center py-5" style={{ borderBottom: i < room.rates.length - 1 ? "1px solid #f5f5f5" : "none" }}>
            <div className="flex-1"><p className="text-base font-medium" style={{ color: "#1a1a1a" }}>{r.name}</p><div className="flex items-center gap-4 mt-1.5"><BF bf={r.bf} /><CX flex={r.flex} /></div></div>
            <div className="text-right mr-8"><p className="text-2xl font-light" style={{ color: "#1a1a1a", letterSpacing: "-0.02em" }}>£{r.price}</p><p className="text-[11px] text-gray-400 mt-0.5">£{r.pn} per night</p></div>
            <ReserveBtn />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════ Concept 4: Modern Hybrid ════════════════ */
function Concept4({ room }: { room: typeof rooms[0] }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e0e0e0" }}>
      <div className="flex flex-col md:flex-row">
        <div className="md:w-[380px] shrink-0 p-5"><div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3/2" }}><img src={room.img} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div></div>
        <div className="flex-1 p-5 md:pl-2 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-[22px] font-semibold" style={{ color: "#1a1a1a" }}>{room.name}</h3>
            {room.tags.map(t => <span key={t.label} className="text-[10px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: t.bg, color: t.color }}>{t.color === "#dc2626" && <Flame className="w-3 h-3" />}{t.label}</span>)}
          </div>
          <p className="text-[13px] text-gray-500 mb-4" style={{ lineHeight: 1.7 }}>{room.desc}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 flex items-center gap-1"><Users className="w-3 h-3" />Sleeps {room.sleeps}</span>
            <span className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 flex items-center gap-1"><Wifi className="w-3 h-3" />Free Wi-Fi</span>
            <span className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 flex items-center gap-1"><Bath className="w-3 h-3" />En-suite</span>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-3 px-1">Select a rate</p>
        <div className="flex flex-col gap-2">
          {room.rates.map(r => (
            <div key={r.name} className="rounded-lg p-4 flex items-center gap-4 transition-colors hover:bg-gray-50" style={{ border: r.best ? "2px solid #2C3E50" : "1px solid #e8e8e8" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[14px] font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
                  {r.best && <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
                </div>
                <div className="flex items-center gap-3"><BF bf={r.bf} /><CX flex={r.flex} /></div>
              </div>
              <div className="text-right shrink-0"><p className="text-[20px] font-bold" style={{ color: "#1a1a1a" }}>£{r.price}</p><p className="text-[10px] text-gray-400">3 nights · £{r.pn}/nt</p></div>
              <ReserveBtn />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Price Compare Banner ════════════════ */
function PriceBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="rounded-lg mb-6 overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E5E0D8" }}>
      <div className="flex items-center gap-4 px-5 py-4">
        <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: "#2C3E50" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>You&apos;re getting the best rate — save £65 by booking direct</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs" style={{ color: "#999" }}>Booking.com <span style={{ textDecoration: "line-through" }}>£167</span></span>
            <span className="text-xs" style={{ color: "#999" }}>Expedia <span style={{ textDecoration: "line-through" }}>£171</span></span>
            <span className="text-xs font-semibold" style={{ color: "#2C3E50" }}>Direct £145/nt</span>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600" style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
const conceptNames = ["Dark Header", "Booking.com", "Luxury", "Modern"];

export function RoomsMockupClient() {
  const [concept, setConcept] = useState(1);

  // Override theme fonts to Inter for mockup
  const theme = {
    ...defaultTheme,
    typography: { ...defaultTheme.typography, headingFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", headingWeight: "600" },
  };

  const ConceptComponent = concept === 1 ? Concept1 : concept === 2 ? Concept2 : concept === 3 ? Concept3 : Concept4;

  return (
    <ThemeProvider theme={theme}>
      <div>
        <NavBar variant="booking" />
        <BookingProgress currentStep={1} />

        <main style={{ backgroundColor: "#F2F2F2" }}>
          {/* Page header */}
          <div style={{ backgroundColor: "#2C3E50" }}>
            <div
              className="mx-auto py-10 md:py-12"
              style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl mb-2 text-white font-semibold">Select Your Room</h1>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Sat 20 Apr → Tue 23 Apr · 3 nights · 2 adults · 1 room
                  </p>
                </div>
                <button className="text-sm px-4 py-2 rounded transition-colors text-white" style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
                  Change dates
                </button>
              </div>
            </div>
          </div>

          {/* Concept switcher */}
          <div className="mx-auto pt-6 pb-0" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
            <div className="flex items-center gap-2 mb-6 p-1 rounded-lg bg-white" style={{ border: "1px solid #e0e0e0", width: "fit-content" }}>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConcept(n)}
                  className="text-xs px-4 py-2 rounded-md transition-colors"
                  style={{
                    backgroundColor: concept === n ? "#2C3E50" : "transparent",
                    color: concept === n ? "#fff" : "#666",
                    cursor: "pointer",
                    border: "none",
                    fontWeight: concept === n ? 600 : 400,
                  }}
                >
                  {n}. {conceptNames[n - 1]}
                </button>
              ))}
            </div>
          </div>

          {/* Room cards */}
          <div className="mx-auto pt-0 pb-24" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
            <PriceBanner />
            <div className="flex flex-col gap-8">
              {rooms.map((room) => (
                <ConceptComponent key={`${concept}-${room.name}`} room={room} />
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
