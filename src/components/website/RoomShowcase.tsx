"use client";

import { RoomCard } from "./RoomCard";

interface Room {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceFrom?: number;
  maxOccupancy?: number;
  amenities?: string[];
}

interface RoomShowcaseProps {
  rooms: Room[];
  currency?: string;
  layout?: "grid" | "carousel" | "stacked";
  showPriceFrom?: boolean;
  limit?: number;
  sectionTitle?: string;
}

export function RoomShowcase({
  rooms,
  currency = "GBP",
  layout = "grid",
  showPriceFrom = true,
  limit,
  sectionTitle = "Our Rooms",
}: RoomShowcaseProps) {
  const displayed = limit ? rooms.slice(0, limit) : rooms;

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

        {layout === "stacked" ? (
          <div className="flex flex-col gap-8">
            {displayed.map((room) => (
              <RoomCard
                key={room.id}
                name={room.name}
                description={room.description}
                imageUrl={room.imageUrl}
                priceFrom={showPriceFrom ? room.priceFrom : undefined}
                currency={currency}
                maxOccupancy={room.maxOccupancy}
                amenities={room.amenities}
                href={`/rooms/${room.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {displayed.map((room) => (
              <RoomCard
                key={room.id}
                name={room.name}
                description={room.description}
                imageUrl={room.imageUrl}
                priceFrom={showPriceFrom ? room.priceFrom : undefined}
                currency={currency}
                maxOccupancy={room.maxOccupancy}
                amenities={room.amenities}
                href={`/rooms/${room.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
