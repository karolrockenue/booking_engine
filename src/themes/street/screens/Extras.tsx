"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  extraLineTotal,
  loadPersistedDraft,
  stayMornings,
  useExtras,
  usePersistedDraft,
  type Extra,
  type ExtraConfig,
  type PersistedBookingDraft,
} from "@/lib/booking";
import type { ResolvedProperty, PropertyPhotos } from "@/lib/get-property";
import type { StreetTokens } from "../tokens";
import { streetImg } from "../tokens";
import { StreetShell } from "../StreetShell";
import { BookingNav } from "../components/BookingNav";
import { Eyebrow, SerifH } from "../components/primitives";
import { renderEmphasis } from "../components/emphasis";

export function StreetExtras({
  t,
  property,
  photos,
}: {
  t: StreetTokens;
  property: ResolvedProperty;
  photos?: PropertyPhotos;
}) {
  const router = useRouter();
  const currency = property.currency ?? "GBP";

  const [persisted, setPersisted] = useState<PersistedBookingDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [extrasConfig, setExtrasConfig] = useState<Record<string, ExtraConfig>>({});
  const [customising, setCustomising] = useState<Set<string>>(new Set());
  const [specialRequests, setSpecialRequests] = useState("");

  useEffect(() => {
    const loaded = loadPersistedDraft();
    /* eslint-disable react-hooks/set-state-in-effect */
    setPersisted(loaded);
    if (loaded?.extras) setSelectedExtras(new Set(loaded.extras));
    if (loaded?.extrasConfig) setExtrasConfig(loaded.extrasConfig);
    if (loaded?.specialRequests) setSpecialRequests(loaded.specialRequests);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated && (!persisted || !persisted.result)) router.replace(`/${property.slug}/book`);
  }, [hydrated, persisted, router, property.slug]);

  const { extras, loading: extrasLoading } = useExtras(property.id);

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
    {
      result: persisted?.result ?? null,
      extras: selectedExtras,
      extrasConfig,
    }
  );

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    setTimeout(() => router.push(`/${property.slug}/checkout`), 0);
  }

  function selectBreakfastAll(id: string) {
    setSelectedExtras((prev) => new Set(prev).add(id));
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

  if (!hydrated || !persisted?.result) return null;

  const fmt = makeFormatter(currency);
  const result = persisted.result;
  const headcount = persisted.adults + persisted.children;
  const allMornings = stayMornings(persisted.checkIn, result.nights);
  const isEmpty = !extrasLoading && extras.length === 0;
  const selectedCount = selectedExtras.size;

  const photoSrc =
    photos?.gallerySlot[1]?.urls.gallery ??
    photos?.heroSlot[0]?.urls.gallery ??
    photos?.gallerySlot[0]?.urls.gallery ??
    streetImg.hero;

  return (
    <StreetShell t={t} fullBleed>
      <BookingNav t={t} step={2} name={property.name} />

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", minHeight: "calc(100dvh - 61px)" }}
        className="street-extras-grid"
      >
        {/* Left — cinematic photo panel */}
        <aside
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 360,
            background: `${t.bg2} url(${JSON.stringify(photoSrc)}) center/cover no-repeat`,
          }}
          className="street-extras-photo"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.5) 100%)",
            }}
          />
          <div
            style={{ position: "absolute", left: 48, right: 48, bottom: 56, color: "#fff" }}
            className="street-extras-caption"
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                opacity: 0.85,
                marginBottom: 14,
                fontFamily: "var(--street-sans)",
              }}
            >
              Curate your stay
            </div>
            <div
              style={{
                fontFamily: "var(--street-serif)",
                fontSize: 40,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              Small touches.
              <br />
              Lasting <span style={{ fontStyle: "italic" }}>memories</span>.
            </div>
          </div>
        </aside>

        {/* Right — form */}
        <section
          style={{
            padding: "56px 56px 72px",
            background: t.bg2,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
          className="street-extras-form"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <Eyebrow t={t}>
              Step 03 ·{" "}
              {extrasLoading
                ? "Loading additions"
                : isEmpty
                  ? "Nothing to add"
                  : `${extras.length} ${extras.length === 1 ? "addition" : "additions"} available`}
            </Eyebrow>
            <button
              type="button"
              onClick={handleContinue}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: t.inkSoft,
                cursor: "pointer",
                borderBottom: `1px solid ${t.rule}`,
                paddingBottom: 2,
                fontFamily: "var(--street-sans)",
              }}
            >
              Skip extras →
            </button>
          </div>

          <SerifH t={t} size="md" style={{ margin: "8px 0 28px" }}>
            {renderEmphasis("Curate your *stay.*", t.accent)}
          </SerifH>

          <div style={{ flex: 1 }}>
            {extrasLoading ? (
              <Loading t={t} />
            ) : isEmpty ? (
              <Empty t={t} onContinue={handleContinue} />
            ) : (
              extras.map((extra, i) => {
                const isOn = selectedExtras.has(extra.id);
                const first = i === 0;
                if (extra.pricingModel === "per_guest_per_night") {
                  return (
                    <StreetBreakfastPicker
                      key={extra.id}
                      t={t}
                      extra={extra}
                      headcount={headcount}
                      nights={result.nights}
                      mornings={allMornings}
                      currency={currency}
                      selected={isOn}
                      config={extrasConfig[extra.id]}
                      open={customising.has(extra.id)}
                      first={first}
                      onSelectAll={() => selectBreakfastAll(extra.id)}
                      onRemove={() => removeExtra(extra.id)}
                      onToggleCustomise={() => toggleCustomise(extra.id)}
                      onSetGuests={(g) => setBreakfastGuests(extra.id, g)}
                      onToggleMorning={(d) => toggleBreakfastMorning(extra.id, d)}
                    />
                  );
                }
                const price = extra.priceMinorUnits / 100;
                return (
                  <ExtraRow
                    key={extra.id}
                    t={t}
                    extra={extra}
                    on={isOn}
                    first={first}
                    priceLabel={fmt.format(price)}
                    onToggle={() => toggleExtra(extra.id)}
                  />
                );
              })
            )}
          </div>

          {!extrasLoading && (
            <section style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${t.rule}` }}>
              <Eyebrow t={t}>Special requests</Eyebrow>
              <h3
                style={{
                  fontFamily: "var(--street-serif)",
                  fontSize: 26,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  margin: "14px 0 16px",
                  color: t.ink,
                }}
              >
                Anything we should know?
              </h3>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={4}
                placeholder="Anniversary stay, late arrival, dietary preferences, accessibility needs…"
                maxLength={500}
                style={{
                  width: "100%",
                  background: t.bg,
                  color: t.ink,
                  border: `1px solid ${t.rule}`,
                  outline: "none",
                  padding: 16,
                  fontFamily: "var(--street-serif)",
                  fontSize: 16,
                  lineHeight: 1.55,
                  resize: "vertical",
                  minHeight: 96,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = t.accent;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = t.rule;
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: t.inkMuted,
                  textAlign: "right",
                  fontFamily: "var(--street-sans)",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {specialRequests.length} / 500
              </div>
            </section>
          )}

          {!extrasLoading && (
            <div
              style={{
                marginTop: 32,
                paddingTop: 22,
                borderTop: `1px solid ${t.rule}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: t.inkMuted,
                  fontFamily: "var(--street-sans)",
                }}
              >
                {selectedCount === 0
                  ? "None selected"
                  : `${selectedCount} ${selectedCount === 1 ? "extra" : "extras"} added`}
              </span>
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  background: t.ink,
                  color: t.bg,
                  border: `1px solid ${t.ink}`,
                  padding: "14px 26px",
                  fontSize: 11.5,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "var(--street-sans)",
                  fontWeight: 500,
                }}
              >
                Continue to checkout →
              </button>
            </div>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .street-extras-grid { grid-template-columns: 1fr !important; }
          .street-extras-photo { min-height: 260px !important; }
          .street-extras-form { padding: 36px 24px 56px !important; }
          .street-extras-caption { left: 28px !important; right: 28px !important; bottom: 32px !important; }
        }
      `}</style>
    </StreetShell>
  );
}

// Plain (per_stay / per_night) extra — a ghost-checkbox toggle row.
function ExtraRow({
  t,
  extra,
  on,
  first,
  priceLabel,
  onToggle,
}: {
  t: StreetTokens;
  extra: Extra;
  on: boolean;
  first: boolean;
  priceLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "24px 0",
        background: "transparent",
        cursor: "pointer",
        color: t.ink,
        textAlign: "left",
        fontFamily: "var(--street-sans)",
        border: "none",
        borderTop: first ? "none" : `1px solid ${t.rule}`,
      }}
    >
      <Checkbox t={t} on={on} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4, color: t.ink }}>{extra.name}</div>
        {extra.description && (
          <div style={{ fontSize: 13, lineHeight: 1.55, color: t.inkSoft }}>{extra.description}</div>
        )}
      </div>
      <div style={{ textAlign: "right", minWidth: 84, flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "var(--street-serif)",
            fontSize: 22,
            fontFeatureSettings: '"tnum"',
            color: on ? t.accent : t.ink,
          }}
        >
          {priceLabel}
        </div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: t.inkMuted,
            marginTop: 2,
          }}
        >
          {on ? "Added" : "Add"}
        </div>
      </div>
    </button>
  );
}

// A per_guest_per_night extra (breakfast) — one tap adds it for every guest /
// morning; "Customise" reveals a guest stepper + per-morning chips. Street skin
// of the Portico BreakfastPicker; same controlled-state contract.
function StreetBreakfastPicker({
  t,
  extra,
  headcount,
  nights,
  mornings,
  currency,
  selected,
  config,
  open,
  first,
  onSelectAll,
  onRemove,
  onToggleCustomise,
  onSetGuests,
  onToggleMorning,
}: {
  t: StreetTokens;
  extra: Extra;
  headcount: number;
  nights: number;
  mornings: string[];
  currency: string;
  selected: boolean;
  config?: ExtraConfig;
  open: boolean;
  first: boolean;
  onSelectAll: () => void;
  onRemove: () => void;
  onToggleCustomise: () => void;
  onSetGuests: (guests: number) => void;
  onToggleMorning: (date: string) => void;
}) {
  const fmt = makeFormatter(currency);
  const unit = extra.priceMinorUnits / 100;
  const guests = config?.guests ?? headcount;
  const chosen = config?.mornings ?? mornings;
  const chosenSet = new Set(chosen);
  const lineTotal = selected ? extraLineTotal(unit, "per_guest_per_night", nights, headcount, config) : 0;
  const summary = `${guests} ${guests === 1 ? "guest" : "guests"} · ${chosen.length} ${chosen.length === 1 ? "morning" : "mornings"}`;

  return (
    <div style={{ padding: "24px 0", borderTop: first ? "none" : `1px solid ${t.rule}`, color: t.ink }}>
      <button
        type="button"
        onClick={selected ? onRemove : onSelectAll}
        aria-pressed={selected}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 24,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: t.ink,
          textAlign: "left",
          padding: 0,
          fontFamily: "var(--street-sans)",
        }}
      >
        <Checkbox t={t} on={selected} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{extra.name}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: t.inkSoft }}>
            {extra.description ? `${extra.description} · ` : ""}
            {fmt.format(unit)} / guest / morning
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 84, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--street-serif)",
              fontSize: 22,
              fontFeatureSettings: '"tnum"',
              color: selected ? t.accent : t.ink,
            }}
          >
            {selected ? fmt.format(lineTotal) : fmt.format(unit)}
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: t.inkMuted,
              marginTop: 2,
            }}
          >
            {selected ? "Added" : "Add"}
          </div>
        </div>
      </button>

      {selected && (
        <div
          style={{
            marginTop: 14,
            marginLeft: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: t.inkSoft, fontFamily: "var(--street-sans)" }}>
            {chosen.length === 0 ? "No mornings selected" : `For ${summary}`}
          </span>
          <button
            type="button"
            onClick={onToggleCustomise}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: t.accent,
              borderBottom: `1px solid ${t.accent}`,
              paddingBottom: 2,
              fontFamily: "var(--street-sans)",
            }}
          >
            {open ? "Done" : "Customise"}
          </button>
        </div>
      )}

      {selected && open && (
        <div style={{ marginTop: 18, marginLeft: 48, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: t.inkMuted,
                fontFamily: "var(--street-sans)",
                fontWeight: 500,
              }}
            >
              Guests having breakfast
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Step t={t} disabled={guests <= 1} onClick={() => onSetGuests(Math.max(1, guests - 1))}>
                −
              </Step>
              <span
                style={{
                  fontFamily: "var(--street-serif)",
                  fontSize: 20,
                  fontFeatureSettings: '"tnum"',
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {guests}
              </span>
              <Step t={t} disabled={guests >= headcount} onClick={() => onSetGuests(Math.min(headcount, guests + 1))}>
                +
              </Step>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: t.inkMuted,
                marginBottom: 12,
                fontFamily: "var(--street-sans)",
                fontWeight: 500,
              }}
            >
              Mornings
            </div>
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
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontFamily: "var(--street-sans)",
                      background: on ? "rgba(176,138,62,0.10)" : "transparent",
                      color: on ? t.ink : t.inkSoft,
                      border: `1px solid ${on ? t.accent : t.rule}`,
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
    </div>
  );
}

function Checkbox({ t, on }: { t: StreetTokens; on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        background: on ? t.accent : "transparent",
        border: `1.5px solid ${on ? t.accent : t.inkMuted}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      {on && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accentInk} strokeWidth="3" strokeLinecap="square">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

