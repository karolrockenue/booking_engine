"use client";

import { useState } from "react";

interface GalleryImage {
  url: string;
  alt?: string;
}

interface GalleryProps {
  images: GalleryImage[];
  layout?: "grid" | "masonry";
  columns?: number;
  sectionTitle?: string;
}

export function Gallery({
  images,
  layout = "grid",
  columns = 3,
  sectionTitle = "Gallery",
}: GalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(columns, 2)}, 1fr)`,
          }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              className="overflow-hidden cursor-pointer aspect-[3/2]"
              style={{ borderRadius: "var(--radius-card)" }}
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={img.url}
                alt={img.alt ?? ""}
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Responsive columns */}
      <style>{`
        @media (min-width: 768px) {
          .gallery-grid { grid-template-columns: repeat(${columns}, 1fr) !important; }
        }
      `}</style>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl p-2"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            &times;
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white text-3xl p-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              aria-label="Previous"
            >
              &#8249;
            </button>
          )}

          <img
            src={images[lightboxIndex].url}
            alt={images[lightboxIndex].alt ?? ""}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < images.length - 1 && (
            <button
              className="absolute right-4 text-white text-3xl p-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              aria-label="Next"
            >
              &#8250;
            </button>
          )}
        </div>
      )}
    </section>
  );
}
