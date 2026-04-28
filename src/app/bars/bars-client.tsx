"use client";

import { Calendar, ChevronDown } from "lucide-react";

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/bars", label: "Bars" },
  { href: "/rooms-mockup", label: "Room Cards" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Live" },
];

const dates = "Tue 15 Apr — Wed 16 Apr";
const guests = "2 Adults · 0 Children · 1 Room";
const navy = "#2C3E50";
const hotelName = "The Kensington Arms";
const address = "12 Kensington Court, London W8 5DL";
const tagline = "Boutique luxury in the heart of Kensington";

function HeroWrap({ n, title, d, overlay, children }: { n: number; title: string; d: string; overlay?: string; children: React.ReactNode }) {
  return (
    <section className="relative min-h-screen flex flex-col">
      <div className="absolute inset-0">
        <img src="/hero-room.jpg" alt="" className="w-full h-full object-cover" />
        <div className={`absolute inset-0 ${overlay ?? "bg-gradient-to-b from-black/75 via-black/60 to-black/85"}`} />
      </div>

      {/* Fake nav */}
      <div className="relative z-10">
        <div className="mx-auto flex items-center justify-between py-4" style={{ maxWidth: "1280px", paddingLeft: "24px", paddingRight: "24px" }}>
          <span className="text-xl text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: "0.05em" }}>{hotelName}</span>
          <div className="flex items-center gap-6">
            <span className="text-[10px] px-2 py-1 rounded text-white/50 border border-white/20">{n}. {title}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col justify-center px-4 pb-[100px]">
        <div className="text-center space-y-3 mb-10 md:mb-14">
          <h1 className="text-white text-5xl lg:text-7xl tracking-tight drop-shadow-2xl" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
            {hotelName}
          </h1>
          <div className="h-px w-24 bg-white/80 mx-auto" />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] pt-1" style={{ fontWeight: 300 }}>{address}</p>
          <p className="text-white text-sm uppercase tracking-widest drop-shadow-lg pt-1">{tagline}</p>
          <div className="pt-5 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              <span className="text-white/90 text-xs tracking-wide" style={{ fontWeight: 300 }}>Lower Rates Than Any Booking Site</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto">
          {children}
        </div>
      </div>

      {/* Variant label */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-center">
        <p className="text-white/30 text-[10px] uppercase tracking-widest">{d}</p>
      </div>
    </section>
  );
}

