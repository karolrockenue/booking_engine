"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Coffee,
  ChevronDown,
  ChevronUp,
  Clock,
  Wine,
  Car,
  Sparkles,
} from "lucide-react";

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/pickers", label: "Pickers" },
  { href: "/fonts", label: "Fonts" },
  { href: "/rates", label: "Rates" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Rooms" },
];

const sampleRates = [
  { name: "Flexible — Room Only", price: 435, perNight: 145, flex: true, breakfast: false, best: true },
  { name: "Flexible — Breakfast Included", price: 487, perNight: 162, flex: true, breakfast: true, best: false },
];

const sampleExtras = [
  { name: "Early Check-in", desc: "From 12:00 noon", price: 25, Icon: Clock },
  { name: "Champagne", desc: "Moët in your room", price: 45, Icon: Wine },
  { name: "Parking", desc: "Secure on-site", price: 45, Icon: Car },
  { name: "Spa Credit", desc: "£50 towards treatment", price: 50, Icon: Sparkles },
];

export function RatesClient() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Dev nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">DEV</span>
          {devLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-xs text-gray-300 hover:text-white transition-colors">
              {link.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="pt-16 pb-24 px-4 max-w-5xl mx-auto" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Rate Plan Display — Concepts</h1>
        <p className="text-sm text-gray-500 mb-12">Same 2 rates + expanded extras view. 6 different approaches.</p>

        {/* ─── Concept 1: Current (card per rate) ─── */}
        <ConceptSection num={1} title="Cards (Current)" desc="Individual bordered cards per rate plan">
          <div className="flex flex-col gap-3">
            {sampleRates.map((r) => (
              <div key={r.name} className="rounded-lg p-5 flex items-center gap-4 bg-white" style={{ border: "1px solid #e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[15px] font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
                    {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <Inclusion breakfast={r.breakfast} />
                    <Cancellation flex={r.flex} />
                  </div>
                </div>
                <PriceBlock price={r.price} perNight={r.perNight} />
                <SelectBtn />
              </div>
            ))}
          </div>
        </ConceptSection>

        {/* ─── Concept 2: Table rows ─── */}
        <ConceptSection num={2} title="Clean Table Rows" desc="No card borders, just rows with subtle dividers. Tighter, more like Booking.com">
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e8e8e8" }}>
            {sampleRates.map((r, i) => (
              <div key={r.name} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors" style={{ borderBottom: i < sampleRates.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
                    {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <Inclusion breakfast={r.breakfast} />
                    <Cancellation flex={r.flex} />
                  </div>
                </div>
                <PriceBlock price={r.price} perNight={r.perNight} />
                <SelectBtn />
              </div>
            ))}
          </div>
        </ConceptSection>

        {/* ─── Concept 3: Horizontal cards with colour accent ─── */}
        <ConceptSection num={3} title="Accent Left Border" desc="Small primary colour accent strip on the left edge of each rate">
          <div className="flex flex-col gap-3">
            {sampleRates.map((r) => (
              <div key={r.name} className="rounded-lg overflow-hidden flex bg-white" style={{ border: "1px solid #e8e8e8" }}>
                <div className="w-1 shrink-0" style={{ backgroundColor: r.best ? "#2C3E50" : "#d1d5db" }} />
                <div className="flex-1 p-5 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[15px] font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
                      {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <Inclusion breakfast={r.breakfast} />
                      <Cancellation flex={r.flex} />
                    </div>
                  </div>
                  <PriceBlock price={r.price} perNight={r.perNight} />
                  <SelectBtn />
                </div>
              </div>
            ))}
          </div>
        </ConceptSection>

        {/* ─── Concept 4: Stacked with prominent price ─── */}
        <ConceptSection num={4} title="Price-First" desc="Large price on the left, details right. Prioritises the number">
          <div className="flex flex-col gap-3">
            {sampleRates.map((r) => (
              <div key={r.name} className="rounded-lg p-5 flex items-center gap-6 bg-white" style={{ border: "1px solid #e8e8e8" }}>
                <div className="text-center shrink-0" style={{ minWidth: "90px" }}>
                  <p className="text-[28px] font-bold leading-none" style={{ color: "#2C3E50" }}>£{r.price}</p>
                  <p className="text-[11px] mt-1 text-gray-400">£{r.perNight}/nt</p>
                </div>
                <div className="w-px h-10 bg-gray-200 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
                    {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <Inclusion breakfast={r.breakfast} />
                    <Cancellation flex={r.flex} />
                  </div>
                </div>
                <SelectBtn />
              </div>
            ))}
          </div>
        </ConceptSection>

        {/* ─── Concept 5: Compact tiles / 2-col grid ─── */}
        <ConceptSection num={5} title="Tile Grid" desc="Rates as tiles in a 2-column grid. Each tile is self-contained">
          <div className="grid grid-cols-2 gap-3">
            {sampleRates.map((r) => (
              <div key={r.name} className="rounded-lg p-5 bg-white flex flex-col" style={{ border: r.best ? "2px solid #2C3E50" : "1px solid #e8e8e8" }}>
                {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold self-start mb-3">Best price</span>}
                <p className="text-sm font-semibold mb-2" style={{ color: "#1a1a1a" }}>{r.name}</p>
                <div className="flex flex-col gap-1.5 mb-4">
                  <Inclusion breakfast={r.breakfast} />
                  <Cancellation flex={r.flex} />
                </div>
                <div className="mt-auto">
                  <p className="text-2xl font-bold mb-0.5" style={{ color: "#1a1a1a" }}>£{r.price}</p>
                  <p className="text-[11px] text-gray-400 mb-3">3 nights · £{r.perNight}/nt · Incl. taxes</p>
                  <button className="w-full py-2.5 text-xs uppercase tracking-wider rounded font-semibold text-white" style={{ backgroundColor: "#2C3E50" }}>Select</button>
                </div>
              </div>
            ))}
          </div>
        </ConceptSection>

        {/* ─── Concept 6: Minimal list with radio selection ─── */}
        <ConceptSection num={6} title="Radio Select" desc="Minimal list, radio-button style selection, single action button at bottom">
          <RadioConcept />
        </ConceptSection>

        {/* ─── Extras expanded mockups ─── */}
        <h2 className="text-xl font-bold mt-20 mb-2" style={{ color: "#1a1a1a" }}>Extras Panel — After Selection</h2>
        <p className="text-sm text-gray-500 mb-8">How the extras look after selecting a rate</p>

        {/* Extras: Compact inline */}
        <ConceptSection num={"A"} title="Compact Inline Extras" desc="Horizontal scroll of small cards below selected rate">
          <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #e8e8e8" }}>
            <SelectedRateBanner />
            <p className="text-xs font-medium text-gray-500 mb-3 mt-5">Enhance your stay <span className="text-gray-400">(optional)</span></p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sampleExtras.map((e) => (
                <button key={e.name} className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-xs border border-gray-200 hover:border-gray-400 transition-colors" style={{ cursor: "pointer", background: "none" }}>
                  <e.Icon className="w-3.5 h-3.5 text-gray-500" />
                  <span className="font-medium text-gray-700">{e.name}</span>
                  <span className="text-gray-400">+£{e.price}</span>
                </button>
              ))}
            </div>
          </div>
        </ConceptSection>

        {/* Extras: Grid (current approach) */}
        <ConceptSection num={"B"} title="Grid Cards Extras" desc="2x2 grid of toggle cards (current)">
          <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #e8e8e8" }}>
            <SelectedRateBanner />
            <p className="text-xs font-medium text-gray-500 mb-3 mt-5">Enhance your stay <span className="text-gray-400">(optional)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {sampleExtras.map((e) => (
                <div key={e.name} className="p-3 rounded-lg border border-gray-200 flex items-start gap-3" style={{ cursor: "pointer" }}>
                  <div className="p-1.5 rounded-full bg-gray-100 mt-0.5">
                    <e.Icon className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{e.name}</p>
                    <p className="text-[10px] text-gray-400">{e.desc}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-1">£{e.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ConceptSection>

        {/* Extras: Checkbox list */}
        <ConceptSection num={"C"} title="Simple Checkbox List" desc="Clean checklist, no cards. Most compact">
          <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #e8e8e8" }}>
            <SelectedRateBanner />
            <p className="text-xs font-medium text-gray-500 mb-3 mt-5">Enhance your stay <span className="text-gray-400">(optional)</span></p>
            <div className="flex flex-col gap-0">
              {sampleExtras.map((e, i) => (
                <label key={e.name} className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded" style={{ borderBottom: i < sampleExtras.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <input type="checkbox" className="w-4 h-4 rounded accent-[#2C3E50]" />
                  <e.Icon className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-sm text-gray-700">{e.name}</span>
                  <span className="text-sm font-medium text-gray-500">+£{e.price}</span>
                </label>
              ))}
            </div>
          </div>
        </ConceptSection>
      </main>
    </>
  );
}

/* ─── Shared sub-components ─── */

function ConceptSection({ num, title, desc, children }: { num: number | string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="mb-14">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{num}</span>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{desc}</p>
      <div style={{ backgroundColor: "#f5f5f7", borderRadius: "8px", padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function Inclusion({ breakfast }: { breakfast: boolean }) {
  return breakfast ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium">
      <Coffee className="w-3 h-3" />Breakfast included
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Room only</span>
  );
}

function Cancellation({ flex }: { flex: boolean }) {
  return flex ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" />Free cancellation
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
      <XCircle className="w-3.5 h-3.5" />Non-refundable
    </span>
  );
}

function PriceBlock({ price, perNight }: { price: number; perNight: number }) {
  return (
    <div className="text-right shrink-0">
      <p className="text-[22px] font-bold leading-tight" style={{ color: "#1a1a1a" }}>£{price}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">3 nights · £{perNight}/nt</p>
      <p className="text-[10px] text-gray-300">Incl. taxes</p>
    </div>
  );
}

function SelectBtn() {
  return (
    <button className="px-6 py-2.5 text-xs uppercase tracking-wider rounded font-semibold text-white shrink-0" style={{ backgroundColor: "#2C3E50" }}>
      Select
    </button>
  );
}

function SelectedRateBanner() {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#f0f4f8", border: "1px solid #2C3E50" }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Flexible — Room Only</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-500">Room only</span>
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3 h-3" />Free cancellation
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: "#1a1a1a" }}>£435</p>
          <p className="text-[10px] text-gray-400">3 nights</p>
        </div>
        <span className="px-3 py-1.5 text-[10px] uppercase tracking-wider inline-flex items-center gap-1 rounded font-semibold text-green-600 bg-green-50">
          <CheckCircle2 className="w-3 h-3" />Selected
        </span>
      </div>
    </div>
  );
}

function RadioConcept() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e8e8e8" }}>
      {sampleRates.map((r, i) => (
        <label
          key={r.name}
          className="px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors"
          style={{
            borderBottom: i < sampleRates.length - 1 ? "1px solid #f0f0f0" : "none",
            backgroundColor: selected === i ? "#f8fafc" : "transparent",
          }}
          onClick={() => setSelected(i)}
        >
          <div
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: selected === i ? "#2C3E50" : "#d1d5db" }}
          >
            {selected === i && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2C3E50" }} />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.name}</p>
              {r.best && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C3E50] text-white font-semibold">Best price</span>}
            </div>
            <div className="flex items-center gap-4">
              <Inclusion breakfast={r.breakfast} />
              <Cancellation flex={r.flex} />
            </div>
          </div>
          <PriceBlock price={r.price} perNight={r.perNight} />
        </label>
      ))}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <button className="w-full py-2.5 text-xs uppercase tracking-wider rounded font-semibold text-white" style={{ backgroundColor: "#2C3E50" }}>
          Continue with selected rate
        </button>
      </div>
    </div>
  );
}
