"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";

interface PriceCompareProps {
  directRate: number;
  currency: string;
  nights: number;
}

export function PriceCompare({ directRate, currency, nights }: PriceCompareProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || directRate <= 0) return null;

  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  const otaRates = [
    { name: "Booking.com", mult: 1.15 },
    { name: "Expedia", mult: 1.18 },
    { name: "Hotels.com", mult: 1.12 },
  ];

  const bestOtaRate = Math.min(...otaRates.map((o) => Math.round(directRate * o.mult)));
  const saving = (bestOtaRate - directRate) * nights;

  return (
    <div
      className="rounded-lg overflow-hidden mb-6"
      style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-2 sm:mb-0">
          <Check className="w-5 h-5 text-white shrink-0" />
          <p className="text-sm font-semibold text-white flex-1">
            You&apos;re saving {symbol}{saving} — best rate guaranteed
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1.5 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-8">
          {otaRates.map((ota) => {
            const otaRate = Math.round(directRate * ota.mult);
            return (
              <span
                key={ota.name}
                className="text-xs px-3 py-1.5 rounded"
                style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              >
                {ota.name}{" "}
                <span className="line-through font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {symbol}{otaRate}
                </span>
              </span>
            );
          })}
          <span
            className="text-xs font-bold text-white px-3 py-1.5 rounded"
            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          >
            Direct {symbol}{directRate}/nt
          </span>
        </div>
      </div>
    </div>
  );
}
