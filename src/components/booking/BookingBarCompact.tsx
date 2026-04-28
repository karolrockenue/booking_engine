"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Minus, Plus } from "lucide-react";

/** Compact single-row variant — minimal labels, tighter spacing */
export function BookingBarCompact() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <div className="w-full bg-white rounded-full shadow-lg px-2 py-2">
      <div className="flex items-center gap-0">
        {/* Dates */}
        <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <Popover.Trigger asChild>
            <button className="flex-1 flex items-center gap-2 px-5 py-3 rounded-full hover:bg-gray-50 transition-colors text-left">
              <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm" style={{ fontFamily: "var(--font-body)", color: "#1a1a1a" }}>
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "dd MMM")} – ${format(dateRange.to, "dd MMM")}`
                  : "Add dates"}
              </span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DayPicker mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} disabled={{ before: new Date() }} style={{ "--rdp-accent-color": "#1a1a1a", "--rdp-accent-background-color": "#f3f4f6" } as React.CSSProperties} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <div className="w-px h-6 bg-gray-200" />

        {/* Guests */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-2 px-5 py-3 rounded-full hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm" style={{ fontFamily: "var(--font-body)", color: "#1a1a1a" }}>
                {adults + children} guest{adults + children !== 1 ? "s" : ""}, {rooms} room{rooms !== 1 ? "s" : ""}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" side="bottom" sideOffset={12} className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-6 w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
              <CompactGuestRow label="Adults" sub="Ages 13+" value={adults} min={1} onChange={setAdults} />
              <CompactGuestRow label="Children" sub="Ages 0-12" value={children} min={0} onChange={setChildren} className="mt-5" />
              <CompactGuestRow label="Rooms" value={rooms} min={1} onChange={setRooms} className="mt-5" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Search */}
        <button className="ml-auto px-7 py-3 rounded-full text-sm text-white transition-colors shrink-0" style={{ fontFamily: "var(--font-body)", fontWeight: 600, backgroundColor: "#1a1a1a", cursor: "pointer" }}>
          Search
        </button>
      </div>
    </div>
  );
}

function CompactGuestRow({ label, sub, value, min, onChange, className }: { label: string; sub?: string; value: number; min: number; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <div>
        <div className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{label}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 transition-colors" style={{ cursor: "pointer" }}>
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-sm">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 transition-colors" style={{ cursor: "pointer" }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
