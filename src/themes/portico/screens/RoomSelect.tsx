"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  useAvailability,
  useBookingDraft,
  useExtras,
  usePersistedDraft,
} from "@/lib/booking";
import { supportingNoteFor } from "@/lib/booking/rate-plan-notes";
import type { AvailabilityResult } from "@/lib/booking";
import type { PropertyPhotos } from "@/lib/get-property";
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { Btn, Pill } from "../components/primitives";
import { PorticoStickyBar } from "../components/StickyBar";
import { RoomGallery } from "../components/RoomGallery";

interface Props {
  t: PorticoTokens;
  property: ResolvedProperty;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  photos?: PropertyPhotos;
}

// Six photos per room block — same pool of Portico photography, rotated so
// each room block leads with a different hero shot. Until each room type has
// its own dedicated gallery, this gives each block visual variety while
// keeping the brand cohesive.
const ROOM_GALLERY_SETS: string[][] = [
  [
    porticoImg.roomDouble,
    porticoImg.bookSidePane,
    porticoImg.heroAlt,
    porticoImg.drawingRoom,
    porticoImg.extrasSidePane,
    porticoImg.roomTwin,
  ],
  [
    porticoImg.roomTwin,
    porticoImg.bookSidePane,
    porticoImg.drawingRoom,
    porticoImg.heroAlt,
    porticoImg.extrasSidePane,
    porticoImg.roomTriple,
  ],
  [
    porticoImg.roomTriple,
    porticoImg.heroAlt,
    porticoImg.drawingRoom,
    porticoImg.bookSidePane,
    porticoImg.extrasSidePane,
    porticoImg.roomDouble,
  ],
];

