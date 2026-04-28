"use client";

import { X, ArrowDown, BadgeCheck, TrendingDown, Shield, Zap, Check, Tag, Star } from "lucide-react";

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/bars", label: "Bars" },
  { href: "/compare", label: "Compare" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Live" },
];

const direct = 128;
const sym = "£";
const otas = [
  { name: "Booking.com", rate: 147 },
  { name: "Expedia", rate: 151 },
  { name: "Hotels.com", rate: 143 },
];
const saving = (143 - 128) * 3; // 45

function Sec({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 bg-white px-2.5 py-1 rounded font-mono">{n}</span>
        <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function CompareClient() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 mr-3">DEV</span>
          {devLinks.map((l) => <a key={l.href} href={l.href} className="text-xs text-gray-300 hover:text-white">{l.label}</a>)}
        </div>
      </nav>

      <main className="pt-16 pb-24 px-4 max-w-[1280px] mx-auto" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#F2F2F2", minHeight: "100vh" }}>
        <h1 className="text-2xl font-bold mb-2">Price Compare Banner — 15 Concepts</h1>
        <p className="text-sm text-gray-500 mb-10">Same data, different vibes. Pick what feels right on the rooms page.</p>

        {/* 1: Blue gradient (current) */}
        <Sec n={1} title="Blue Gradient">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #0ea5e9, #2563eb)" }}>
            <div className="flex items-center gap-5 px-5 py-4">
              <div className="flex items-center gap-2 shrink-0"><div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}><ArrowDown className="w-5 h-5 text-white" /></div><div><p className="text-[22px] font-bold text-white leading-none">{sym}{saving}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">saved</p></div></div>
              <div className="h-8 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
              <div className="flex-1 flex items-center gap-5">{otas.map(o => <div key={o.name} className="text-center"><p className="text-[10px] text-white/40">{o.name}</p><p className="text-sm text-white/50 line-through">{sym}{o.rate}</p></div>)}<div className="text-center px-4 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}><p className="text-[10px] text-white/70 font-medium">Direct</p><p className="text-sm font-bold text-white">{sym}{direct}/nt</p></div></div>
            </div>
          </div>
        </Sec>

        {/* 2: Emerald gradient */}
        <Sec n={2} title="Emerald Gradient">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
            <div className="flex items-center gap-4 px-5 py-4">
              <Check className="w-5 h-5 text-white shrink-0" />
              <p className="text-sm font-semibold text-white flex-1">You&apos;re saving {sym}{saving} — best rate guaranteed</p>
              <div className="flex items-center gap-4">{otas.map(o => <span key={o.name} className="text-xs text-white/40">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white px-2 py-1 rounded" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>Direct {sym}{direct}/nt</span></div>
            </div>
          </div>
        </Sec>

        {/* 3: Warm amber */}
        <Sec n={3} title="Warm Amber">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <div className="flex items-center gap-4 px-5 py-4">
              <Zap className="w-5 h-5 text-white shrink-0" />
              <div className="flex-1"><p className="text-sm font-semibold text-white">Save {sym}{saving} — you&apos;re on the hotel&apos;s official site</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/50">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white">Direct {sym}{direct}/nt</span></div></div>
            </div>
          </div>
        </Sec>

        {/* 4: White with green accent left */}
        <Sec n={4} title="White + Green Accent">
          <div className="rounded-lg overflow-hidden flex" style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }}>
            <div className="w-1.5 shrink-0" style={{ backgroundColor: "#059669" }} />
            <div className="flex items-center gap-4 px-5 py-4 flex-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#ecfdf5" }}><TrendingDown className="w-4 h-4" style={{ color: "#059669" }} /></div>
              <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#059669" }}>Saving {sym}{saving} vs OTAs</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-gray-400">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-semibold" style={{ color: "#059669" }}>Direct {sym}{direct}/nt</span></div></div>
            </div>
          </div>
        </Sec>

        {/* 5: White with blue accent left */}
        <Sec n={5} title="White + Blue Accent">
          <div className="rounded-lg overflow-hidden flex" style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }}>
            <div className="w-1.5 shrink-0" style={{ backgroundColor: "#2563eb" }} />
            <div className="flex items-center gap-4 px-5 py-4 flex-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#eff6ff" }}><BadgeCheck className="w-4 h-4" style={{ color: "#2563eb" }} /></div>
              <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>You&apos;re saving {sym}{saving} by booking direct</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-gray-400">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-semibold" style={{ color: "#2563eb" }}>Direct {sym}{direct}/nt</span></div></div>
            </div>
          </div>
        </Sec>

        {/* 6: Teal gradient — horizontal save meter */}
        <Sec n={6} title="Teal + Save Meter">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">You save {sym}{saving} booking direct</p>
                <span className="text-xs text-white/50">vs cheapest OTA</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${Math.round((direct / 151) * 100)}%`, backgroundColor: "rgba(255,255,255,0.6)" }} />
                </div>
                <span className="text-xs font-bold text-white shrink-0">{sym}{direct}</span>
                <span className="text-xs text-white/30 shrink-0">vs {sym}151</span>
              </div>
            </div>
          </div>
        </Sec>

        {/* 7: Rose/pink gradient */}
        <Sec n={7} title="Rose Pink">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #e11d48, #be123c)" }}>
            <div className="flex items-center gap-4 px-5 py-4">
              <Tag className="w-5 h-5 text-white shrink-0" />
              <div className="flex-1"><p className="text-sm font-semibold text-white">{sym}{saving} cheaper than any booking site</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/40">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white px-2 py-1 rounded" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>{sym}{direct}/nt</span></div></div>
            </div>
          </div>
        </Sec>

        {/* 8: Dark slate */}
        <Sec n={8} title="Dark Slate">
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "#1e293b" }}>
            <div className="flex items-center gap-5 px-5 py-4">
              <div><p className="text-2xl font-bold text-white leading-none">{sym}{saving}</p><p className="text-[10px] text-white/40 uppercase tracking-wider">saving</p></div>
              <div className="h-8 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
              <div className="flex-1 flex items-center gap-5">{otas.map(o => <div key={o.name}><p className="text-[10px] text-white/30">{o.name}</p><p className="text-sm text-white/40 line-through">{sym}{o.rate}</p></div>)}<div className="px-3 py-1.5 rounded" style={{ backgroundColor: "#059669" }}><p className="text-[10px] text-white/80">Direct</p><p className="text-sm font-bold text-white">{sym}{direct}/nt</p></div></div>
            </div>
          </div>
        </Sec>

        {/* 9: Light with pill badges */}
        <Sec n={9} title="Light + Pill Badges">
          <div className="rounded-lg px-5 py-4 flex items-center gap-4" style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }}>
            <Shield className="w-5 h-5 shrink-0" style={{ color: "#059669" }} />
            <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Best rate — save {sym}{saving}</p>
            <div className="flex items-center gap-2 ml-auto">
              {otas.map(o => <span key={o.name} className="text-[11px] px-2.5 py-1 rounded-full line-through" style={{ backgroundColor: "#fef2f2", color: "#999" }}>{o.name} {sym}{o.rate}</span>)}
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>Direct {sym}{direct}/nt</span>
            </div>
          </div>
        </Sec>

        {/* 10: Indigo to violet */}
        <Sec n={10} title="Indigo Violet">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <div className="flex items-center gap-4 px-5 py-4">
              <Star className="w-5 h-5 text-white shrink-0" />
              <div className="flex-1"><p className="text-sm font-semibold text-white">Official rate — {sym}{saving} less than OTAs</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/40">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-bold text-white">{sym}{direct}/nt direct</span></div></div>
            </div>
          </div>
        </Sec>

        {/* 11: Minimal text only */}
        <Sec n={11} title="Minimal Text">
          <div className="rounded-lg px-5 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }}>
            <p className="text-sm" style={{ color: "#1a1a1a" }}>Booking direct saves you <strong>{sym}{saving}</strong> on this stay</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">{otas.map(o => <span key={o.name} className="line-through">{sym}{o.rate}</span>)}<span className="font-semibold text-sm" style={{ color: "#059669" }}>{sym}{direct}/nt</span></div>
          </div>
        </Sec>

        {/* 12: Sky blue light */}
        <Sec n={12} title="Sky Blue Light">
          <div className="rounded-lg px-5 py-4 flex items-center gap-4" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: "#2563eb" }} />
            <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#1e40af" }}>Save {sym}{saving} — you&apos;re on the official website</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs" style={{ color: "#93c5fd" }}>{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-semibold" style={{ color: "#2563eb" }}>Direct {sym}{direct}/nt</span></div></div>
          </div>
        </Sec>

        {/* 13: Mint green light */}
        <Sec n={13} title="Mint Green Light">
          <div className="rounded-lg px-5 py-4 flex items-center gap-4" style={{ backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <Check className="w-5 h-5 shrink-0" style={{ color: "#059669" }} />
            <div className="flex-1"><p className="text-sm font-semibold" style={{ color: "#065f46" }}>You&apos;re saving {sym}{saving} by booking direct</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs" style={{ color: "#6ee7b7" }}>{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}<span className="text-xs font-semibold" style={{ color: "#059669" }}>Direct {sym}{direct}/nt</span></div></div>
          </div>
        </Sec>

        {/* 14: Gradient blue-teal with big number */}
        <Sec n={14} title="Blue-Teal + Big Number">
          <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #0284c7, #0891b2)" }}>
            <div className="flex items-center gap-5 px-5 py-4">
              <div className="shrink-0"><p className="text-3xl font-bold text-white leading-none">-{sym}{saving}</p></div>
              <div className="h-8 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
              <div className="flex-1"><p className="text-sm text-white/80">vs booking sites</p><div className="flex items-center gap-4 mt-1">{otas.map(o => <span key={o.name} className="text-xs text-white/35">{o.name} <span className="line-through">{sym}{o.rate}</span></span>)}</div></div>
              <div className="px-4 py-2 rounded-lg shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}><p className="text-[10px] text-white/60">Your price</p><p className="text-lg font-bold text-white">{sym}{direct}<span className="text-xs font-normal">/nt</span></p></div>
            </div>
          </div>
        </Sec>

        {/* 15: Split — saving left, rates right */}
        <Sec n={15} title="Split Two-Tone">
          <div className="rounded-lg overflow-hidden flex" style={{ border: "1px solid #e0e0e0" }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "#059669" }}>
              <ArrowDown className="w-5 h-5 text-white" />
              <div><p className="text-xl font-bold text-white leading-none">{sym}{saving}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">saved</p></div>
            </div>
            <div className="flex-1 bg-white px-5 py-4 flex items-center gap-5">
              {otas.map(o => <div key={o.name}><p className="text-[10px] text-gray-400">{o.name}</p><p className="text-sm text-gray-400 line-through">{sym}{o.rate}</p></div>)}
              <div className="ml-auto"><p className="text-[10px] text-gray-400">Direct</p><p className="text-sm font-bold" style={{ color: "#059669" }}>{sym}{direct}/nt</p></div>
            </div>
          </div>
        </Sec>

      </main>
    </>
  );
}
