"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  useAvailability,
  useBookingDraft,
  useExtras,
  usePersistedDraft,
} from "@/lib/booking";
import type { AvailabilityResult } from "@/lib/booking";
import type { PropertyPhotos, ResolvedProperty } from "@/lib/get-property";
import type { StreetTokens } from "../tokens";
import { streetImg, streetLayout } from "../tokens";
import { StreetShell } from "../StreetShell";
import { Nav } from "../components/Nav";
import { StreetSearchBar } from "../components/SearchBar";
import { fromIsoDate } from "../components/DatePicker";
import { Eyebrow, SerifH } from "../components/primitives";
import { renderEmphasis } from "../components/emphasis";

interface Props {
  t: StreetTokens;
  property: ResolvedProperty;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  photos?: PropertyPhotos;
}

export function StreetRoomSelect({
  t,
  property,
  checkIn,
  checkOut,
  adults,
  children,
  photos,
}: Props) {
  const router = useRouter();
  const currency = property.currency ?? "GBP";

  const { results, loading, error } = useAvailability({
    propertyId: property.id,
    checkIn,
    checkOut,
    adults,
  });
  const { extras } = useExtras(property.id);
  const { draft, selectRoom } = useBookingDraft(extras);
  usePersistedDraft(
    { propertyId: property.id, checkIn, checkOut, adults, children },
    draft
  );

  const grouped = useMemo(() => groupByRoom(results), [results]);
  const fmt = useMemo(() => makeFormatter(currency), [currency]);

  function handleChoose(result: AvailabilityResult) {
    selectRoom(result);
    setTimeout(() => router.push(`/${property.slug}/extras`), 0);
  }

  const initialCheckIn = fromIsoDate(checkIn);
  const initialCheckOut = fromIsoDate(checkOut);
  const nights = grouped[0]?.cheapest.nights ?? 0;
  const dateRange = useMemo(() => {
    try {
      return `${format(parseISO(checkIn), "EEE d MMM")} — ${format(parseISO(checkOut), "EEE d MMM")}`;
    } catch {
      return `${checkIn} — ${checkOut}`;
    }
  }, [checkIn, checkOut]);

  return (
    <StreetShell t={t} fullBleed>
      <Nav t={t} name={property.name} current="rooms" />

      <StreetSearchBar
        t={t}
        slug={property.slug}
        initialCheckIn={initialCheckIn}
        initialCheckOut={initialCheckOut}
        initialAdults={adults}
        initialChildren={children}
      />

      <section
        style={{
          maxWidth: streetLayout.contentMax,
          margin: "0 auto",
          padding: "64px 40px 24px",
        }}
        className="street-section"
      >
        <div style={{ marginBottom: 14 }}>
          <Eyebrow t={t}>
            {loading
              ? "Checking availability"
              : grouped.length === 0
                ? "No rooms for these dates"
                : `${grouped.length} room${grouped.length === 1 ? "" : "s"} · ${nights} night${nights === 1 ? "" : "s"} · ${dateRange}`}
          </Eyebrow>
        </div>
        <SerifH t={t} size="lg" style={{ maxWidth: 720, marginBottom: 10 }}>
          {renderEmphasis(
            grouped.length === 1
              ? "One room *for your stay.*"
              : `${grouped.length || "—"} rooms *for your stay.*`,
            t.accent
          )}
        </SerifH>
        <div
          style={{
            fontSize: 13.5,
            color: t.inkSoft,
            letterSpacing: "0.04em",
            maxWidth: 640,
          }}
        >
          All rates include WiFi, 24h reception and the option to{" "}
          <b style={{ color: t.ink, fontWeight: 500 }}>
            cancel free until 18:00
          </b>{" "}
          on the day of arrival.
        </div>
      </section>

      <section
        style={{
          maxWidth: streetLayout.contentMax,
          margin: "0 auto",
          padding: "0 40px 96px",
        }}
        className="street-section"
      >
        {error && (
          <ErrorState t={t} slug={property.slug} message={error.message} />
        )}
        {loading && <LoadingState t={t} />}
        {!loading && !error && grouped.length === 0 && (
          <EmptyState t={t} slug={property.slug} />
        )}

        {grouped.map((g) => {
          const roomPhotos = photos?.byRoomType[g.roomTypeId];
          const photoUrl =
            roomPhotos && roomPhotos.length > 0
              ? roomPhotos[0].urls.gallery
              : streetImg.roomFallback;
          return (
            <RoomRow
              key={g.roomTypeId}
              t={t}
              group={g}
              currency={currency}
              fmt={fmt}
              photoUrl={photoUrl}
              onChoose={handleChoose}
            />
          );
        })}
      </section>

      <Footer t={t} />
    </StreetShell>
  );
}

interface Group {
  roomTypeId: string;
  roomTypeName: string;
  description: string | null | undefined;
  maxOccupancy: number | null | undefined;
  cheapest: AvailabilityResult; // the row used for price + Choose
  altCount: number; // number of other rate plans (currently shown as a hint)
}

function groupByRoom(results: AvailabilityResult[]): Group[] {
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
        cheapest: r,
        altCount: 0,
      };
      map.set(key, g);
    } else {
      g.altCount += 1;
      if (r.totalPrice < g.cheapest.totalPrice) g.cheapest = r;
    }
  }
  const list = Array.from(map.values());
  list.sort(
    (a, b) => a.cheapest.totalPrice - b.cheapest.totalPrice
  );
  return list;
}

