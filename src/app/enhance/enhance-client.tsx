"use client";

import { useState } from "react";
import {
  Clock,
  Wine,
  Car,
  Sparkles,
  Plane,
  Coffee,
  Check,
  Plus,
} from "lucide-react";
import type { ComponentType } from "react";

const devLinks = [
  { href: "/", label: "Home" },
  { href: "/pickers", label: "Pickers" },
  { href: "/fonts", label: "Fonts" },
  { href: "/rates", label: "Rates" },
  { href: "/enhance", label: "Enhance" },
  { href: "/rooms?checkIn=2026-04-20&checkOut=2026-04-23&adults=2", label: "Rooms" },
];

interface Extra {
  id: string;
  name: string;
  desc: string;
  price: number;
  unit: string;
  Icon: ComponentType<{ className?: string }>;
}

const extras: Extra[] = [
  { id: "early", name: "Early Check-in", desc: "Guaranteed from 12:00 noon", price: 25, unit: "per stay", Icon: Clock },
  { id: "late", name: "Late Check-out", desc: "Stay until 14:00", price: 25, unit: "per stay", Icon: Clock },
  { id: "parking", name: "Secure Parking", desc: "On-site covered parking", price: 15, unit: "per night", Icon: Car },
  { id: "champagne", name: "Champagne on Arrival", desc: "Bottle of Moët in your room", price: 45, unit: "per stay", Icon: Wine },
  { id: "transfer", name: "Airport Transfer", desc: "Private car from Heathrow", price: 60, unit: "per stay", Icon: Plane },
  { id: "spa", name: "Spa Credit", desc: "£50 towards any treatment", price: 50, unit: "per stay", Icon: Sparkles },
];

export function EnhanceClient() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
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

      <main className="pt-16 pb-24 px-4 max-w-5xl mx-auto" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Enhance Your Stay — Concepts</h1>
        <p className="text-sm text-gray-500 mb-12">Different approaches to upsell extras after rate selection</p>

        {/* 1: Pill toggles */}
        <Concept num={1} title="Pill Toggles" desc="Horizontal scrollable pills. Lightest touch, least intrusive">
          <PillToggles />
        </Concept>

        {/* 2: Checkbox list */}
        <Concept num={2} title="Checkbox List" desc="Simple rows with checkboxes. Clean and scannable, familiar pattern">
          <CheckboxList />
        </Concept>

        {/* 3: Toggle cards — 2 col */}
        <Concept num={3} title="Toggle Cards (2-col)" desc="Current approach refined. Cards with icon, desc, price — click to toggle">
          <ToggleCards2Col />
        </Concept>

        {/* 4: Toggle cards — 3 col compact */}
        <Concept num={4} title="Compact Cards (3-col)" desc="Smaller cards, tighter grid. Icon-led with price below">
          <CompactCards3Col />
        </Concept>

        {/* 5: Inline add buttons */}
        <Concept num={5} title="Inline Add Buttons" desc="Row layout with + button on the right. Like adding items to a food delivery order">
          <InlineAddButtons />
        </Concept>

        {/* 6: Visual cards with images */}
        <Concept num={6} title="Visual Cards" desc="Larger cards with coloured icon backgrounds. More premium, hospitality feel">
          <VisualCards />
        </Concept>

        {/* 7: Accordion with categories */}
        <Concept num={7} title="Grouped Accordion" desc="Extras grouped by category (Arrival, In-Room, Experiences). Collapsible">
          <GroupedAccordion />
        </Concept>

        {/* 8: Horizontal scroll carousel */}
        <Concept num={8} title="Carousel" desc="Horizontal scrollable cards. Works well on mobile, feels browsable">
          <CarouselExtras />
        </Concept>
      </main>
    </>
  );
}

