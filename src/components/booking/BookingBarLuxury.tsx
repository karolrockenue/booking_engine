"use client";

import { useState, useRef } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Minus,
  Plus,
  ChevronDown,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

/** Dark luxury variant — near-black background, gold accents */
export function BookingBarLuxury() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [promoValue, setPromoValue] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const gold = "#D4AF37";
  const dark = "#1a1a1a";

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: ".75rem",
    letterSpacing: ".03125rem",
    color: gold,
  };

  const valueStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 300,
    fontSize: ".75rem",
    letterSpacing: ".03125rem",
    color: "rgba(255,255,255,0.7)",
  };

  return (
    <div
      ref={barRef}
      className="w-full rounded-lg shadow-2xl"
      style={{
        backgroundColor: "rgba(26,26,26,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: `2px solid ${gold}`,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/10">
        {/* Dates */}
        <div className="md:col-span-3 p-5">
          <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <Popover.Trigger asChild>
              <button className="w-full text-left focus:outline-none border-b-2 border-white/10 pb-4 hover:border-[#D4AF37] transition-all">
                <div className="uppercase mb-5" style={labelStyle}>Select Dates</div>
                <div className="flex items-center gap-2">
                  <span className="uppercase" style={valueStyle}>
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "EEE dd MMM")} - ${format(dateRange.to, "EEE dd MMM")}`
                      : "Check-in \u2014 Check-out"}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-white/30 ml-auto" />
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DayPicker mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} disabled={{ before: new Date() }} style={{ "--rdp-accent-color": dark, "--rdp-accent-background-color": "#f0ebe0" } as React.CSSProperties} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Guests */}
        <div className="md:col-span-3 p-5">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="w-full text-left focus:outline-none border-b-2 border-white/10 pb-4 hover:border-[#D4AF37] transition-all h-full flex items-end">
                <div className="w-full">
                  <div className="uppercase mb-5" style={labelStyle}>Guests & Rooms</div>
                  <div className="flex items-center justify-between">
                    <span className="uppercase" style={valueStyle}>
                      {adults} Adult{adults !== 1 ? "s" : ""} &middot; {children} {children !== 1 ? "Children" : "Child"} &middot; {rooms} Room{rooms !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  </div>
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-6 w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
                <GuestRow label="Adults" sub="Ages 13+" value={adults} min={1} onChange={setAdults} accent={dark} />
                <GuestRow label="Children" sub="Ages 0-12" value={children} min={0} onChange={setChildren} accent={dark} className="mt-6" />
                <GuestRow label="Rooms" value={rooms} min={1} onChange={setRooms} accent={dark} className="mt-6" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Promo */}
        <div className="md:col-span-3 p-5">
          <label className="block uppercase mb-5 pointer-events-none" style={labelStyle}>Promo Code</label>
          <input
            type="text" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} placeholder="Enter code"
            className="w-full border-0 border-b-2 border-white/10 rounded-none px-0 pb-4 focus:ring-0 focus:outline-none focus:border-[#D4AF37] uppercase transition-all bg-transparent"
            style={valueStyle}
          />
        </div>

        {/* Button */}
        <div className="md:col-span-3 p-5 flex items-end">
          <button className="w-full h-12 uppercase tracking-wider rounded transition-colors" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".875rem", backgroundColor: gold, color: dark, cursor: "pointer" }}>
            Check Availability
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestRow({ label, sub, value, min, onChange, accent, className }: { label: string; sub?: string; value: number; min: number; onChange: (n: number) => void; accent: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <div>
        <div className="uppercase mb-0.5" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".75rem", letterSpacing: ".03125rem", color: "#1a1a1a" }}>{label}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-colors" style={{ cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}>
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-colors" style={{ cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
