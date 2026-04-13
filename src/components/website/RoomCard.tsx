"use client";

interface RoomCardProps {
  name: string;
  description?: string;
  imageUrl?: string;
  priceFrom?: number;
  currency?: string;
  maxOccupancy?: number;
  amenities?: string[];
  href?: string;
}

export function RoomCard({
  name,
  description,
  imageUrl,
  priceFrom,
  currency = "GBP",
  maxOccupancy,
  amenities,
  href,
}: RoomCardProps) {
  const currencySymbol = currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";

  const content = (
    <div
      className="group overflow-hidden transition-shadow hover:shadow-lg"
      style={{
        borderRadius: "var(--radius-card)",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Image */}
      <div
        className="w-full aspect-[3/2] bg-cover bg-center transition-transform group-hover:scale-105"
        style={{
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundColor: "var(--color-border)",
        }}
      />

      {/* Content */}
      <div className="p-6">
        <h3
          className="text-xl mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
            color: "var(--color-text)",
          }}
        >
          {name}
        </h3>

        {description && (
          <p
            className="text-sm mb-4 line-clamp-2"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--font-body-line-height)",
            }}
          >
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {maxOccupancy && (
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Sleeps {maxOccupancy}
              </span>
            )}
          </div>
          {priceFrom != null && (
            <span
              className="text-lg font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              From {currencySymbol}{priceFrom}
              <span
                className="text-xs font-normal ml-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                /night
              </span>
            </span>
          )}
        </div>

        {/* Amenities */}
        {amenities && amenities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {amenities.slice(0, 4).map((a) => (
              <span
                key={a}
                className="text-xs px-2 py-1"
                style={{
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text-muted)",
                  borderRadius: "var(--radius)",
                }}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }
  return content;
}
