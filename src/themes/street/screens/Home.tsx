import type { StreetTokens } from "../tokens";
import { streetImg, streetLayout } from "../tokens";
import { StreetShell } from "../StreetShell";
import { Nav } from "../components/Nav";
import { StreetGallery } from "../components/Gallery";
import { StreetMap } from "../components/Map";
import { StreetSearchBar } from "../components/SearchBar";
import { Eyebrow, SerifH, Hairline } from "../components/primitives";
import { renderEmphasis } from "../components/emphasis";
import type { PropertyPhotos, PropertyContent } from "@/lib/get-property";
import { defaultContent } from "@/lib/content-defaults";

const FALLBACK_GALLERY = [
  streetImg.hero,
  streetImg.roomFallback,
  streetImg.hero,
];

export function StreetHome({
  t,
  slug,
  name,
  subtitle,
  photos,
  content,
}: {
  t: StreetTokens;
  slug: string;
  name: string;
  subtitle?: string;
  photos?: PropertyPhotos;
  content?: PropertyContent;
}) {
  const c = content ?? defaultContent;

  const heroSrc =
    photos?.heroSlot[0]?.urls.hero ??
    photos?.gallerySlot[0]?.urls.hero ??
    streetImg.hero;
  const heroAlt = photos?.heroSlot[0]?.altText ?? `${name} — exterior`;

  const galleryUrls = photos?.gallerySlot.length
    ? photos.gallerySlot.map((p) => p.urls.gallery)
    : FALLBACK_GALLERY;

  const neighbourhoodSrc =
    photos?.neighbourhoodSlot[0]?.urls.gallery ??
    photos?.gallerySlot[1]?.urls.gallery ??
    null;
  const neighbourhoodAlt =
    photos?.neighbourhoodSlot[0]?.altText ?? "Neighbourhood";

  return (
    <StreetShell t={t} fullBleed>
      <style>{`
        html { scroll-behavior: smooth; scroll-padding-top: 24px; }
        @media (max-width: 760px) {
          .street-section { padding: 56px 24px !important; }
        }
      `}</style>
      <Nav t={t} name={name} subtitle={subtitle} current="stay" />
      <Hero t={t} src={heroSrc} alt={heroAlt} />
      <HeadlineAndSearch t={t} slug={slug} content={c.hero} />
      <Inside t={t} urls={galleryUrls} />
      <Neighbourhood
        t={t}
        photoSrc={neighbourhoodSrc}
        photoAlt={neighbourhoodAlt}
        content={c.neighbourhood}
      />
      <GoodToKnow t={t} content={c.goodToKnow} />
      <Footer t={t} content={c} />
    </StreetShell>
  );
}

// ─── Hero (full-bleed photo band) ────────────────────────────────────

