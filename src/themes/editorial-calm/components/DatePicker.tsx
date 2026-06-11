"use client";

import { useState } from "react";
import type { EditorialCalmTokens } from "../tokens";

// Editorial Calm calendar — the mockup's fluid month grid wired to real
// dates. Two months side by side, range selection, past dates disabled.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromIsoDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function fmtShort(d: Date): string {
  return `${d.getDate()} ${MON3[d.getMonth()]}`;
}

export function nightsBetween(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getTime() === b.getTime();
}

function Month({
  t,
  year,
  month,
  start,
  end,
  minDate,
  onPick,
}: {
  t: EditorialCalmTokens;
  year: number;
  month: number;
  start: Date | null;
  end: Date | null;
  minDate: Date;
  onPick: (d: Date) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--ec-mono)",
              fontSize: 9,
              textAlign: "center",
              color: t.ink50,
              paddingBottom: 6,
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dt = new Date(year, month, d);
          const disabled = dt < minDate;
          const edge = sameDay(dt, start) || sameDay(dt, end);
          const inRange = !!start && !!end && dt > start && dt < end;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onPick(dt)}
              style={{
                cursor: disabled ? "default" : "pointer",
                border: "none",
                height: 36,
                borderRadius: 9,
                fontFamily: "var(--ec-sans)",
                fontSize: 13,
                background: edge ? t.ink : inRange ? t.line : "transparent",
                color: disabled ? t.line2 : edge ? t.paper : t.ink,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({
  t,
  checkIn,
  checkOut,
  onChange,
}: {
  t: EditorialCalmTokens;
  checkIn: Date | null;
  checkOut: Date | null;
  onChange: (checkIn: Date | null, checkOut: Date | null) => void;
}) {
  const today = startOfToday();
  const initial = checkIn ?? today;
  const [view, setView] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  function pick(dt: Date) {
    if (!checkIn || (checkIn && checkOut)) onChange(dt, null);
    else if (dt < checkIn) onChange(dt, null);
    else if (sameDay(dt, checkIn)) {
      /* noop */
    } else onChange(checkIn, dt);
  }

  const next = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  const canGoBack = view > new Date(today.getFullYear(), today.getMonth(), 1);

  const arrowStyle = (enabled: boolean) =>
    ({
      width: 30,
      height: 30,
      borderRadius: 30,
      fontSize: 15,
      cursor: enabled ? "pointer" : "default",
      background: "transparent",
      border: "none",
      boxShadow: `inset 0 0 0 1px ${t.line2}`,
      color: enabled ? t.ink : t.line2,
    }) as const;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -4, left: 0, right: 0, display: "flex", justifyContent: "space-between", zIndex: 1 }}>
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          style={arrowStyle(canGoBack)}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          style={arrowStyle(true)}
        >
          ›
        </button>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: "0 42px" }} className="ec-datepicker-months">
        <Month t={t} year={view.getFullYear()} month={view.getMonth()} start={checkIn} end={checkOut} minDate={today} onPick={pick} />
        <div className="ec-datepicker-month2" style={{ flex: 1, minWidth: 0 }}>
          <Month t={t} year={next.getFullYear()} month={next.getMonth()} start={checkIn} end={checkOut} minDate={today} onPick={pick} />
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .ec-datepicker-month2 { display: none !important; }
          .ec-datepicker-months { padding: 0 38px !important; }
        }
      `}</style>
    </div>
  );
}
