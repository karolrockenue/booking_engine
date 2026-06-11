"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAdminAuth } from "../../layout";
import { TopStrip, Badge } from "@/components/admin/TopStrip";
import {
  getTemplateSchema,
  readinessFor,
  type PhotoSlotKey,
  type TemplateSchema,
} from "@/lib/template-schema";

type TemplateSlug = "default" | "portico-ivory" | "street-ivory" | "editorial-calm";

interface Template {
  slug: TemplateSlug;
  label: string;
  description: string;
}

interface Photo {
  slot: PhotoSlotKey | "marketing";
  roomTypeId: string | null;
}

interface RoomType {
  id: string;
  name: string;
}

interface PhotoCounts {
  hero: number;
  gallery: number;
  neighbourhood: number;
  roomsCovered: number; // room types with ≥1 room photo
  roomsTotal: number;
}

const TEMPLATES: Template[] = [
  {
    slug: "default",
    label: "Default",
    description: "Clean, neutral booking engine. Applies your hotel's brand colours and typography.",
  },
  {
    slug: "portico-ivory",
    label: "Portico · Ivory",
    description: "Editorial design — warm ivory ground, deep teal accent, full-bleed photography. A fixed brand voice.",
  },
  {
    slug: "street-ivory",
    label: "Street · Ivory",
    description: "Cinematic-light for limited-service hotels — same warm ivory, gold-italic accent, ghost-bordered buttons. Photo speaks for itself; type breathes.",
  },
  {
    slug: "editorial-calm",
    label: "Editorial · Calm",
    description: "Off-white paper, mono bracketed labels, pill buttons, dotted-leader extras and a floating basket. Boutique-guesthouse voice — one decision at a time.",
  },
];

// Iframe renders the storefront at this width, then we scale it down to fit
// the card. 1100 keeps hero copy readable at typical admin card widths.
const PREVIEW_VIEWPORT_WIDTH = 1100;
const PREVIEW_VIEWPORT_HEIGHT = 690;

