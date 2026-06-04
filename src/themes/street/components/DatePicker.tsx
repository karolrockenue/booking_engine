"use client";

import { useEffect, useMemo, useState } from "react";
import type { StreetTokens } from "../tokens";

// Two-month range picker. Click first = check-in. Click second = check-out.
// Hovering between the two clicks shows a range preview. Clicking before the
// current check-in resets the range. Stays open until Apply (or onClose).

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export function DatePicker({
  t,
  checkIn,
  checkOut,
  onChange,
  onClose,
}: {
  t: StreetTokens;
  checkIn: Date | null;
  checkOut: Date | null;
  onChange: (checkIn: Date | null, checkOut: Date | null) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [leftMonth, setLeftMonth] = useState(() =>
    startOfMonth(checkIn ?? today)
  );
  const [hover, setHover] = useState<Date | null>(null);

  // Stop scroll-jacking the page when the user clicks Apply quickly.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rightMonth = addMonths(leftMonth, 1);
  const canGoBack = !isSameMonth(leftMonth, today);

  function handleClick(date: Date) {
    if (date < today) return;
    // No check-in yet → set it.
    if (!checkIn || (checkIn && checkOut)) {
      onChange(date, null);
      return;
    }
    // Check-in set, choosing check-out.
    if (date.getTime() === checkIn.getTime()) {
      // Same day twice → treat as a 1-night stay (check-out next day) to nudge.
      onChange(checkIn, addDays(checkIn, 1));
      return;
    }
    if (date < checkIn) {
      // Earlier than check-in → reset range, new check-in.
      onChange(date, null);
      return;
    }
    onChange(checkIn, date);
  }

  const summary = useMemo(() => {
    if (!checkIn) return "Choose your dates";
    if (!checkOut) return "Now choose your check-out date";
    const n = nightsBetween(checkIn, checkOut);
    return `${n} night${n === 1 ? "" : "s"} · ${formatRangeShort(checkIn, checkOut)}`;
  }, [checkIn, checkOut]);

  const ariaLive = checkIn && checkOut ? "polite" : "off";

  return (
    <div
      style={{
        position: "relative",
        background: t.bg,
        border: `1px solid ${t.rule}`,
        boxShadow: "0 18px 48px -16px rgba(15, 23, 42, 0.18)",
        padding: "22px 32px 24px",
        maxWidth: 720,
        fontFamily: "var(--street-sans)",
      }}
      onMouseLeave={() => setHover(null)}
      className="street-datepicker"
    >
      {/* arrow above */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -6,
          left: 28,
          width: 12,
          height: 12,
          background: t.bg,
          borderTop: `1px solid ${t.rule}`,
          borderLeft: `1px solid ${t.rule}`,
          transform: "rotate(45deg)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 14,
          borderBottom: `1px solid ${t.ruleSoft}`,
          marginBottom: 22,
        }}
      >
        <div
          aria-live={ariaLive}
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 17,
            letterSpacing: "-0.005em",
            color: t.ink,
          }}
        >
          {!checkIn ? (
            <span>
              <em style={{ fontStyle: "italic", color: t.accent }}>Choose</em>{" "}
              your dates
            </span>
          ) : !checkOut ? (
            <span>
              <em style={{ fontStyle: "italic", color: t.accent }}>Choose</em>{" "}
              your check-out date
            </span>
          ) : (
            <span>
              <em style={{ fontStyle: "italic", color: t.accent }}>
                {nightsBetween(checkIn, checkOut)}
              </em>{" "}
              night{nightsBetween(checkIn, checkOut) === 1 ? "" : "s"} ·{" "}
              {formatRangeShort(checkIn, checkOut)}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.inkMuted,
          }}
        >
          {checkIn && checkOut
            ? "Click any date to change"
            : checkIn
              ? "Or click a new check-in"
              : ""}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 36,
        }}
        className="street-datepicker-months"
      >
        <Month
          t={t}
          monthDate={leftMonth}
          today={today}
          checkIn={checkIn}
          checkOut={checkOut}
          hover={hover}
          onHover={setHover}
          onClick={handleClick}
          showArrows={{ left: canGoBack, right: false }}
          onArrow={(dir) => setLeftMonth(addMonths(leftMonth, dir))}
        />
        <Month
          t={t}
          monthDate={rightMonth}
          today={today}
          checkIn={checkIn}
          checkOut={checkOut}
          hover={hover}
          onHover={setHover}
          onClick={handleClick}
          showArrows={{ left: false, right: true }}
          onArrow={(dir) => setLeftMonth(addMonths(leftMonth, dir))}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 18,
          borderTop: `1px solid ${t.ruleSoft}`,
          marginTop: 18,
        }}
      >
        <div
          style={{
            fontFamily: "var(--street-serif)",
            fontStyle: "italic",
            fontSize: 12.5,
            color: t.inkSoft,
          }}
        >
          {summary}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            style={ghostBtnStyle(t)}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={!checkIn || !checkOut}
            style={{
              ...inkBtnStyle(t),
              opacity: !checkIn || !checkOut ? 0.45 : 1,
              cursor: !checkIn || !checkOut ? "not-allowed" : "pointer",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .street-datepicker { padding: 18px 18px 20px !important; }
          .street-datepicker-months { grid-template-columns: 1fr !important; gap: 18px !important; }
        }
      `}</style>
    </div>
  );
}

function Month({
  t,
  monthDate,
  today,
  checkIn,
  checkOut,
  hover,
  onHover,
  onClick,
  showArrows,
  onArrow,
}: {
  t: StreetTokens;
  monthDate: Date;
  today: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  hover: Date | null;
  onHover: (d: Date | null) => void;
  onClick: (d: Date) => void;
  showArrows: { left: boolean; right: boolean };
  onArrow: (dir: -1 | 1) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const cells = monthCells(year, month);

  // Effective range (if user has only set check-in, hovering previews the range).
  const rangeStart = checkIn;
  const rangeEnd = checkOut ?? (checkIn && hover && hover > checkIn ? hover : null);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 4px 16px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 20,
            letterSpacing: "-0.005em",
            color: t.ink,
          }}
        >
          {MONTH_NAMES[month]} {year}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {showArrows.left && (
            <button type="button" aria-label="Previous month" onClick={() => onArrow(-1)} style={arrowStyle(t)}>
              ‹
            </button>
          )}
          {showArrows.right && (
            <button type="button" aria-label="Next month" onClick={() => onArrow(1)} style={arrowStyle(t)}>
              ›
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: t.inkMuted,
          textAlign: "center",
          padding: "4px 0 10px",
          fontWeight: 500,
        }}
      >
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} />;
          const { date, inMonth } = cell;
          const isPast = date < today;
          const isCheckIn = checkIn && isSameDay(date, checkIn);
          const isCheckOut = checkOut && isSameDay(date, checkOut);
          const isInRange =
            rangeStart &&
            rangeEnd &&
            date > rangeStart &&
            date < rangeEnd;
          const isToday = isSameDay(date, today);

          const isSelected = isCheckIn || isCheckOut;
          const muted = isPast || !inMonth;

          return (
            <button
              key={i}
              type="button"
              onClick={() => !muted && onClick(date)}
              onMouseEnter={() => !muted && onHover(date)}
              disabled={muted}
              aria-label={date.toDateString()}
              aria-pressed={isSelected || undefined}
              style={{
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--street-serif)",
                fontSize: 14.5,
                fontFeatureSettings: '"tnum"',
                cursor: muted ? "not-allowed" : "pointer",
                background: isSelected
                  ? t.ink
                  : isInRange
                    ? t.bg2
                    : "transparent",
                color: isSelected ? t.bg : muted ? t.inkMuted : t.ink,
                opacity: muted && !isSelected ? 0.45 : 1,
                border: 0,
                borderRadius: isSelected ? "50%" : isInRange ? 0 : "50%",
                boxShadow: !isSelected && isToday ? `inset 0 0 0 1px ${t.ink}` : "none",
                fontWeight: isSelected ? 500 : 400,
                padding: 0,
                transition: "background 80ms ease",
              }}
              onMouseOver={(e) => {
                if (!isSelected && !isInRange && !muted) {
                  e.currentTarget.style.background = t.bg2;
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected && !isInRange && !muted) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── style helpers ───────────────────────────────────────────────────

function arrowStyle(t: StreetTokens) {
  return {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${t.rule}`,
    background: "transparent",
    cursor: "pointer",
    color: t.ink,
    fontFamily: "inherit",
    fontSize: 18,
  } as const;
}

