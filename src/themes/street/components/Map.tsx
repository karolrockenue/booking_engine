import type { StreetTokens } from "../tokens";

// Static-feeling OpenStreetMap embed — no API key, no JS. The pin is the
// property's lat/lon. Style stays austere: hairline border, no rounded
// corners, sits as a quiet block in the Neighbourhood section.

export function StreetMap({
  t,
  lat,
  lon,
  label,
  height = 320,
}: {
  t: StreetTokens;
  lat: number;
  lon: number;
  label?: string;
  height?: number;
}) {
  const span = 0.012; // tight zoom — block-level
  const bbox = [
    (lon - span).toFixed(5),
    (lat - span / 2).toFixed(5),
    (lon + span).toFixed(5),
    (lat + span / 2).toFixed(5),
  ].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

  return (
    <div style={{ position: "relative", border: `1px solid ${t.rule}` }}>
      <iframe
        title={label ?? "Map"}
        src={src}
        style={{ width: "100%", height, border: 0, display: "block" }}
        loading="lazy"
      />
    </div>
  );
}
