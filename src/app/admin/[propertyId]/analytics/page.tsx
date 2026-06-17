"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

const GA_RE = /^G-[A-Z0-9]{6,}$/;

export default function AnalyticsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [value, setValue] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = await r.json();
      const v = p?.gaMeasurementId ?? "";
      setValue(v);
      setOriginal(v);
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

  const trimmed = value.trim();
  const valid = trimmed === "" || GA_RE.test(trimmed);
  const dirty = trimmed !== original;

  async function save() {
    if (!token || !propertyId || !dirty || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gaMeasurementId: trimmed === "" ? null : trimmed }),
      });
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${r.status}`);
      }
      setOriginal(trimmed);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const active = original !== "" && GA_RE.test(original);

  return (
    <>
      <TopStrip
        title="Analytics"
        subtitle={loading ? "Loading…" : "Per-hotel Google Analytics · saves live, no deploy"}
        actions={
          <>
            <Btn variant="ghost" onClick={() => setValue(original)}>
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
          style={{ borderColor: "var(--a-red)", background: "var(--a-red-soft)", color: "var(--a-red)" }}
        >
          {error}
        </div>
      )}

      <div className="max-w-[640px]">
        <div
          className="rounded-lg border"
          style={{ borderColor: "var(--a-border)", background: "var(--a-card)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3 border-b text-[13.5px] font-semibold"
            style={{ borderColor: "var(--a-border-soft)" }}
          >
            <span>▲</span> Google Analytics 4
            <span className="ml-auto">
              {active ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium"
                  style={{ color: "var(--a-green)", background: "var(--a-green-soft)" }}
                >
                  ● Active
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium"
                  style={{ color: "var(--a-muted)", background: "var(--a-bg)" }}
                >
                  ● Not configured
                </span>
              )}
            </span>
          </div>

          <div className="p-4">
            <label
              className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: "var(--a-muted)" }}
            >
              Measurement ID
            </label>
            <div className="flex items-center gap-2.5 max-w-[380px]">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                spellCheck={false}
                className="w-full px-2.5 py-2 rounded border text-[13.5px] font-jbm tracking-wide"
                style={{
                  borderColor: valid ? "var(--a-border)" : "var(--a-red)",
                  color: "var(--a-ink)",
                }}
              />
              {trimmed !== "" && (
                <span className="text-[16px]" style={{ color: valid ? "var(--a-green)" : "var(--a-red)" }}>
                  {valid ? "✓" : "✕"}
                </span>
              )}
            </div>
            <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: "var(--a-muted)" }}>
              Find it in GA4 → <strong>Admin → Data streams → [your stream] → Measurement ID</strong>.
              Format <span className="font-jbm">G-XXXXXXXXXX</span>. Leave blank to turn analytics off for this hotel.
            </p>

            <div
              className="flex gap-2.5 items-start rounded-lg px-3 py-2.5 mt-4 text-[12.5px] leading-relaxed"
              style={{ background: "var(--a-blue-soft)", color: "var(--a-blue, #1e459e)" }}
            >
              <span>ⓘ</span>
              <div>
                Adding an ID automatically switches on the <strong>cookie consent banner</strong> for this
                hotel&apos;s site. Analytics loads <strong>only after a guest consents</strong> (Consent Mode v2).
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
