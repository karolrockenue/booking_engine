import Image from "next/image";
import Link from "next/link";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { Nav } from "../components/Nav";

// Marketing rooms index — three room types presented as editorial cards.
// Content is intentionally Portico-flavoured (per the design handoff). The real
// availability + rate-plan picker lives at /rooms?checkIn=&checkOut=… (Step 02).

const ROOMS = [
  {
    name: "Double",
    img: porticoImg.roomDouble,
    copy: "The signature room. King bed, hand-painted mural, deep teal joinery.",
    specs: ["14 sqm", "150 × 200cm", "2 guests"],
    price: "from £185",
  },
  {
    name: "Twin",
    img: porticoImg.roomTwin,
    copy: "Two single beds, navy velvet drapes, marble chevron shower beyond.",
    specs: ["15 sqm", "2 × 100 × 200cm", "2 guests"],
    price: "from £195",
  },
  {
    name: "Triple",
    img: porticoImg.roomTriple,
    copy: "Queen plus a single tucked behind brass-trimmed pocket doors. For families.",
    specs: ["19 sqm", "Queen + single", "Up to 3"],
    price: "from £245",
  },
];

export function PorticoRoomsIndex({ t }: { t: PorticoTokens }) {
  return (
    <PorticoShell t={t}>
      <Nav t={t} variant="solid" current="rooms" />

      <header
        style={{
          padding: "56px 56px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 56,
          alignItems: "end",
        }}
        className="portico-rooms-header"
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: t.inkSoft,
            fontFamily: "var(--portico-sans)",
          }}
        >
          01 — The Rooms
        </div>
        <h1
          style={{
            fontFamily: "var(--portico-serif)",
            fontSize: "clamp(36px, 5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            fontWeight: 400,
            margin: 0,
          }}
        >
          Three sizes. <span style={{ fontStyle: "italic", color: t.accent }}>One quiet</span> obsession with detail.
        </h1>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 1,
          background: t.rule,
          borderTop: `1px solid ${t.rule}`,
          borderBottom: `1px solid ${t.rule}`,
          marginTop: 16,
        }}
        className="portico-rooms-grid"
      >
        {ROOMS.map((r) => (
          <article
            key={r.name}
            style={{ background: t.bg, display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 5",
                overflow: "hidden",
              }}
            >
              <Image
                src={r.img}
                alt={`${r.name} room`}
                fill
                sizes="(max-width: 720px) 100vw, 33vw"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                padding: "28px 28px 32px",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 14,
                  gap: 16,
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--portico-serif)",
                    fontSize: 38,
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  {r.name}
                </h2>
                <span
                  style={{
                    fontSize: 13,
                    color: t.inkSoft,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.price} / night
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: t.inkSoft,
                  margin: "0 0 18px",
                }}
              >
                {r.copy}
              </p>
              <div
                style={{
                  borderTop: `1px solid ${t.rule}`,
                  paddingTop: 14,
                  marginBottom: 20,
                }}
              >
                {r.specs.map((s) => (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ color: t.inkSoft }}>—</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  gap: 18,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/book"
                  style={{
                    background: t.ink,
                    color: t.bg,
                    padding: "14px 26px",
                    fontSize: 10,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    fontFamily: "var(--portico-sans)",
                  }}
                >
                  Check availability
                </Link>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${t.accent}`,
                    paddingBottom: 2,
                    color: t.accent,
                    fontFamily: "var(--portico-sans)",
                  }}
                >
                  Read more
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-rooms-header {
            grid-template-columns: 1fr !important;
            padding: 40px 28px 24px !important;
            gap: 18px !important;
          }
          .portico-rooms-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PorticoShell>
  );
}
