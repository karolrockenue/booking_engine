"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  maxOccupancy: number | null;
  baseOccupancy: number | null;
  amenities: unknown;
  hiddenFromBooking: boolean;
}

export default function RoomsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [list, setList] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setList((await r.json()) as RoomRow[]);
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

  async function toggle(room: RoomRow) {
    if (!token || savingId) return;
    const next = !room.hiddenFromBooking;
    // optimistic
    setList((cur) =>
      cur.map((r) => (r.id === room.id ? { ...r, hiddenFromBooking: next } : r))
    );
    setSavingId(room.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/rooms`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId: room.id, hiddenFromBooking: next }),
      });
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${r.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      load(); // re-pull truth on failure
    } finally {
      setSavingId(null);
    }
  }

  const hiddenCount = list.filter((r) => r.hiddenFromBooking).length;

  return (
    <>
      <TopStrip
        title="Rooms"
        subtitle={
          loading
            ? "Loading…"
            : `${list.length} room ${
                list.length === 1 ? "type" : "types"
              } · synced from Cloudbeds${
                hiddenCount ? ` · ${hiddenCount} hidden` : ""
              }`
        }
        actions={
          <Btn href={`/admin/${propertyId}/cloudbeds`}>
            Re-sync from Cloudbeds
          </Btn>
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
          No room types yet. Run a Cloudbeds sync to populate.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((r) => {
            const occ =
              r.maxOccupancy != null
                ? `${r.baseOccupancy ?? 1}–${r.maxOccupancy} guests`
                : null;
            const amenities = Array.isArray(r.amenities)
              ? ((r.amenities as unknown[]).filter(
                  (a) => typeof a === "string"
                ) as string[])
              : [];
            return (
              <div
                key={r.id}
                className="border rounded-md px-3.5 py-2.5 flex items-center gap-3"
                style={{
                  borderColor: "var(--a-border)",
                  background: "var(--a-surface)",
                  opacity: r.hiddenFromBooking ? 0.6 : 1,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium flex items-center gap-2">
                    {r.name}
                    {occ && (
                      <span
                        className="font-jbm text-[11px]"
                        style={{ color: "var(--a-muted)" }}
                      >
                        {occ}
                      </span>
                    )}
                  </div>
                  <div
                    className="font-jbm text-[11px] mt-0.5 truncate"
                    style={{ color: "var(--a-muted)" }}
                  >
                    {r.description ||
                      (amenities.length
                        ? amenities.join(" · ")
                        : "No description in Cloudbeds")}
                  </div>
                </div>
                <button
                  onClick={() => toggle(r)}
                  disabled={!token || savingId === r.id}
                  title={
                    r.hiddenFromBooking
                      ? "Hidden from the booking engine — click to show"
                      : "Shown in the booking engine — click to hide"
                  }
                  className="text-[12px] px-2.5 py-1 rounded border font-medium flex-shrink-0"
                  style={
                    r.hiddenFromBooking
                      ? {
                          borderColor: "var(--a-border)",
                          color: "var(--a-muted)",
                          background: "var(--a-surface-2)",
                        }
                      : {
                          borderColor: "rgba(0,135,90,0.25)",
                          color: "var(--a-green)",
                          background: "var(--a-green-soft)",
                        }
                  }
                >
                  {savingId === r.id ? "…" : r.hiddenFromBooking ? "Hidden" : "Shown"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        Hidden room types are removed from the booking engine (the rooms step)
        but stay in Cloudbeds — useful for virtual or staff-only room types.
        Re-syncing from Cloudbeds never changes these settings.
      </p>
    </>
  );
}
