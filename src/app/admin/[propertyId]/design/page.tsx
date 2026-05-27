"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAdminAuth } from "../../layout";
import { TopStrip } from "@/components/admin/TopStrip";

type TemplateSlug = "default" | "portico-ivory";

interface Template {
  slug: TemplateSlug;
  label: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    slug: "default",
    label: "Default",
    description: "The legacy booking engine skin. Reads per-hotel brand tokens from the property's theme JSON.",
  },
  {
    slug: "portico-ivory",
    label: "Portico · Ivory",
    description: "Warm ivory ground, deep teal accent. Gallery-white booking flow. Ignores per-hotel theme JSON.",
  },
];

// Iframe renders the storefront at this width, then we scale it down to fit
// the card. 1280 = a typical desktop first-fold; the scale factor in the
// component picks the right zoom for the card's actual rendered width.
const PREVIEW_VIEWPORT_WIDTH = 1280;
const PREVIEW_VIEWPORT_HEIGHT = 800;

export default function DesignPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const { token } = useAdminAuth();

  const [current, setCurrent] = useState<TemplateSlug | null>(null);
  const [propertySlug, setPropertySlug] = useState<string | null>(null);
  const [saving, setSaving] = useState<TemplateSlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    fetch(`/api/admin/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.templateSlug) setCurrent(p.templateSlug as TemplateSlug);
        if (p?.slug) setPropertySlug(p.slug);
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
        subtitle="Pick the template this hotel renders. Previews are live — they iframe the storefront with each template applied."
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
  active,
  saving,
  disabled,
  onSelect,
}: {
  template: Template;
  propertySlug: string;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const previewUrl = `/${propertySlug}?_template=${template.slug}`;

  return (
    <div
      className="bg-white border rounded-md overflow-hidden transition-colors flex flex-col"
      style={{
        borderColor: active ? "var(--a-ink)" : "var(--a-border)",
        boxShadow: active ? "0 0 0 1px var(--a-ink)" : "none",
      }}
    >
      <PreviewFrame url={previewUrl} />

      <div className="p-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[13.5px] font-semibold tracking-tight" style={{ color: "var(--a-ink)" }}>
              {template.label}
            </div>
            {active && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10px] font-medium border"
                style={{
                  color: "var(--a-green)",
                  background: "var(--a-green-soft)",
                  borderColor: "rgba(0,135,90,0.25)",
                }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: "currentColor" }} />
                active
              </span>
            )}
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: "var(--a-muted)" }}>
            {template.description}
          </div>
          <div className="text-[11px] font-jbm mt-2" style={{ color: "var(--a-muted)" }}>
            {template.slug}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <a
            href={previewUrl}
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
