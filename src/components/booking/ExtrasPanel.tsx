"use client";

export interface Extra {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
}

interface ExtrasPanelProps {
  extras: Extra[];
  selectedExtras: Set<string>;
  onToggle: (extraId: string) => void;
  currency: string;
}

export function ExtrasPanel({
  extras,
  selectedExtras,
  onToggle,
  currency,
}: ExtrasPanelProps) {
  const symbol =
    currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  if (extras.length === 0) return null;

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
        {extras.map((extra, i) => {
          const selected = selectedExtras.has(extra.id);
          const price = extra.priceMinorUnits / 100;

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
                borderBottom: i < extras.length - 1 ? "1px solid #f0f0f0" : "none",
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
                {extra.description && (
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    {extra.description}
                  </p>
                )}
              </div>

              {/* Price */}
              <p className="text-[13px] font-medium shrink-0" style={{ color: "var(--color-text)" }}>
                +{symbol}{price.toFixed(2)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