export function BarsClient() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 mr-3">DEV</span>
          {devLinks.map((l) => <a key={l.href} href={l.href} className="text-xs text-gray-300 hover:text-white transition-colors">{l.label}</a>)}
        </div>
      </nav>

      <main style={{ fontFamily: "'Inter', sans-serif", paddingTop: "40px" }}>

        {/* 1: Relaxed Values */}
        <HeroWrap n={1} title="Relaxed Values" d="Labels uppercase, values normal case. No underlines. Clean white bar">
          <div className="rounded-xl bg-white" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
            <div className="grid grid-cols-4 divide-x divide-gray-200/60">
              <div className="p-5"><p className="uppercase mb-3 text-[10px] tracking-widest" style={{ color: "#999", fontWeight: 500 }}>Dates</p><div className="flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: navy }} /><span className="text-sm" style={{ color: "#1a1a1a" }}>{dates}</span></div></div>
              <div className="p-5"><p className="uppercase mb-3 text-[10px] tracking-widest" style={{ color: "#999", fontWeight: 500 }}>Guests</p><div className="flex items-center justify-between"><span className="text-sm" style={{ color: "#1a1a1a" }}>{guests}</span><ChevronDown className="w-4 h-4 text-gray-400" /></div></div>
              <div className="p-5"><p className="uppercase mb-3 text-[10px] tracking-widest" style={{ color: "#999", fontWeight: 500 }}>Promo Code</p><span className="text-sm" style={{ color: "#bbb" }}>Enter code</span></div>
              <div className="p-5 flex items-center"><button className="w-full h-11 rounded text-white uppercase tracking-[0.15em] text-xs font-semibold" style={{ backgroundColor: navy }}>Check Availability</button></div>
            </div>
          </div>
        </HeroWrap>

        {/* 2: Top Accent */}
        <HeroWrap n={2} title="Top Accent" d="Thin navy line at the top. Subtle branding touch">
          <div className="rounded-xl overflow-hidden bg-white" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
            <div className="h-[3px]" style={{ backgroundColor: navy }} />
            <div className="grid grid-cols-4 divide-x divide-gray-200/60">
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest font-medium" style={{ color: navy }}>Select Dates</p><div className="flex items-center gap-2"><span className="text-sm" style={{ color: "#1a1a1a" }}>{dates}</span><Calendar className="w-4 h-4 text-gray-400 ml-auto" /></div></div>
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest font-medium" style={{ color: navy }}>Guests & Rooms</p><div className="flex items-center justify-between"><span className="text-sm" style={{ color: "#1a1a1a" }}>{guests}</span><ChevronDown className="w-4 h-4 text-gray-400" /></div></div>
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest font-medium" style={{ color: navy }}>Promo Code</p><span className="text-sm" style={{ color: "#bbb" }}>Enter code</span></div>
              <div className="p-5 flex items-end"><button className="w-full h-11 rounded text-white uppercase tracking-[0.15em] text-xs font-semibold" style={{ backgroundColor: navy }}>Check Availability</button></div>
            </div>
          </div>
        </HeroWrap>

        {/* 3: Icon-Led */}
        <HeroWrap n={3} title="Icon-Led" d="Icons in tinted squares replace text labels">
          <div className="rounded-xl bg-white" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
            <div className="grid grid-cols-4 divide-x divide-gray-200/60">
              <div className="p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${navy}10` }}><Calendar className="w-5 h-5" style={{ color: navy }} /></div><div><p className="text-[10px] text-gray-400 mb-0.5">Check-in / Check-out</p><p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{dates}</p></div></div>
              <div className="p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${navy}10` }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navy} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div className="flex-1"><p className="text-[10px] text-gray-400 mb-0.5">Guests & Rooms</p><p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{guests}</p></div><ChevronDown className="w-4 h-4 text-gray-300" /></div>
              <div className="p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${navy}10` }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navy} strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div><div><p className="text-[10px] text-gray-400 mb-0.5">Promo Code</p><p className="text-sm" style={{ color: "#bbb" }}>Optional</p></div></div>
              <div className="p-4 flex items-center"><button className="w-full h-12 rounded-lg text-white uppercase tracking-[0.15em] text-xs font-semibold" style={{ backgroundColor: navy }}>Check Availability</button></div>
            </div>
          </div>
        </HeroWrap>

        {/* 4: Outlined Fields */}
        <HeroWrap n={4} title="Outlined Fields" d="Each field has its own border box. No shared container">
          <div className="flex gap-3">
            <div className="flex-1 p-4 rounded-lg bg-white border border-gray-200"><p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Dates</p><div className="flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: navy }} /><span className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{dates}</span></div></div>
            <div className="flex-1 p-4 rounded-lg bg-white border border-gray-200"><p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Guests & Rooms</p><div className="flex items-center justify-between"><span className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{guests}</span><ChevronDown className="w-4 h-4 text-gray-400" /></div></div>
            <div className="flex-1 p-4 rounded-lg bg-white border border-gray-200"><p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Promo Code</p><span className="text-sm" style={{ color: "#bbb" }}>Enter code</span></div>
            <button className="px-8 rounded-lg text-white uppercase tracking-[0.15em] text-xs font-semibold shrink-0" style={{ backgroundColor: navy }}>Check Availability</button>
          </div>
        </HeroWrap>

        {/* 5: Dark Bar */}
        <HeroWrap n={5} title="Dark Bar" d="Navy background, white text. Matches dark header room cards">
          <div className="rounded-xl" style={{ backgroundColor: navy, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
            <div className="grid grid-cols-4 divide-x divide-white/10">
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Select Dates</p><div className="flex items-center gap-2"><span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{dates}</span><Calendar className="w-4 h-4 ml-auto" style={{ color: "rgba(255,255,255,0.3)" }} /></div></div>
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Guests & Rooms</p><div className="flex items-center justify-between"><span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{guests}</span><ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} /></div></div>
              <div className="p-5"><p className="uppercase mb-4 text-[10px] tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Promo Code</p><span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Enter code</span></div>
              <div className="p-4 flex items-center"><button className="w-full h-11 rounded text-sm uppercase tracking-[0.15em] font-semibold" style={{ backgroundColor: "#fff", color: navy }}>Check Availability</button></div>
            </div>
          </div>
        </HeroWrap>

        {/* 6: Floating Fields */}
        <HeroWrap n={6} title="Floating Fields" d="No container. Fields float on the hero with white underlines" overlay="bg-gradient-to-b from-black/85 via-black/80 to-black/90">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-4 gap-8">
              <div><p className="uppercase mb-3 text-[10px] tracking-widest text-white/40">Dates</p><div className="flex items-center gap-2 pb-3 border-b border-white/20"><span className="text-sm text-white">{dates}</span><Calendar className="w-4 h-4 text-white/30 ml-auto" /></div></div>
              <div><p className="uppercase mb-3 text-[10px] tracking-widest text-white/40">Guests & Rooms</p><div className="flex items-center justify-between pb-3 border-b border-white/20"><span className="text-sm text-white">{guests}</span><ChevronDown className="w-4 h-4 text-white/30" /></div></div>
              <div><p className="uppercase mb-3 text-[10px] tracking-widest text-white/40">Promo Code</p><div className="pb-3 border-b border-white/20"><span className="text-sm text-white/30">Enter code</span></div></div>
              <div className="flex items-end"><button className="w-full h-11 rounded text-sm uppercase tracking-[0.15em] font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors" style={{ backgroundColor: "transparent" }}>Check Availability</button></div>
            </div>
          </div>
        </HeroWrap>

      </main>
    </>
  );
}
