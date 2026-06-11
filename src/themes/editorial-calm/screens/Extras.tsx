"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  extraLineTotal,
  extrasSubtotal,
  loadPersistedDraft,
  stayMornings,
  useAvailability,
  useExtras,
  usePersistedDraft,
  type AvailabilityResult,
  type Extra,
  type ExtraConfig,
  type PersistedBookingDraft,
} from "@/lib/booking";
import { supportingNoteFor } from "@/lib/booking/rate-plan-notes";
import type { ResolvedProperty, PropertyPhotos } from "@/lib/get-property";
import type { EditorialCalmTokens } from "../tokens";
import { ecImg, ecLayout } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav } from "../components/Nav";
import { StepBar, StepDots } from "../components/BookingChrome";
import { CTA, Mono, Bracket } from "../components/primitives";
import { FineFooter } from "./RoomSelect";

// Screen 2 · "How you'll stay" — the signed-off Editorial Calm layout:
// photo collage (1 large + 2 stacked) of the held room, name + description,
// dominant rate-plan rows, dotted-leader extras a register below, basket
// rail right, and the floating corner basket pinned bottom-right.

export function EditorialCalmExtras({
  t,
  property,
  photos,
}: {
  t: EditorialCalmTokens;
  property: ResolvedProperty;
  photos?: PropertyPhotos;
}) {
  const router = useRouter();
  const currency = property.currency ?? "GBP";

  const [persisted, setPersisted] = useState<PersistedBookingDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [extrasConfig, setExtrasConfig] = useState<Record<string, ExtraConfig>>({});
  const [customising, setCustomising] = useState<Set<string>>(new Set());
  const [specialRequests, setSpecialRequests] = useState("");

  useEffect(() => {
    const loaded = loadPersistedDraft();
    /* eslint-disable react-hooks/set-state-in-effect */
    setPersisted(loaded);
    if (loaded?.result) setResult(loaded.result);
    if (loaded?.extras) setSelectedExtras(new Set(loaded.extras));
    if (loaded?.extrasConfig) setExtrasConfig(loaded.extrasConfig);
    if (loaded?.specialRequests) setSpecialRequests(loaded.specialRequests);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated && (!persisted || !persisted.result)) router.replace(`/${property.slug}`);
  }, [hydrated, persisted, router, property.slug]);

  const { extras, loading: extrasLoading } = useExtras(property.id);

  // Re-fetch availability for the persisted stay so the guest can switch
  // rate plan here (the room page deliberately only offered the cheapest).
  const { results: availResults } = useAvailability({
    propertyId: hydrated && persisted ? persisted.propertyId : "",
    checkIn: persisted?.checkIn ?? "",
    checkOut: persisted?.checkOut ?? "",
    adults: persisted?.adults ?? 0,
  });

  const ratePlans = useMemo(() => {
    if (!result) return [];
    const forRoom = availResults.filter((r) => r.roomType.id === result.roomType.id);
    const seen = new Set<string>();
    const plans = forRoom.filter((r) => {
      if (seen.has(r.ratePlan.id)) return false;
      seen.add(r.ratePlan.id);
      return true;
    });
    // Always include the held result even if the re-fetch lost it (race).
    if (!plans.some((r) => r.ratePlan.id === result.ratePlan.id)) plans.unshift(result);
    plans.sort((a, b) => a.totalPrice - b.totalPrice);
    return plans;
  }, [availResults, result]);

  usePersistedDraft(
    hydrated && persisted
      ? {
          propertyId: persisted.propertyId,
          checkIn: persisted.checkIn,
          checkOut: persisted.checkOut,
          adults: persisted.adults,
          children: persisted.children,
          specialRequests,
        }
      : { propertyId: "", checkIn: "", checkOut: "", adults: 0, children: 0 },
    { result, extras: selectedExtras, extrasConfig }
  );

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setExtrasConfig((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCustomising((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleCustomise(id: string) {
    setExtrasConfig((prev) =>
      prev[id] ? prev : { ...prev, [id]: { guests: headcount, mornings: [...allMornings] } }
    );
    setCustomising((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setBreakfastGuests(id: string, guests: number) {
    setExtrasConfig((prev) => {
      const cur = prev[id] ?? { guests: headcount, mornings: [...allMornings] };
      return { ...prev, [id]: { ...cur, guests } };
    });
  }

  function toggleBreakfastMorning(id: string, date: string) {
    setExtrasConfig((prev) => {
      const cur = prev[id] ?? { guests: headcount, mornings: [...allMornings] };
      const mornings = cur.mornings.includes(date)
        ? cur.mornings.filter((d) => d !== date)
        : [...cur.mornings, date].sort();
      return { ...prev, [id]: { ...cur, mornings } };
    });
  }

  function handleContinue() {
    setTimeout(() => router.push(`/${property.slug}/checkout`), 0);
  }

  if (!hydrated || !persisted?.result || !result) return null;

  const fmt = makeFormatter(currency);
  const headcount = persisted.adults + persisted.children;
  const allMornings = stayMornings(persisted.checkIn, result.nights);
  const nights = result.nights;

  const roomPhotos = photos?.byRoomType[result.roomType.id];
  const collage =
    roomPhotos && roomPhotos.length > 0
      ? roomPhotos.slice(0, 3).map((p) => p.urls.gallery)
      : ecImg.roomFallbacks.slice(0, 3);

  const extrasTotal = extrasSubtotal(extras, Array.from(selectedExtras), nights, headcount, extrasConfig);
  const total = result.totalPrice + extrasTotal;

  const basketLines = extras
    .filter((e) => selectedExtras.has(e.id))
    .map((e) => {
      const unit = e.priceMinorUnits / 100;
      const line = extraLineTotal(unit, e.pricingModel, nights, headcount, extrasConfig[e.id]);
      const cfg = extrasConfig[e.id];
      const detail =
        e.pricingModel === "per_guest_per_night"
          ? `${cfg?.guests ?? headcount} × ${cfg?.mornings.length ?? allMornings.length} × ${fmt.format(unit)}`
          : "";
      return { name: e.name, total: line, detail };
    });

  const summary = `${fmtRange(persisted.checkIn, persisted.checkOut)} · ${nights} NIGHT${nights === 1 ? "" : "S"} · ${persisted.adults} ADULT${persisted.adults === 1 ? "" : "S"}${persisted.children ? ` · ${persisted.children} CHILDREN` : ""}`;
  const roomsHref = `/${property.slug}/rooms?checkIn=${persisted.checkIn}&checkOut=${persisted.checkOut}&adults=${persisted.adults}&children=${persisted.children}`;

  return (
    <EditorialCalmShell t={t}>
      <Nav t={t} name={property.name} />
      <StepBar t={t} step={2} label="RATE & EXTRAS" summary={summary} editHref={roomsHref} />
      <div style={{ textAlign: "center", padding: "40px 40px 4px" }}>
        <StepDots t={t} current={1} />
      </div>

      <div
        style={{
          maxWidth: ecLayout.contentMax,
          margin: "0 auto",
          padding: "44px 40px 96px",
          display: "grid",
          gridTemplateColumns: `1fr ${ecLayout.railWidth}px`,
          gap: ecLayout.railGap,
          alignItems: "start",
          width: "100%",
        }}
        className="ec-extras-grid"
      >
        <div>
          {/* editorial collage: one large + two stacked photos of the held room */}
          {collage.length >= 3 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gridTemplateRows: "150px 150px", gap: 14 }}>
              <CollagePhoto src={collage[0]} style={{ gridRow: "1 / -1" }} alt={result.roomType.name} />
              <CollagePhoto src={collage[1]} alt={result.roomType.name} />
              <CollagePhoto src={collage[2]} alt={result.roomType.name} />
            </div>
          ) : (
            <CollagePhoto src={collage[0]} style={{ height: 314 }} alt={result.roomType.name} />
          )}

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 26, flexWrap: "wrap", gap: 8 }}>
            <h1 style={{ fontFamily: "var(--ec-sans)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.022em", lineHeight: 1.02, margin: 0 }}>
              {result.roomType.name}
            </h1>
            <Mono t={t} size={10}>
              {result.roomType.maxOccupancy != null ? `SLEEPS ${result.roomType.maxOccupancy} · ` : ""}HELD FOR YOU
            </Mono>
          </div>
          {result.roomType.description && (
            <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, lineHeight: 1.75, color: t.ink70, maxWidth: 560, margin: "12px 0 0" }}>
              {result.roomType.description}
            </p>
          )}

          <div style={{ height: 1, background: t.line, margin: "38px 0 34px" }} />

          {/* ── rate plans — the dominant decision ── */}
          <Bracket t={t} size={11} style={{ marginBottom: 6, display: "inline-flex" }}>
            CHOOSE YOUR RATE
          </Bracket>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
            {ratePlans.map((p) => (
              <RatePlanRow
                key={p.ratePlan.id}
                t={t}
                plan={p}
                fmt={fmt}
                selected={p.ratePlan.id === result.ratePlan.id}
                onSelect={() => setResult(p)}
              />
            ))}
          </div>

          {/* definite horizontal split between the rate decision and the optional extras */}
          <div style={{ height: 1, background: t.line, margin: "52px 0 44px" }} />

          {/* ── extras — dotted leaders, a register below ── */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Mono t={t} size={10.5} style={{ letterSpacing: "0.14em" }}>ADD EXTRAS · OPTIONAL</Mono>
            <Mono t={t} size={10}>ADD OR REMOVE ANY TIME BEFORE YOU PAY</Mono>
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            {extrasLoading && <Mono t={t} size={10.5}>LOADING EXTRAS…</Mono>}
            {!extrasLoading && extras.length === 0 && <Mono t={t} size={10.5}>NOTHING TO ADD FOR THIS STAY</Mono>}
            {extras.map((e) =>
              e.pricingModel === "per_guest_per_night" ? (
                <BreakfastRow
                  key={e.id}
                  t={t}
                  extra={e}
                  fmt={fmt}
                  headcount={headcount}
                  mornings={allMornings}
                  selected={selectedExtras.has(e.id)}
                  config={extrasConfig[e.id]}
                  open={customising.has(e.id)}
                  onAdd={() => toggleExtra(e.id)}
                  onRemove={() => removeExtra(e.id)}
                  onToggleCustomise={() => toggleCustomise(e.id)}
                  onSetGuests={(g) => setBreakfastGuests(e.id, g)}
                  onToggleMorning={(d) => toggleBreakfastMorning(e.id, d)}
                />
              ) : (
                <ExtraRow
                  key={e.id}
                  t={t}
                  extra={e}
                  fmt={fmt}
                  on={selectedExtras.has(e.id)}
                  onToggle={() => toggleExtra(e.id)}
                />
              )
            )}
          </div>

          {/* special requests — carried onto the booking at checkout */}
          <div style={{ height: 1, background: t.line, margin: "44px 0 34px" }} />
          <Mono t={t} size={10.5} style={{ letterSpacing: "0.14em" }}>ANYTHING WE SHOULD KNOW? · OPTIONAL</Mono>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Arrival time, dietary notes, a special occasion…"
            style={{
              width: "100%",
              marginTop: 16,
              background: "transparent",
              color: t.ink,
              border: `1px solid ${t.line2}`,
              borderRadius: 14,
              outline: "none",
              padding: 16,
              fontFamily: "var(--ec-sans)",
              fontSize: 14.5,
              lineHeight: 1.55,
              resize: "vertical",
              minHeight: 84,
            }}
          />
        </div>

        <BasketRail
          t={t}
          fmt={fmt}
          photo={collage[0]}
          roomName={result.roomType.name}
          meta={summary}
          rateLabel={`${result.ratePlan.name}`}
          rateSub={`${nights} NIGHTS · ${fmt.format(result.totalPrice / Math.max(1, nights))} / NIGHT`}
          rateTotal={result.totalPrice}
          lines={basketLines}
          total={total}
          onContinue={handleContinue}
        />
      </div>

      <FloatingBasket
        t={t}
        fmt={fmt}
        photo={collage[0]}
        roomName={result.roomType.name}
        meta={summary}
        rateLabel={result.ratePlan.name}
        rateSub={`${nights} NIGHTS · ${fmt.format(result.totalPrice / Math.max(1, nights))} / NIGHT`}
        rateTotal={result.totalPrice}
        lines={basketLines}
        total={total}
        onContinue={handleContinue}
      />

      <FineFooter t={t} name={property.name} />
      <style>{`
        @media (max-width: 1020px) {
          .ec-extras-grid { grid-template-columns: 1fr !important; padding: 32px 24px 96px !important; }
        }
      `}</style>
    </EditorialCalmShell>
  );
}