function Step({
  t,
  onClick,
  disabled,
  children,
}: {
  t: StreetTokens;
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
        width: 32,
        height: 32,
        background: "transparent",
        color: disabled ? t.inkMuted : t.ink,
        border: `1px solid ${disabled ? t.rule : t.ink}`,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--street-sans)",
        fontSize: 15,
        lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Loading({ t }: { t: StreetTokens }) {
  return (
    <div
      style={{
        padding: "64px 0",
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: t.inkSoft,
        fontFamily: "var(--street-sans)",
      }}
    >
      Loading additions…
    </div>
  );
}

function Empty({ t, onContinue }: { t: StreetTokens; onContinue: () => void }) {
  return (
    <div
      style={{
        padding: "48px 0",
        fontSize: 14,
        color: t.inkSoft,
        textAlign: "center",
        fontFamily: "var(--street-sans)",
        letterSpacing: "0.04em",
        lineHeight: 1.6,
      }}
    >
      Nothing to add for this stay.{" "}
      <button
        type="button"
        onClick={onContinue}
        style={{
          background: "transparent",
          border: "none",
          color: t.accent,
          fontFamily: "inherit",
          fontSize: "inherit",
          cursor: "pointer",
          borderBottom: `1px solid ${t.accent}`,
          paddingBottom: 1,
        }}
      >
        Continue to checkout →
      </button>
    </div>
  );
}

function safeFmt(d: string): string {
  try {
    return format(parseISO(d), "EEE d MMM");
  } catch {
    return d;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
