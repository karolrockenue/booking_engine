"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

type PricingModel = "per_stay" | "per_guest_per_night";

interface ExtraRow {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
  pricingModel: PricingModel;
}

const MODELS: Array<{ value: PricingModel; label: string }> = [
  { value: "per_stay", label: "Per stay (once)" },
  { value: "per_guest_per_night", label: "Per guest, per night" },
];

function symbolFor(c: string): string {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : "$";
}

export default function ExtrasPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [list, setList] = useState<ExtraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/extras`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { extras: ExtraRow[] };
      setList(d.extras);
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

  async function setModel(id: string, pricingModel: PricingModel) {
    setList((cur) => cur.map((e) => (e.id === id ? { ...e, pricingModel } : e)));
    setSavingId(id);
    setSavedId(null);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/extras`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ extraId: id, pricingModel }),
      });
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${r.status}`);
      }
      setSavedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      load(); // re-pull truth on failure
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <TopStrip
        title="Extras"
        subtitle={
          loading
            ? "Loading…"
            : `${list.length} ${list.length === 1 ? "extra" : "extras"} · synced from Cloudbeds · set how each one is charged`
        }
        actions={
          <Btn href={`/admin/${propertyId}/cloudbeds`}>Re-sync from Cloudbeds</Btn>
        }
      />

      {loading && list.length === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : error && list.length === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      ) : list.length === 0 ? (
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          No extras yet. Run a Cloudbeds sync to populate.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((e) => (
            <div
              key={e.id}
              className="border rounded-md px-3.5 py-2.5 flex items-center gap-3"
              style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{e.name}</div>
                <div
                  className="font-jbm text-[11px] mt-0.5 truncate"
                  style={{ color: "var(--a-muted)" }}
                >
                  {symbolFor(e.currency)}
                  {(e.priceMinorUnits / 100).toFixed(2)} {e.currency}
                  {e.description ? ` · ${e.description}` : ""}
                </div>
              </div>
              <select
                value={e.pricingModel}
                onChange={(ev) => setModel(e.id, ev.target.value as PricingModel)}
                className="px-2 py-1 border rounded text-[12.5px]"
                style={{ borderColor: "var(--a-border)", background: "white" }}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span
                className="text-[11px] w-12 text-right"
                style={{
                  color: savedId === e.id ? "var(--a-green)" : "var(--a-muted)",
                }}
              >
                {savingId === e.id ? "Saving…" : savedId === e.id ? "Saved" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        &ldquo;Per guest, per night&rdquo; charges one unit per guest for each
        morning after a night (e.g. breakfast). &ldquo;Per stay&rdquo; charges
        once. Re-syncing from Cloudbeds never changes these settings.
      </p>
    </>
  );
}
