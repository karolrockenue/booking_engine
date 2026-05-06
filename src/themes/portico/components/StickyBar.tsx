"use client";

import type { Extra, AvailabilityResult } from "@/lib/booking";
import type { PorticoTokens } from "../tokens";

interface Props {
  t: PorticoTokens;
  result: AvailabilityResult;
  extras: Extra[];
  selectedExtras: Set<string>;
  onRemoveExtra: (extraId: string) => void;
  onContinue: () => void;
  onClear: () => void;
  currency: string;
  continueLabel?: string;
  clearLabel?: string;
}

export function PorticoStickyBar({
  t,
  result,
  extras,
  selectedExtras,
  onRemoveExtra,
  onContinue,
  onClear,
  currency,
  continueLabel = "Continue to checkout →",
  clearLabel = "Clear",
}: Props) {
  const fmt = makeFormatter(currency);
  const items = extras.filter((e) => selectedExtras.has(e.id));
  const extrasTotal = items.reduce((sum, e) => sum + e.priceMinorUnits / 100, 0);
  const total = result.totalPrice + extrasTotal;

  // The sticky bar is always cinematic-dark for both palettes — it punctuates
  // the page in the same way the checkout summary panel does on Ivory.
  const bg = t.summaryBg;
  const ink = t.summaryInk;
  const rule = t.summaryRule;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: bg,
        color: ink,
        borderTop: `1px solid ${rule}`,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
        fontFamily: "var(--portico-sans)",
      }}
    >
      <div
        style={{
          padding: "18px 48px",
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 32,
          alignItems: "center",
        }}
        className="portico-sticky-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            Your selection
          </div>
          <div
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 22,
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
            }}
          >
            {result.roomType.name}{" "}
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, fontStyle: "italic" }}>
              · {result.ratePlan.name}
            </span>
          </div>
          {items.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {items.map((extra) => {
                const price = extra.priceMinorUnits / 100;
                return (
                  <span
                    key={extra.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      padding: "5px 10px 5px 12px",
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {extra.name}
                    <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
                      +{fmt.format(price)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveExtra(extra.id);
                      }}
                      aria-label={`Remove ${extra.name}`}
                      style={{
                        marginLeft: 2,
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.85)",
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              opacity: 0.6,
              marginBottom: 4,
            }}
          >
            Total · {result.nights} {result.nights === 1 ? "night" : "nights"}
          </div>
          <div
            style={{
              fontSize: 28,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.005em",
              fontWeight: 500,
            }}
          >
            {fmt.format(total)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 0",
            }}
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: t.accent,
              color: t.accentInk,
              border: "none",
              padding: "16px 28px",
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            {continueLabel}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-sticky-grid {
            grid-template-columns: 1fr !important;
            padding: 16px 24px !important;
            gap: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
