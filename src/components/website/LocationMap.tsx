"use client";

interface LocationMapProps {
  address: string;
  lat?: number;
  lng?: number;
  sectionTitle?: string;
  showNearby?: boolean;
  nearbyPlaces?: Array<{ name: string; distance: string }>;
}

export function LocationMap({
  address,
  lat,
  lng,
  sectionTitle = "Location",
  showNearby = false,
  nearbyPlaces,
}: LocationMapProps) {
  // Build a Google Maps embed URL from the address
  const mapQuery = encodeURIComponent(address);

  return (
    <section
      className="py-[var(--section-padding)]"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        {sectionTitle && (
          <h2
            className="text-3xl md:text-4xl mb-12 text-center"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
              letterSpacing: "var(--font-heading-letter-spacing)",
              color: "var(--color-text)",
            }}
          >
            {sectionTitle}
          </h2>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {/* Map embed */}
          <div
            className="w-full aspect-[4/3] overflow-hidden"
            style={{
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <iframe
              src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              title="Hotel location"
            />
          </div>

          {/* Address + nearby */}
          <div className="flex flex-col justify-center">
            <h3
              className="text-xl mb-4"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                color: "var(--color-text)",
              }}
            >
              Getting Here
            </h3>
            <p
              className="text-base mb-6"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-muted)",
                lineHeight: "var(--font-body-line-height)",
              }}
            >
              {address}
            </p>

            {showNearby && nearbyPlaces && nearbyPlaces.length > 0 && (
              <div>
                <h4
                  className="text-sm uppercase tracking-wider mb-3 font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Nearby
                </h4>
                <ul className="flex flex-col gap-2">
                  {nearbyPlaces.map((place) => (
                    <li
                      key={place.name}
                      className="flex justify-between text-sm"
                      style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--color-text-muted)",
                        paddingBottom: "8px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <span>{place.name}</span>
                      <span>{place.distance}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
