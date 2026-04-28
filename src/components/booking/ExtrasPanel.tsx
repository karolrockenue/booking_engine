"use client";

export interface Extra {
  id: string;
  name: string;
  description: string;
  price: number;
  priceType: "per_stay" | "per_night";
}

export const AVAILABLE_EXTRAS: Extra[] = [
  { id: "early-checkin", name: "Early Check-in", description: "Guaranteed from 12:00 noon", price: 25, priceType: "per_stay" },
  { id: "late-checkout", name: "Late Check-out", description: "Stay until 14:00", price: 25, priceType: "per_stay" },
  { id: "parking", name: "Parking", description: "Secure on-site parking", price: 15, priceType: "per_night" },
  { id: "champagne", name: "Champagne on Arrival", description: "Bottle of Moët in your room", price: 45, priceType: "per_stay" },
  { id: "airport-transfer", name: "Airport Transfer", description: "Private car from Heathrow", price: 60, priceType: "per_stay" },
  { id: "spa-credit", name: "Spa Credit", description: "£50 towards any treatment", price: 50, priceType: "per_stay" },
];

interface ExtrasPanelProps {
  selectedExtras: Set<string>;
  onToggle: (extraId: string) => void;
  nights: number;
  currency: string;
  totalPrice?: number;
  onContinue?: () => void;
}

export function ExtrasPanel({
  selectedExtras,
  onToggle,
  nights,
  currency,
}: ExtrasPanelProps) {
  const symbol =
    currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";

  return (
    <div>
      <div
        className="px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <p className="text-sm font-medium text-white">Enhance your stay</p>
        <p className="text-[11px] text-white/40">Optional</p>
      </div>

      <div>
        {AVAILABLE_EXTRAS.map((extra, i) => {
          const selected = selectedExtras.has(extra.id);
          const extraTotal =
            extra.priceType === "per_night"
              ? extra.price * nights
              : extra.price;

          return (
            <button
              key={extra.id}
              onClick={() => onToggle(extra.id)}
              className="w-full text-left flex items-center gap-4 px-6 py-3.5 transition-colors"
              style={{
                borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
                backgroundColor: selected ? "#f7f9fb" : "transparent",
                cursor: "pointer",
                border: "none",
                borderBottom: i < AVAILABLE_EXTRAS.length - 1 ? "1px solid #f0f0f0" : "none",
              }}
            >
              {/* Toggle */}
              <div
                className="w-[34px] h-[18px] rounded-full shrink-0 relative transition-colors"
                style={{
                  backgroundColor: selected ? "var(--color-primary)" : "#d4d4d4",
                }}
              >
                <div
                  className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm"
                  style={{ left: selected ? "18px" : "2px" }}
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  {extra.name}
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  {extra.description}
                </p>
              </div>

              {/* Price */}
              <p className="text-[13px] font-medium shrink-0" style={{ color: "var(--color-text)" }}>
                +{symbol}{extraTotal}
                {extra.priceType === "per_night" && (
                  <span className="text-[10px] font-normal ml-1" style={{ color: "var(--color-text-muted)" }}>
                    ({symbol}{extra.price}/nt)
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