function RoomRow({
  t,
  group,
  currency,
  fmt,
  photoUrl,
  onChoose,
}: {
  t: StreetTokens;
  group: Group;
  currency: string;
  fmt: Intl.NumberFormat;
  photoUrl: string;
  onChoose: (r: AvailabilityResult) => void;
}) {
  const r = group.cheapest;
  const nightly = r.nights > 0 ? r.totalPrice / r.nights : r.totalPrice;
  const occupancy = group.maxOccupancy ? `Sleeps ${group.maxOccupancy}` : null;

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 220px",
        gap: 36,
        padding: "36px 0",
        borderTop: `1px solid ${t.rule}`,
        alignItems: "center",
      }}
      className="street-room-row"
    >
      <div
        style={{
          width: "100%",
          height: 180,
          background: `${t.bg2} url(${JSON.stringify(photoUrl)}) center/cover no-repeat`,
        }}
        role="img"
        aria-label={`${group.roomTypeName} photo`}
        className="street-room-photo"
      />

      <div>
        <h2
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
            margin: "0 0 10px",
            color: t.ink,
          }}
        >
          {group.roomTypeName}
        </h2>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 12.5,
            color: t.inkSoft,
            letterSpacing: "0.02em",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {occupancy && <Fact>{occupancy}</Fact>}
          {group.description && (
            <Fact>{truncate(group.description, 80)}</Fact>
          )}
          {group.altCount > 0 && (
            <Fact>
              {group.altCount + 1} rate
              {group.altCount === 0 ? "" : "s"} available
            </Fact>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.inkMuted,
            letterSpacing: "0.04em",
            fontStyle: "italic",
          }}
        >
          <span style={{ color: t.accent, marginRight: 8, fontStyle: "normal" }}>
            ✓
          </span>
          {r.ratePlan.isRefundable
            ? `Free cancellation · ${r.ratePlan.name}`
            : `Non-refundable · ${r.ratePlan.name}`}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: t.inkMuted,
            marginBottom: 6,
          }}
        >
          From / night
        </div>
        <div
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 38,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            fontFeatureSettings: '"tnum"',
            color: t.ink,
          }}
        >
          {fmt.format(nightly)}
          <small
            style={{
              fontFamily: "var(--street-sans)",
              fontSize: 13,
              color: t.inkMuted,
              fontWeight: 400,
              letterSpacing: "0.02em",
              marginLeft: 2,
            }}
          >
            /n
          </small>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: t.inkMuted,
            margin: "6px 0 16px",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {fmt.format(r.totalPrice)} total · {r.nights} night
          {r.nights === 1 ? "" : "s"}
        </div>
        <button
          type="button"
          onClick={() => onChoose(r)}
          style={{
            background: "transparent",
            color: t.ink,
            border: `1px solid ${t.ink}`,
            padding: "13px 24px",
            fontSize: 11.5,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "var(--street-sans)",
            width: "100%",
          }}
        >
          Choose →
        </button>
      </div>
      <style>{`
        @media (max-width: 760px) {
          .street-room-row { grid-template-columns: 1fr !important; gap: 18px !important; }
          .street-room-photo { height: 220px !important; }
        }
      `}</style>
    </article>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "relative",
        paddingRight: 18,
      }}
    >
      {children}
    </span>
  );
}

function LoadingState({ t }: { t: StreetTokens }) {
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
        fontFamily: "var(--street-sans)",
      }}
    >
      Checking availability…
    </div>
  );
}

function ErrorState({
  t,
  slug,
  message,
}: {
  t: StreetTokens;
  slug: string;
  message: string;
}) {
  return (
    <div
      style={{
        padding: "32px 0",
        fontSize: 13,
        color: t.inkSoft,
        borderTop: `1px solid ${t.rule}`,
        fontFamily: "var(--street-sans)",
      }}
    >
      We couldn&apos;t load availability ({message}).{" "}
      <Link
        href={`/${slug}`}
        style={{
          color: t.ink,
          borderBottom: `1px solid ${t.accent}`,
          textDecoration: "none",
        }}
      >
        Try again
      </Link>
      .
    </div>
  );
}

function EmptyState({ t, slug }: { t: StreetTokens; slug: string }) {
  return (
    <div
      style={{
        padding: "48px 0",
        textAlign: "center",
        fontFamily: "var(--street-sans)",
        borderTop: `1px solid ${t.rule}`,
      }}
    >
      <div
        style={{
          fontFamily: "var(--street-serif)",
          fontSize: 24,
          color: t.ink,
          marginBottom: 10,
        }}
      >
        Nothing available for these dates.
      </div>
      <div style={{ fontSize: 13, color: t.inkSoft, marginBottom: 18 }}>
        Try a different range — earlier or later by a day or two often opens
        the calendar up.
      </div>
      <Link
        href={`/${slug}`}
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: t.ink,
          borderBottom: `1px solid ${t.accent}`,
          textDecoration: "none",
          padding: "4px 0",
        }}
      >
        Edit your dates
      </Link>
    </div>
  );
}

function Footer({ t }: { t: StreetTokens }) {
  return (
    <footer
      style={{
        padding: "32px 40px",
        borderTop: `1px solid ${t.rule}`,
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: t.inkMuted,
      }}
    >
      © {new Date().getFullYear()}
    </footer>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function makeFormatter(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}
