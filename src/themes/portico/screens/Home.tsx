import Image from "next/image";
import Link from "next/link";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { Nav } from "../components/Nav";
import { PorticoGallery } from "../components/Gallery";
import { PorticoMap } from "../components/Map";

// Photos shown in the Inside gallery + lightbox.
const GALLERY_IMAGES = [
  porticoImg.roomDouble,
  porticoImg.roomTwin,
  porticoImg.roomTriple,
  porticoImg.bookSidePane,
  porticoImg.extrasSidePane,
  porticoImg.heroAlt,
  porticoImg.hero,
];

// Mock copy / data — replace with real property details when the Portico
// brand sits on its own Cloudbeds property.
const NEARBY = [
  { place: "Hyde Park", dist: "2 min walk" },
  { place: "Paddington Station", dist: "4 min walk" },
  { place: "Marylebone Village", dist: "8 min walk" },
  { place: "Notting Hill", dist: "12 min walk" },
  { place: "Oxford Street", dist: "12 min by Tube" },
  { place: "Heathrow Airport", dist: "15 min by Heathrow Express" },
];

const GOOD_TO_KNOW = [
  { label: "Check-in", value: "From 4pm" },
  { label: "Check-out", value: "By 11am" },
  { label: "Reception", value: "24 hours" },
  { label: "Wi-Fi", value: "Complimentary throughout" },
  { label: "Parking", value: "NCP, 3 min walk" },
  { label: "Children", value: "Welcome · cot on request" },
  { label: "Pets", value: "Small dogs by arrangement" },
  { label: "Accessibility", value: "Lift to all floors · 1 ADA room" },
];

