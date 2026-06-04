import type { ReactNode } from "react";

// Render text with light inline markup:
//   *word*  → italic + accent colour (Street's gold)
//   \n      → line break
//
// Lets admin-edited copy keep Street's italic gold accents without a
// full markdown parser. Mirrors Portico's renderEmphasis.

export function renderEmphasis(text: string, accent: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={lineIdx}>
        {parts.map((part, i) => {
          if (part.startsWith("*") && part.endsWith("*") && part.length >= 3) {
            return (
              <em
                key={i}
                style={{ fontStyle: "italic", color: accent, fontWeight: "inherit" }}
              >
                {part.slice(1, -1)}
              </em>
            );
          }
          return <span key={i}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}