function Hero({ t, src, alt }: { t: StreetTokens; src: string; alt: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: 420,
        background: `${t.bg2} url(${JSON.stringify(src)}) center/cover no-repeat`,
      }}
      role="img"
      aria-label={alt}
      className="street-hero"
    >
      <style>{`
        @media (max-width: 760px) {
          .street-hero { height: 300px !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Headline + search bar ───────────────────────────────────────────

function HeadlineAndSearch({
  t,
  slug,
  content,
}: {
  t: StreetTokens;
  slug: string;
  content: PropertyContent["hero"];
}) {
  // Street's headline reads as one continuous line — the *italic* word does
  // the visual lift, not line-break drama. Flatten any newlines from copy
  // that was written for Portico's three-line cadence.
  const oneLineHeadline = content.headline.replace(/\s*\n\s*/g, " ").trim();

  return (
    <section
      style={{
        // Generous bottom padding leaves room for the date picker to drop
        // below the search bar without pushing the next section down.
        padding: "32px 40px 220px",
        textAlign: "center",
        maxWidth: streetLayout.contentMax,
        margin: "0 auto",
      }}
      className="street-section"
    >
      <div style={{ marginBottom: 16 }}>
        <Eyebrow t={t}>{content.eyebrow}</Eyebrow>
      </div>
      <SerifH
        t={t}
        size="lg"
        style={{ maxWidth: 900, margin: "0 auto", color: t.ink }}
      >
        {renderEmphasis(oneLineHeadline, t.accent)}
      </SerifH>

      <StreetSearchBar t={t} slug={slug} />
    </section>
  );
}

// ─── Inside gallery ──────────────────────────────────────────────────

function Inside({ t, urls }: { t: StreetTokens; urls: ReadonlyArray<string> }) {
  return (
    <section
      id="rooms"
      style={{
        padding: "32px 40px 64px",
        maxWidth: streetLayout.contentMax,
        margin: "0 auto",
      }}
      className="street-section"
    >
      <Hairline t={t} style={{ marginBottom: 40 }} />
      <div style={{ marginBottom: 24 }}>
        <Eyebrow t={t}>01 — Inside</Eyebrow>
      </div>
      <StreetGallery t={t} urls={urls} />
    </section>
  );
}

// ─── Neighbourhood ───────────────────────────────────────────────────

function Neighbourhood({
  t,
  photoSrc,
  photoAlt,
  content,
}: {
  t: StreetTokens;
  photoSrc: string | null;
  photoAlt: string;
  content: PropertyContent["neighbourhood"];
}) {
  return (
    <section
      id="neighbourhood"
      style={{
        padding: "32px 40px 64px",
        maxWidth: streetLayout.contentMax,
        margin: "0 auto",
      }}
      className="street-section"
    >
      <Hairline t={t} style={{ marginBottom: 40 }} />
      <div style={{ marginBottom: 18 }}>
        <Eyebrow t={t}>{content.eyebrow}</Eyebrow>
      </div>
      <SerifH t={t} size="lg" style={{ maxWidth: 720, marginBottom: 18 }}>
        {renderEmphasis(content.title, t.accent)}
      </SerifH>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: t.inkSoft,
          maxWidth: 640,
          margin: "0 0 28px",
        }}
      >
        {content.body}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: photoSrc ? "1fr 1fr" : "1fr",
          gap: 32,
          alignItems: "start",
        }}
        className="street-neighbourhood-grid"
      >
        <div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {content.nearby.map((n) => (
              <li
                key={n.place}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: `1px solid ${t.ruleSoft}`,
                  paddingBottom: 10,
                  fontSize: 13.5,
                }}
              >
                <span style={{ color: t.ink }}>{n.place}</span>
                <span style={{ color: t.inkMuted, fontFamily: "var(--street-sans)" }}>
                  {n.dist}
                </span>
              </li>
            ))}
          </ul>
          {content.mapLat !== 0 && content.mapLon !== 0 && (
            <div style={{ marginTop: 24 }}>
              <StreetMap t={t} lat={content.mapLat} lon={content.mapLon} label="Map" height={280} />
            </div>
          )}
        </div>
        {photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt={photoAlt}
            style={{
              width: "100%",
              aspectRatio: "4/5",
              objectFit: "cover",
              display: "block",
              background: t.bg2,
            }}
            loading="lazy"
          />
        )}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .street-neighbourhood-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Good to know ────────────────────────────────────────────────────

function GoodToKnow({
  t,
  content,
}: {
  t: StreetTokens;
  content: PropertyContent["goodToKnow"];
}) {
  return (
    <section
      style={{
        padding: "32px 40px 64px",
        maxWidth: streetLayout.contentMax,
        margin: "0 auto",
      }}
      className="street-section"
    >
      <Hairline t={t} style={{ marginBottom: 40 }} />
      <div style={{ marginBottom: 18 }}>
        <Eyebrow t={t}>{content.eyebrow}</Eyebrow>
      </div>
      <SerifH t={t} size="md" style={{ maxWidth: 640, marginBottom: 28 }}>
        {renderEmphasis(content.title, t.accent)}
      </SerifH>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 12,
          columnGap: 40,
          maxWidth: 720,
        }}
        className="street-rows"
      >
        {content.rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              borderBottom: `1px solid ${t.ruleSoft}`,
              paddingBottom: 10,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: t.inkMuted, letterSpacing: "0.04em" }}>
              {row.label}
            </span>
            <span style={{ color: t.ink, textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .street-rows { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────

function Footer({ t, content }: { t: StreetTokens; content: PropertyContent }) {
  const c = content.contact;
  const f = content.footer;
  return (
    <footer
      id="contact"
      style={{
        padding: "48px 40px 32px",
        borderTop: `1px solid ${t.rule}`,
        marginTop: 24,
      }}
      className="street-section"
    >
      <div
        style={{
          maxWidth: streetLayout.contentMax,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: 40,
        }}
        className="street-foot-grid"
      >
        <div>
          <p
            style={{
              fontFamily: "var(--street-serif)",
              fontStyle: "italic",
              color: t.ink,
              fontSize: 18,
              lineHeight: 1.45,
              margin: 0,
              maxWidth: 360,
            }}
          >
            {f.brandTagline}
          </p>
        </div>
        <div>
          <FooterColTitle t={t}>Visit</FooterColTitle>
          {c.addressLines.map((line, i) => (
            <div key={i} style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              {line}
            </div>
          ))}
        </div>
        <div>
          <FooterColTitle t={t}>Contact</FooterColTitle>
          {c.receptionLine && (
            <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              {c.receptionLine}
            </div>
          )}
          {c.reservationsPhone && (
            <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              <a href={`tel:${c.reservationsPhone.replace(/\s/g, "")}`} style={{ color: "inherit" }}>
                {c.reservationsPhone}
              </a>
            </div>
          )}
          {c.reservationsEmail && (
            <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              <a href={`mailto:${c.reservationsEmail}`} style={{ color: "inherit" }}>
                {c.reservationsEmail}
              </a>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          maxWidth: streetLayout.contentMax,
          margin: "32px auto 0",
          borderTop: `1px solid ${t.ruleSoft}`,
          paddingTop: 18,
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: t.inkMuted,
        }}
        className="street-foot-fineprint"
      >
        <span>© {new Date().getFullYear()}</span>
        <span style={{ display: "flex", gap: 18 }}>
          {f.fineprintLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </span>
      </div>
      <style>{`
        @media (max-width: 760px) {
          .street-foot-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .street-foot-fineprint { flex-direction: column; gap: 12px !important; }
        }
      `}</style>
    </footer>
  );
}

function FooterColTitle({
  t,
  children,
}: {
  t: StreetTokens;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: t.inkMuted,
        fontWeight: 500,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