function Concept({ num, title, desc, children }: { num: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{num}</span>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{desc}</p>
      <div style={{ backgroundColor: "#f5f5f7", borderRadius: "8px", padding: "20px" }}>
        <div className="bg-white rounded-lg p-6" style={{ border: "1px solid #e8e8e8" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#1a1a1a" }}>Enhance your stay</p>
          <p className="text-[11px] text-gray-400 mb-5">Optional — skip and continue anytime</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── 1: Pill Toggles ─── */
function PillToggles() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-wrap gap-2">
      {extras.map((e) => {
        const on = selected.has(e.id);
        return (
          <button key={e.id} onClick={() => toggle(e.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition-all"
            style={{
              border: on ? "2px solid #2C3E50" : "1px solid #e0e0e0",
              backgroundColor: on ? "#f0f4f8" : "#fff",
              cursor: "pointer",
              fontWeight: on ? 600 : 400,
              color: on ? "#2C3E50" : "#555",
            }}>
            {on ? <Check className="w-3.5 h-3.5" /> : <span style={{ color: "#aaa", display: "flex" }}><e.Icon className="w-3.5 h-3.5" /></span>}
            {e.name}
            <span className="text-gray-400 font-normal">+£{e.price}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 2: Checkbox List ─── */
function CheckboxList() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col">
      {extras.map((e, i) => {
        const on = selected.has(e.id);
        return (
          <label key={e.id} onClick={() => toggle(e.id)}
            className="flex items-center gap-4 py-3.5 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
            style={{ borderBottom: i < extras.length - 1 ? "1px solid #f0f0f0" : "none" }}>
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
              style={{ borderColor: on ? "#2C3E50" : "#d1d5db", backgroundColor: on ? "#2C3E50" : "transparent" }}>
              {on && <Check className="w-3 h-3 text-white" />}
            </div>
            <span style={{ color: "#666", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{e.name}</p>
              <p className="text-[11px] text-gray-400">{e.desc}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>£{e.price}</p>
              <p className="text-[10px] text-gray-400">{e.unit}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ─── 3: Toggle Cards 2-col ─── */
function ToggleCards2Col() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="grid grid-cols-2 gap-3">
      {extras.map((e) => {
        const on = selected.has(e.id);
        return (
          <button key={e.id} onClick={() => toggle(e.id)} className="text-left p-4 rounded-lg transition-all"
            style={{ border: on ? "2px solid #2C3E50" : "1px solid #e8e8e8", backgroundColor: on ? "#f0f4f8" : "#fff", cursor: "pointer" }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: on ? "#2C3E50" : "#f5f5f5" }}>
                <span style={{ color: on ? "#fff" : "#888", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{e.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{e.desc}</p>
                <p className="text-sm font-semibold mt-2" style={{ color: "#1a1a1a" }}>£{e.price} <span className="text-[10px] font-normal text-gray-400">{e.unit}</span></p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 4: Compact Cards 3-col ─── */
function CompactCards3Col() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="grid grid-cols-3 gap-2">
      {extras.map((e) => {
        const on = selected.has(e.id);
        return (
          <button key={e.id} onClick={() => toggle(e.id)} className="text-center p-3 rounded-lg transition-all"
            style={{ border: on ? "2px solid #2C3E50" : "1px solid #e8e8e8", backgroundColor: on ? "#f0f4f8" : "#fff", cursor: "pointer" }}>
            <div className="mx-auto w-9 h-9 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: on ? "#2C3E50" : "#f5f5f5" }}>
              <span style={{ color: on ? "#fff" : "#888", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
            </div>
            <p className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>{e.name}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: "#2C3E50" }}>+£{e.price}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 5: Inline Add Buttons ─── */
function InlineAddButtons() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col">
      {extras.map((e, i) => {
        const on = selected.has(e.id);
        return (
          <div key={e.id} className="flex items-center gap-4 py-3"
            style={{ borderBottom: i < extras.length - 1 ? "1px solid #f0f0f0" : "none" }}>
            <div className="p-2 rounded-full" style={{ backgroundColor: "#f5f5f5" }}>
              <span style={{ color: "#888", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{e.name}</p>
              <p className="text-[11px] text-gray-400">{e.desc}</p>
            </div>
            <p className="text-sm font-semibold shrink-0 mr-3" style={{ color: "#1a1a1a" }}>£{e.price}</p>
            <button onClick={() => toggle(e.id)}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{
                backgroundColor: on ? "#2C3E50" : "transparent",
                border: on ? "none" : "2px solid #d1d5db",
                cursor: "pointer",
                color: on ? "#fff" : "#999",
              }}>
              {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 6: Visual Cards ─── */
function VisualCards() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const colors = ["#e8f0fe", "#fef3e2", "#e6f7ed", "#fce4ec", "#ede7f6", "#e0f2f1"];

  return (
    <div className="grid grid-cols-3 gap-3">
      {extras.map((e, idx) => {
        const on = selected.has(e.id);
        return (
          <button key={e.id} onClick={() => toggle(e.id)} className="text-left rounded-xl overflow-hidden transition-all"
            style={{ border: on ? "2px solid #2C3E50" : "1px solid #e8e8e8", cursor: "pointer", backgroundColor: "#fff" }}>
            <div className="h-20 flex items-center justify-center" style={{ backgroundColor: on ? "#2C3E50" : colors[idx] }}>
              <span style={{ color: on ? "#fff" : "#555", display: "flex" }}><e.Icon className="w-7 h-7" /></span>
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold mb-0.5" style={{ color: "#1a1a1a" }}>{e.name}</p>
              <p className="text-[10px] text-gray-400 mb-2">{e.desc}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: "#2C3E50" }}>£{e.price}</p>
                {on && <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5"><Check className="w-3 h-3" />Added</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 7: Grouped Accordion ─── */
function GroupedAccordion() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroup, setOpenGroup] = useState<string | null>("arrival");
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const groups = [
    { key: "arrival", label: "Arrival & Departure", items: extras.slice(0, 3) },
    { key: "experience", label: "Experiences & Treats", items: extras.slice(3) },
  ];

  return (
    <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: "1px solid #e8e8e8" }}>
      {groups.map((g, gi) => (
        <div key={g.key}>
          <button onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}
            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
            style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", background: "none", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#f0f0f0" }}>
            <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{g.label}</span>
            <span className="text-gray-400">{openGroup === g.key ? "−" : "+"}</span>
          </button>
          {openGroup === g.key && (
            <div className="px-4 pb-3">
              {g.items.map((e, i) => {
                const on = selected.has(e.id);
                return (
                  <label key={e.id} onClick={() => toggle(e.id)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                    style={{ borderBottom: i < g.items.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: on ? "#2C3E50" : "#d1d5db", backgroundColor: on ? "#2C3E50" : "transparent" }}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span style={{ color: "#888", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
                    <span className="flex-1 text-sm" style={{ color: "#1a1a1a" }}>{e.name}</span>
                    <span className="text-sm font-medium text-gray-500">£{e.price}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── 8: Carousel ─── */
function CarouselExtras() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
      {extras.map((e) => {
        const on = selected.has(e.id);
        return (
          <button key={e.id} onClick={() => toggle(e.id)}
            className="shrink-0 w-[160px] text-left p-4 rounded-xl transition-all"
            style={{ border: on ? "2px solid #2C3E50" : "1px solid #e8e8e8", backgroundColor: on ? "#f0f4f8" : "#fff", cursor: "pointer" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: on ? "#2C3E50" : "#f5f5f5" }}>
              <span style={{ color: on ? "#fff" : "#888", display: "flex" }}><e.Icon className="w-4 h-4" /></span>
            </div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#1a1a1a" }}>{e.name}</p>
            <p className="text-[10px] text-gray-400 mb-2 leading-tight">{e.desc}</p>
            <p className="text-sm font-bold" style={{ color: "#2C3E50" }}>+£{e.price}</p>
          </button>
        );
      })}
    </div>
  );
}
