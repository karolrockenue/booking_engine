"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadPersistedDraft,
  stayMornings,
  useExtras,
  usePersistedDraft,
  type ExtraConfig,
  type PersistedBookingDraft,
} from "@/lib/booking";
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { PorticoStickyBar } from "../components/StickyBar";
import { BreakfastPicker } from "../components/BreakfastPicker";

export function PorticoExtras({ t, property }: { t: PorticoTokens; property: ResolvedProperty }) {
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
  }, [hydrated, persisted, router]);

  const { extras, loading: extrasLoading } = useExtras(property.id);

  // Suppress sessionStorage write until hydration completes — prevents the
  // mount-time effect from clobbering whatever /rooms persisted.
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

  function handleEditRoom() {
    if (!persisted) return;
    const params = new URLSearchParams({
      checkIn: persisted.checkIn,
      checkOut: persisted.checkOut,
      adults: String(persisted.adults),
      children: String(persisted.children),
      rooms: "1",
    });
    router.push(`/${property.slug}/rooms?${params.toString()}`);
  }

  if (!hydrated || !persisted?.result) return null;
  const fmt = makeFormatter(currency);
  const result = persisted.result;
  const headcount = persisted.adults + persisted.children;
  const allMornings = stayMornings(persisted.checkIn, result.nights);
  const isEmpty = !extrasLoading && extras.length === 0;
  const selectedCount = selectedExtras.size;

  // --- per_guest_per_night (breakfast) picker handlers ---
  function selectBreakfastAll(id: string) {
    setSelectedExtras((prev) => new Set(prev).add(id));
    setExtrasConfig((prev) => {
      const next = { ...prev };
      delete next[id]; // no config = default (all guests, all mornings)
      return next;
    });
    setCustomising((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Full remove — also clears any custom config + open editor. Used by both the
  // picker's remove and the sticky bar's chip remove (safe for per_stay too).
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
    // Materialise a config on first open so the editor has values to edit.
    setExtrasConfig((prev) =>
      prev[id]
        ? prev
        : { ...prev, [id]: { guests: headcount, mornings: [...allMornings] } }
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

  return (
    <PorticoShell t={t}>
      <BookingNav t={t} step={2} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.05fr",
          flex: 1,
          minHeight: "calc(100dvh - 60px)",
        }}
        className="portico-extras-grid"
      >
        {/* Left pane — phone photo */}
        <aside style={{ position: "relative", overflow: "hidden", minHeight: 360 }}>
          <Image
            src={porticoImg.extrasSidePane}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            priority
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55))",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 48,
              bottom: 160,
              color: "#fff",
              maxWidth: 380,
            }}
            className="portico-extras-cinema-text"
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                opacity: 0.85,
                marginBottom: 14,
                fontFamily: "var(--portico-sans)",
              }}
            >
              Curate your stay
            </div>
            <div
              style={{
                fontFamily: "var(--portico-serif)",
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

        {/* Right pane — form */}
        <section
          style={{
            padding: "48px 56px",
            background: t.bg2,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
          className="portico-extras-form"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: t.inkSoft,
                fontFamily: "var(--portico-sans)",
              }}
            >
              Step 03 ·{" "}
              {extrasLoading
                ? "Loading additions"
                : isEmpty
                  ? "Nothing to add"
                  : `${extras.length} ${extras.length === 1 ? "addition" : "additions"} available`}
            </div>
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
                fontFamily: "var(--portico-sans)",
              }}
            >
              Skip extras →
            </button>
          </div>

          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 34,
              margin: "0 0 32px",
              letterSpacing: "-0.01em",
              fontWeight: 400,
            }}
          >
            Curate your <span style={{ fontStyle: "italic", color: t.accent }}>stay</span>.
          </h1>

          <div
            style={{
              borderTop: `1px solid ${t.rule}`,
              paddingTop: 8,
              flex: 1,
            }}
          >
            {extrasLoading ? (
              <Loading t={t} />
            ) : isEmpty ? (
              <Empty t={t} onContinue={handleContinue} />
            ) : (
              extras.map((extra, i) => {
                const isOn = selectedExtras.has(extra.id);
                const price = extra.priceMinorUnits / 100;
                const last = i === extras.length - 1;
                if (extra.pricingModel === "per_guest_per_night") {
                  return (
                    <BreakfastPicker
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
                      last={last}
                      onSelectAll={() => selectBreakfastAll(extra.id)}
                      onRemove={() => removeExtra(extra.id)}
                      onToggleCustomise={() => toggleCustomise(extra.id)}
                      onSetGuests={(g) => setBreakfastGuests(extra.id, g)}
                      onToggleMorning={(d) => toggleBreakfastMorning(extra.id, d)}
                    />
                  );
                }
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => toggleExtra(extra.id)}
                    aria-pressed={isOn}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      padding: "20px 0",
                      borderBottom: i < extras.length - 1 ? `1px solid ${t.rule}` : "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: t.ink,
                      textAlign: "left",
                      fontFamily: "var(--portico-sans)",
                      border: "none",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        background: isOn ? t.accent : "transparent",
                        border: `1.5px solid ${isOn ? t.accent : t.inkSoft}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 120ms ease, border-color 120ms ease",
                      }}
                    >
                      {isOn && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={t.accentInk}
                          strokeWidth="3"
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 500,
                          marginBottom: 4,
                          color: t.ink,
                        }}
                      >
                        {extra.name}
                      </div>
                      {extra.description && (
                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.55,
                            color: t.inkSoft,
                          }}
                        >
                          {extra.description}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        minWidth: 80,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 17,
                          fontVariantNumeric: "tabular-nums",
                          color: isOn ? t.accent : t.ink,
                          fontWeight: 500,
                        }}
                      >
                        {fmt.format(price)}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: t.inkSoft,
                          marginTop: 2,
                        }}
                      >
                        {isOn ? "Added" : "Add"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {!extrasLoading && (
            <section style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${t.rule}` }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: t.inkSoft,
                  marginBottom: 14,
                  fontFamily: "var(--portico-sans)",
                }}
              >
                Special requests
              </div>
              <h3
                style={{
                  fontFamily: "var(--portico-serif)",
                  fontSize: 26,
                  letterSpacing: "-0.005em",
                  fontWeight: 400,
                  margin: "0 0 16px",
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
                  fontFamily: "var(--portico-serif)",
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
                  color: t.inkSoft,
                  textAlign: "right",
                  fontFamily: "var(--portico-sans)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {specialRequests.length} / 500
              </div>
            </section>
          )}

          {!extrasLoading && !isEmpty && (
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
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: t.inkSoft,
                  fontFamily: "var(--portico-sans)",
                }}
              >
                {selectedCount === 0
                  ? "None selected"
                  : `${selectedCount} ${selectedCount === 1 ? "extra" : "extras"} added`}
              </div>
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  background: t.accent,
                  color: t.accentInk,
                  border: "none",
                  padding: "14px 26px",
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "var(--portico-sans)",
                  fontWeight: 500,
                }}
              >
                Continue to checkout →
              </button>
            </div>
          )}
        </section>
      </div>

      <PorticoStickyBar
        t={t}
        result={result}
        extras={extras}
        selectedExtras={selectedExtras}
        guests={persisted.adults + persisted.children}
        extrasConfig={extrasConfig}
        onRemoveExtra={removeExtra}
        onContinue={handleContinue}
        onClear={handleEditRoom}
        currency={currency}
        continueLabel="Continue to checkout →"
        clearLabel="Edit room"
      />

      <style>{`
        @media (max-width: 900px) {
          .portico-extras-grid {
            grid-template-columns: 1fr !important;
          }
          .portico-extras-form {
            padding: 32px 24px !important;
          }
          .portico-extras-cinema-text {
            bottom: 32px !important;
            left: 28px !important;
            right: 28px !important;
            max-width: none !important;
          }
        }
      `}</style>
    </PorticoShell>
  );
}

function Loading({ t }: { t: PorticoTokens }) {
  return (
    <div
      style={{
        padding: "64px 0",
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: t.inkSoft,
        fontFamily: "var(--portico-sans)",
      }}
    >
      Loading additions…
    </div>
  );
}

function Empty({ t, onContinue }: { t: PorticoTokens; onContinue: () => void }) {
  return (
    <div
      style={{
        padding: "48px 0",
        fontSize: 14,
        color: t.inkSoft,
        textAlign: "center",
        fontFamily: "var(--portico-sans)",
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

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
