"use client";

import { useMemo, useState } from "react";
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
import type { EditorialCalmTokens } from "../tokens";
import { ecImg, ecLayout } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav } from "../components/Nav";
import { StepBar, StepDots, PageHeading } from "../components/BookingChrome";
import { CTA, Mono } from "../components/primitives";

// Screen 1 · Select your room — one room per row, kept editorial. Carousel
// photo left, name + facts + description centre, price + Select right.
// The cheapest rate is shown here; the rate decision happens on step 2.

interface Props {
  t: EditorialCalmTokens;
  property: ResolvedProperty;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  photos?: PropertyPhotos;
}

export function EditorialCalmRoomSelect({
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

  const nights = grouped[0]?.cheapest.nights ?? 0;
  const summary = `${fmtRange(checkIn, checkOut)} · ${nights || "—"} NIGHT${nights === 1 ? "" : "S"} · ${adults} ADULT${adults === 1 ? "" : "S"}${children ? ` · ${children} CHILDREN` : ""}`;

  return (
    <EditorialCalmShell t={t}>
      <Nav t={t} name={property.name} />
      <StepBar t={t} step={1} label="SELECT YOUR ROOM" summary={summary} editHref={`/${property.slug}`} />
      <PageHeading
        t={t}
        title="Select your room"
        body={
          loading
            ? "Checking what's free for your dates…"
            : grouped.length === 0
              ? "Nothing is free for these dates — try shifting by a day or two."
              : `${grouped.length} room type${grouped.length === 1 ? "" : "s"} ${grouped.length === 1 ? "is" : "are"} available for your dates. Take your time — one decision at a time.`
        }
        dots={<StepDots t={t} current={0} />}
      />

      <div style={{ maxWidth: ecLayout.wideMax, margin: "0 auto", padding: "40px 40px 96px", width: "100%" }} className="ec-rooms-wrap">
        {error && (
          <div style={{ padding: "32px 0", borderTop: `1px solid ${t.line}`, fontFamily: "var(--ec-mono)", fontSize: 13, color: t.ink70 }}>
            We couldn&apos;t load availability ({error.message}).{" "}
            <Link href={`/${property.slug}`} style={{ color: t.ink, borderBottom: `1px solid ${t.line2}` }}>
              Try again
            </Link>
            .
          </div>
        )}
        {loading && (
          <div style={{ padding: "56px 0", textAlign: "center", borderTop: `1px solid ${t.line}` }}>
            <Mono t={t} size={11}>Checking availability…</Mono>
          </div>
        )}
        {!loading && !error && grouped.length === 0 && (
          <div style={{ padding: "56px 0", textAlign: "center", borderTop: `1px solid ${t.line}` }}>
            <div style={{ fontFamily: "var(--ec-serif)", fontSize: 24, marginBottom: 12 }}>Nothing available for these dates.</div>
            <Link href={`/${property.slug}`} style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 14, color: t.ink, borderBottom: `1px solid ${t.line2}`, paddingBottom: 2 }}>
              Edit your dates
            </Link>
          </div>
        )}

        {grouped.map((g) => {
          const roomPhotos = photos?.byRoomType[g.roomTypeId];
          const imgs =
            roomPhotos && roomPhotos.length > 0
              ? roomPhotos.map((p) => p.urls.gallery)
              : [...ecImg.roomFallbacks];
          return (
            <RoomRow key={g.roomTypeId} t={t} group={g} fmt={fmt} imgs={imgs} onChoose={handleChoose} />
          );
        })}
      </div>

      <FineFooter t={t} name={property.name} />
      <style>{`
        @media (max-width: 760px) {
          .ec-rooms-wrap { padding: 24px 24px 64px !important; }
        }
      `}</style>
    </EditorialCalmShell>
  );
}

interface Group {
  roomTypeId: string;
  roomTypeName: string;
  description: string | null | undefined;
  maxOccupancy: number | null | undefined;
  cheapest: AvailabilityResult;
  rateCount: number;
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
        rateCount: 1,
      };
      map.set(key, g);
    } else {
      g.rateCount += 1;
      if (r.totalPrice < g.cheapest.totalPrice) g.cheapest = r;
    }
  }
  const list = Array.from(map.values());
  list.sort((a, b) => a.cheapest.totalPrice - b.cheapest.totalPrice);
  return list;
}

