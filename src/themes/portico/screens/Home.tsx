import Image from "next/image";
import Link from "next/link";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { Nav } from "../components/Nav";
import { PorticoGallery } from "../components/Gallery";
import { PorticoMap } from "../components/Map";
import { renderEmphasis } from "../components/emphasis";
import type { PropertyPhotos, PropertyContent } from "@/lib/get-property";
import { defaultContent } from "@/lib/content-defaults";

// Fallback photos shown in the Inside gallery if the DB has nothing in the
// gallery slot. Pulled from public/portico/ — overridden by uploads.
const FALLBACK_GALLERY_IMAGES = [
  porticoImg.roomDouble,
  porticoImg.roomTwin,
  porticoImg.roomTriple,
  porticoImg.bookSidePane,
  porticoImg.extrasSidePane,
  porticoImg.heroAlt,
  porticoImg.hero,
];

export function PorticoHome({
  t,
  slug,
  photos,
  content,
}: {
  t: PorticoTokens;
  slug: string;
  photos?: PropertyPhotos;
  content?: PropertyContent;
}) {
  const c = content ?? defaultContent;

  // Pick the right photo per slot, falling back to bundled defaults.
  const heroSrc =
    photos?.heroSlot[0]?.urls.hero ??
    photos?.gallerySlot[0]?.urls.hero ??
    porticoImg.hero;
  const heroAlt = photos?.heroSlot[0]?.altText ?? "Hotel hero";

  const galleryUrls = photos?.gallerySlot.length
    ? photos.gallerySlot.map((p) => p.urls.gallery)
    : FALLBACK_GALLERY_IMAGES;

  const neighbourhoodSrc =
    photos?.neighbourhoodSlot[0]?.urls.gallery ??
    photos?.gallerySlot[0]?.urls.gallery ??
    porticoImg.drawingRoom;
  const neighbourhoodAlt =
    photos?.neighbourhoodSlot[0]?.altText ?? "Neighbourhood photo";

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
      <Hero t={t} slug={slug} heroSrc={heroSrc} heroAlt={heroAlt} content={c.hero} />
      <Neighbourhood
        t={t}
        photoSrc={neighbourhoodSrc}
        photoAlt={neighbourhoodAlt}
        content={c.neighbourhood}
      />
      <Inside t={t} galleryUrls={galleryUrls} />
      <GoodToKnow t={t} content={c.goodToKnow} />
      <Footer t={t} slug={slug} content={c} />
    </PorticoShell>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────
function Hero({
  t,
  slug,
  heroSrc,
  heroAlt,
  content,
}: {
  t: PorticoTokens;
  slug: string;
  heroSrc: string;
  heroAlt: string;
  content: PropertyContent["hero"];
}) {
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
      <Image src={heroSrc} alt={heroAlt} fill priority sizes="100vw" style={{ objectFit: "cover" }} unoptimized={heroSrc.startsWith("http")} />
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
            {content.eyebrow}
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
            {renderEmphasis(content.headline, "#fff")}
          </h1>
        </div>

        {content.pressQuote ? (
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
            &ldquo;{content.pressQuote}&rdquo;
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
            — {content.pressQuoteAttribution}
          </div>
        </aside>
        ) : null}
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
          href={`/${slug}/book`}
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
          {content.bookCtaLabel}
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
function Neighbourhood({
  t,
  photoSrc,
  photoAlt,
  content,
}: {
  t: PorticoTokens;
  photoSrc: string;
  photoAlt: string;
  content: PropertyContent["neighbourhood"];
}) {
  const lat = content.mapLat;
  const lon = content.mapLon;

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
            src={photoSrc}
            alt={photoAlt}
            fill
            sizes="(max-width: 920px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            unoptimized={photoSrc.startsWith("http")}
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
            <SectionEyebrow t={t}>{content.eyebrow}</SectionEyebrow>
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
              {renderEmphasis(content.title, t.accent)}
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
              {content.body}
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
              {content.nearby.map((item) => (
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
function Inside({ t, galleryUrls }: { t: PorticoTokens; galleryUrls: string[] }) {
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

        <PorticoGallery t={t} images={galleryUrls} />
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
function GoodToKnow({
  t,
  content,
}: {
  t: PorticoTokens;
  content: PropertyContent["goodToKnow"];
}) {
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
          <SectionEyebrow t={t}>{content.eyebrow}</SectionEyebrow>
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
            {renderEmphasis(content.title, t.accent)}
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
          {content.rows.map((item) => (
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
function Footer({
  t,
  slug,
  content,
}: {
  t: PorticoTokens;
  slug: string;
  content: PropertyContent;
}) {
  const inkOn = t.summaryInk;
  const inkMuted = "rgba(236, 229, 212, 0.55)";
  const ruleOn = t.summaryRule;
  const fc = content.footer;
  const cc = content.contact;

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
            {fc.brandTagline}
          </p>
          <Link
            href={`/${slug}/book`}
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
          {cc.addressLines.map((line, i) => (
            <FooterLine key={i}>{line}</FooterLine>
          ))}
          {cc.receptionLine && <FooterLine spacedTop>{cc.receptionLine}</FooterLine>}
        </FooterCol>

        {/* Reservations */}
        <FooterCol label="Reservations" inkMuted={inkMuted} ruleOn={ruleOn}>
          <FooterLine>
            <a
              href={`tel:${cc.reservationsPhone.replace(/\s+/g, "")}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {cc.reservationsPhone}
            </a>
          </FooterLine>
          <FooterLine>
            <a
              href={`mailto:${cc.reservationsEmail}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {cc.reservationsEmail}
            </a>
          </FooterLine>
          <FooterLine spacedTop muted={inkMuted}>
            General enquiries
          </FooterLine>
          <FooterLine>
            <a
              href={`mailto:${cc.generalEmail}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {cc.generalEmail}
            </a>
          </FooterLine>
        </FooterCol>

        {/* Fine print */}
        <FooterCol label="Fine print" inkMuted={inkMuted} ruleOn={ruleOn}>
          {fc.fineprintLinks.map((l) => (
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
