"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  CheckCircle2,
  XCircle,
  Coffee,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flame,
} from "lucide-react";

import type { AvailabilityResult, NightlyRate } from "@/lib/booking";
export type { AvailabilityResult, NightlyRate };

interface AvailabilityResultsProps {
  results: AvailabilityResult[];
  currency?: string;
  onSelect: (result: AvailabilityResult) => void;
  /** ID of the currently selected rate plan (highlights it + dims others) */
  selectedRatePlanId?: string;
  /** Content to render below the selected rate plan row (e.g. extras panel) */
  selectedSlot?: React.ReactNode;
  /** Called when user wants to change their rate plan selection */
  onClearSelection?: () => void;
}

// Sample room images — will come from DB/R2 later
const ROOM_IMAGES: Record<string, string[]> = {
  "Classic Double": [
    "/hotel/classic-double-1.jpg",
    "/hotel/classic-double-2.jpg",
  ],
  "Deluxe Suite": [
    "/hotel/deluxe-suite-1.jpg",
    "/hotel/deluxe-suite-2.jpg",
  ],
  "Superior Twin": [
    "/hotel/superior-twin-1.jpg",
    "/hotel/superior-twin-2.jpg",
  ],
};

// Richer fallback descriptions when DB description is short
const ROOM_DESCRIPTIONS: Record<string, string> = {
  "Classic Double":
    "A beautifully appointed room featuring a king-size bed with premium Egyptian cotton linen, an elegant en-suite bathroom with walk-in rain shower, and peaceful views over the private garden. Includes complimentary high-speed Wi-Fi, in-room safe, minibar, and Nespresso machine.",
  "Deluxe Suite":
    "Our most spacious accommodation with a separate living area, bedroom with super-king bed, and a luxurious marble bathroom with freestanding soaking tub. The private balcony offers panoramic views across the London skyline. Includes evening turndown service, premium minibar, and Dyson hairdryer.",
  "Superior Twin":
    "A light-filled corner room with two generous single beds, perfect for friends or colleagues. Features a modern en-suite with power shower, a dedicated workspace with ergonomic chair, and views over the quiet courtyard. Includes complimentary newspaper, high-speed Wi-Fi, and tea & coffee facilities.",
};

const FALLBACK_IMAGE = "/hotel/classic-double-1.jpg";

/** Group flat results by room type */
function groupByRoom(results: AvailabilityResult[]) {
  const map = new Map<
    string,
    { room: AvailabilityResult["roomType"]; rates: AvailabilityResult[] }
  >();
  for (const r of results) {
    if (!map.has(r.roomType.id)) {
      map.set(r.roomType.id, { room: r.roomType, rates: [] });
    }
    map.get(r.roomType.id)!.rates.push(r);
  }
  return Array.from(map.values());
}

/** Infer cancellation policy from rate plan name */
function isFlexible(name: string) {
  const lower = name.toLowerCase();
  return lower.includes("flex") && !lower.includes("non");
}

/** Infer breakfast from rate plan name */
function hasBreakfast(name: string) {
  const lower = name.toLowerCase();
  return lower.includes("breakfast") || lower.includes("bb");
}

function RoomImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
      <Image
        src={images[idx]}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 360px"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((idx - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx((idx + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_VISIBLE = 2;

