"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Minus, Plus, ChevronDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

/** Warm earthy variant — cream background, cognac accents */
export function BookingBarWarm() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [promoValue, setPromoValue] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const cognac = "#A0826D";
  const cognacDark = "#7A5C47";
  const cream = "#F5F1EB";

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: ".75rem",
    letterSpacing: ".03125rem",
    color: cognacDark,
  };

  const valueStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 300,
    fontSize: ".75rem",
    letterSpacing: ".03125rem",
    color: "#5a5a5a",
  };

  return (
    <div className="w-full rounded-lg shadow-lg" style={{ backgroundColor: cream }}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: "#D4C5A9" }}>
        {/* Dates */}
        <div className="md:col-span-3 p-6">
          <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <Popover.Trigger asChild>
              <button className="w-full text-left focus:outline-none pb-4 transition-all" style={{ borderBottom: `2px solid #D4C5A9` }} onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = cognac)} onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "#D4C5A9")}>
                <div className="uppercase mb-5" style={labelStyle}>Select Dates</div>
                <div className="flex items-center gap-2">
                  <span className="uppercase" style={valueStyle}>
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "EEE dd MMM")} - ${format(dateRange.to, "EEE dd MMM")}`
                      : "Check-in \u2014 Check-out"}
                  </span>
                  <CalendarIcon className="w-4 h-4 ml-auto" style={{ color: "#bba88f" }} />
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DayPicker mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} disabled={{ before: new Date() }} style={{ "--rdp-accent-color": cognac, "--rdp-accent-background-color": "#EDE7E1" } as React.CSSProperties} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Guests */}
        <div className="md:col-span-3 p-6">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="w-full text-left focus:outline-none pb-4 transition-all h-full flex items-end" style={{ borderBottom: `2px solid #D4C5A9` }} onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = cognac)} onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "#D4C5A9")}>
                <div className="w-full">
                  <div className="uppercase mb-5" style={labelStyle}>Guests & Rooms</div>
                  <div className="flex items-center justify-between">
                    <span className="uppercase" style={valueStyle}>
                      {adults} Adult{adults !== 1 ? "s" : ""} &middot; {children} {children !== 1 ? "Children" : "Child"} &middot; {rooms} Room{rooms !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown className="w-4 h-4" style={{ color: "#bba88f" }} />
                  </div>
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-6 w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
                <WarmGuestRow label="Adults" sub="Ages 13+" value={adults} min={1} onChange={setAdults} accent={cognac} />
                <WarmGuestRow label="Children" sub="Ages 0-12" value={children} min={0} onChange={setChildren} accent={cognac} className="mt-6" />
                <WarmGuestRow label="Rooms" value={rooms} min={1} onChange={setRooms} accent={cognac} className="mt-6" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Promo */}
        <div className="md:col-span-3 p-6">
          <label className="block uppercase mb-5 pointer-events-none" style={labelStyle}>Promo Code</label>
          <input
            type="text" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} placeholder="Enter code"
            className="w-full border-0 rounded-none px-0 pb-4 focus:ring-0 focus:outline-none uppercase transition-all bg-transparent"
            style={{ ...valueStyle, borderBottom: `2px solid #D4C5A9` }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = cognac)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = "#D4C5A9")}
          />
        </div>

        {/* Button */}
        <div className="md:col-span-3 p-6 flex items-end">
          <button className="w-full h-12 uppercase tracking-wider rounded transition-colors" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".875rem", backgroundColor: cognac, color: "#fff", cursor: "pointer" }}>
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

function WarmGuestRow({ label, sub, value, min, onChange, accent, className }: { label: string; sub?: string; value: number; min: number; onChange: (n: number) => void; accent: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <div>
        <div className="uppercase mb-0.5" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".75rem", letterSpacing: ".03125rem", color: "#5a4a3a" }}>{label}</div>
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
