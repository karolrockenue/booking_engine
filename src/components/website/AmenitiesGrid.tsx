"use client";

interface Amenity {
  label: string;
  icon?: string;
}

interface AmenitiesGridProps {
  amenities: Amenity[];
  columns?: number;
  sectionTitle?: string;
}

const defaultIcons: Record<string, string> = {
  wifi: "Wi-Fi",
  parking: "Parking",
  breakfast: "Breakfast",
  pool: "Pool",
  spa: "Spa",
  gym: "Gym",
  restaurant: "Restaurant",
  bar: "Bar",
  "room service": "Room Service",
  concierge: "Concierge",
  laundry: "Laundry",
  "air conditioning": "AC",
};

export function AmenitiesGrid({
  amenities,
  columns = 4,
  sectionTitle = "Amenities",
}: AmenitiesGridProps) {
  return (
    <section
      className="py-[var(--section-padding)]"
      style={{ backgroundColor: "var(--color-background)" }}
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

        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: `repeat(${Math.min(columns, 2)}, 1fr)`,
          }}
        >
          {amenities.map((amenity) => (
            <div
              key={amenity.label}
              className="flex flex-col items-center text-center p-6"
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3 text-lg"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  color: "#FFFFFF",
                }}
              >
                {amenity.icon ?? amenity.label.charAt(0).toUpperCase()}
              </div>
              <span
                className="text-sm font-medium"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text)",
                }}
              >
                {amenity.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Responsive override for larger screens */}
      <style>{`
        @media (min-width: 768px) {
          .amenities-grid { grid-template-columns: repeat(${columns}, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
