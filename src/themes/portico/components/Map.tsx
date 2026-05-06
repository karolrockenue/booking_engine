"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lon: number;
  accent: string;
  accentInk: string;
  zoom?: number;
}

// Carto Positron — clean light vector cartography. Free for non-commercial use
// via basemaps.cartocdn.com (attribution required and rendered by Leaflet).
export function PorticoMap({ lat, lon, accent, accentInk, zoom = 15 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // avoid scroll-jacking on the long page
      }).setView([lat, lon], zoom);

      L.control.zoom({ position: "topright" }).remove();

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      L.circleMarker([lat, lon], {
        radius: 9,
        color: accent,
        fillColor: accent,
        fillOpacity: 1,
        weight: 3,
      })
        .addTo(map)
        .bindPopup(
          `<span style="font-family: 'Cormorant Garamond', serif; font-size: 16px; color: ${accentInk}">The Portico Hotel</span>`
        );

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove: () => void } | null;
      if (m) m.remove();
      mapRef.current = null;
    };
  }, [lat, lon, zoom, accent, accentInk]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#faf8f3" }}
    />
  );
}
