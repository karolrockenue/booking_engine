"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";
import {
  getTemplateSchema,
  readinessFor,
  type PhotoSlotSpec,
} from "@/lib/template-schema";

// Slot tags photos by where they appear on the site.
//   hero          → above-the-fold hero on /
//   gallery       → below-fold gallery section
//   room          → per-room gallery (linked via roomTypeId)
//   neighbourhood → neighbourhood / map context
//   marketing     → admin-only · logos + brand assets · never auto-displayed
//                   on the public site (use in emails, future ad creatives)
type Slot = "hero" | "gallery" | "room" | "neighbourhood" | "marketing";

interface Variant {
  key: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface Photo {
  id: string;
  propertyId: string;
  key: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  slot: Slot;
  roomTypeId: string | null;
  sortOrder: number;
  mimeType: string | null;
  sizeBytes: number | null;
  variants: { hero?: Variant; gallery?: Variant; thumb?: Variant } | null;
  createdAt: string | null;
}

interface RoomType {
  id: string;
  name: string;
}

interface PhotosResponse {
  photos: Photo[];
  rooms: RoomType[];
}

export default function PhotosPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [data, setData] = useState<PhotosResponse | null>(null);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [photosRes, propertyRes] = await Promise.all([
        fetch(`/api/admin/properties/${propertyId}/photos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/properties/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!photosRes.ok) throw new Error(`HTTP ${photosRes.status}`);
      setData(await photosRes.json());
      if (propertyRes.ok) {
        const p = await propertyRes.json();
        setTemplateSlug(p?.templateSlug ?? null);
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

  const schema = useMemo(() => getTemplateSchema(templateSlug), [templateSlug]);

  const photos = data?.photos ?? [];
  const rooms = data?.rooms ?? [];

  const groups = useMemo(() => {
    const hero = photos.filter((p) => p.slot === "hero");
    const gallery = photos.filter((p) => p.slot === "gallery");
    const neighbourhood = photos.filter((p) => p.slot === "neighbourhood");
    const marketing = photos.filter((p) => p.slot === "marketing");
    const byRoom = new Map<string, Photo[]>();
    for (const p of photos.filter((p) => p.slot === "room")) {
      const key = p.roomTypeId ?? "_unassigned";
      const arr = byRoom.get(key) ?? [];
      arr.push(p);
      byRoom.set(key, arr);
    }
    return { hero, gallery, neighbourhood, marketing, byRoom };
  }, [photos]);

  const totalBytes = photos.reduce((s, p) => s + (p.sizeBytes ?? 0), 0);

  return (
    <>
      <TopStrip
        title="Media"
        subtitle={
          loading
            ? "Loading…"
            : `${photos.length} file${photos.length === 1 ? "" : "s"} · hosted on Cloudflare R2 · ${formatBytes(totalBytes)} total`
        }
        actions={
          <UploadButton
            propertyId={propertyId}
            token={token}
            slot="gallery"
            onUploaded={load}
            label="+ Upload"
          />
        }
      />

      {error && (
        <div className="text-[13px] mb-4" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      )}

      {schema.ignoresUploads && !loading && (
        <IgnoresUploadsBanner />
      )}

      <Section
        title={schema.photos.hero?.label ?? "Hero"}
        sub={schema.photos.hero?.hint ?? "shown on /"}
        spec={schema.photos.hero}
        propertyId={propertyId}
        token={token}
        slot="hero"
        photos={groups.hero}
        rooms={rooms}
        onChanged={load}
      />

      <Section
        title={schema.photos.gallery?.label ?? "Gallery"}
        sub={schema.photos.gallery?.hint ?? "below-fold gallery section"}
        spec={schema.photos.gallery}
        propertyId={propertyId}
        token={token}
        slot="gallery"
        photos={groups.gallery}
        rooms={rooms}
        onChanged={load}
      />

      <Section
        title={schema.photos.neighbourhood?.label ?? "Neighbourhood"}
        sub={schema.photos.neighbourhood?.hint ?? "optional · neighbourhood / map context"}
        spec={schema.photos.neighbourhood}
        propertyId={propertyId}
        token={token}
        slot="neighbourhood"
        photos={groups.neighbourhood}
        rooms={rooms}
        onChanged={load}
      />

      <Section
        title="Marketing"
        sub="logos, brand assets · never auto-displayed on the public site · available in emails and the photo picker"
        spec={undefined}
        propertyId={propertyId}
        token={token}
        slot="marketing"
        photos={groups.marketing}
        rooms={rooms}
        onChanged={load}
      />

      {/* Per-room galleries */}
      <div className="mt-6">
        <div className="flex items-baseline gap-2 mb-2">
          <h2
            className="text-[12.5px] font-semibold"
            style={{ color: "var(--a-ink)" }}
          >
            {schema.photos.room?.label ?? "Per-room galleries"}
          </h2>
          {schema.photos.room && (
            <SlotPills spec={schema.photos.room} count={rooms.length === 0 ? 0 : 1} />
          )}
        </div>
        <p
          className="text-[11.5px] mb-3"
          style={{ color: "var(--a-muted)" }}
        >
          {schema.photos.room?.hint ?? "Assign photos to specific room types."}
        </p>
        {rooms.length === 0 ? (
          <Empty>No room types yet. Sync from Cloudbeds first.</Empty>
        ) : (
          rooms.map((room) => (
            <RoomSection
              key={room.id}
              propertyId={propertyId}
              token={token}
              room={room}
              photos={groups.byRoom.get(room.id) ?? []}
              onChanged={load}
            />
          ))
        )}
        {/* Unassigned room photos */}
        {(groups.byRoom.get("_unassigned") ?? []).length > 0 && (
          <RoomSection
            propertyId={propertyId}
            token={token}
            room={{ id: "", name: "Unassigned (room slot, no room ID)" }}
            photos={groups.byRoom.get("_unassigned") ?? []}
            onChanged={load}
          />
        )}
      </div>

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        Photos uploaded here go to Cloudflare R2 and serve from the public CDN URL on customer-facing sites. To wire them into the actual hotel pages, the bespoke React reads them via property config (next step after this UI).
      </p>
    </>
  );
}

// ─── section ──────────────────────────────────────────────────────

function Section({
  title,
  sub,
  spec,
  propertyId,
  token,
  slot,
  photos,
  rooms,
  onChanged,
}: {
  title: string;
  sub?: string;
  spec: PhotoSlotSpec | undefined;
  propertyId: string;
  token: string;
  slot: Slot;
  photos: Photo[];
  rooms: RoomType[];
  onChanged: () => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <h2
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--a-ink)" }}
        >
          {title}
        </h2>
        {sub && (
          <span
            className="text-[11.5px]"
            style={{ color: "var(--a-muted)" }}
          >
            · {sub}
          </span>
        )}
        {spec && <SlotPills spec={spec} count={photos.length} />}
        <span
          className="ml-auto font-jbm text-[11px]"
          style={{ color: "var(--a-muted)" }}
        >
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </span>
      </div>
      {spec?.fallback && photos.length === 0 && (
        <p className="text-[11px] mb-2" style={{ color: "var(--a-muted)" }}>
          {spec.fallback}
        </p>
      )}
      <PhotoGrid
        photos={photos}
        rooms={rooms}
        propertyId={propertyId}
        token={token}
        emptySlot={slot}
        onChanged={onChanged}
      />
    </div>
  );
}

function SlotPills({ spec, count }: { spec: PhotoSlotSpec; count: number }) {
  const r = readinessFor(spec, count);
  const required = spec.required;
  const showMin = spec.min !== undefined && spec.min > 0;

  return (
    <span className="inline-flex items-center gap-1.5">
      {required && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
          style={
            r.ok
              ? { color: "var(--a-green)", background: "var(--a-green-soft)", borderColor: "rgba(0,135,90,0.18)" }
              : { color: "var(--a-amber)", background: "var(--a-amber-soft)", borderColor: "rgba(180,83,9,0.18)" }
          }
        >
          {r.ok ? "ready" : "needed"}
        </span>
      )}
      {showMin && (
        <span
          className="font-jbm text-[10.5px]"
          style={{ color: r.ok ? "var(--a-muted)" : "var(--a-amber)" }}
        >
          {count}/{spec.min}
        </span>
      )}
    </span>
  );
}

function IgnoresUploadsBanner() {
  return (
    <div
      className="border-l-4 px-3 py-2 mb-4 text-[12.5px] rounded-r"
      style={{
        borderColor: "var(--a-amber)",
        background: "var(--a-amber-soft)",
        color: "var(--a-ink)",
      }}
    >
      <strong>Current template doesn&apos;t render uploaded photos.</strong>{" "}
      <span style={{ color: "var(--a-muted)" }}>
        Photos uploaded here won&apos;t show on the live site until you switch to a template that consumes them (e.g. Portico · Ivory). You can still upload — they&apos;ll be ready when you switch.
      </span>
    </div>
  );
}

function RoomSection({
  propertyId,
  token,
  room,
  photos,
  onChanged,
}: {
  propertyId: string;
  token: string;
  room: { id: string; name: string };
  photos: Photo[];
  onChanged: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline gap-2 mb-2">
        <h3
          className="text-[12px] font-semibold"
          style={{ color: "var(--a-ink)" }}
        >
          {room.name}
        </h3>
        <span
          className="ml-auto font-jbm text-[11px]"
          style={{ color: "var(--a-muted)" }}
        >
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </span>
      </div>
      <PhotoGrid
        photos={photos}
        rooms={[]}
        propertyId={propertyId}
        token={token}
        emptySlot="room"
        emptyRoomId={room.id || undefined}
        onChanged={onChanged}
      />
    </div>
  );
}

// ─── grid ─────────────────────────────────────────────────────────

function PhotoGrid({
  photos,
  rooms,
  propertyId,
  token,
  emptySlot,
  emptyRoomId,
  onChanged,
}: {
  photos: Photo[];
  rooms: RoomType[];
  propertyId: string;
  token: string;
  emptySlot: Slot;
  emptyRoomId?: string;
  onChanged: () => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {photos.map((p) => (
        <PhotoTile
          key={p.id}
          photo={p}
          rooms={rooms}
          propertyId={propertyId}
          token={token}
          onChanged={onChanged}
        />
      ))}
      <UploadTile
        propertyId={propertyId}
        token={token}
        slot={emptySlot}
        roomTypeId={emptyRoomId}
        onUploaded={onChanged}
      />
    </div>
  );
}

// ─── photo tile ───────────────────────────────────────────────────

function PhotoTile({
  photo,
  rooms,
  propertyId,
  token,
  onChanged,
}: {
  photo: Photo;
  rooms: RoomType[];
  propertyId: string;
  token: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function patch(body: Partial<Photo>) {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/photos/${photo.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
      setShowMenu(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this photo? This removes it from R2 and the DB.")) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/photos/${photo.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
      setShowMenu(false);
    }
  }

  return (
    <div
      className="relative group rounded-md overflow-hidden border"
      style={{
        borderColor: "var(--a-border)",
        background: "var(--a-surface-2)",
        opacity: busy ? 0.5 : 1,
      }}
    >
      <div className="aspect-[4/3] w-full relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.variants?.thumb?.url ?? photo.url}
          alt={photo.altText ?? ""}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded font-jbm"
          >
            ⋯
          </button>
          {showMenu && (
            <div
              className="absolute top-full right-0 mt-1 bg-white border rounded-md shadow-lg p-1.5 min-w-[200px] z-10"
              style={{ borderColor: "var(--a-border)" }}
            >
              <MenuLabel>Move to slot</MenuLabel>
              {(["hero", "gallery", "room", "neighbourhood", "marketing"] as Slot[]).map((s) => (
                <button
                  key={s}
                  onClick={() => patch({ slot: s, roomTypeId: s === "room" ? photo.roomTypeId : null })}
                  disabled={photo.slot === s}
                  className="w-full text-left px-2 py-1 text-[11.5px] rounded hover:bg-[var(--a-surface-2)] disabled:opacity-40"
                >
                  {photo.slot === s ? "✓ " : "  "}{s}
                </button>
              ))}
              {photo.slot === "room" && rooms.length > 0 && (
                <>
                  <MenuLabel>Assign to room</MenuLabel>
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => patch({ roomTypeId: r.id })}
                      disabled={photo.roomTypeId === r.id}
                      className="w-full text-left px-2 py-1 text-[11.5px] rounded hover:bg-[var(--a-surface-2)] disabled:opacity-40"
                    >
                      {photo.roomTypeId === r.id ? "✓ " : "  "}{r.name}
                    </button>
                  ))}
                </>
              )}
              <div
                className="border-t my-1"
                style={{ borderColor: "var(--a-border-soft)" }}
              />
              <button
                onClick={remove}
                className="w-full text-left px-2 py-1 text-[11.5px] rounded hover:bg-[var(--a-red-soft)]"
                style={{ color: "var(--a-red)" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        className="px-2 py-1 text-[10.5px] font-jbm flex items-center gap-1.5"
        style={{ color: "var(--a-muted)" }}
      >
        <span className="truncate flex-1">
          {photo.altText ||
            (photo.variants?.hero
              ? `${photo.variants.hero.width}×${photo.variants.hero.height}`
              : photo.key.split("/").pop())}
        </span>
        <span>{formatBytes(photo.sizeBytes ?? 0)}</span>
      </div>
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{ color: "var(--a-muted)" }}
    >
      {children}
    </div>
  );
}

// ─── upload tile + button ─────────────────────────────────────────

function UploadTile({
  propertyId,
  token,
  slot,
  roomTypeId,
  onUploaded,
}: {
  propertyId: string;
  token: string;
  slot: Slot;
  roomTypeId?: string;
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("slot", slot);
        if (roomTypeId) fd.append("roomTypeId", roomTypeId);
        const r = await fetch(`/api/admin/properties/${propertyId}/photos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
      }
      onUploaded();
    } catch (e) {
      alert(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      className="aspect-[4/3] border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-1 text-[11.5px] disabled:opacity-50"
      style={{
        borderColor: busy ? "var(--a-accent)" : "var(--a-border)",
        background: busy ? "var(--a-accent-soft)" : "var(--a-surface-2)",
        color: busy ? "var(--a-accent)" : "var(--a-muted)",
      }}
    >
      {busy ? (
        <span>Uploading…</span>
      ) : (
        <>
          <span className="text-[18px]">+</span>
          <span>Drop or click</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </button>
  );
}

function UploadButton({
  propertyId,
  token,
  slot,
  label,
  onUploaded,
}: {
  propertyId: string;
  token: string;
  slot: Slot;
  label: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("slot", slot);
        const r = await fetch(`/api/admin/properties/${propertyId}/photos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
      }
      onUploaded();
    } catch (e) {
      alert(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Btn variant="primary" onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : label}
      </Btn>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  );
}

// ─── helpers ──────────────────────────────────────────────────────

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border rounded-md p-6 text-center text-[12.5px]"
      style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
    >
      {children}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
