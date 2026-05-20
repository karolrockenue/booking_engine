"use client";

import { format, parseISO } from "date-fns";
import { extraLineTotal } from "@/lib/booking";
import type { Extra, ExtraConfig } from "@/lib/booking";
import type { PorticoTokens } from "../tokens";

// A per_guest_per_night extra (breakfast). Smart default: one tap adds it for
// every guest, every morning. "Customise" reveals a guest stepper + per-morning
// toggles for the few who want fewer people or specific mornings. Controlled —
// the Extras screen owns selected/config/open state.
interface Props {
  t: PorticoTokens;
  extra: Extra;
  headcount: number; // adults + children
  nights: number;
  mornings: string[]; // all stay mornings, YYYY-MM-DD
  currency: string;
  selected: boolean;
  config?: ExtraConfig; // present once customised
  open: boolean; // customise panel open
  last: boolean;
  onSelectAll: () => void;
  onRemove: () => void;
  onToggleCustomise: () => void;
  onSetGuests: (guests: number) => void;
  onToggleMorning: (date: string) => void;
}

export function BreakfastPicker({
  t,
  extra,
  headcount,
  nights,
  mornings,
  currency,
  selected,
  config,
  open,
  last,
  onSelectAll,
  onRemove,
  onToggleCustomise,
  onSetGuests,
  onToggleMorning,
}: Props) {
  const fmt = makeFormatter(currency);
  const unit = extra.priceMinorUnits / 100;
  const guests = config?.guests ?? headcount;
  const chosen = config?.mornings ?? mornings;
  const chosenSet = new Set(chosen);
  const lineTotal = selected
    ? extraLineTotal(unit, "per_guest_per_night", nights, headcount, config)
    : 0;

  const summary = `${guests} ${guests === 1 ? "guest" : "guests"} · ${chosen.length} ${chosen.length === 1 ? "morning" : "mornings"}`;

  return (
    <div
      style={{
        padding: "20px 0",
        borderBottom: last ? "none" : `1px solid ${t.rule}`,
        fontFamily: "var(--portico-sans)",
        color: t.ink,
      }}
    >
      {/* Header row — checkbox toggles the smart default (all guests, all mornings) */}
      <button
        type="button"
        onClick={selected ? onRemove : onSelectAll}
        aria-pressed={selected}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 24,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: t.ink,
          textAlign: "left",
          padding: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            background: selected ? t.accent : "transparent",
            border: `1.5px solid ${selected ? t.accent : t.inkSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accentInk} strokeWidth="3" strokeLinecap="square">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{extra.name}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: t.inkSoft }}>
            {extra.description ? `${extra.description} · ` : ""}
            {fmt.format(unit)} / guest / morning
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", color: selected ? t.accent : t.ink, fontWeight: 500 }}>
            {selected ? fmt.format(lineTotal) : fmt.format(unit)}
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: t.inkSoft, marginTop: 2 }}>
            {selected ? "Added" : "Add"}
          </div>
        </div>
      </button>

      {/* Summary + Customise toggle (only once added) */}
      {selected && (
        <div
          style={{
            marginTop: 12,
            marginLeft: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: t.inkSoft }}>
            {chosen.length === 0 ? "No mornings selected" : `For ${summary}`}
          </span>
          <button
            type="button"
            onClick={onToggleCustomise}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: t.accent,
              borderBottom: `1px solid ${t.accent}`,
              paddingBottom: 2,
              fontFamily: "inherit",
            }}
          >
            {open ? "Done" : "Customise"}
          </button>
        </div>
      )}

      {/* Customise editor */}
      {selected && open && (
        <div style={{ marginTop: 16, marginLeft: 48, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Guests stepper */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: t.inkSoft }}>
              Guests having breakfast
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Step t={t} disabled={guests <= 1} onClick={() => onSetGuests(Math.max(1, guests - 1))}>−</Step>
              <span style={{ fontFamily: "var(--portico-serif)", fontSize: 19, fontVariantNumeric: "tabular-nums", minWidth: 18, textAlign: "center" }}>
                {guests}
              </span>
              <Step t={t} disabled={guests >= headcount} onClick={() => onSetGuests(Math.min(headcount, guests + 1))}>+</Step>
            </div>
          </div>

          {/* Morning toggles */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: t.inkSoft, marginBottom: 10 }}>
              Mornings
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mornings.map((d) => {
                const on = chosenSet.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onToggleMorning(d)}
                    aria-pressed={on}
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      background: on ? t.accent : "transparent",
                      color: on ? t.accentInk : t.inkSoft,
                      border: `1px solid ${on ? t.accent : t.rule}`,
                    }}
                  >
                    {safeFmt(d)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  t,
  onClick,
  disabled,
  children,
}: {
  t: PorticoTokens;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26,
        height: 26,
        background: "transparent",
        color: disabled ? t.inkSoft : t.ink,
        border: `1px solid ${disabled ? t.rule : t.ink}`,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--portico-sans)",
        fontSize: 14,
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function safeFmt(d: string): string {
  try {
    return format(parseISO(d), "EEE d MMM");
  } catch {
    return d;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