export function PorticoRoomSelect({ t, property, checkIn, checkOut, adults, children, photos }: Props) {
  const router = useRouter();
  const currency = property.currency ?? "GBP";

  const { results, loading, error } = useAvailability({
    propertyId: property.id,
    checkIn,
    checkOut,
    adults,
  });
  const { extras } = useExtras(property.id);
  const { draft, selectRoom, clearRoom, toggleExtra } = useBookingDraft(extras);
  usePersistedDraft({ propertyId: property.id, checkIn, checkOut, adults, children }, draft);

  const [sort, setSort] = useState<"low" | "high">("low");

  // Group by room type, then sort by lowest price within each group.
  const grouped = useMemo(() => groupByRoom(results, sort), [results, sort]);

  function handleSelect(result: AvailabilityResult) {
    selectRoom(result);
    // Stay so user can review the choice in the sticky bar before stepping
    // forward. They click "Choose extras" in the bar to advance.
  }

  function handleContinue() {
    // Defer one tick so the persistence effect has flushed before we navigate.
    setTimeout(() => router.push(`/${property.slug}/extras`), 0);
  }

  const dateRange = useMemo(() => {
    try {
      return `${format(parseISO(checkIn), "EEE d MMM")} → ${format(parseISO(checkOut), "EEE d MMM yyyy")}`;
    } catch {
      return `${checkIn} → ${checkOut}`;
    }
  }, [checkIn, checkOut]);

  return (
    <PorticoShell t={t}>
      <BookingNav t={t} step={1} />

      <header
        style={{
          padding: "32px 48px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 32,
          flexWrap: "wrap",
        }}
        className="portico-roomselect-header"
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: t.inkSoft,
              marginBottom: 10,
              fontFamily: "var(--portico-sans)",
            }}
          >
            Step 02 ·{" "}
            {loading
              ? "Checking availability"
              : grouped.length === 0
              ? "No rooms for these dates"
              : `${grouped.length} ${grouped.length === 1 ? "room" : "rooms"} available`}
          </div>
          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 40,
              letterSpacing: "-0.01em",
              lineHeight: 1,
              margin: 0,
              fontWeight: 400,
            }}
          >
            Choose your <span style={{ fontStyle: "italic", color: t.accent }}>room</span>.
          </h1>
          <div
            style={{
              fontSize: 12,
              color: t.inkSoft,
              marginTop: 12,
              fontFamily: "var(--portico-sans)",
            }}
          >
            {dateRange} · {adults} {adults === 1 ? "adult" : "adults"}
            {children > 0 ? ` · ${children} ${children === 1 ? "child" : "children"}` : ""}
            {" · "}
            <Link
              href={`/${property.slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
              style={{ color: t.accent, textDecoration: "none", borderBottom: `1px solid ${t.accent}` }}
            >
              Edit
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 22,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontFamily: "var(--portico-sans)",
          }}
        >
          <span style={{ color: t.inkSoft }}>Sort</span>
          <button
            type="button"
            onClick={() => setSort("low")}
            style={{
              background: "transparent",
              border: "none",
              color: sort === "low" ? t.ink : t.inkSoft,
              borderBottom: sort === "low" ? `1px solid ${t.ink}` : "none",
              paddingBottom: 2,
              cursor: "pointer",
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
              fontFamily: "inherit",
            }}
          >
            Lowest rate
          </button>
          <button
            type="button"
            onClick={() => setSort("high")}
            style={{
              background: "transparent",
              border: "none",
              color: sort === "high" ? t.ink : t.inkSoft,
              borderBottom: sort === "high" ? `1px solid ${t.ink}` : "none",
              paddingBottom: 2,
              cursor: "pointer",
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
              fontFamily: "inherit",
            }}
          >
            Highest rate
          </button>
        </div>
      </header>

      <main
        style={{
          padding: "0 48px 64px",
          flex: 1,
          // Reserve space for the sticky bar so its 100+px footprint doesn't cover content
          paddingBottom: draft.result ? 200 : 64,
        }}
        className="portico-roomselect-main"
      >
        {loading && <Loading t={t} />}
        {error && (
          <div
            style={{
              padding: "32px 0",
              fontSize: 13,
              color: t.inkSoft,
              borderTop: `1px solid ${t.rule}`,
            }}
          >
            We couldn’t load availability ({error.message}). Please refresh, or
            <Link href={`/${property.slug}/book`} style={{ color: t.accent, marginLeft: 6 }}>
              edit your dates
            </Link>
            .
          </div>
        )}

        {!loading && !error && grouped.length === 0 && (
          <div
            style={{
              padding: "32px 0",
              fontSize: 13,
              color: t.inkSoft,
              borderTop: `1px solid ${t.rule}`,
            }}
          >
            No rooms available for these dates. Try a different range.
          </div>
        )}

        {grouped.map((g, idx) => {
          const dbPhotos = photos?.byRoomType[g.roomTypeId];
          const gallery =
            dbPhotos && dbPhotos.length > 0
              ? dbPhotos.map((p) => p.urls.gallery)
              : ROOM_GALLERY_SETS[idx % ROOM_GALLERY_SETS.length];
          return (
            <RoomBlock
              key={g.roomTypeId}
              t={t}
              group={g}
              currency={currency}
              gallery={gallery}
              selectedKey={
                draft.result
                  ? `${draft.result.roomType.id}:${draft.result.ratePlan.id}`
                  : null
              }
              onSelect={handleSelect}
            />
          );
        })}

      </main>

      {draft.result && (
        <PorticoStickyBar
          t={t}
          result={draft.result}
          extras={extras}
          selectedExtras={draft.extras}
          guests={adults + children}
          extrasConfig={draft.extrasConfig}
          onRemoveExtra={toggleExtra}
          onContinue={handleContinue}
          onClear={clearRoom}
          currency={currency}
          continueLabel="Choose extras →"
        />
      )}
    </PorticoShell>
  );
}

function Loading({ t }: { t: PorticoTokens }) {
  return (
    <div
      style={{
        padding: "48px 0",
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: t.inkSoft,
        borderTop: `1px solid ${t.rule}`,
        fontFamily: "var(--portico-sans)",
      }}
    >
      Checking availability…
    </div>
  );
}

interface Group {
  roomTypeId: string;
  roomTypeName: string;
  description: string | null | undefined;
  maxOccupancy: number | null | undefined;
  results: AvailabilityResult[]; // sorted: cheapest first
  lowestNightly: number;
}

function groupByRoom(results: AvailabilityResult[], sort: "low" | "high"): Group[] {
  const map = new Map<string, Group>();
  for (const r of results) {
    const key = r.roomType.id;
    let g = map.get(key);
    if (!g) {
      g = {
        roomTypeId: key,
        roomTypeName: r.roomType.name,
        description: r.roomType.description,
        maxOccupancy: r.roomType.maxOccupancy,
        results: [],
        lowestNightly: Number.POSITIVE_INFINITY,
      };
      map.set(key, g);
    }
    g.results.push(r);
    const nightly = r.nights > 0 ? r.totalPrice / r.nights : r.totalPrice;
    if (nightly < g.lowestNightly) g.lowestNightly = nightly;
  }
  for (const g of map.values()) {
    g.results.sort((a, b) => a.totalPrice - b.totalPrice);
  }
  const list = Array.from(map.values());
  list.sort((a, b) => (sort === "low" ? a.lowestNightly - b.lowestNightly : b.lowestNightly - a.lowestNightly));
  return list;
}

function RoomBlock({
  t,
  group,
  currency,
  gallery,
  selectedKey,
  onSelect,
}: {
  t: PorticoTokens;
  group: Group;
  currency: string;
  gallery: string[];
  selectedKey: string | null;
  onSelect: (r: AvailabilityResult) => void;
}) {
  const fmt = useMemo(() => makeFormatter(currency), [currency]);
  const occupancy = group.maxOccupancy ? `Sleeps ${group.maxOccupancy}` : null;

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "460px 1fr",
        gap: 64,
        padding: "40px 0",
        borderTop: `1px solid ${t.rule}`,
        alignItems: "start",
      }}
      className="portico-roomblock"
    >
      <RoomGallery t={t} images={gallery} roomName={group.roomTypeName} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
        className="portico-roomblock-body"
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 36,
              lineHeight: 1,
              margin: "0 0 14px",
              fontWeight: 400,
            }}
          >
            {group.roomTypeName}
          </h2>
          {occupancy && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill t={t}>{occupancy}</Pill>
            </div>
          )}
        </div>

        <div>
          {group.results.map((r, i) => {
            const key = `${r.roomType.id}:${r.ratePlan.id}`;
            const isSelected = selectedKey === key;
            const nightly = r.nights > 0 ? r.totalPrice / r.nights : r.totalPrice;
            const last = i === group.results.length - 1;
            return (
              <div
                key={key}
                className="portico-rateplan-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 0",
                  borderBottom: last ? "none" : `1px solid ${t.rule}`,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                    {r.ratePlan.name}
                  </div>
                  <div style={{ fontSize: 11, color: t.inkSoft, lineHeight: 1.5 }}>
                    {supportingNoteFor(r.ratePlan.name, r.ratePlan.isRefundable)}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 64 }}>
                  <div style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", letterSpacing: "0.005em", fontWeight: 500 }}>
                    {fmt.format(nightly)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: t.inkSoft,
                    }}
                  >
                    / night · {r.nights}n total {fmt.format(r.totalPrice)}
                  </div>
                </div>
                <Btn
                  t={t}
                  primary={isSelected}
                  ghost={!isSelected}
                  onClick={() => onSelect(r)}
                  style={{ minWidth: 124, textAlign: "center" }}
                >
                  {isSelected ? "Selected" : "Select"}
                </Btn>
              </div>
            );
          })}

          <BestRateStrip t={t} group={group} fmt={fmt} />
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-roomblock {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 720px) {
          .portico-roomselect-header { padding: 24px 20px 16px !important; }
          .portico-roomselect-main { padding: 0 20px 200px !important; }
        }
        @media (max-width: 520px) {
          /* Stack the rate-plan row on tiny screens so the Select button has room */
          .portico-rateplan-row {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 8px 16px !important;
          }
          .portico-rateplan-row > button {
            grid-column: 1 / -1;
            justify-self: end;
          }
        }
      `}</style>
    </article>
  );
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
  }
}

