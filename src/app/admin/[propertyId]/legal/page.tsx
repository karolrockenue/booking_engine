"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";
import { LEGAL_SLUGS, LEGAL_LABELS, type LegalSlug } from "@/lib/legal-constants";

interface LegalDraft {
  title: string;
  body: string;
  published: boolean;
}

type DraftMap = Record<LegalSlug, LegalDraft>;

function emptyDrafts(): DraftMap {
  return LEGAL_SLUGS.reduce((acc, slug) => {
    acc[slug] = { title: LEGAL_LABELS[slug], body: "", published: false };
    return acc;
  }, {} as DraftMap);
}

export default function LegalPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [draft, setDraft] = useState<DraftMap>(emptyDrafts());
  const [original, setOriginal] = useState<DraftMap>(emptyDrafts());
  const [propertySlug, setPropertySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [legalRes, propertyRes] = await Promise.all([
        fetch(`/api/admin/properties/${propertyId}/legal`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/properties/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!legalRes.ok) throw new Error(`HTTP ${legalRes.status}`);
      const rows = (await legalRes.json()) as Array<
        LegalDraft & { slug: string }
      >;
      const next = emptyDrafts();
      for (const r of rows) {
        if ((LEGAL_SLUGS as readonly string[]).includes(r.slug)) {
          next[r.slug as LegalSlug] = {
            title: r.title,
            body: r.body ?? "",
            published: r.published,
          };
        }
      }
      setDraft(next);
      setOriginal(structuredClone(next));
      if (propertyRes.ok) {
        const p = await propertyRes.json();
        setPropertySlug(p?.slug ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  async function save() {
    if (!token || !propertyId || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      for (const slug of LEGAL_SLUGS) {
        if (JSON.stringify(draft[slug]) !== JSON.stringify(original[slug])) {
          const r = await fetch(
            `/api/admin/properties/${propertyId}/legal`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ slug, ...draft[slug] }),
            }
          );
          if (!r.ok) {
            const b = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(b.error ?? `HTTP ${r.status}`);
          }
        }
      }
      setOriginal(structuredClone(draft));
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  function patch(slug: LegalSlug, value: Partial<LegalDraft>) {
    setDraft((d) => ({ ...d, [slug]: { ...d[slug], ...value } }));
  }

  return (
    <>
      <TopStrip
        title="Legal pages"
        subtitle={
          loading
            ? "Loading…"
            : "Privacy, cookies, accessibility & terms · markdown · saves live · only published pages appear in the footer"
        }
        actions={
          <>
            <Btn variant="ghost" onClick={() => setDraft(original)}>
              {dirty ? "Discard" : ""}
            </Btn>
            <Btn variant="primary" onClick={save}>
              {saving ? "Saving…" : dirty ? "Save changes" : savedAt ? "Saved" : "Save changes"}
            </Btn>
          </>
        }
      />

      {error && (
        <div
          className="border-l-4 px-3 py-2 mb-4 text-[12.5px]"
          style={{
            borderColor: "var(--a-red)",
            background: "var(--a-red-soft)",
            color: "var(--a-red)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 max-w-[860px]">
        {LEGAL_SLUGS.map((slug) => (
          <LegalCard
            key={slug}
            slug={slug}
            value={draft[slug]}
            propertySlug={propertySlug}
            onChange={(v) => patch(slug, v)}
          />
        ))}
      </div>
    </>
  );
}

function LegalCard({
  slug,
  value,
  propertySlug,
  onChange,
}: {
  slug: LegalSlug;
  value: LegalDraft;
  propertySlug: string | null;
  onChange: (v: Partial<LegalDraft>) => void;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--a-border)", background: "var(--a-card)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="text-[10.5px] uppercase tracking-wider font-jbm"
          style={{ color: "var(--a-muted)" }}
        >
          {LEGAL_LABELS[slug]}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--a-ink-2)" }}>
          <input
            type="checkbox"
            checked={value.published}
            onChange={(e) => onChange({ published: e.target.checked })}
          />
          Published
        </label>
        {value.published && propertySlug && (
          <a
            href={`/${propertySlug}/legal/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] underline"
            style={{ color: "var(--a-accent)" }}
          >
            View ↗
          </a>
        )}
      </div>

      <input
        value={value.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Page title"
        className="w-full mb-2 px-2.5 py-1.5 rounded border text-[13.5px]"
        style={{ borderColor: "var(--a-border)", color: "var(--a-ink)" }}
      />
      <textarea
        value={value.body}
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder="Page content — markdown supported (## headings, **bold**, lists, [links](https://…))"
        rows={10}
        className="w-full px-2.5 py-2 rounded border text-[13px] font-jbm leading-relaxed"
        style={{ borderColor: "var(--a-border)", color: "var(--a-ink)" }}
      />
    </div>
  );
}