export function PorticoHome({ t }: { t: PorticoTokens }) {
  return (
    <PorticoShell t={t} fullBleed>
      {/* Smooth anchor scrolling for the in-page nav links. Scoped to document
         while the home page is mounted. */}
      <style>{`
        html { scroll-behavior: smooth; scroll-padding-top: 24px; }
        @media (max-width: 720px) {
          .portico-section { padding: 64px 24px !important; }
        }
      `}</style>
      <Hero t={t} />
      <Neighbourhood t={t} />
      <Inside t={t} />
      <GoodToKnow t={t} />
      <Footer t={t} />
    </PorticoShell>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────
function Hero({ t }: { t: PorticoTokens }) {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100dvh",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <Image src={porticoImg.hero} alt="The Portico Hotel — Paddington exterior" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: t.heroOverlay }} />

      <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <Nav t={t} variant="transparent" inkOverride="#fff" />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)",
          alignItems: "end",
          padding: "0 56px 160px",
          gap: 48,
        }}
        className="portico-hero-grid"
      >
        <div style={{ maxWidth: 720, color: "#fff" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              opacity: 0.85,
              marginBottom: 18,
              fontFamily: "var(--portico-sans)",
            }}
          >
            Paddington · London · W2
          </div>
          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: "clamp(44px, 6.4vw, 76px)",
              lineHeight: 0.98,
              letterSpacing: "-0.018em",
              fontWeight: 400,
              margin: 0,
            }}
          >
            An evening
            <br />
            at <span style={{ fontStyle: "italic" }}>The Portico</span>,
            <br />
            any night you choose.
          </h1>
        </div>

        <aside
          style={{ maxWidth: 280, textAlign: "right", color: "#fff" }}
          className="portico-hero-quote"
        >
          <p
            style={{
              fontFamily: "var(--portico-serif)",
              fontStyle: "italic",
              fontSize: 17,
              lineHeight: 1.4,
              margin: "0 0 10px",
            }}
          >
            &ldquo;A jewel-box behind a Paddington portico.&rdquo;
          </p>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              opacity: 0.8,
              fontFamily: "var(--portico-sans)",
            }}
          >
            — Conde Nast Traveller
          </div>
        </aside>
      </div>

      <div
        style={{
          position: "absolute",
          left: 56,
          bottom: 56,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/book"
          style={{
            background: t.accent,
            color: t.accentInk,
            padding: "18px 34px",
            fontSize: 11,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontFamily: "var(--portico-sans)",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Book a room →
        </Link>
        <Link
          href="/rooms"
          style={{
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "#fff",
            opacity: 0.85,
            borderBottom: "1px solid rgba(255,255,255,0.55)",
            paddingBottom: 2,
            fontFamily: "var(--portico-sans)",
            textDecoration: "none",
          }}
        >
          Explore the rooms
        </Link>
      </div>

      {/* Scroll cue */}
      <a
        href="#neighbourhood"
        aria-label="Scroll to neighbourhood"
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          color: "#fff",
          textDecoration: "none",
          opacity: 0.7,
        }}
        className="portico-scroll-cue"
      >
        <span
          style={{
            fontFamily: "var(--portico-sans)",
            fontSize: 9,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
          }}
        >
          Scroll
        </span>
        <span
          style={{
            display: "inline-block",
            width: 1,
            height: 36,
            background: "rgba(255,255,255,0.7)",
          }}
          className="portico-scroll-line"
        />
      </a>

      <style>{`
        @keyframes porticoBob {
          0%, 100% { transform: scaleY(1); transform-origin: top; opacity: 0.7; }
          50%      { transform: scaleY(1.4); transform-origin: top; opacity: 1; }
        }
        .portico-scroll-line {
          animation: porticoBob 2.2s ease-in-out infinite;
        }
        @media (max-width: 720px) {
          .portico-hero-grid {
            grid-template-columns: 1fr !important;
            padding: 0 28px 220px !important;
            align-items: end !important;
          }
          .portico-hero-quote {
            text-align: left !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── 01 · Neighbourhood ───────────────────────────────────────────────────
function Neighbourhood({ t }: { t: PorticoTokens }) {
  // 32 Sussex Gardens, Paddington, London W2 1UJ — approx. coords
  const lat = 51.5158;
  const lon = -0.1745;

  return (
    <section
      id="neighbourhood"
      style={{
        padding: "120px 56px",
        borderBottom: `1px solid ${t.rule}`,
        scrollMarginTop: 24,
      }}
      className="portico-section"
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 80,
          alignItems: "stretch",
          minHeight: "calc(100dvh - 240px)",
        }}
        className="portico-section-grid"
      >
        {/* Left — photo */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 480,
          }}
        >
          <Image
            src={porticoImg.drawingRoom}
            alt="The Portico Hotel — drawing room"
            fill
            sizes="(max-width: 920px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
        </div>

        {/* Right — text on top, map on bottom (50/50) */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: 32,
            minHeight: 600,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <SectionEyebrow t={t}>01 — Neighbourhood</SectionEyebrow>
            <h2
              style={{
                fontFamily: "var(--portico-serif)",
                fontSize: "clamp(30px, 3.6vw, 44px)",
                lineHeight: 1.05,
                letterSpacing: "-0.018em",
                fontWeight: 400,
                margin: "16px 0 24px",
              }}
            >
              Behind a Paddington portico,
              <br />a <span style={{ fontStyle: "italic", color: t.accent }}>quiet</span> Edwardian street.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: t.inkSoft,
                margin: "0 0 24px",
                maxWidth: 520,
              }}
            >
              Sussex Gardens is the kind of London street that hasn&rsquo;t quite been discovered. Two minutes from Hyde Park&rsquo;s Italian Gardens. Eight from Marylebone Village. Paddington Station — direct to Heathrow in fifteen — is around the corner.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 24px",
                borderTop: `1px solid ${t.rule}`,
                paddingTop: 16,
              }}
            >
              {NEARBY.map((item) => (
                <div
                  key={item.place}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontFamily: "var(--portico-sans)",
                  }}
                >
                  <span style={{ fontSize: 13, color: t.ink }}>{item.place}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: t.inkSoft,
                      letterSpacing: "0.06em",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.dist}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom half — map */}
          <div
            style={{
              position: "relative",
              border: `1px solid ${t.rule}`,
              overflow: "hidden",
              minHeight: 240,
            }}
          >
            <PorticoMap lat={lat} lon={lon} accent={t.accent} accentInk={t.accentInk} />
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                zIndex: 500,
                background: t.bg,
                color: t.ink,
                padding: "8px 14px",
                fontSize: 9,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                textDecoration: "none",
                border: `1px solid ${t.rule}`,
                fontFamily: "var(--portico-sans)",
              }}
            >
              Open in maps →
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-section-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── 02 · Inside (gallery) ────────────────────────────────────────────────
function Inside({ t }: { t: PorticoTokens }) {
  return (
    <section
      id="inside"
      style={{
        padding: "120px 56px",
        borderBottom: `1px solid ${t.rule}`,
        scrollMarginTop: 24,
      }}
      className="portico-section"
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 3fr",
            gap: 56,
            alignItems: "end",
            marginBottom: 48,
          }}
          className="portico-inside-head"
        >
          <SectionEyebrow t={t}>02 — Inside</SectionEyebrow>
          <h2
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: "clamp(34px, 4.4vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.018em",
              fontWeight: 400,
              margin: 0,
              textAlign: "right",
            }}
            className="portico-inside-title"
          >
            Brass, mural, marble, <span style={{ fontStyle: "italic", color: t.accent }}>candlelight</span>.
          </h2>
        </div>

        <PorticoGallery t={t} images={GALLERY_IMAGES} />
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-inside-head {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .portico-inside-title {
            text-align: left !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── 03 · Good to know ────────────────────────────────────────────────────
function GoodToKnow({ t }: { t: PorticoTokens }) {
  return (
    <section
      id="good-to-know"
      style={{
        padding: "120px 56px",
        borderBottom: `1px solid ${t.rule}`,
        scrollMarginTop: 24,
      }}
      className="portico-section"
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 3fr",
            gap: 56,
            alignItems: "end",
            marginBottom: 48,
          }}
          className="portico-section-head"
        >
          <SectionEyebrow t={t}>03 — Good to know</SectionEyebrow>
          <h2
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: "clamp(34px, 4.4vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.018em",
              fontWeight: 400,
              margin: 0,
            }}
          >
            The <span style={{ fontStyle: "italic", color: t.accent }}>practicalities</span>.
          </h2>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 0,
            margin: 0,
            borderTop: `1px solid ${t.rule}`,
          }}
          className="portico-gtk-grid"
        >
          {GOOD_TO_KNOW.map((item) => (
            <div
              key={item.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: 24,
                padding: "22px 0",
                borderBottom: `1px solid ${t.rule}`,
                alignItems: "baseline",
              }}
            >
              <dt
                style={{
                  fontFamily: "var(--portico-sans)",
                  fontSize: 10,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: t.inkSoft,
                  fontWeight: 500,
                }}
              >
                {item.label}
              </dt>
              <dd
                style={{
                  fontFamily: "var(--portico-serif)",
                  fontSize: 19,
                  margin: 0,
                  color: t.ink,
                }}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-section-head {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .portico-gtk-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────
// Cinematic dark block — reuses the same surface as the checkout summary
// panel and the sticky basket bar so the brand has one repeated dark colour
// rather than three. Doubles as the /#contact anchor target.
function Footer({ t }: { t: PorticoTokens }) {
  const inkOn = t.summaryInk;
  const inkMuted = "rgba(236, 229, 212, 0.55)";
  const ruleOn = t.summaryRule;

  return (
    <footer
      id="contact"
      style={{
        background: t.summaryBg,
        color: inkOn,
        fontFamily: "var(--portico-sans)",
        scrollMarginTop: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "80px 56px 56px",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 56,
        }}
        className="portico-footer-grid"
      >
        {/* Brand */}
        <div>
          <Image
            src="/portico/portico-logo-white.png"
            alt="The Portico Hotel"
            width={696}
            height={145}
            style={{ height: 56, width: "auto", objectFit: "contain", marginBottom: 24 }}
          />
          <p
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 18,
              lineHeight: 1.5,
              fontStyle: "italic",
              color: inkOn,
              opacity: 0.85,
              margin: "0 0 22px",
              maxWidth: 360,
            }}
          >
            A jewel-box behind a Paddington portico. Seventy-three rooms across five floors of W2.
          </p>
          <Link
            href="/book"
            style={{
              display: "inline-block",
              background: inkOn,
              color: t.summaryBg,
              padding: "14px 26px",
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Book a room →
          </Link>
        </div>

        {/* Visit */}
        <FooterCol label="Visit" inkMuted={inkMuted} ruleOn={ruleOn}>
          <FooterLine>32 Sussex Gardens</FooterLine>
          <FooterLine>Paddington</FooterLine>
          <FooterLine>London W2 1UJ</FooterLine>
          <FooterLine spacedTop>Reception · 24 hours</FooterLine>
        </FooterCol>

        {/* Reservations */}
        <FooterCol label="Reservations" inkMuted={inkMuted} ruleOn={ruleOn}>
          <FooterLine>
            <a href="tel:+442074020190" style={{ color: "inherit", textDecoration: "none" }}>
              +44 20 7402 0190
            </a>
          </FooterLine>
          <FooterLine>
            <a href="mailto:stay@theporticohotel.com" style={{ color: "inherit", textDecoration: "none" }}>
              stay@theporticohotel.com
            </a>
          </FooterLine>
          <FooterLine spacedTop muted={inkMuted}>
            General enquiries
          </FooterLine>
          <FooterLine>
            <a href="mailto:hello@theporticohotel.com" style={{ color: "inherit", textDecoration: "none" }}>
              hello@theporticohotel.com
            </a>
          </FooterLine>
        </FooterCol>

        {/* Fine print */}
        <FooterCol label="Fine print" inkMuted={inkMuted} ruleOn={ruleOn}>
          {[
            { label: "Terms & conditions", href: "#" },
            { label: "Privacy policy", href: "#" },
            { label: "Cookie policy", href: "#" },
            { label: "Accessibility", href: "#" },
            { label: "Modern slavery statement", href: "#" },
            { label: "Press", href: "#" },
          ].map((l) => (
            <FooterLine key={l.label}>
              <Link href={l.href} style={{ color: "inherit", textDecoration: "none" }}>
                {l.label}
              </Link>
            </FooterLine>
          ))}
        </FooterCol>
      </div>

      {/* Bottom strip */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "24px 56px 40px",
          borderTop: `1px solid ${ruleOn}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
        className="portico-footer-strip"
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: inkMuted,
          }}
        >
          © {new Date().getFullYear()} The Portico Hotel · All rights reserved
        </span>
        <div style={{ display: "flex", gap: 22 }}>
          {[
            { label: "Instagram", href: "#" },
            { label: "Journal", href: "#" },
            { label: "Newsletter", href: "#" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              style={{
                fontSize: 10,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: inkMuted,
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .portico-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
            padding: 48px 28px 32px !important;
          }
          .portico-footer-strip {
            padding: 20px 28px 32px !important;
          }
        }
        @media (max-width: 560px) {
          .portico-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}

function FooterCol({
  label,
  inkMuted,
  ruleOn,
  children,
}: {
  label: string;
  inkMuted: string;
  ruleOn: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: inkMuted,
          fontWeight: 500,
          paddingBottom: 12,
          borderBottom: `1px solid ${ruleOn}`,
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function FooterLine({
  children,
  spacedTop,
  muted,
}: {
  children: React.ReactNode;
  spacedTop?: boolean;
  muted?: string;
}) {
  return (
    <div
      style={{
        fontSize: 14,
        lineHeight: 1.55,
        color: muted ?? "inherit",
        marginTop: spacedTop ? 14 : 0,
        opacity: muted ? 1 : 0.95,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────
function SectionEyebrow({ t, children }: { t: PorticoTokens; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--portico-sans)",
        fontSize: 10,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: t.inkSoft,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}
