import type { EditorialCalmTokens } from "../tokens";
import { ecImg, ecLayout } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav } from "../components/Nav";
import { HeroSearchBar } from "../components/SearchBar";
import type { PropertyPhotos, PropertyContent } from "@/lib/get-property";
import { ecDefaultContent } from "../content-defaults";
import { Newsletter } from "../components/Newsletter";

const FALLBACK_GALLERY = ecImg.gallery;

// Editorial Calm homepage — full-bleed photographic hero with the booking
// form living inside it (main.html / C1 Editorial), then a quiet single
// reading column: gallery strip, neighbourhood, good to know, manifesto.

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
  const galleryUrls = photos?.gallerySlot.length
    ? photos.gallerySlot.slice(0, 3).map((p) => p.urls.gallery)
    : FALLBACK_GALLERY;
  const neighbourhoodSrc =
    photos?.neighbourhoodSlot[0]?.urls.gallery ??
    photos?.gallerySlot[1]?.urls.gallery ??
    ecImg.neighbourhood;

  const headlineLines = c.hero.headline.split("\n").map((l) => l.replace(/\*/g, "").trim()).filter(Boolean);

  return (
    <EditorialCalmShell t={t}>
      {/* ── Hero — full-viewport photo, headline + booking form ── */}
      <section style={{ position: "relative", height: "100dvh", minHeight: 680, width: "100%" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `#2C3127 url(${JSON.stringify(heroSrc)}) center/cover no-repeat`,
          }}
          role="img"
          aria-label={`${name} — hero`}
        />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: t.scrim }} />
        <Nav t={t} name={name} over />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
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
              {headlineLines.map((l, i) => (
                <span key={i}>
                  {l}
                  {i < headlineLines.length - 1 && " "}
                </span>
              ))}
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

      {/* ── Inside — three-photo editorial strip ── */}
      <section style={{ padding: "96px 40px 24px", maxWidth: 1240, margin: "0 auto", width: "100%" }} className="ec-section">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <MonoBracket t={t}>INSIDE</MonoBracket>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }} className="ec-gallery-grid">
          {galleryUrls.map((src, i) => (
            <div
              key={i}
              style={{
                height: 300,
                borderRadius: 16,
                background: `#E7E2D6 url(${JSON.stringify(src)}) center/cover no-repeat`,
              }}
              role="img"
              aria-label={`${name} — gallery photo ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── Neighbourhood ── */}
      <section style={{ padding: "88px 40px 24px", maxWidth: 1240, margin: "0 auto", width: "100%" }} className="ec-section">
        <div style={{ height: 1, background: t.line, marginBottom: 56 }} />
        <div style={{ display: "grid", gridTemplateColumns: neighbourhoodSrc ? "1fr 1fr" : "1fr", gap: 56, alignItems: "start" }} className="ec-2col">
          <div>
            <MonoBracket t={t}>{stripNum(c.neighbourhood.eyebrow)}</MonoBracket>
            <h2
              style={{
                fontFamily: "var(--ec-sans)",
                fontWeight: 400,
                fontSize: 38,
                letterSpacing: "-0.022em",
                lineHeight: 1.08,
                margin: "20px 0 18px",
                color: t.ink,
              }}
            >
              {c.neighbourhood.title.replace(/\*/g, "").replace(/\n/g, " ")}
            </h2>
            <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, lineHeight: 1.7, color: t.ink70, maxWidth: 480, margin: "0 0 32px" }}>
              {c.neighbourhood.body}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxWidth: 480 }}>
              {c.neighbourhood.nearby.map((n) => (
                <li
                  key={n.place}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: `1px solid ${t.line}`,
                    paddingBottom: 10,
                    fontSize: 14,
                    fontFamily: "var(--ec-sans)",
                  }}
                >
                  <span style={{ color: t.ink }}>{n.place}</span>
                  <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: t.ink50 }}>
                    {n.dist}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {neighbourhoodSrc && (
            <div
              style={{
                borderRadius: 16,
                minHeight: 420,
                background: `#E7E2D6 url(${JSON.stringify(neighbourhoodSrc)}) center/cover no-repeat`,
              }}
              role="img"
              aria-label="Neighbourhood"
            />
          )}
        </div>
      </section>

      {/* ── Good to know ── */}
      <section style={{ padding: "88px 40px 24px", maxWidth: 1240, margin: "0 auto", width: "100%" }} className="ec-section">
        <div style={{ height: 1, background: t.line, marginBottom: 56 }} />
        <MonoBracket t={t}>{stripNum(c.goodToKnow.eyebrow)}</MonoBracket>
        <h2
          style={{
            fontFamily: "var(--ec-sans)",
            fontWeight: 400,
            fontSize: 32,
            letterSpacing: "-0.022em",
            margin: "20px 0 32px",
            color: t.ink,
          }}
        >
          {c.goodToKnow.title.replace(/\*/g, "")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 48, maxWidth: 760 }} className="ec-2col">
          {c.goodToKnow.rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                borderBottom: `1px solid ${t.line}`,
                paddingBottom: 10,
              }}
            >
              <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50 }}>
                {row.label}
              </span>
              <span style={{ fontFamily: "var(--ec-sans)", fontSize: 14, color: t.ink, textAlign: "right" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </section>

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
        <p style={{ textAlign: "center", margin: "32px 0 0" }}>
          <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink50 }}>
            {(c.hero.pressQuoteAttribution || name).toUpperCase()}
          </span>
        </p>
      </section>

      {/* ── Newsletter ── */}
      <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }} className="ec-section">
        <div style={{ height: 1, background: t.line }} />
      </div>
      <Newsletter t={t} />

      <Footer t={t} name={name} content={c} />

      <style>{`
        @media (max-width: 760px) {
          .ec-section { padding-left: 24px !important; padding-right: 24px !important; }
          .ec-gallery-grid { grid-template-columns: 1fr !important; }
          .ec-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </EditorialCalmShell>
  );
}

// content eyebrows arrive as "01 — Neighbourhood"; the bracket supplies its
// own punctuation, so strip the leading number.
function stripNum(eyebrow: string): string {
  return eyebrow.replace(/^\s*\d+\s*[—–-]\s*/, "").toUpperCase();
}

function MonoBracket({ t, children }: { t: EditorialCalmTokens; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--ec-mono)",
        fontSize: 11.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: t.ink70,
      }}
    >
      <span style={{ opacity: 0.5, marginRight: 8 }}>(</span>
      {children}
      <span style={{ opacity: 0.5, marginLeft: 8 }}>)</span>
    </span>
  );
}

export function Footer({
  t,
  name,
  content,
}: {
  t: EditorialCalmTokens;
  name: string;
  content: PropertyContent;
}) {
  const c = content.contact;
  const f = content.footer;
  return (
    <footer style={{ borderTop: `1px solid ${t.line}`, padding: "64px 40px 48px", marginTop: "auto" }} className="ec-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 40,
          maxWidth: ecLayout.contentMax - 40,
          margin: "0 auto",
        }}
      >
        <div style={{ maxWidth: 280 }}>
          <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 22, letterSpacing: "-0.012em", color: t.ink }}>{name}</span>
          <p style={{ fontFamily: "var(--ec-mono)", fontSize: 12.5, lineHeight: 1.7, color: t.ink70, marginTop: 16 }}>{f.brandTagline}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink70, marginBottom: 5 }}>Visit</span>
          {c.addressLines.map((line, i) => (
            <span key={i} style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70 }}>{line}</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink70, marginBottom: 5 }}>Say hello</span>
          {c.receptionLine && <span style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70 }}>{c.receptionLine}</span>}
          {c.reservationsPhone && (
            <a href={`tel:${c.reservationsPhone.replace(/\s/g, "")}`} style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70 }}>
              {c.reservationsPhone}
            </a>
          )}
          {c.reservationsEmail && (
            <a href={`mailto:${c.reservationsEmail}`} style={{ fontFamily: "var(--ec-sans)", fontSize: 14.5, color: t.ink70 }}>
              {c.reservationsEmail}
            </a>
          )}
        </div>
      </div>
      <div
        style={{
          maxWidth: ecLayout.contentMax - 40,
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
        <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {f.fineprintLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{ fontFamily: "var(--ec-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </span>
      </div>
    </footer>
  );
}