export default function DesignPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const { token } = useAdminAuth();

  const [current, setCurrent] = useState<TemplateSlug | null>(null);
  const [propertySlug, setPropertySlug] = useState<string | null>(null);
  const [counts, setCounts] = useState<PhotoCounts | null>(null);
  const [saving, setSaving] = useState<TemplateSlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/properties/${propertyId}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([p, photos]) => {
        if (p?.templateSlug) setCurrent(p.templateSlug as TemplateSlug);
        if (p?.slug) setPropertySlug(p.slug);
        if (photos) setCounts(computeCounts(photos.photos ?? [], photos.rooms ?? []));
      })
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  async function assign(slug: TemplateSlug) {
    if (slug === current || saving) return;
    setSaving(slug);
    setError(null);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateSlug: slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      const updated = await res.json();
      setCurrent(updated.templateSlug as TemplateSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <TopStrip
        title="Design"
        subtitle="Pick the template this hotel renders. Each preview is the real storefront, live."
        actions={null}
      />

      {error && (
        <div
          className="mb-4 p-3 rounded-md border text-[13px]"
          style={{
            color: "var(--a-red)",
            background: "var(--a-red-soft)",
            borderColor: "rgba(198,40,40,0.25)",
          }}
        >
          {error}
        </div>
      )}

      {loading || !propertySlug ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tpl) => (
            <TemplateCard
              key={tpl.slug}
              template={tpl}
              propertySlug={propertySlug}
              schema={getTemplateSchema(tpl.slug)}
              counts={counts}
              active={current === tpl.slug}
              saving={saving === tpl.slug}
              disabled={saving !== null}
              onSelect={() => assign(tpl.slug)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TemplateCard({
  template,
  propertySlug,
  schema,
  counts,
  active,
  saving,
  disabled,
  onSelect,
}: {
  template: Template;
  propertySlug: string;
  schema: TemplateSchema;
  counts: PhotoCounts | null;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const previewUrl = `/${propertySlug}?_template=${template.slug}`;
  // Active card opens the real assigned URL; inactive opens the preview URL.
  const openUrl = active ? `/${propertySlug}` : previewUrl;
  const [hover, setHover] = useState(false);

  const borderColor = active
    ? "var(--a-ink)"
    : hover
      ? "var(--a-muted)"
      : "var(--a-border)";
  const boxShadow = active
    ? "0 0 0 1px var(--a-ink), inset 0 0 0 1px rgba(20,24,29,0.04)"
    : hover
      ? "0 4px 14px -8px rgba(20,24,29,0.18)"
      : "none";

  return (
    <div
      className="bg-white border rounded-md overflow-hidden flex flex-col"
      style={{
        borderColor,
        boxShadow,
        transition: "border-color 120ms, box-shadow 160ms",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <PreviewFrame url={previewUrl} />

      <div className="p-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[13.5px] font-semibold tracking-tight" style={{ color: "var(--a-ink)" }}>
              {template.label}
            </div>
            {active && <Badge text="active" tone="green" />}
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: "var(--a-muted)" }}>
            {template.description}
          </div>
          <ReadinessLine schema={schema} counts={counts} />
          <div className="text-[11px] font-jbm mt-2" style={{ color: "var(--a-muted)" }}>
            {template.slug}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded text-[11.5px] font-medium border inline-flex items-center justify-center"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface)", color: "var(--a-ink)" }}
          >
            Open ↗
          </a>
          <button
            onClick={onSelect}
            disabled={disabled || active}
            className="px-2.5 py-1 rounded text-[11.5px] font-medium border"
            style={{
              borderColor: active ? "var(--a-border)" : "var(--a-ink)",
              background: active ? "var(--a-surface)" : "var(--a-ink)",
              color: active ? "var(--a-muted)" : "#fff",
              cursor: active ? "default" : disabled ? "wait" : "pointer",
              opacity: disabled && !saving && !active ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : active ? "Active" : "Use this"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadinessLine({
  schema,
  counts,
}: {
  schema: TemplateSchema;
  counts: PhotoCounts | null;
}) {
  if (schema.ignoresUploads) {
    return (
      <div className="text-[11.5px] mt-2 font-jbm" style={{ color: "var(--a-amber)" }}>
        Doesn&apos;t render uploaded photos yet.
      </div>
    );
  }
  if (!counts) return null;

  const parts: Array<{ label: string; ok: boolean; detail: string }> = [];

  if (schema.photos.hero) {
    const r = readinessFor(schema.photos.hero, counts.hero);
    parts.push({ label: "Hero", ok: r.ok, detail: r.ok ? "✓" : "missing" });
  }
  if (schema.photos.gallery) {
    const r = readinessFor(schema.photos.gallery, counts.gallery);
    const min = schema.photos.gallery.min ?? 1;
    parts.push({
      label: "Gallery",
      ok: r.ok,
      detail: `${counts.gallery}/${min}`,
    });
  }
  if (schema.photos.room) {
    const ok = counts.roomsTotal > 0 && counts.roomsCovered === counts.roomsTotal;
    parts.push({
      label: "Rooms",
      ok,
      detail: counts.roomsTotal === 0 ? "no rooms synced" : `${counts.roomsCovered}/${counts.roomsTotal}`,
    });
  }

  if (parts.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-jbm text-[11px]">
      {parts.map((p) => (
        <span
          key={p.label}
          style={{ color: p.ok ? "var(--a-green)" : "var(--a-muted)" }}
        >
          {p.label} <span style={{ color: "var(--a-muted)" }}>{p.detail}</span>
        </span>
      ))}
    </div>
  );
}

function computeCounts(photos: Photo[], rooms: RoomType[]): PhotoCounts {
  const hero = photos.filter((p) => p.slot === "hero").length;
  const gallery = photos.filter((p) => p.slot === "gallery").length;
  const neighbourhood = photos.filter((p) => p.slot === "neighbourhood").length;
  const roomTypesCovered = new Set(
    photos.filter((p) => p.slot === "room" && p.roomTypeId).map((p) => p.roomTypeId!)
  );
  return {
    hero,
    gallery,
    neighbourhood,
    roomsCovered: roomTypesCovered.size,
    roomsTotal: rooms.length,
  };
}

function PreviewFrame({ url }: { url: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(w / PREVIEW_VIEWPORT_WIDTH);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden border-b"
      style={{
        height: PREVIEW_VIEWPORT_HEIGHT * scale,
        background: "#f5f5f5",
        borderColor: "var(--a-border)",
      }}
    >
      <iframe
        src={url}
        loading="lazy"
        sandbox="allow-same-origin allow-scripts"
        title="template preview"
        style={{
          width: PREVIEW_VIEWPORT_WIDTH,
          height: PREVIEW_VIEWPORT_HEIGHT,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