function CollagePhoto({ src, style, alt }: { src: string; style?: React.CSSProperties; alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        borderRadius: 16,
        background: `#E7E2D6 url(${JSON.stringify(src)}) center/cover no-repeat`,
        ...style,
      }}
    />
  );
}

/* RATE PLAN ROW — kept substantial (the dominant decision) */
function RatePlanRow({
  t,
  plan,
  fmt,
  selected,
  onSelect,
}: {
  t: EditorialCalmTokens;
  plan: AvailabilityResult;
  fmt: Intl.NumberFormat;
  selected: boolean;
  onSelect: () => void;
}) {
  const nightly = plan.nights > 0 ? plan.totalPrice / plan.nights : plan.totalPrice;
  const note = plan.ratePlan.isRefundable ? "FULLY REFUNDABLE" : "PAY NOW";
  const desc = supportingNoteFor(plan.ratePlan.name, plan.ratePlan.isRefundable);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: "28px 1fr auto",
        gap: 22,
        alignItems: "center",
        padding: "30px 24px",
        borderRadius: selected ? 16 : 0,
        // selected ring vs unselected bottom hairline — one boxShadow channel,
        // so border stays "none" and React never sees conflicting shorthands
        boxShadow: selected ? `inset 0 0 0 1px ${t.ink}` : `inset 0 -1px 0 ${t.line}`,
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      className="ec-rate-row"
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 22,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `inset 0 0 0 1.5px ${selected ? t.ink : t.line2}`,
        }}
      >
        {selected && <span style={{ width: 10, height: 10, borderRadius: 10, background: t.ink }} />}
      </span>
      <div style={{ paddingRight: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "var(--ec-sans)", fontWeight: 400, fontSize: 27, letterSpacing: "-0.02em", margin: 0, color: t.ink }}>
            {plan.ratePlan.name}
          </h3>
          <Mono t={t} size={10.5}>{note}</Mono>
        </div>
        <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, lineHeight: 1.7, color: t.ink70, marginTop: 11, maxWidth: 480, marginBottom: 0 }}>{desc}</p>
      </div>
      <div style={{ textAlign: "right", minWidth: 140 }}>
        <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 31, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {fmt.format(nightly)}
          <span style={{ fontSize: 13.5, fontWeight: 400, color: t.ink50 }}> / night</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <Mono t={t} size={10}>
            {fmt.format(plan.totalPrice)} FOR {plan.nights} NIGHT{plan.nights === 1 ? "" : "S"}
          </Mono>
        </div>
      </div>
    </button>
  );
}

