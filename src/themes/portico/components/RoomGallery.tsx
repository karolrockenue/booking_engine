"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { PorticoTokens } from "../tokens";

function ArrowBtn({
  side,
  onClick,
  ariaLabel,
}: {
  side: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
}) {
  const base: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    background: "transparent",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    lineHeight: 1,
    fontFamily: "var(--portico-sans)",
    textShadow: "0 1px 6px rgba(0,0,0,0.45)",
    transition: "opacity 150ms ease",
    opacity: 0.9,
    padding: 0,
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        ...base,
        [side]: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.9")}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

interface Props {
  t: PorticoTokens;
  images: string[];
  roomName: string;
  /** Renders an aspect-ratio 4/3 hero with thumbnails below. */
}

export function RoomGallery({ t, images, roomName }: Props) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;
  const main = images[active] ?? images[0];
  const hasMany = images.length > 1;

  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setActive((i) => (i + 1) % images.length);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          overflow: "hidden",
          background: "#f1ede2",
        }}
      >
        <Image
          src={main}
          alt={`${roomName} — interior`}
          fill
          sizes="(max-width: 920px) 100vw, 460px"
          style={{ objectFit: "cover" }}
          unoptimized={main.startsWith("http")}
        />

        {hasMany && (
          <>
            <ArrowBtn side="left" onClick={prev} ariaLabel="Previous photo" />
            <ArrowBtn side="right" onClick={next} ariaLabel="Next photo" />
          </>
        )}
      </div>

      {images.length > 1 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(images.length, 6)}, 1fr)`,
            gap: 6,
          }}
          role="tablist"
          aria-label={`${roomName} photos`}
        >
          {images.slice(0, 6).map((src, i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Photo ${i + 1} of ${images.length}`}
                onClick={() => setActive(i)}
                style={{
                  position: "relative",
                  aspectRatio: "4 / 3",
                  overflow: "hidden",
                  border: isActive ? `2px solid ${t.accent}` : `1px solid ${t.rule}`,
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  opacity: isActive ? 1 : 0.7,
                  transition: "opacity 150ms ease, border-color 150ms ease",
                }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="80px"
                  style={{ objectFit: "cover" }}
                  unoptimized={src.startsWith("http")}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