function RatePlanList({
  rates,
  symbol,
  selectedRatePlanId,
  roomHasSelection,
  onSelect,
  onClearSelection,
  selectedSlot,
}: {
  rates: AvailabilityResult[];
  symbol: string;
  selectedRatePlanId?: string;
  roomHasSelection: boolean;
  onSelect: (result: AvailabilityResult) => void;
  onClearSelection?: () => void;
  selectedSlot?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  // Sort by price ascending
  const sorted = [...rates].sort((a, b) => a.totalPrice - b.totalPrice);
  const hiddenCount = sorted.length - DEFAULT_VISIBLE;

  // Determine which rates to show
  let visible: AvailabilityResult[];
  if (roomHasSelection) {
    // Only show the selected one
    visible = sorted.filter((r) => r.ratePlan.id === selectedRatePlanId);
  } else if (expanded || sorted.length <= DEFAULT_VISIBLE) {
    visible = sorted;
  } else {
    visible = sorted.slice(0, DEFAULT_VISIBLE);
  }

  return (
    <div>
      {visible.map((result, i) => {
        const flexible = isFlexible(result.ratePlan.name);
        const breakfast = hasBreakfast(result.ratePlan.name);
        const perNight = result.totalPrice / result.nights;
        const isSelected = result.ratePlan.id === selectedRatePlanId;

        return (
          <div key={result.ratePlan.id}>
            <div
              className="py-3 transition-colors"
              style={{
                borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
                backgroundColor: isSelected ? "#f0f4f8" : undefined,
                marginLeft: isSelected ? "-20px" : undefined,
                marginRight: isSelected ? "-20px" : undefined,
                paddingLeft: isSelected ? "20px" : undefined,
                paddingRight: isSelected ? "20px" : undefined,
                borderRadius: isSelected ? "6px" : undefined,
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text)",
                    }}
                  >
                    {result.ratePlan.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {breakfast ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                        <Coffee className="w-3 h-3" />
                        Breakfast
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                        Room only
                      </span>
                    )}
                    {flexible ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Free cancellation
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Non-refundable
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right shrink-0">
                    <p
                      className="text-lg font-bold"
                      style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
                    >
                      {symbol}{result.totalPrice.toFixed(0)}
                    </p>
                    <p className="text-[10px]" style={{ color: "#999" }}>
                      {symbol}{perNight.toFixed(0)}/nt
                    </p>
                  </div>
                  {isSelected ? (
                    <span
                      className="px-5 py-2.5 text-xs uppercase tracking-wider inline-flex items-center gap-1.5 rounded shrink-0"
                      style={{ fontWeight: 600, color: "#059669", backgroundColor: "#ecfdf5" }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelect(result)}
                      className="px-6 py-2.5 text-xs uppercase tracking-[0.15em] font-medium transition-colors shrink-0"
                      style={{
                        color: "var(--color-primary)",
                        border: "1px solid var(--color-primary)",
                        borderRadius: "2px",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Reserve
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Extras slot */}
            {isSelected && selectedSlot && (
              <div
                className="mt-3 mb-3 rounded-lg overflow-hidden"
                style={{
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                {selectedSlot}
              </div>
            )}

            {/* View all rates */}
            {isSelected && (
              <button
                onClick={() => onClearSelection?.()}
                className="mb-2 w-full py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  color: "var(--color-primary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
                View all rate plans for this room
              </button>
            )}
          </div>
        );
      })}

      {/* Show more / less toggle */}
      {!roomHasSelection && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 text-xs transition-colors"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            color: "var(--color-primary)",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show fewer rates
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show {hiddenCount} more rate{hiddenCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function AvailabilityResults({
  results,
  currency = "GBP",
  onSelect,
  selectedRatePlanId,
  selectedSlot,
  onClearSelection,
}: AvailabilityResultsProps) {
  const symbol =
    currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";
  const grouped = groupByRoom(results);
  const hasSelection = !!selectedRatePlanId;

  if (results.length === 0) {
    return (
      <div
        className="text-center py-16"
        style={{
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-body)",
        }}
      >
        <p className="text-lg mb-2">No rooms available for these dates.</p>
        <p className="text-sm">Try different dates or fewer guests.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(({ room, rates }) => {
        const images = ROOM_IMAGES[room.name] ?? [FALLBACK_IMAGE];
        const lowestPerNight = Math.min(
          ...rates.map((r) => r.totalPrice / r.nights)
        );

        const roomHasSelection = rates.some(
          (r) => r.ratePlan.id === selectedRatePlanId
        );
        const isDimmed = hasSelection && !roomHasSelection;

        // Urgency tag
        const urgencyTag = room.name === "Deluxe Suite"
          ? { label: "Only 2 left", color: "#dc2626" }
          : room.name === "Classic Double"
            ? { label: "Most popular", color: "#2563eb" }
            : null;

        return (
          <div
            key={room.id}
            className="rounded-md overflow-hidden transition-opacity"
            style={{
              border: roomHasSelection
                ? "2px solid var(--color-primary)"
                : "1px solid var(--color-border)",
              opacity: isDimmed ? 0.45 : 1,
              pointerEvents: isDimmed ? "none" : "auto",
            }}
          >
            {/* Dark header band */}
            <div
              className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <div className="flex items-center gap-3">
                <h3
                  className="text-base sm:text-lg font-semibold text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {room.name}
                </h3>
                {urgencyTag && (
                  <span
                    className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
                  >
                    {urgencyTag.label}
                  </span>
                )}
              </div>
              <span className="text-xs text-white/50" style={{ fontFamily: "var(--font-body)" }}>
                {room.maxOccupancy && `Sleeps ${room.maxOccupancy}`} · En-suite
              </span>
            </div>

            {/* Image + description + rates */}
            <div className="bg-white flex flex-col md:flex-row">
              {/* Image */}
              <div className="md:w-[320px] shrink-0">
                <RoomImageCarousel images={images} />
              </div>

              {/* Description + rate rows */}
              <div className="flex-1 p-5">
                <p
                  className="text-sm mb-5 line-clamp-3"
                  style={{
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-body)",
                    lineHeight: "1.7",
                  }}
                >
                  {ROOM_DESCRIPTIONS[room.name] || room.description || ""}
                </p>

                {/* Rate plans */}
                <RatePlanList
                  rates={rates}
                  symbol={symbol}
                  selectedRatePlanId={selectedRatePlanId}
                  roomHasSelection={roomHasSelection}
                  onSelect={onSelect}
                  onClearSelection={onClearSelection}
                  selectedSlot={selectedSlot}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
