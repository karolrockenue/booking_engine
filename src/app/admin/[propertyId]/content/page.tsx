"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";
import {
  defaultContent,
  type PropertyContent,
  type ContentKey,
  CONTENT_KEYS,
} from "@/lib/content-defaults";

interface ContentBlock {
  key: string;
  content: unknown;
}

interface RoomTypeRow {
  id: string;
  name: string;
  description: string | null;
  maxOccupancy: number | null;
  baseOccupancy: number | null;
  amenities: unknown;
  otaRoomId: string;
}

export default function ContentPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [draft, setDraft] = useState<PropertyContent>(defaultContent);
  const [original, setOriginal] = useState<PropertyContent>(defaultContent);
  const [rooms, setRooms] = useState<RoomTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [contentRes, roomsRes] = await Promise.all([
        fetch(`/api/admin/properties/${propertyId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/properties/${propertyId}/rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
      if (!roomsRes.ok) throw new Error(`HTTP ${roomsRes.status}`);
      const blocks = (await contentRes.json()) as ContentBlock[];
      const merged = mergeBlocks(blocks);
      setDraft(merged);
      setOriginal(merged);
      setRooms((await roomsRes.json()) as RoomTypeRow[]);
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
      // Save each section that's actually changed.
      for (const k of CONTENT_KEYS) {
        if (JSON.stringify(draft[k]) !== JSON.stringify(original[k])) {
          const r = await fetch(`/api/admin/properties/${propertyId}/content`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ key: k, content: draft[k] }),
          });
          if (!r.ok) {
            const body = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${r.status}`);
          }
        }
      }
      setOriginal(draft);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setDraft(original);
    setSavedAt(null);
    setError(null);
  }

  function patch<K extends ContentKey>(key: K, value: PropertyContent[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <>
      <TopStrip
        title="Content & copy"
        subtitle={
          loading
            ? "Loading…"
            : "Edit text shown on customer pages · saves live, no deploy needed · use *word* for italic accent"
        }
        actions={
          <>
            <Btn variant="ghost" onClick={discardChanges}>
              {dirty ? "Discard" : ""}
            </Btn>
            <Btn variant="primary" onClick={save}>
              {saving
                ? "Saving…"
                : dirty
                  ? "Save changes"
                  : savedAt
                    ? "Saved"
                    : "Save changes"}
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

      {loading && !draft ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className="flex flex-col gap-4">
            <HeroCard value={draft.hero} onChange={(v) => patch("hero", v)} />
            <NeighbourhoodCard
              value={draft.neighbourhood}
              onChange={(v) => patch("neighbourhood", v)}
            />
            <GoodToKnowCard
              value={draft.goodToKnow}
              onChange={(v) => patch("goodToKnow", v)}
            />
            <FooterCard
              value={draft.footer}
              onChange={(v) => patch("footer", v)}
            />
            <RoomsCard rooms={rooms} />
          </div>
          <div className="flex flex-col gap-4">
            <ContactCard
              value={draft.contact}
              onChange={(v) => patch("contact", v)}
            />
            <PreviewCard propertyId={propertyId} dirty={dirty} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── helpers ──────────────────────────────────────────────────────

function mergeBlocks(blocks: ContentBlock[]): PropertyContent {
  const out = structuredClone(defaultContent);
  for (const b of blocks) {
    if ((CONTENT_KEYS as readonly string[]).includes(b.key) && b.content && typeof b.content === "object") {
      const k = b.key as ContentKey;
      out[k] = { ...out[k], ...(b.content as Record<string, unknown>) } as never;
    }
  }
  return out;
}

// ─── cards ────────────────────────────────────────────────────────

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      <div
        className="px-4 py-3 flex items-center gap-3 border-b"
        style={{ borderColor: "var(--a-border-soft)" }}
      >
        <h2 className="text-[12.5px] font-semibold">{title}</h2>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--a-muted)" }}>
            {hint}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label
        className="block text-[11.5px] font-medium mb-1"
        style={{ color: "var(--a-ink-2)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[11px] mt-1" style={{ color: "var(--a-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "6px 10px",
  border: "1px solid var(--a-border)",
  borderRadius: "4px",
  fontSize: "12.5px",
  background: "var(--a-surface)",
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style as object) }} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...inputStyle,
        minHeight: 60,
        fontFamily: "inherit",
        ...(props.style as object),
      }}
    />
  );
}

// ─── Hero ─────────────────────────────────────────────────────────

