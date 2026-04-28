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
  Users,
  Tag,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useTheme } from "@/components/layout/ThemeProvider";

interface BookingBarProps {
  onSearch?: (
    checkIn: string,
    checkOut: string,
    adults: number,
    children: number,
    rooms: number
  ) => void;
  datePickerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function BookingBar({ onSearch, datePickerRef }: BookingBarProps) {
  const theme = useTheme();
  const primaryColor = theme.colors.primary;

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [promoValue, setPromoValue] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  function handleSearch() {
    if (!dateRange?.from || !dateRange?.to) return;
    onSearch?.(
      dateRange.from.toISOString().split("T")[0],
      dateRange.to.toISOString().split("T")[0],
      adults,
      children,
      rooms
    );
  }

  const today = new Date();

  function lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  const rangeMiddleBg = lightenColor(primaryColor, 0.55);

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: ".75rem",
    letterSpacing: ".03125rem",
    color: primaryColor,
  };

  return (
    <div
      ref={barRef}
      className="w-full rounded-xl bg-white"
      style={{
        boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200/60">
        {/* Date Range Picker */}
        <div className="md:col-span-3 p-5 relative">
          <Popover.Root
            open={isDatePickerOpen}
            onOpenChange={setIsDatePickerOpen}
          >
            <Popover.Trigger asChild>
              <button
                ref={datePickerRef}
                className="w-full text-left focus:outline-none flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <CalendarIcon className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Check-in / Check-out</p>
                  <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "EEE dd MMM")} – ${format(dateRange.to, "EEE dd MMM")}`
                      : (() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const dayAfter = new Date();
                          dayAfter.setDate(dayAfter.getDate() + 2);
                          return `${format(tomorrow, "EEE dd MMM")} – ${format(dayAfter, "EEE dd MMM")}`;
                        })()}
                  </p>
                </div>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="bottom"
                avoidCollisions
                sideOffset={4}
                alignOffset={-20}
                className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-3 sm:p-5 max-w-[calc(100vw-32px)]"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                      setTimeout(() => setIsDatePickerOpen(false), 300);
                    }
                  }}
                  numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
                  disabled={{ before: today }}
                  style={{
                    "--rdp-accent-color": primaryColor,
                    "--rdp-accent-background-color": rangeMiddleBg,
                  } as React.CSSProperties}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Guests & Rooms */}
        <div className="md:col-span-3 p-5 relative">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="w-full text-left focus:outline-none flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <Users className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-400 mb-0.5">Guests & Rooms</p>
                  <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                    {adults} Adult{adults !== 1 ? "s" : ""} · {children} {children !== 1 ? "Children" : "Child"} · {rooms} Room{rooms !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="bottom"
                sideOffset={12}
                className="z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-6 w-80"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <GuestRow label="Adults" sub="Ages 13+" value={adults} min={1} onChange={setAdults} accent={primaryColor} />
                <GuestRow label="Children" sub="Ages 0-12" value={children} min={0} onChange={setChildren} accent={primaryColor} className="mt-6" />
                <GuestRow label="Rooms" value={rooms} min={1} onChange={setRooms} accent={primaryColor} className="mt-6" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Promo Code */}
        <div className="md:col-span-3 p-5 relative">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <Tag className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 mb-0.5">Promo Code</p>
              <input
                type="text"
                value={promoValue}
                onChange={(e) => setPromoValue(e.target.value)}
                placeholder="Optional"
                className="text-sm font-medium bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full"
                style={{ color: promoValue ? "#1a1a1a" : "#bbb" }}
              />
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div className="md:col-span-3 p-4 flex items-center">
          <button
            onClick={handleSearch}
            disabled={!dateRange?.from || !dateRange?.to}
            className="w-full h-12 text-white uppercase tracking-[0.15em] rounded-lg transition-all disabled:opacity-40"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: ".8rem",
              backgroundColor: primaryColor,
              cursor: !dateRange?.from || !dateRange?.to ? "not-allowed" : "pointer",
              boxShadow: !dateRange?.from || !dateRange?.to ? "none" : `0 4px 14px ${primaryColor}40`,
            }}
          >
            Check Availability
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestRow({ label, sub, value, min, onChange, accent, className }: {
  label: string; sub?: string; value: number; min: number;
  onChange: (n: number) => void; accent: string; className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <div>
        <div className="uppercase mb-0.5" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".75rem", letterSpacing: ".03125rem", color: "#1a1a1a" }}>{label}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-colors"
          style={{ cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-colors"
          style={{ cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
