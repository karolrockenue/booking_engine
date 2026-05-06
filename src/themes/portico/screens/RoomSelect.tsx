"use client";

import Image from "next/image";
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
import type { AvailabilityResult } from "@/lib/booking";
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { Btn, Pill } from "../components/primitives";
import { PorticoStickyBar } from "../components/StickyBar";

interface Props {
  t: PorticoTokens;
  property: ResolvedProperty;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

const ROOM_FALLBACK_IMGS = [porticoImg.roomDouble, porticoImg.roomTwin, porticoImg.roomTriple];

export function PorticoRoomSelect({ t, property, checkIn, checkOut, adults, children }: Props) {
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
    setTimeout(() => router.push("/extras"), 0);
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
              href={`/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
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
            <Link href="/book" style={{ color: t.accent, marginLeft: 6 }}>
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

        {grouped.map((g, idx) => (
          <RoomBlock
            key={g.roomTypeId}
            t={t}
            group={g}
            currency={currency}
            img={ROOM_FALLBACK_IMGS[idx % ROOM_FALLBACK_IMGS.length]}
            selectedKey={
              draft.result
                ? `${draft.result.roomType.id}:${draft.result.ratePlan.id}`
                : null
            }
            onSelect={handleSelect}
          />
        ))}

      </main>

      {draft.result && (
        <PorticoStickyBar
          t={t}
          result={draft.result}
          extras={extras}
          selectedExtras={draft.extras}
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
  img,
  selectedKey,
  onSelect,
}: {
  t: PorticoTokens;
  group: Group;
  currency: string;
  img: string;
  selectedKey: string | null;
  onSelect: (r: AvailabilityResult) => void;
}) {
  const fmt = useMemo(() => makeFormatter(currency), [currency]);
  const occupancy = group.maxOccupancy ? `Up to ${group.maxOccupancy}` : null;

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 32,
        padding: "24px 0",
        borderTop: `1px solid ${t.rule}`,
      }}
      className="portico-roomblock"
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          overflow: "hidden",
        }}
      >
        <Image src={img} alt={group.roomTypeName} fill sizes="280px" style={{ objectFit: "cover" }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1.1fr",
          gap: 32,
        }}
        className="portico-roomblock-body"
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
              gap: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--portico-serif)",
                fontSize: 36,
                lineHeight: 1,
                margin: 0,
                fontWeight: 400,
              }}
            >
              {group.roomTypeName}
            </h2>
            <span
              style={{
                fontSize: 13,
                color: t.inkSoft,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              from {fmt.format(group.lowestNightly)}
            </span>
          </div>
          {group.description && (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: t.inkSoft,
                margin: "0 0 14px",
              }}
            >
              {group.description}
            </p>
          )}
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
                  padding: "12px 0",
                  borderBottom: last ? "none" : `1px solid ${t.rule}`,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{r.ratePlan.name}</div>
                  <div style={{ fontSize: 11, color: t.inkSoft, lineHeight: 1.5 }}>
                    {r.ratePlan.isRefundable ? "Free cancellation up to 48h before arrival" : "Non-refundable rate"}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 64 }}>
                  <div style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", letterSpacing: "0.005em" }}>
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
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-roomblock {
            grid-template-columns: 1fr !important;
          }
          .portico-roomblock-body {
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