function RoomRow({
  t,
  group,
  fmt,
  imgs,
  onChoose,
}: {
  t: EditorialCalmTokens;
  group: Group;
  fmt: Intl.NumberFormat;
  imgs: string[];
  onChoose: (r: AvailabilityResult) => void;
}) {
  const r = group.cheapest;
  const nightly = r.nights > 0 ? r.totalPrice / r.nights : r.totalPrice;

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "440px 1fr auto",
        gap: 48,
        alignItems: "center",
        padding: "36px 0",
        borderBottom: `1px solid ${t.line}`,
      }}
      className="ec-room-row"
    >
      <Carousel t={t} imgs={imgs} name={group.roomTypeName} />

      <div style={{ paddingRight: 12 }}>
        <h3
          style={{
            fontFamily: "var(--ec-sans)",
            fontWeight: 400,
            fontSize: 30,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            margin: 0,
            color: t.ink,
          }}
        >
          {group.roomTypeName}
        </h3>
        <div style={{ display: "flex", gap: 16, margin: "12px 0 16px", flexWrap: "wrap" }}>
          {group.maxOccupancy != null && <Mono t={t} size={11}>MAX {group.maxOccupancy} {group.maxOccupancy === 1 ? "PERSON" : "PERSONS"}</Mono>}
          {group.rateCount > 1 && (
            <>
              <span style={{ color: t.line2 }}>·</span>
              <Mono t={t} size={11}>{group.rateCount} RATES AVAILABLE</Mono>
            </>
          )}
        </div>
        {group.description && <RoomDesc t={t} text={group.description} />}
      </div>

      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 20, minWidth: 190 }}>
        <div>
          <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 34, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {fmt.format(nightly)}
            <span style={{ fontSize: 15, fontWeight: 400, color: t.ink50 }}> / night</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Mono t={t} size={11}>
              {fmt.format(r.totalPrice)} FOR {r.nights} NIGHT{r.nights === 1 ? "" : "S"}
            </Mono>
          </div>
        </div>
        <CTA t={t} kind="outline" size="md" onClick={() => onChoose(r)}>
          Select
        </CTA>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .ec-room-row { grid-template-columns: 1fr !important; gap: 20px !important; }
          .ec-room-row > div:last-child { align-items: flex-start !important; text-align: left !important; }
        }
      `}</style>
    </article>
  );
}

// Mini-gallery carousel — one photo at a time, arrows + dots.
function Carousel({ t, imgs, name }: { t: EditorialCalmTokens; imgs: string[]; name: string }) {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((i + d + imgs.length) % imgs.length);
  const arrow = {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    width: 38,
    height: 38,
    borderRadius: 100,
    cursor: "pointer",
    border: "none",
    background: "rgba(250,249,245,.9)",
    color: t.ink,
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px -8px rgba(0,0,0,.5)",
  };
  return (
    <div style={{ position: "relative", width: "100%", height: 300, borderRadius: 16, overflow: "hidden", background: "#E7E2D6" }}>
      <div
        style={{ position: "absolute", inset: 0, background: `url(${JSON.stringify(imgs[i])}) center/cover no-repeat` }}
        role="img"
        aria-label={`${name} — photo ${i + 1} of ${imgs.length}`}
      />
      {imgs.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)} style={{ ...arrow, left: 12 }}>
            ‹
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(1)} style={{ ...arrow, right: 12 }}>
            ›
          </button>
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 7 }}>
            {imgs.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Photo ${k + 1}`}
                onClick={() => setI(k)}
                style={{
                  width: k === i ? 18 : 7,
                  height: 7,
                  borderRadius: 7,
                  border: "none",
                  padding: 0,
                  background: k === i ? "#fff" : "rgba(255,255,255,.55)",
                  cursor: "pointer",
                  transition: "width .15s",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Description clamped to 3 lines with a Read more toggle.
function RoomDesc({ t, text }: { t: EditorialCalmTokens; text: string }) {
  const [open, setOpen] = useState(false);
  const clamp = open
    ? {}
    : ({ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as const);
  const long = text.length > 180;
  return (
    <div>
      <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, lineHeight: 1.7, color: t.ink70, maxWidth: 500, margin: 0, ...clamp }}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--ec-sans)",
            fontWeight: 500,
            fontSize: 13,
            color: t.ink,
            borderBottom: `1px solid ${t.line2}`,
            paddingBottom: 2,
            marginTop: 10,
            borderRadius: 0,
            padding: "0 0 2px",
          }}
        >
          {open ? "Less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function FineFooter({ t, name }: { t: EditorialCalmTokens; name: string }) {
  return (
    <footer
      style={{
        padding: "32px 40px",
        borderTop: `1px solid ${t.line}`,
        textAlign: "center",
        marginTop: "auto",
      }}
    >
      <Mono t={t} size={10.5}>
        © {new Date().getFullYear()} {name.toUpperCase()}
      </Mono>
    </footer>
  );
}

function fmtRange(checkIn: string, checkOut: string): string {
  try {
    return `${format(parseISO(checkIn), "d MMM")} – ${format(parseISO(checkOut), "d MMM")}`.toUpperCase();
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

function makeFormatter(currency: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
  }
}
