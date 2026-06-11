import type { EditorialCalmTokens } from "../tokens";
import { ecImg } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav, Wordmark } from "../components/Nav";
import { HeroSearchBar } from "../components/SearchBar";
import { Newsletter } from "../components/Newsletter";
import type { PropertyPhotos, PropertyContent } from "@/lib/get-property";
import { ecDefaultContent } from "../content-defaults";

// Editorial Calm homepage — pixel-for-pixel port of export-src/main.html:
// C1 Editorial hero (photo at 50%/35%, scrim, booking form in the hero),
// then the LandingA sequence: Our houses → rule → manifesto → rule →
// newsletter → footer. Nothing more, nothing less.

// The houses sequence — seed copy + bundled photos from the mockup.
// Per-hotel gallery uploads replace the photos in order; making the names
// and lines hotel-editable needs a "houses" content block (future work).
const EC_HOUSES = [
  {
    name: "Bermondsey",
    line: "The original. Riverside warehouse living, south of the river.",
    img: "/editorial-calm/living.jpg",
  },
  {
    name: "Primrose Hill",
    line: "A heritage building beside Regent's Canal, leafy and quiet.",
    img: "/editorial-calm/studio.jpg",
  },
  {
    name: "Westbourne Park",
    line: "Our largest house — wellness, studio and culture under one roof.",
    img: "/editorial-calm/kitchen-bright.jpg",
  },
] as const;

export function EditorialCalmHome({
  t,
  slug,
  name,
  photos,
  content,
}: {
  t: EditorialCalmTokens;
  slug: string;
  name: string;
  photos?: PropertyPhotos;
  content?: PropertyContent;
}) {
  const c = content ?? ecDefaultContent;

  const heroSrc =
    photos?.heroSlot[0]?.urls.hero ??
    photos?.gallerySlot[0]?.urls.hero ??
    ecImg.hero;

  const houses = EC_HOUSES.map((h, i) => ({
    ...h,
    img: photos?.gallerySlot[i]?.urls.gallery ?? h.img,
  }));

  // mockup nav shows the city next to the booking CTA — last address line
  const location = c.contact.addressLines[c.contact.addressLines.length - 1];

  const headline = c.hero.headline.replace(/\*/g, "").replace(/\s*\n\s*/g, " ").trim();

  return (
    <EditorialCalmShell t={t}>
      {/* ── Hero — 100vh photo (50% 35%, as the mockup), scrim, booking form ── */}
      <section style={{ position: "relative", height: "100vh", minHeight: 720, width: "100%" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `#2C3127 url(${JSON.stringify(heroSrc)}) 50% 35%/cover no-repeat`,
          }}
          role="img"
          aria-label={`${name} — hero`}
        />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: t.scrim }} />
        <Nav t={t} name={name} over location={location} cta={c.hero.bookCtaLabel.replace(/\s*→\s*$/, "")} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 1240,
              margin: "0 auto",
              padding: "0 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
            className="ec-hero-inner"
          >
            <span
              style={{
                fontFamily: "var(--ec-mono)",
                fontSize: 11.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.85)",
                marginBottom: 26,
              }}
            >
              <span style={{ opacity: 0.5, marginRight: 8 }}>(</span>
              {c.hero.eyebrow}
              <span style={{ opacity: 0.5, marginLeft: 8 }}>)</span>
            </span>
            <h1
              style={{
                fontFamily: "var(--ec-serif)",
                fontWeight: 400,
                fontSize: "clamp(38px, 5.2vw, 66px)",
                letterSpacing: "-0.012em",
                lineHeight: 1.04,
                color: "#fff",
                textShadow: "0 1px 30px rgba(0,0,0,.28)",
                margin: 0,
                maxWidth: 900,
              }}
            >
              {headline}
            </h1>
            <HeroSearchBar
              t={t}
              slug={slug}
              propertyName={name}
              enquiriesEmail={c.contact.reservationsEmail || c.contact.generalEmail}
            />
          </div>
        </div>
      </section>

      {/* ── Our houses — one image + one line + one Explore, single column ── */}
      <section style={{ padding: "104px 40px", maxWidth: 1240, margin: "0 auto", width: "100%" }} className="ec-section" id="houses">
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <span
            style={{
              fontFamily: "var(--ec-mono)",
              fontSize: 11.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: t.ink70,
              display: "inline-flex",
              marginBottom: 20,
            }}
          >
            <span style={{ opacity: 0.5, marginRight: 8 }}>(</span>
            OUR HOUSES
            <span style={{ opacity: 0.5, marginLeft: 8 }}>)</span>
          </span>
          <h2
            style={{
              fontFamily: "var(--ec-sans)",
              fontWeight: 400,
              fontSize: 46,
              letterSpacing: "-0.022em",
              lineHeight: 1.02,
              margin: "18px 0 0",
              color: t.ink,
            }}
          >
            Three places to call home
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 96 }}>
          {houses.map((h, i) => (
            <div
              key={h.name}
              style={{
                display: "grid",
                gridTemplateColumns: i % 2 ? "1fr 1.15fr" : "1.15fr 1fr",
                gap: 56,
                alignItems: "center",
              }}
              className="ec-house-row"
            >
              <div
                style={{
                  order: i % 2 ? 2 : 1,
                  height: 420,
                  borderRadius: 16,
                  background: `#E7E2D6 url(${JSON.stringify(h.img)}) center/cover no-repeat`,
                }}
                role="img"
                aria-label={h.name}
                className="ec-house-photo"
              />
              <div style={{ order: i % 2 ? 1 : 2, padding: "0 12px" }} className="ec-house-copy">
                <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink50 }}>
                  0{i + 1} / 03
                </span>
                <h3
                  style={{
                    fontFamily: "var(--ec-sans)",
                    fontWeight: 400,
                    fontSize: 34,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.02,
                    margin: "16px 0 18px",
                    color: t.ink,
                  }}
                >
                  {h.name}
                </h3>
                <p style={{ fontFamily: "var(--ec-mono)", fontSize: 15, lineHeight: 1.7, color: t.ink70, maxWidth: 380, margin: "0 0 28px" }}>
                  {h.line}
                </p>
                <a
                  href="#stay-search"
                  style={{
                    fontFamily: "var(--ec-sans)",
                    fontWeight: 500,
                    fontSize: 15,
                    letterSpacing: "-0.005em",
                    color: t.ink,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    borderBottom: `1px solid ${t.ink}`,
                    paddingBottom: 3,
                    textDecoration: "none",
                  }}
                >
                  Explore {h.name}
                  <span aria-hidden style={{ fontSize: 16 }}>→</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <div style={{ height: 1, background: t.line }} />
      </div>

      {/* ── Manifesto — quiet centred mono quote ── */}
      <section style={{ padding: "112px 40px" }} className="ec-section">
        <p
          style={{
            fontFamily: "var(--ec-mono)",
            fontSize: 19,
            lineHeight: 1.85,
            textAlign: "center",
            maxWidth: 680,
            margin: "0 auto",
            color: t.ink,
          }}
        >
          {c.hero.pressQuote}
        </p>
        <p
          style={{
            textAlign: "center",
            margin: "32px 0 0",
            fontFamily: "var(--ec-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: t.ink50,
          }}
        >
          {(c.hero.pressQuoteAttribution || name).toUpperCase()}
        </p>
      </section>

      <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <div style={{ height: 1, background: t.line }} />
      </div>

      {/* ── Newsletter ── */}
      <Newsletter t={t} />

      <Footer t={t} name={name} content={c} houseNames={EC_HOUSES.map((h) => h.name)} />

      <style>{`
        @media (max-width: 760px) {
          .ec-section { padding-left: 24px !important; padding-right: 24px !important; }
          .ec-house-row { grid-template-columns: 1fr !important; gap: 24px !important; }
          .ec-house-photo { order: 1 !important; height: 280px !important; }
          .ec-house-copy { order: 2 !important; }
        }
      `}</style>
    </EditorialCalmShell>
  );
}

