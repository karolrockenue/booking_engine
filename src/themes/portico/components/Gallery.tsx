"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { PorticoTokens } from "../tokens";

interface Tile {
  src: string;
  aspect: string;
  // grid placement helpers — only used by the editorial preview
  span?: number; // column span on the preview grid (1 or 2)
  rowSpan?: number;
}

interface Props {
  t: PorticoTokens;
  // The full set of photos — shown both in the preview grid and the lightbox.
  images: string[];
  // Optional preview grid layout. When omitted the preview shows up to 6 images.
  preview?: Tile[];
}

export function PorticoGallery({ t, images, preview }: Props) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  const open = useCallback((i: number) => setOpenAt(i), []);
  const close = useCallback(() => setOpenAt(null), []);

  const next = useCallback(() => {
    setOpenAt((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);

  const prev = useCallback(() => {
    setOpenAt((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (openAt === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    // Lock page scroll while the lightbox is open.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [openAt, close, next, prev]);

  return (
    <>
      {/* Preview grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gridTemplateRows: "auto auto",
          gap: 16,
        }}
        className="portico-gallery-grid"
      >
        <Tile t={t} src={images[0]} aspect="4 / 5" onClick={() => open(0)} />
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 16 }}>
          <Tile t={t} src={images[1]} aspect="4 / 3" onClick={() => open(1)} />
          <Tile t={t} src={images[2]} aspect="4 / 3" onClick={() => open(2)} />
        </div>
        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
          className="portico-gallery-row"
        >
          <Tile t={t} src={images[3] ?? images[0]} aspect="4 / 3" onClick={() => open(3 < images.length ? 3 : 0)} />
          <Tile t={t} src={images[4] ?? images[1]} aspect="4 / 3" onClick={() => open(4 < images.length ? 4 : 1)} />
          <Tile t={t} src={images[5] ?? images[2]} aspect="4 / 3" onClick={() => open(5 < images.length ? 5 : 2)} />
        </div>
      </div>

      <div style={{ marginTop: 32, textAlign: "right" }}>
        <button
          type="button"
          onClick={() => open(0)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: t.accent,
            borderBottom: `1px solid ${t.accent}`,
            paddingBottom: 2,
            cursor: "pointer",
            fontFamily: "var(--portico-sans)",
          }}
        >
          See full gallery →
        </button>
      </div>

      {/* Lightbox */}
      {openAt !== null && (
        <Lightbox
          t={t}
          images={images}
          index={openAt}
          onClose={close}
          onPrev={prev}
          onNext={next}
          onPick={(i) => setOpenAt(i)}
        />
      )}

      <style>{`
        @media (max-width: 920px) {
          .portico-gallery-grid {
            grid-template-columns: 1fr !important;
          }
          .portico-gallery-row {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

function Tile({
  t,
  src,
  aspect,
  onClick,
}: {
  t: PorticoTokens;
  src: string;
  aspect: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open photo"
      style={{
        position: "relative",
        aspectRatio: aspect,
        overflow: "hidden",
        background: t.bg2,
        cursor: "pointer",
        padding: 0,
        border: "none",
      }}
      className="portico-gallery-tile"
    >
      <Image src={src} alt="" fill sizes="(max-width: 920px) 100vw, 33vw" style={{ objectFit: "cover" }} />
    </button>
  );
}

function Lightbox({
  t,
  images,
  index,
  onClose,
  onPrev,
  onNext,
  onPick,
}: {
  t: PorticoTokens;
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPick: (i: number) => void;
}) {
  const src = images[index];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8, 12, 14, 0.94)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--portico-sans)",
        color: "#ece5d4",
      }}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "20px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(236,229,212,0.16)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            opacity: 0.7,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: "#ece5d4",
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            padding: "8px 0",
            fontFamily: "inherit",
          }}
        >
          Close ×
        </button>
      </div>

      {/* Stage */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 80px",
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          style={{
            position: "absolute",
            left: 24,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "1px solid rgba(236,229,212,0.4)",
            color: "#ece5d4",
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ‹
        </button>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            maxWidth: 1280,
          }}
        >
          <Image
            src={src}
            alt={`The Portico Hotel — gallery photo ${index + 1} of ${images.length}`}
            fill
            sizes="100vw"
            priority
            style={{ objectFit: "contain" }}
          />
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          style={{
            position: "absolute",
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "1px solid rgba(236,229,212,0.4)",
            color: "#ece5d4",
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ›
        </button>
      </div>

      {/* Thumbnails */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "16px 32px 24px",
          display: "flex",
          gap: 10,
          overflowX: "auto",
          borderTop: "1px solid rgba(236,229,212,0.16)",
          flexShrink: 0,
        }}
      >
        {images.map((img, i) => {
          const active = i === index;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Photo ${i + 1}`}
              style={{
                position: "relative",
                width: 96,
                height: 64,
                flexShrink: 0,
                border: active ? `2px solid ${t.accent}` : "1px solid rgba(236,229,212,0.2)",
                cursor: "pointer",
                background: "#15252a",
                padding: 0,
                opacity: active ? 1 : 0.55,
                transition: "opacity 150ms ease",
              }}
            >
              <Image src={img} alt="" fill sizes="96px" style={{ objectFit: "cover" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
