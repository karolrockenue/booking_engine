import type { StreetTokens } from "../tokens";

// A quiet photo strip — used in the homepage "Inside" section. Stays small
// and behaves like a contact sheet, never a hero. Mobile collapses to two-up.

export function StreetGallery({
  t,
  urls,
  alt = "Inside",
}: {
  t: StreetTokens;
  urls: ReadonlyArray<string>;
  alt?: string;
}) {
  const visible = urls.slice(0, 6);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}
      className="street-gallery"
    >
      {visible.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={`${alt} ${i + 1}`}
          style={{
            width: "100%",
            aspectRatio: "4/3",
            objectFit: "cover",
            display: "block",
            background: t.bg2,
          }}
          loading="lazy"
        />
      ))}
      <style>{`
        @media (max-width: 760px) {
          .street-gallery {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