// "Best rate guaranteed" strip beneath the rate-plan ladder. Mock OTA prices
// computed as a markup over the cheapest direct rate (typical OTA commission
// ~10–14%). When a real rate-shopping integration lands, swap the multipliers
// for live data without touching the layout.
const OTA_MARKUP: Array<{ name: string; markup: number }> = [
  { name: "Booking.com", markup: 1.12 },
  { name: "Expedia", markup: 1.09 },
  { name: "Hotels.com", markup: 1.1 },
];

function BestRateStrip({
  t,
  group,
  fmt,
}: {
  t: PorticoTokens;
  group: Group;
  fmt: Intl.NumberFormat;
}) {
  const direct = group.lowestNightly;
  if (!Number.isFinite(direct) || direct <= 0) return null;
  return (
    <div
      style={{
        marginTop: 18,
        padding: "12px 16px",
        background: "#f1ede2",
        border: `1px solid ${t.rule}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        fontFamily: "var(--portico-sans)",
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: t.accent,
          fontWeight: 500,
        }}
      >
        Best rate guaranteed — direct only
      </span>
      <span
        style={{
          display: "inline-flex",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: t.inkSoft,
        }}
      >
        {OTA_MARKUP.map(({ name, markup }) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ letterSpacing: "0.04em" }}>{name}</span>
            {fmt.format(Math.round(direct * markup))}
          </span>
        ))}
      </span>
    </div>
  );
}