function HeroCard({
  value,
  onChange,
}: {
  value: PropertyContent["hero"];
  onChange: (v: PropertyContent["hero"]) => void;
}) {
  return (
    <Card title="Hero" hint="shown above the fold on /">
      <Field label="Eyebrow">
        <Input
          value={value.eyebrow}
          onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
        />
      </Field>
      <Field
        label="Headline"
        hint="Use line breaks for stacked lines · *italic* for accent"
      >
        <Textarea
          rows={3}
          value={value.headline}
          onChange={(e) => onChange({ ...value, headline: e.target.value })}
        />
      </Field>
      <Field label="Press quote">
        <Input
          value={value.pressQuote}
          onChange={(e) => onChange({ ...value, pressQuote: e.target.value })}
        />
      </Field>
      <Field label="Press quote attribution">
        <Input
          value={value.pressQuoteAttribution}
          onChange={(e) =>
            onChange({ ...value, pressQuoteAttribution: e.target.value })
          }
        />
      </Field>
      <Field label="Book CTA label">
        <Input
          value={value.bookCtaLabel}
          onChange={(e) => onChange({ ...value, bookCtaLabel: e.target.value })}
        />
      </Field>
    </Card>
  );
}

// ─── Neighbourhood ────────────────────────────────────────────────

function NeighbourhoodCard({
  value,
  onChange,
}: {
  value: PropertyContent["neighbourhood"];
  onChange: (v: PropertyContent["neighbourhood"]) => void;
}) {
  return (
    <Card title="Neighbourhood" hint="01 section + map">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Eyebrow">
          <Input
            value={value.eyebrow}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Title" hint="*italic* for accent">
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Body">
        <Textarea
          rows={3}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </Field>
      <Field
        label="Nearby places"
        hint="One per line · format: Place · distance"
      >
        <Textarea
          rows={6}
          value={value.nearby.map((p) => `${p.place} · ${p.dist}`).join("\n")}
          onChange={(e) =>
            onChange({ ...value, nearby: parseNearby(e.target.value) })
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Map latitude" hint="auto-fills from Cloudbeds">
          <Input
            type="number"
            step="any"
            value={value.mapLat}
            onChange={(e) =>
              onChange({ ...value, mapLat: parseFloat(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Map longitude" hint="auto-fills from Cloudbeds">
          <Input
            type="number"
            step="any"
            value={value.mapLon}
            onChange={(e) =>
              onChange({ ...value, mapLon: parseFloat(e.target.value) || 0 })
            }
          />
        </Field>
      </div>
    </Card>
  );
}

function parseNearby(raw: string): Array<{ place: string; dist: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [place, ...rest] = line.split(/\s*·\s*/);
      return { place: place ?? "", dist: rest.join(" · ") };
    });
}

// ─── Good to know ─────────────────────────────────────────────────

function GoodToKnowCard({
  value,
  onChange,
}: {
  value: PropertyContent["goodToKnow"];
  onChange: (v: PropertyContent["goodToKnow"]) => void;
}) {
  return (
    <Card title="Good to know" hint="03 section · check-in/out, wifi, parking, etc.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Eyebrow">
          <Input
            value={value.eyebrow}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Title" hint="*italic* for accent">
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Rows"
        hint="One per line · format: Label · Value · Check-in/Check-out auto-fill from Cloudbeds"
      >
        <Textarea
          rows={8}
          value={value.rows.map((r) => `${r.label} · ${r.value}`).join("\n")}
          onChange={(e) =>
            onChange({ ...value, rows: parseLabelValueRows(e.target.value) })
          }
        />
      </Field>
    </Card>
  );
}

function parseLabelValueRows(
  raw: string
): Array<{ label: string; value: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(/\s*·\s*/);
      return { label: label ?? "", value: rest.join(" · ") };
    });
}

// ─── Contact ──────────────────────────────────────────────────────

function ContactCard({
  value,
  onChange,
}: {
  value: PropertyContent["contact"];
  onChange: (v: PropertyContent["contact"]) => void;
}) {
  return (
    <Card
      title="Contact"
      hint="footer · confirmation emails · auto-fills from Cloudbeds, edits override"
    >
      <Field
        label="Address"
        hint="One line per row · auto-fills from Cloudbeds"
      >
        <Textarea
          rows={3}
          value={value.addressLines.join("\n")}
          onChange={(e) =>
            onChange({
              ...value,
              addressLines: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </Field>
      <Field label="Reception line">
        <Input
          value={value.receptionLine}
          onChange={(e) => onChange({ ...value, receptionLine: e.target.value })}
        />
      </Field>
      <Field label="Reservations phone" hint="auto-fills from Cloudbeds">
        <Input
          value={value.reservationsPhone}
          onChange={(e) =>
            onChange({ ...value, reservationsPhone: e.target.value })
          }
        />
      </Field>
      <Field label="Reservations email" hint="auto-fills from Cloudbeds">
        <Input
          type="email"
          value={value.reservationsEmail}
          onChange={(e) =>
            onChange({ ...value, reservationsEmail: e.target.value })
          }
        />
      </Field>
      <Field label="General email" hint="auto-fills from Cloudbeds">
        <Input
          type="email"
          value={value.generalEmail}
          onChange={(e) => onChange({ ...value, generalEmail: e.target.value })}
        />
      </Field>
    </Card>
  );
}

// ─── Footer ───────────────────────────────────────────────────────

function FooterCard({
  value,
  onChange,
}: {
  value: PropertyContent["footer"];
  onChange: (v: PropertyContent["footer"]) => void;
}) {
  return (
    <Card title="Footer" hint="brand line · fine-print legal links">
      <Field label="Brand tagline" hint="shown italic in the footer">
        <Textarea
          rows={2}
          value={value.brandTagline}
          onChange={(e) => onChange({ ...value, brandTagline: e.target.value })}
        />
      </Field>
      <Field
        label="Fine-print links"
        hint="One per line · format: Label · /url   (use # for placeholder)"
      >
        <Textarea
          rows={6}
          value={value.fineprintLinks
            .map((l) => `${l.label} · ${l.href}`)
            .join("\n")}
          onChange={(e) =>
            onChange({
              ...value,
              fineprintLinks: parseLabelHrefRows(e.target.value),
            })
          }
        />
      </Field>
    </Card>
  );
}

function parseLabelHrefRows(
  raw: string
): Array<{ label: string; href: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(/\s*·\s*/);
      return { label: label ?? "", href: rest.join(" · ") || "#" };
    });
}

// ─── Rooms (read-only, synced from Cloudbeds) ─────────────────────

function RoomsCard({ rooms }: { rooms: RoomTypeRow[] }) {
  return (
    <Card
      title="Rooms"
      hint="synced from Cloudbeds · read-only · edit in your PMS"
    >
      {rooms.length === 0 ? (
        <div className="text-[12.5px]" style={{ color: "var(--a-muted)" }}>
          No room types synced yet. Connect Cloudbeds and trigger a sync.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map((r) => {
            const occ =
              r.maxOccupancy != null
                ? `${r.baseOccupancy ?? 1}–${r.maxOccupancy} guests`
                : null;
            const amenities = Array.isArray(r.amenities)
              ? (r.amenities as unknown[]).filter(
                  (a) => typeof a === "string"
                ) as string[]
              : [];
            return (
              <div
                key={r.id}
                className="border rounded-md p-3"
                style={{ borderColor: "var(--a-border-soft)" }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="text-[13px] font-semibold">{r.name}</div>
                  {occ && (
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--a-muted)" }}
                    >
                      {occ}
                    </div>
                  )}
                </div>
                {r.description && (
                  <div
                    className="text-[12px] mb-2"
                    style={{ color: "var(--a-ink-2)" }}
                  >
                    {r.description}
                  </div>
                )}
                {amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {amenities.map((a, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-1.5 py-0.5 rounded border"
                        style={{
                          borderColor: "var(--a-border-soft)",
                          color: "var(--a-ink-2)",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--a-muted)" }}
                  >
                    No amenities listed in Cloudbeds.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Preview ──────────────────────────────────────────────────────

function PreviewCard({
  propertyId,
  dirty,
}: {
  propertyId: string;
  dirty: boolean;
}) {
  return (
    <Card title="Preview">
      <div className="text-[12px]" style={{ color: "var(--a-muted)" }}>
        {dirty ? (
          <>
            <strong style={{ color: "var(--a-amber)" }}>Unsaved changes.</strong>
            <br />
            Save first, then open the live site to see them. The site reads
            content from the DB on every request — no deploy needed.
          </>
        ) : (
          "Saved content shows on the live site immediately. The customer-facing pages read from the DB on every request — no deploy needed."
        )}
      </div>
    </Card>
  );
}