/* EXTRA ROW — dotted leaders, menu typography (clearly a register below) */
function DottedHead({
  t,
  name,
  priceLabel,
}: {
  t: EditorialCalmTokens;
  name: string;
  priceLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <h4 style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 13.5, color: t.ink70, whiteSpace: "nowrap", margin: 0 }}>{name}</h4>
      <span style={{ flex: 1, borderBottom: `1px dotted ${t.line2}`, transform: "translateY(-3px)" }} />
      <Mono t={t} size={10} style={{ whiteSpace: "nowrap" }}>{priceLabel}</Mono>
    </div>
  );
}

function AddPill({
  t,
  on,
  onClick,
}: {
  t: EditorialCalmTokens;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        padding: "6px 13px",
        borderRadius: 100,
        fontFamily: "var(--ec-sans)",
        fontWeight: 500,
        fontSize: 11.5,
        color: on ? t.paper : t.ink,
        boxShadow: on ? "none" : `inset 0 0 0 1px ${t.line2}`,
        background: on ? t.ink : "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      {on ? "Added ✓" : "+ Add"}
    </button>
  );
}

function ExtraRow({
  t,
  extra,
  fmt,
  on,
  onToggle,
}: {
  t: EditorialCalmTokens;
  extra: Extra;
  fmt: Intl.NumberFormat;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <article style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 20, alignItems: "center" }}>
      <div>
        <DottedHead t={t} name={extra.name} priceLabel={`${fmt.format(extra.priceMinorUnits / 100)} / STAY`} />
        {extra.description && (
          <p style={{ fontFamily: "var(--ec-mono)", fontSize: 11.5, lineHeight: 1.6, color: t.ink50, marginTop: 4, maxWidth: 460, marginBottom: 0 }}>
            {extra.description}
          </p>
        )}
      </div>
      <div style={{ justifySelf: "end" }}>
        <AddPill t={t} on={on} onClick={onToggle} />
      </div>
    </article>
  );
}

