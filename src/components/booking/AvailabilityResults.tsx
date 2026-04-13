"use client";

interface NightlyRate {
  date: string;
  rate: number;
}

interface AvailabilityResult {
  roomType: {
    id: string;
    name: string;
    description?: string;
    maxOccupancy?: number;
    amenities?: unknown;
  };
  ratePlan: {
    id: string;
    name: string;
  };
  totalPrice: number;
  nightlyRates: NightlyRate[];
  nights: number;
}

interface AvailabilityResultsProps {
  results: AvailabilityResult[];
  currency?: string;
  onSelect: (result: AvailabilityResult) => void;
}

export function AvailabilityResults({
  results,
  currency = "GBP",
  onSelect,
}: AvailabilityResultsProps) {
  const symbol = currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";

  if (results.length === 0) {
    return (
      <div
        className="text-center py-12"
        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
      >
        <p className="text-lg mb-2">No rooms available for these dates.</p>
        <p className="text-sm">Try different dates or fewer guests.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {results.map((result) => (
        <div
          key={`${result.roomType.id}-${result.ratePlan.id}`}
          className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div className="flex-1">
            <h3
              className="text-lg mb-1"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                color: "var(--color-text)",
              }}
            >
              {result.roomType.name}
            </h3>
            <p
              className="text-sm mb-2"
              style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
            >
              {result.ratePlan.name}
            </p>
            {result.roomType.description && (
              <p
                className="text-sm line-clamp-2"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                  lineHeight: "var(--font-body-line-height)",
                }}
              >
                {result.roomType.description}
              </p>
            )}
            {result.roomType.maxOccupancy && (
              <p
                className="text-xs mt-2 uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Sleeps {result.roomType.maxOccupancy}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p
                className="text-2xl font-semibold"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-body)" }}
              >
                {symbol}{result.totalPrice.toFixed(2)}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {result.nights} night{result.nights !== 1 ? "s" : ""} &middot;{" "}
                {symbol}{(result.totalPrice / result.nights).toFixed(2)}/night
              </p>
            </div>
            <button
              onClick={() => onSelect(result)}
              className="px-6 py-2 text-sm uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "600",
                borderRadius: "var(--radius-button)",
                backgroundColor: "var(--color-secondary)",
                color: "#FFFFFF",
                border: "none",
                cursor: "pointer",
              }}
            >
              Select
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { AvailabilityResult, NightlyRate };
