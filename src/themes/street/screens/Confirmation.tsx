"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { loadPersistedConfirmation, type PersistedConfirmation } from "@/lib/booking";
import type { ResolvedProperty, PropertyPhotos } from "@/lib/get-property";
import type { StreetTokens } from "../tokens";
import { streetImg, streetLayout } from "../tokens";
import { StreetShell } from "../StreetShell";
import { Nav } from "../components/Nav";
import { Eyebrow } from "../components/primitives";
import { renderEmphasis } from "../components/emphasis";

export function StreetConfirmation({
  t,
  property,
  photos,
}: {
  t: StreetTokens;
  property: ResolvedProperty;
  photos?: PropertyPhotos;
}) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const currency = property.currency ?? "GBP";

  const [details, setDetails] = useState<PersistedConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPersistedConfirmation();
    if (loaded && loaded.orderId === orderId) setDetails(loaded);
    setHydrated(true);
  }, [orderId]);

  const fmt = makeFormatter(currency);
  const stayLine = details
    ? `${details.nights} ${details.nights === 1 ? "night" : "nights"}`
    : "your stay";

  const heroSrc =
    photos?.heroSlot[0]?.urls.hero ?? photos?.gallerySlot[0]?.urls.hero ?? streetImg.hero;

  const status = !orderId ? "No booking found" : !hydrated ? "Confirming…" : "Reservation confirmed";

  return (
    <StreetShell t={t} fullBleed>
      <Nav t={t} name={property.name} />

      {/* Cinematic-light hero band */}
      <section
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(260px, 36vh, 420px)",
          background: `${t.bg2} url(${JSON.stringify(heroSrc)}) center/cover no-repeat`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: t.heroOverlay }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            maxWidth: streetLayout.contentMax,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 40px 44px",
          }}
          className="street-confirm-hero"
        >
          <div style={{ marginBottom: 14 }}>
            <Eyebrow t={t} color={t.ink}>
              {status}
            </Eyebrow>
          </div>
          <h1
            style={{
              fontFamily: "var(--street-serif)",
              fontSize: "clamp(34px, 5vw, 60px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              fontWeight: 400,
              margin: 0,
              maxWidth: 820,
              color: t.ink,
            }}
          >
            {orderId
              ? renderEmphasis(`*Reserved.* We have you for ${stayLine}.`, t.accent)
              : renderEmphasis("Your reservation reference *wasn't found.*", t.accent)}
          </h1>
        </div>
      </section>

      {/* Body */}
      <main
        style={{
          maxWidth: streetLayout.contentMax,
          margin: "0 auto",
          width: "100%",
          padding: "64px 40px 96px",
        }}
        className="street-confirm-main"
      >
        {!orderId ? (
          <EmptyState t={t} message="No booking reference found in the URL." />
        ) : !hydrated ? (
          <EmptyState t={t} message="Loading your reservation…" />
        ) : !details ? (
          <EmptyState
            t={t}
            message={
              <>
                Your booking{" "}
                <strong style={{ color: t.ink, fontFeatureSettings: '"tnum"' }}>{orderId}</strong> is
                confirmed. A receipt is on the way to your inbox.
              </>
            }
          />
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 64, alignItems: "start" }}
            className="street-confirm-grid"
          >
            {/* Greeting + reference */}
            <div>
              <Eyebrow t={t}>Reference</Eyebrow>
              <div
                style={{
                  fontFamily: "var(--street-serif)",
                  fontSize: 28,
                  letterSpacing: "-0.01em",
                  fontFeatureSettings: '"tnum"',
                  margin: "10px 0 24px",
                  color: t.ink,
                }}
              >
                {details.orderId}
              </div>
              <p style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 1.7, margin: "0 0 24px" }}>
                Welcome, {details.firstName}. A confirmation is on its way to{" "}
                <span style={{ color: t.ink }}>{details.email}</span>. Reception is staffed
                twenty-four hours — just check in when you arrive.
              </p>
            </div>

            {/* Detail rows */}
            <div style={{ borderTop: `1px solid ${t.rule}` }}>
              <SumLine t={t} label="Guest" value={`${details.firstName} ${details.lastName}`} />
              <SumLine t={t} label="Room" value={`${details.roomName} · ${details.rateName}`} />
              <SumLine t={t} label="Arrive" value={fmtDate(details.checkIn, "EEE d MMM yyyy · 'from 4pm'")} />
              <SumLine t={t} label="Depart" value={fmtDate(details.checkOut, "EEE d MMM yyyy · 'by 11am'")} />
              <SumLine
                t={t}
                label="Guests"
                value={`${details.adults} ${details.adults === 1 ? "adult" : "adults"}`}
              />
              <SumLine t={t} label="Accommodation" value={fmt.format(details.roomTotal)} />
              {details.extras?.map((e, i) => (
                <SumLine
                  key={`${e.name}-${i}`}
                  t={t}
                  label={e.quantity > 1 ? `${e.name} × ${e.quantity}` : e.name}
                  value={fmt.format(e.lineTotal)}
                />
              ))}
              <SumLine t={t} label="Total" value={fmt.format(details.totalPrice)} emphasis />
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 56,
            paddingTop: 28,
            borderTop: `1px solid ${t.rule}`,
          }}
        >
          <Link
            href={`/${property.slug}`}
            style={{
              background: t.ink,
              color: t.bg,
              padding: "14px 26px",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textDecoration: "none",
              fontFamily: "var(--street-sans)",
              fontWeight: 500,
            }}
          >
            Return home
          </Link>
          {details?.cancelUrl && (
            <a
              href={details.cancelUrl}
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: t.inkSoft,
                textDecoration: "none",
                borderBottom: `1px solid ${t.rule}`,
                paddingBottom: 2,
                fontFamily: "var(--street-sans)",
              }}
            >
              Cancel booking
            </a>
          )}
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: t.inkMuted,
              fontFamily: "var(--street-sans)",
              marginLeft: "auto",
            }}
          >
            {property.name}
          </span>
        </div>
      </main>

      <style>{`
        @media (max-width: 760px) {
          .street-confirm-hero { padding: 0 24px 32px !important; }
          .street-confirm-main { padding: 44px 24px 64px !important; }
          .street-confirm-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </StreetShell>
  );
}

function EmptyState({ t, message }: { t: StreetTokens; message: React.ReactNode }) {
  return (
    <p
      style={{
        color: t.inkSoft,
        fontSize: 15,
        lineHeight: 1.7,
        padding: "24px 0",
        borderTop: `1px solid ${t.rule}`,
        borderBottom: `1px solid ${t.rule}`,
        margin: 0,
      }}
    >
      {message}
    </p>
  );
}

function SumLine({
  t,
  label,
  value,
  emphasis,
}: {
  t: StreetTokens;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: `1px solid ${t.ruleSoft}`,
        gap: 16,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontFamily: "var(--street-sans)",
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? 26 : 15,
          fontFeatureSettings: '"tnum"',
          fontFamily: "var(--street-serif)",
          fontWeight: 400,
          letterSpacing: emphasis ? "-0.02em" : "-0.005em",
          color: emphasis ? t.accent : t.ink,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function fmtDate(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