function BreakfastRow({
  t,
  extra,
  fmt,
  headcount,
  mornings,
  selected,
  config,
  open,
  onAdd,
  onRemove,
  onToggleCustomise,
  onSetGuests,
  onToggleMorning,
}: {
  t: EditorialCalmTokens;
  extra: Extra;
  fmt: Intl.NumberFormat;
  headcount: number;
  mornings: string[];
  selected: boolean;
  config?: ExtraConfig;
  open: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onToggleCustomise: () => void;
  onSetGuests: (g: number) => void;
  onToggleMorning: (d: string) => void;
}) {
  const unit = extra.priceMinorUnits / 100;
  const guests = config?.guests ?? headcount;
  const chosen = config?.mornings ?? mornings;
  const chosenSet = new Set(chosen);

  return (
    <article>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 20, alignItems: "center" }}>
        <div>
          <DottedHead t={t} name={extra.name} priceLabel={`${fmt.format(unit)} / GUEST / MORNING`} />
          {extra.description && (
            <p style={{ fontFamily: "var(--ec-mono)", fontSize: 11.5, lineHeight: 1.6, color: t.ink50, marginTop: 4, maxWidth: 460, marginBottom: 0 }}>
              {extra.description}
            </p>
          )}
        </div>
        <div style={{ justifySelf: "end" }}>
          <AddPill t={t} on={selected} onClick={selected ? onRemove : onAdd} />
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Mono t={t} size={9.5}>
            {guests} {guests === 1 ? "GUEST" : "GUESTS"} · {chosen.length} {chosen.length === 1 ? "MORNING" : "MORNINGS"}
          </Mono>
          <button
            type="button"
            onClick={onToggleCustomise}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--ec-sans)",
              fontWeight: 500,
              fontSize: 12,
              color: t.ink,
              borderBottom: `1px solid ${t.line2}`,
              padding: "0 0 2px",
              borderRadius: 0,
            }}
          >
            {open ? "Done" : "Customise"}
          </button>
        </div>
      )}

      {selected && open && (
        <div style={{ marginTop: 14, padding: "16px 18px", borderRadius: 14, boxShadow: `inset 0 0 0 1px ${t.line}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <Mono t={t} size={9.5}>GUESTS HAVING BREAKFAST</Mono>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <MiniStep t={t} disabled={guests <= 1} onClick={() => onSetGuests(Math.max(1, guests - 1))}>−</MiniStep>
              <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 14, minWidth: 14, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{guests}</span>
              <MiniStep t={t} disabled={guests >= headcount} onClick={() => onSetGuests(Math.min(headcount, guests + 1))}>+</MiniStep>
            </span>
          </div>
          <div>
            <Mono t={t} size={9.5} style={{ display: "block", marginBottom: 10 }}>MORNINGS</Mono>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mornings.map((d) => {
                const on = chosenSet.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onToggleMorning(d)}
                    aria-pressed={on}
                    style={{
                      fontFamily: "var(--ec-sans)",
                      fontWeight: 500,
                      fontSize: 12,
                      padding: "8px 13px",
                      borderRadius: 100,
                      cursor: "pointer",
                      border: "none",
                      background: on ? t.ink : "transparent",
                      color: on ? t.paper : t.ink70,
                      boxShadow: on ? "none" : `inset 0 0 0 1px ${t.line2}`,
                    }}
                  >
                    {safeFmt(d)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function MiniStep({
  t,
  onClick,
  disabled,
  children,
}: {
  t: EditorialCalmTokens;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 24,
        fontSize: 13.5,
        color: disabled ? t.line2 : t.ink,
        boxShadow: `inset 0 0 0 1px ${t.line2}`,
        background: "transparent",
        border: "none",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ── the basket: rail card + floating corner chip share this body ── */

interface BasketProps {
  t: EditorialCalmTokens;
  fmt: Intl.NumberFormat;
  photo: string;
  roomName: string;
  meta: string;
  rateLabel: string;
  rateSub: string;
  rateTotal: number;
  lines: Array<{ name: string; total: number; detail: string }>;
  total: number;
  onContinue: () => void;
}

function BasketLine({
  t,
  fmt,
  label,
  sub,
  amount,
  muted,
}: {
  t: EditorialCalmTokens;
  fmt: Intl.NumberFormat;
  label: string;
  sub?: string;
  amount: number;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <div>
        <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 14, color: muted ? t.ink70 : t.ink }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, marginTop: 4 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 15, fontVariantNumeric: "tabular-nums", color: muted ? t.ink70 : t.ink }}>
        {fmt.format(amount)}
      </span>
    </div>
  );
}

function BasketCard(props: BasketProps & { compact?: boolean }) {
  const { t, fmt, photo, roomName, meta, rateLabel, rateSub, rateTotal, lines, total, onContinue, compact } = props;
  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: compact ? 18 : 20, overflow: "hidden", background: t.paper, boxShadow: compact ? "0 22px 60px rgba(20,18,12,.16)" : "none" }}>
      <div style={{ display: "flex", gap: compact ? 14 : 16, padding: compact ? 16 : 20, borderBottom: `1px solid ${t.line}` }}>
        <div
          role="img"
          aria-label={roomName}
          style={{
            width: compact ? 68 : 90,
            height: compact ? 68 : 90,
            flexShrink: 0,
            borderRadius: compact ? 10 : 12,
            background: `#E7E2D6 url(${JSON.stringify(photo)}) center/cover no-repeat`,
          }}
        />
        <div style={{ paddingTop: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: compact ? 7 : 9 }}>
            <CartIcon s={compact ? 12 : 13} c={t.ink70} />
            <Bracket t={t} size={compact ? 9 : 9.5}>YOUR BASKET</Bracket>
          </div>
          <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 400, fontSize: compact ? 16 : 18, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{roomName}</div>
          <div style={{ marginTop: compact ? 5 : 7 }}>
            <Mono t={t} size={compact ? 9 : 9.5}>{meta}</Mono>
          </div>
        </div>
      </div>
      <div style={{ padding: compact ? "16px 16px" : "22px 20px", display: "flex", flexDirection: "column", gap: compact ? 11 : 14 }}>
        <BasketLine t={t} fmt={fmt} label={rateLineLabel(rateLabel)} sub={rateSub} amount={rateTotal} />
        {lines.map((l) => (
          <BasketLine key={l.name} t={t} fmt={fmt} label={l.name} sub={l.detail} amount={l.total} muted />
        ))}
      </div>
      <div style={{ padding: compact ? "14px 16px 16px" : "20px 20px 22px", borderTop: `1px solid ${t.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: compact ? 13 : 18 }}>
          <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: compact ? 14 : 16 }}>Total</span>
          <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 600, fontSize: compact ? 21 : 26, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {fmt.format(total)}
          </span>
        </div>
        <CTA t={t} size={compact ? "sm" : "md"} style={{ width: "100%", justifyContent: "center" }} onClick={onContinue}>
          Continue to checkout →
        </CTA>
        <div style={{ fontFamily: "var(--ec-mono)", fontSize: compact ? 8.5 : 9, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, textAlign: "center", marginTop: compact ? 12 : 14, lineHeight: 1.7 }}>
          HELD WHILE YOU BROWSE · NOTHING CHARGED YET
        </div>
      </div>
    </div>
  );
}

function BasketRail(props: BasketProps) {
  return (
    <aside style={{ position: "sticky", top: 28, alignSelf: "start" }} className="ec-basket-rail">
      <BasketCard {...props} />
      <style>{`
        @media (max-width: 1020px) {
          .ec-basket-rail { position: static !important; }
        }
      `}</style>
    </aside>
  );
}

/* FLOATING CORNER CARD — pinned bottom-right, follows the guest until checkout */
function FloatingBasket(props: BasketProps) {
  const { t, fmt, total } = props;
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "fixed", right: 24, bottom: 24, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}
      className="ec-floating-basket"
    >
      {open && <div style={{ width: 330, maxWidth: "calc(100vw - 48px)" }}><BasketCard {...props} compact /></div>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 19px",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          background: t.ink,
          color: t.paper,
          boxShadow: "0 14px 40px rgba(20,18,12,.28)",
        }}
      >
        <CartIcon s={16} c={t.paper} />
        <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{fmt.format(total)}</span>
        <span style={{ fontFamily: "var(--ec-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>
          {open ? "CLOSE" : "VIEW STAY"}
        </span>
      </button>
      <style>{`
        @media (max-width: 1020px) {
          .ec-floating-basket { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// "Flexible" → "Flexible rate", but "My rate" stays "My rate" — operators
// often bake the word into the plan name already.
function rateLineLabel(name: string): string {
  return /rate$/i.test(name.trim()) ? name : `${name} rate`;
}

function CartIcon({ s = 18, c = "currentColor" }: { s?: number; c?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function safeFmt(d: string): string {
  try {
    return format(parseISO(d), "EEE d MMM");
  } catch {
    return d;
  }
}

function fmtRange(checkIn: string, checkOut: string): string {
  try {
    return `${format(parseISO(checkIn), "d MMM")} – ${format(parseISO(checkOut), "d MMM")}`.toUpperCase();
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
