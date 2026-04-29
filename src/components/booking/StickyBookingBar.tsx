"use client";

import { X, ShoppingBag, ArrowRight } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { Extra } from "./ExtrasPanel";

interface StickyBookingBarProps {
  roomName: string;
  rateName: string;
  roomPrice: number;
  extras: Extra[];
  selectedExtras: Set<string>;
  nights: number;
  currency: string;
  onContinue: () => void;
  onClear: () => void;
  onRemoveExtra: (extraId: string) => void;
}

export function StickyBookingBar({
  roomName,
  rateName,
  roomPrice,
  extras,
  selectedExtras,
  nights,
  currency,
  onContinue,
  onRemoveExtra,
}: StickyBookingBarProps) {
  const theme = useTheme();
  const symbol =
    currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  const extraItems = extras.filter((e) => selectedExtras.has(e.id));
  const extrasTotal = extraItems.reduce(
    (sum, e) => sum + e.priceMinorUnits / 100,
    0
  );
  const total = roomPrice + extrasTotal;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: theme.colors.primary,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
      }}
    >
      <div
        className="mx-auto py-4 md:py-5"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{roomName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-white/50">{rateName}</span>
                {extraItems.map((extra) => {
                  const price = extra.priceMinorUnits / 100;
                  return (
                    <span
                      key={extra.id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
                    >
                      {extra.name} +{symbol}{price.toFixed(2)}
                      <button
                        onClick={() => onRemoveExtra(extra.id)}
                        className="ml-0.5 rounded-full flex items-center justify-center"
                        style={{
                          width: "14px",
                          height: "14px",
                          backgroundColor: "rgba(255,255,255,0.2)",
                          cursor: "pointer",
                          border: "none",
                          color: "#fff",
                        }}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-white leading-tight">
                {symbol}{total.toFixed(0)}
              </p>
              {extrasTotal > 0 ? (
                <p className="text-[11px] text-white/50 mt-0.5">
                  Room {symbol}{roomPrice.toFixed(0)} + Extras {symbol}{extrasTotal.toFixed(0)}
                </p>
              ) : (
                <p className="text-[11px] text-white/50 mt-0.5">
                  {nights} night{nights !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              onClick={onContinue}
              className="px-8 py-3.5 text-sm uppercase tracking-wider transition-colors rounded flex items-center gap-2"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                backgroundColor: "#fff",
                color: theme.colors.primary,
                border: "none",
                cursor: "pointer",
              }}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{roomName}</p>
              <p className="text-xs text-white/50 truncate">{rateName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-white leading-tight">
                {symbol}{total.toFixed(0)}
              </p>
              <p className="text-[10px] text-white/50">
                {nights} night{nights !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {extraItems.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {extraItems.map((extra) => {
                const price = extra.priceMinorUnits / 100;
                return (
                  <span
                    key={extra.id}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
                  >
                    {extra.name} +{symbol}{price.toFixed(2)}
                    <button
                      onClick={() => onRemoveExtra(extra.id)}
                      className="ml-0.5 rounded-full flex items-center justify-center"
                      style={{
                        width: "14px",
                        height: "14px",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        cursor: "pointer",
                        border: "none",
                        color: "#fff",
                      }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <button
            onClick={onContinue}
            className="w-full py-3 text-sm uppercase tracking-wider rounded flex items-center justify-center gap-2"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              backgroundColor: "#fff",
              color: theme.colors.primary,
              border: "none",
              cursor: "pointer",
            }}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
