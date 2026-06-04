"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StreetTokens } from "../tokens";
import {
  DatePicker,
  formatDayChip,
  toIsoDate,
  nightsBetween,
} from "./DatePicker";

type Panel = null | "dates" | "adults" | "children";

interface SearchBarProps {
  t: StreetTokens;
  slug: string;
  initialCheckIn?: Date | null;
  initialCheckOut?: Date | null;
  initialAdults?: number;
  initialChildren?: number;
  // Where the Find rooms button routes. Defaults to /<slug>/rooms.
  rooms?: string;
}

export function StreetSearchBar({
  t,
  slug,
  initialCheckIn = null,
  initialCheckOut = null,
  initialAdults = 2,
  initialChildren = 0,
}: SearchBarProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<Date | null>(initialCheckIn);
  const [checkOut, setCheckOut] = useState<Date | null>(initialCheckOut);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close any open panel on outside click.
  useEffect(() => {
    if (!panel) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPanel(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [panel]);

  const datesValue =
    checkIn && checkOut
      ? `${formatDayChip(checkIn)} — ${formatDayChip(checkOut)}`
      : checkIn
        ? `${formatDayChip(checkIn)} — ?`
        : "Choose dates";

  const datesSub =
    checkIn && checkOut
      ? `${nightsBetween(checkIn, checkOut)} night${nightsBetween(checkIn, checkOut) === 1 ? "" : "s"} · cancel free until 18:00`
      : "";

  const canSubmit = !!(checkIn && checkOut);

  function submit() {
    if (!canSubmit) {
      setPanel("dates");
      return;
    }
    const params = new URLSearchParams({
      checkIn: toIsoDate(checkIn!),
      checkOut: toIsoDate(checkOut!),
      adults: String(adults),
      children: String(children),
    });
    router.push(`/${slug}/rooms?${params.toString()}`);
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        maxWidth: 980,
        margin: "28px auto 0",
        padding: "0 40px",
      }}
      className="street-search-wrap"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 0.55fr 0.55fr auto",
          gap: 0,
          alignItems: "end",
        }}
        className="street-search-grid"
      >
        <FieldBtn
          t={t}
          label="Dates"
          value={datesValue}
          sub={datesSub}
          placeholder={!checkIn}
          active={panel === "dates"}
          onClick={() => setPanel(panel === "dates" ? null : "dates")}
        />
        <FieldBtn
          t={t}
          label="Adults"
          value={String(adults)}
          active={panel === "adults"}
          onClick={() => setPanel(panel === "adults" ? null : "adults")}
        />
        <FieldBtn
          t={t}
          label="Children"
          value={String(children)}
          active={panel === "children"}
          onClick={() => setPanel(panel === "children" ? null : "children")}
        />
        <button
          type="button"
          onClick={submit}
          style={{
            background: canSubmit ? t.ink : "transparent",
            color: canSubmit ? t.bg : t.ink,
            border: `1px solid ${t.ink}`,
            padding: "16px 28px",
            fontSize: 11.5,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "var(--street-sans)",
            minWidth: 160,
          }}
        >
          Find rooms
        </button>
      </div>

      {panel === "dates" && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 40,
            right: 40,
            marginTop: 16,
            zIndex: 50,
          }}
          className="street-search-popover-wrap"
        >
          <DatePicker
            t={t}
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={(ci, co) => {
              setCheckIn(ci);
              setCheckOut(co);
            }}
            onClose={() => setPanel(null)}
          />
        </div>
      )}

      {panel === "adults" && (
        <StepperPopover
          t={t}
          label="Adults"
          value={adults}
          min={1}
          max={6}
          left={210}
          onChange={setAdults}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "children" && (
        <StepperPopover
          t={t}
          label="Children"
          value={children}
          min={0}
          max={4}
          left={345}
          onChange={setChildren}
          onClose={() => setPanel(null)}
        />
      )}

      <style>{`
        @media (max-width: 760px) {
          .street-search-wrap { padding: 0 24px !important; }
          .street-search-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 18px !important;
          }
          .street-search-grid > button { grid-column: 1 / -1; }
          .street-search-popover-wrap { left: 24px !important; right: 24px !important; }
        }
      `}</style>
    </div>
  );
}

function FieldBtn({
  t,
  label,
  value,
  sub,
  placeholder,
  active,
  onClick,
}: {
  t: StreetTokens;
  label: string;
  value: string;
  sub?: string;
  placeholder?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        display: "block",
        textAlign: "left",
        padding: "10px 22px 12px 0",
        marginRight: 22,
        borderBottom: active ? `1.5px solid ${t.ink}` : `1px solid ${t.rule}`,
        cursor: "pointer",
        fontFamily: "var(--street-sans)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontWeight: 500,
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--street-serif)",
          fontSize: 19,
          letterSpacing: "-0.005em",
          color: placeholder ? t.inkMuted : t.ink,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--street-sans)",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: t.inkMuted,
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </button>
  );
}

function StepperPopover({
  t,
  label,
  value,
  min,
  max,
  left,
  onChange,
  onClose,
}: {
  t: StreetTokens;
  label: string;
  value: number;
  min: number;
  max: number;
  left: number;
  onChange: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left,
        marginTop: 16,
        zIndex: 50,
        background: t.bg,
        border: `1px solid ${t.rule}`,
        boxShadow: "0 18px 48px -16px rgba(15, 23, 42, 0.18)",
        padding: "18px 22px",
        minWidth: 240,
        fontFamily: "var(--street-sans)",
      }}
      className="street-search-stepper"
    >
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
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          style={stepBtnStyle(t, value <= min)}
        >
          −
        </button>
        <span
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 24,
            letterSpacing: "-0.005em",
            color: t.ink,
            fontFeatureSettings: '"tnum"',
            minWidth: 24,
            textAlign: "center",
          }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          style={stepBtnStyle(t, value >= max)}
        >
          +
        </button>
      </div>
      <style>{`
        @media (max-width: 760px) {
          .street-search-stepper { left: 24px !important; right: 24px !important; }
        }
      `}</style>
    </div>
  );
}

function stepBtnStyle(t: StreetTokens, disabled: boolean) {
  return {
    width: 36,
    height: 36,
    border: `1px solid ${t.ink}`,
    background: "transparent",
    color: t.ink,
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    fontFamily: "var(--street-sans)",
    fontWeight: 400,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  } as const;
}
