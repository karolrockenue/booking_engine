"use client";

import { useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import type { PorticoTokens } from "../tokens";

interface Props {
  t: PorticoTokens;
  arrival: Date | null;
  departure: Date | null;
  onSelect: (next: { arrival: Date | null; departure: Date | null }) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PorticoCalendar({ t, arrival, departure, onSelect }: Props) {
  const today = startOfToday();
  const [cursor, setCursor] = useState<Date>(() =>
    arrival ? startOfMonth(arrival) : startOfMonth(today)
  );

  const monthDays = buildMonthGrid(cursor);

  function handleDayClick(day: Date) {
    if (isBefore(day, today)) return;
    if (!arrival || (arrival && departure)) {
      onSelect({ arrival: day, departure: null });
      return;
    }
    if (!isBefore(arrival, day)) {
      onSelect({ arrival: day, departure: null });
      return;
    }
    onSelect({ arrival, departure: day });
  }

  const instruction =
    !arrival
      ? "Tap a date to set arrival"
      : !departure
        ? "Tap a second date to set departure"
        : "Tap any date to start over";

  return (
    <div style={{ fontFamily: "var(--portico-sans)" }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: t.inkSoft,
          marginBottom: 14,
        }}
      >
        {instruction}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <NavBtn
          t={t}
          onClick={() => setCursor(addMonths(cursor, -1))}
          disabled={isSameMonth(cursor, today) || isBefore(cursor, today)}
          label="Previous month"
        >
          ‹
        </NavBtn>
        <div
          style={{
            fontFamily: "var(--portico-serif)",
            fontSize: 26,
            letterSpacing: "-0.005em",
          }}
        >
          {format(cursor, "MMMM yyyy")}
        </div>
        <NavBtn t={t} onClick={() => setCursor(addMonths(cursor, 1))} label="Next month">
          ›
        </NavBtn>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: `1px solid ${t.rule}`,
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: t.inkSoft,
              textAlign: "center",
              padding: "6px 0",
              fontWeight: 500,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 2 }}>
        {monthDays.map((day, i) => {
          if (!day) return <div key={i} style={{ padding: "16px 0" }} />;
          const past = isBefore(day, today);
          const isArrival = arrival ? isSameDay(day, arrival) : false;
          const isDeparture = departure ? isSameDay(day, departure) : false;
          const inRange =
            arrival && departure && !isArrival && !isDeparture && day > arrival && day < departure;
          const isEdge = isArrival || isDeparture;

          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => handleDayClick(day)}
              data-edge={isEdge ? "true" : undefined}
              data-range={inRange ? "true" : undefined}
              data-past={past ? "true" : undefined}
              className="portico-cal-day"
              style={
                {
                  padding: "14px 0",
                  textAlign: "center",
                  fontFamily: "var(--portico-sans)",
                  fontSize: 17,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: isEdge ? 600 : 500,
                  background: isEdge ? t.accent : inRange ? t.accentSoft : "transparent",
                  color: isEdge ? t.accentInk : past ? t.inkSoft : t.ink,
                  opacity: past ? 0.3 : 1,
                  cursor: past ? "not-allowed" : "pointer",
                  border: "none",
                  transition: "background 120ms ease",
                  // Custom CSS variables consumed by the hover style below
                  ["--hover-bg" as string]: t.accentSoft,
                } as React.CSSProperties
              }
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <style>{`
        .portico-cal-day:not([data-past='true']):not([data-edge='true']):not([data-range='true']):hover {
          background: var(--hover-bg);
        }
        .portico-cal-day:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: -3px;
        }
      `}</style>
    </div>
  );
}

function NavBtn({
  t,
  onClick,
  disabled,
  children,
  label,
}: {
  t: PorticoTokens;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        background: "transparent",
        border: `1px solid ${disabled ? t.rule : t.ink}`,
        color: disabled ? t.inkSoft : t.ink,
        fontSize: 18,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function buildMonthGrid(month: Date): Array<Date | null> {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const gridStart = startOfWeek(start, { weekStartsOn: 1 });
  const cells: Array<Date | null> = [];

  let cur = gridStart;
  while (cur < start) {
    cells.push(null);
    cur = new Date(cur.getTime() + 24 * 3600 * 1000);
  }
  cur = start;
  while (cur <= end) {
    cells.push(new Date(cur));
    cur = new Date(cur.getTime() + 24 * 3600 * 1000);
  }
  return cells;
}