function ghostBtnStyle(t: StreetTokens) {
  return {
    background: "transparent",
    color: t.inkSoft,
    border: 0,
    padding: "10px 16px",
    fontSize: 10.5,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "var(--street-sans)",
    fontWeight: 500,
  } as const;
}

function inkBtnStyle(t: StreetTokens) {
  return {
    background: t.ink,
    color: t.bg,
    border: 0,
    padding: "11px 22px",
    fontSize: 10.5,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "var(--street-sans)",
    fontWeight: 500,
  } as const;
}

// ─── date helpers ────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function nightsBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

// Build a 6-row grid of cells for the month, Monday-first. Pads with prev/next
// month dates so the grid is always rectangular.
function monthCells(
  year: number,
  month: number
): Array<{ date: Date; inMonth: boolean } | null> {
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay: 0=Sun..6=Sat. We want Monday=0..Sunday=6.
  const jsDow = firstOfMonth.getDay();
  const monStart = (jsDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  // Prev-month padding
  for (let i = monStart; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  // Pad trailing to fill full weeks (multiples of 7).
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: addDays(last, 1), inMonth: false });
  }
  return cells;
}

export function formatDayChip(d: Date): string {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${dow} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

function formatRangeShort(a: Date, b: Date): string {
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const aMon = MONTH_NAMES[a.getMonth()].slice(0, 3);
  const bMon = MONTH_NAMES[b.getMonth()].slice(0, 3);
  if (sameMonth) return `${a.getDate()} — ${b.getDate()} ${aMon}`;
  return `${a.getDate()} ${aMon} — ${b.getDate()} ${bMon}`;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function fromIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