// Footer — wordmark, minimal columns, mono fine print, per the mockup.
function Footer({
  t,
  name,
  content,
  houseNames,
}: {
  t: EditorialCalmTokens;
  name: string;
  content: PropertyContent;
  houseNames: string[];
}) {
  const c = content.contact;
  const cols: Array<[string, string[]]> = [
    ["Stay", ["Find your place", "Our houses", "Residencies", "Gift a stay"]],
    [name, ["The story", "The Grounding", "Journal", "Careers"]],
    ["Say hello", ["Contact", "Instagram", "Newsletter", "Press"]],
  ];
  return (
    <footer style={{ borderTop: `1px solid ${t.line}`, padding: "64px 40px 48px", marginTop: "auto" }} className="ec-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 40,
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        <div style={{ maxWidth: 260 }}>
          <Wordmark name={name} color={t.ink} size={22} />
          <p style={{ fontFamily: "var(--ec-mono)", fontSize: 12.5, lineHeight: 1.7, color: t.ink70, marginTop: 16, marginBottom: 0 }}>
            {content.footer.brandTagline}
          </p>
        </div>
        {cols.map(([h, items]) => (
          <div key={h} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink70, marginBottom: 5 }}>
              {h}
            </span>
            {items.map((it) =>
              it === "Contact" && c.reservationsEmail ? (
                <a key={it} href={`mailto:${c.reservationsEmail}`} style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70, textDecoration: "none" }}>
                  {it}
                </a>
              ) : (
                <a key={it} style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70, textDecoration: "none" }}>
                  {it}
                </a>
              )
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1240,
          margin: "48px auto 0",
          paddingTop: 24,
          borderTop: `1px solid ${t.line}`,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontFamily: "var(--ec-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink50 }}>
          © {new Date().getFullYear()} {name.toUpperCase()}
        </span>
        <span style={{ fontFamily: "var(--ec-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink50 }}>
          {houseNames.join(" · ").toUpperCase()}
        </span>
      </div>
    </footer>
  );
}
