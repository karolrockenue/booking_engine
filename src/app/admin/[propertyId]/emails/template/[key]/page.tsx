"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import EmailEditor, { type EditorRef } from "react-email-editor";

import { TopStrip, Btn, Crumb } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../../../layout";
import { VAR_GROUPS } from "@/lib/email/variables";

interface TemplateRow {
  key: string;
  name: string;
  subject: string;
  body: unknown; // Unlayer JSONTemplate
  htmlCached: string | null;
  status: "active" | "draft" | "disabled";
  isTransactional: boolean;
  isDefault?: boolean;
}

interface EmailFontStacks {
  headingDisplayName: string;
  headingStack: string;
  bodyDisplayName: string;
  bodyStack: string;
}

interface PhotoVariant {
  url: string;
  key?: string;
  w?: number;
  h?: number;
}

interface PhotoRow {
  id: string;
  url: string;
  altText: string | null;
  slot: "hero" | "gallery" | "room" | "neighbourhood" | "marketing";
  variants: {
    hero?: PhotoVariant;
    gallery?: PhotoVariant;
    thumb?: PhotoVariant;
  } | null;
}

// Build Unlayer merge tags from our variable namespace. Lets the composer
// surface a dropdown of every variable in its text/heading tools — admin
// inserts them with one click instead of typing `{{guest.firstName}}`.
function buildMergeTags() {
  const tags: Record<string, { name: string; value: string; sample: string }> = {};
  for (const group of VAR_GROUPS) {
    for (const item of group.items) {
      tags[item.key] = {
        name: item.key,
        value: `{{${item.key}}}`,
        sample: item.example,
      };
    }
  }
  return tags;
}

// Email-safe system fonts. Available on virtually every recipient device, so
// no CSS download is needed — but Unlayer's CustomFont type still requires
// a `url`, so we point at an empty data: stylesheet (200 OK, no-op).
const NOOP_FONT_URL = "data:text/css;base64,";

const SYSTEM_FONTS: Array<{ label: string; value: string; url: string }> = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
].map((f) => ({ ...f, url: NOOP_FONT_URL }));

// Fonts that exist on Google Fonts — when one of these is the property's
// brand font we register the real CSS URL so the editor previews it.
const GOOGLE_FONTS = new Set([
  "Cormorant Garamond",
  "Inter",
  "Playfair Display",
  "Lora",
  "Merriweather",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
]);

function buildCustomFonts(fonts: EmailFontStacks): Array<{
  label: string;
  value: string;
  url: string;
}> {
  const out = [...SYSTEM_FONTS];
  const seen = new Set(out.map((f) => f.label));
  for (const stack of [fonts.headingStack, fonts.bodyStack]) {
    const label = stack.split(",")[0].replace(/^["']|["']$/g, "").trim();
    if (seen.has(label)) continue;
    seen.add(label);
    if (!GOOGLE_FONTS.has(label)) continue;
    out.push({
      label,
      value: stack,
      url: `https://fonts.googleapis.com/css2?family=${label.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`,
    });
  }
  return out;
}

// Callback shapes Unlayer invokes — kept minimal so we don't pull the full
// @unlayer/types editor surface into the client bundle.
type SelectImageDone = (result: {
  url: string;
  width?: number;
  height?: number;
}) => void;
type ImageUploadDone = (result: {
  progress?: number;
  url?: string;
  width?: number;
  height?: number;
}) => void;

// Loose shape of Unlayer's exported design — we only touch image content
// items' values.src so a permissive walk is enough.
type DesignContent = {
  id?: string;
  type?: string;
  values?: { src?: { url?: string; width?: number; height?: number } };
};
type DesignColumn = { contents?: DesignContent[] };
type DesignRow = { columns?: DesignColumn[] };
type DesignTree = { body?: { rows?: DesignRow[] } };

function patchImageSrc(
  design: DesignTree,
  contentId: string,
  src: { url: string; width?: number; height?: number }
): DesignTree | null {
  // Deep-clone via JSON to avoid mutating Unlayer's live tree, then walk.
  const clone = JSON.parse(JSON.stringify(design)) as DesignTree;
  for (const row of clone.body?.rows ?? []) {
    for (const col of row.columns ?? []) {
      for (const content of col.contents ?? []) {
        if (content.id === contentId && content.type === "image") {
          content.values = content.values ?? {};
          content.values.src = {
            ...(content.values.src ?? {}),
            url: src.url,
            ...(src.width ? { width: src.width } : {}),
            ...(src.height ? { height: src.height } : {}),
          };
          return clone;
        }
      }
    }
  }
  return null;
}

export default function EmailComposerPage() {
  const { propertyId, key } = useParams<{ propertyId: string; key: string }>();
  const token = useAdminToken();

  const editorRef = useRef<EditorRef>(null);
  // Stashes Unlayer's selectImage callback while our library modal is open.
  // We invoke it with the picked URL and clear it when the modal closes.
  const pendingSelectRef = useRef<SelectImageDone | null>(null);
  // ID of the most recently dropped Image block — used so the library picker
  // can patch its src after the user chooses a photo (since some Unlayer
  // versions don't surface the selectImage button automatically).
  const lastAddedImageIdRef = useRef<string | null>(null);

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [fonts, setFonts] = useState<EmailFontStacks | null>(null);
  const [subject, setSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Library picker — opens when Unlayer fires selectImage OR when admin clicks
  // the toolbar button manually. The toolbar button also stashes a "manual
  // mode" handler that just copies to clipboard, so admin can still pull a URL
  // even before an Image block exists.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Load template + property fonts on mount
  useEffect(() => {
    if (!token || !propertyId || !key) return;
    Promise.all([
      fetch(`/api/admin/properties/${propertyId}/email-templates/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch(`/api/admin/properties/${propertyId}/email-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
    ])
      .then(([t, list]: [TemplateRow, { fonts: EmailFontStacks }]) => {
        setTemplate(t);
        setSubject(t.subject);
        setFonts(list.fonts);
      })
      .catch((e) => setError(String(e)));
  }, [token, propertyId, key]);

  // Load photo library (used by both the modal and as fallback if Unlayer's
  // selectImage fires before we've fetched).
  const loadPhotos = useCallback(async () => {
    if (!token) return;
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } finally {
      setPhotosLoading(false);
    }
  }, [propertyId, token]);

  // Register Unlayer callbacks once the editor is ready.
  // - image:      file dropped/picked in Unlayer's Image block → POST to /photos
  //               (R2 + media library) → return URL
  // - selectImage: admin clicked "open library" inside the Image block → show
  //                our picker modal → user picks → return URL
  useEffect(() => {
    if (!editorReady || !editorRef.current?.editor) return;
    const ed = editorRef.current.editor;

    const onImageUpload = (
      data: { accepted: File[] },
      done: ImageUploadDone
    ) => {
      const file = data.accepted?.[0];
      if (!file) {
        done({ progress: 100 });
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slot", "marketing"); // emails are admin-only; keep out of public site
      fd.append("altText", file.name);
      fetch(`/api/admin/properties/${propertyId}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
        .then((res: { photo: PhotoRow }) => {
          const url =
            res.photo.variants?.gallery?.url ?? res.photo.url;
          done({
            progress: 100,
            url,
            width: res.photo.variants?.gallery?.w,
            height: res.photo.variants?.gallery?.h,
          });
          // Refresh the local cache so the library shows the new photo too.
          void loadPhotos();
        })
        .catch((e) => {
          console.error("photo upload failed", e);
          alert("Upload failed — see console.");
          done({ progress: 100 });
        });
    };

    const onSelectImage = (
      _data: Record<string, unknown>,
      done: SelectImageDone
    ) => {
      pendingSelectRef.current = done;
      void loadPhotos();
      setLibraryOpen(true);
    };

    // Fallback path for Unlayer versions that don't surface a "Select Image"
    // button: when a fresh Image block is dropped, remember its id and open
    // our library so the user can pick directly.
    const onContentAdded = (data: { content?: Record<string, unknown> }) => {
      const c = data.content as
        | { id?: string; type?: string; values?: { src?: { url?: string } } }
        | undefined;
      if (!c || c.type !== "image") return;
      const currentUrl = c.values?.src?.url ?? "";
      // Only auto-open when the image is empty (i.e. just dropped onto canvas,
      // not when the user is dragging an already-configured block around).
      if (currentUrl && !currentUrl.endsWith("/old/image_placeholder.png") && !currentUrl.endsWith("placeholder.png")) return;
      lastAddedImageIdRef.current = c.id ?? null;
      void loadPhotos();
      setLibraryOpen(true);
    };

    ed.registerCallback("image", onImageUpload);
    ed.registerCallback("selectImage", onSelectImage);
    ed.addEventListener("content:added", onContentAdded);

    return () => {
      try {
        ed.unregisterCallback("image");
        ed.unregisterCallback("selectImage");
        ed.removeEventListener("content:added");
      } catch {
        // editor may already be torn down
      }
    };
  }, [editorReady, propertyId, token, loadPhotos]);

  // Push the design into the editor once both have loaded
  useEffect(() => {
    if (!editorReady || !template?.body || !editorRef.current?.editor) return;
    try {
      editorRef.current.editor.loadDesign(
        template.body as Parameters<NonNullable<EditorRef["editor"]>["loadDesign"]>[0]
      );
    } catch (e) {
      console.error("loadDesign failed", e);
    }
  }, [editorReady, template]);

  // Debounced live preview — exportHtml from the editor and POST to the
  // server which substitutes sample vars and hands back the final HTML.
  const refreshPreview = useCallback(() => {
    if (!editorRef.current?.editor) return;
    setPreviewLoading(true);
    editorRef.current.editor.exportHtml(async (data) => {
      try {
        const res = await fetch(
          `/api/admin/properties/${propertyId}/email-templates/${key}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ html: data.html }),
          }
        );
        const out = await res.json();
        if (res.ok) setPreviewHtml(out.html);
      } finally {
        setPreviewLoading(false);
      }
    });
  }, [propertyId, key, token]);

  // Initial preview once the editor is ready
  useEffect(() => {
    if (!editorReady) return;
    const t = setTimeout(refreshPreview, 600);
    return () => clearTimeout(t);
  }, [editorReady, refreshPreview]);

  function pickPhoto(photo: PhotoRow) {
    const url = photo.variants?.gallery?.url ?? photo.url;
    const width = photo.variants?.gallery?.w;
    const height = photo.variants?.gallery?.h;
    const pending = pendingSelectRef.current;
    const lastAddedId = lastAddedImageIdRef.current;

    if (pending) {
      // Unlayer asked via selectImage — hand it back. Width/height help the
      // Image tool size itself correctly.
      pending({ url, width, height });
      pendingSelectRef.current = null;
    } else if (lastAddedId && editorRef.current?.editor) {
      // Auto-opened path: patch the just-added Image block by walking the
      // design tree, updating that one content item's src, then reloading.
      const ed = editorRef.current.editor;
      ed.saveDesign((design) => {
        const patched = patchImageSrc(design as DesignTree, lastAddedId, {
          url,
          width,
          height,
        });
        if (patched) {
          ed.loadDesign(
            patched as Parameters<NonNullable<EditorRef["editor"]>["loadDesign"]>[0]
          );
        }
        lastAddedImageIdRef.current = null;
      });
    } else {
      // Manual open from our toolbar — copy URL for paste-into-Image-block.
      navigator.clipboard?.writeText(url).catch(() => {});
      alert(`URL copied: ${url}`);
    }
    setLibraryOpen(false);
  }

  function closeLibrary() {
    // Cancel any pending Unlayer selection so its Image block doesn't hang.
    pendingSelectRef.current = null;
    lastAddedImageIdRef.current = null;
    setLibraryOpen(false);
  }

  async function handleSave() {
    if (!template || !editorRef.current?.editor) return;
    setSaving(true);
    setError(null);
    try {
      const { design, html } = await new Promise<{ design: unknown; html: string }>(
        (resolve, reject) => {
          editorRef.current!.editor!.exportHtml((data) => {
            resolve({ design: data.design, html: data.html });
          });
          setTimeout(() => reject(new Error("exportHtml timed out")), 15000);
        }
      );

      const res = await fetch(
        `/api/admin/properties/${propertyId}/email-templates/${key}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: template.name,
            subject,
            design,
            html,
            status: template.status,
            isTransactional: template.isTransactional,
            updatedBy: "karol@rockenue.com",
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setSavedAt(Date.now());
      refreshPreview();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!template || !editorRef.current?.editor) return;
    const to = window.prompt("Send test to (email)?");
    if (!to) return;
    editorRef.current.editor.exportHtml(async (data) => {
      const res = await fetch(
        `/api/admin/properties/${propertyId}/email-templates/${key}/send-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to, subject, html: data.html }),
        }
      );
      if (res.ok) alert(`Test sent to ${to}.`);
      else alert(`Send failed: ${await res.text()}`);
    });
  }

  const editorOptions = useMemo(() => {
    if (!fonts) return undefined;
    const customFonts = buildCustomFonts(fonts);
    return {
      displayMode: "email" as const,
      mergeTags: buildMergeTags(),
      mergeTagsConfig: { autocompleteTriggerChar: "{" },
      // Force Unlayer's full default font list on. customFonts (whitelisted
      // Google Fonts, e.g. Cormorant Garamond + Inter for Portico) get
      // appended to it. customFonts is always passed as an array — Unlayer
      // 1.x suppresses the default list if the field is missing.
      fonts: {
        showDefaultFonts: true,
        customFonts,
      },
      appearance: {
        theme: "modern_light" as const,
        panels: { tools: { dock: "left" as const } },
      },
    };
  }, [fonts]);

  const statusPill = useMemo(() => {
    if (!template) return null;
    if (template.status === "active") {
      return <Pill tone="green">on</Pill>;
    }
    if (template.status === "draft") return <Pill tone="gray">draft</Pill>;
    return <Pill tone="gray">disabled</Pill>;
  }, [template]);

  if (!template) {
    return (
      <div className="px-2 py-4 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
        {error ? <span style={{ color: "var(--a-red)" }}>{error}</span> : "Loading…"}
      </div>
    );
  }

  return (
    <div>
      <TopStrip
        title={
          <span className="inline-flex items-center gap-2">
            <Crumb to={`/admin/${propertyId}/emails`}>Emails</Crumb>
            {template.name}
            {statusPill}
          </span>
        }
        subtitle={
          template.isTransactional
            ? "Sent on booking event · no schedule"
            : "Automated · runs on schedule"
        }
        actions={
          <>
            <Btn
              size="sm"
              onClick={() => {
                void loadPhotos();
                setLibraryOpen(true);
              }}
            >
              ▣ Media library
            </Btn>
            <Btn size="sm" onClick={refreshPreview}>
              ↻ Refresh preview
            </Btn>
            <Btn size="sm" onClick={handleSendTest}>
              ✉ Send test
            </Btn>
            <Btn variant="primary" onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </Btn>
          </>
        }
      />

      {error && (
        <div
          className="mb-3 p-2.5 rounded text-[12.5px]"
          style={{
            background: "var(--a-red-soft)",
            color: "var(--a-red)",
            border: "1px solid rgba(198,40,40,0.2)",
          }}
        >
          {error}
        </div>
      )}
      {savedAt && (
        <div
          className="mb-3 p-2.5 rounded text-[12.5px]"
          style={{
            background: "var(--a-green-soft)",
            color: "var(--a-green)",
            border: "1px solid rgba(0,135,90,0.2)",
          }}
        >
          Saved.
        </div>
      )}

      {/* subject row */}
      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          className="px-3 py-2 border rounded text-[12.5px] focus:outline-none focus:border-[var(--a-accent)]"
          style={{ borderColor: "var(--a-border)", minWidth: 420, flex: 1 }}
        />
        <span className="text-[11.5px]" style={{ color: "var(--a-muted)" }}>
          Subject supports {`{{var}}`} substitution
        </span>
      </div>

      {/* split-pane */}
      <div
        className="rounded-md overflow-hidden grid"
        style={{
          gridTemplateColumns: "1.15fr 1fr",
          background: "var(--a-surface)",
          border: "1px solid var(--a-border)",
          minHeight: 780,
        }}
      >
        {/* editor pane */}
        <div
          style={{ borderRight: "1px solid var(--a-border)" }}
          className="flex flex-col"
        >
          <div
            className="flex items-center px-3 py-2 text-[11.5px]"
            style={{
              borderBottom: "1px solid var(--a-border-soft)",
              color: "var(--a-muted)",
              background: "var(--a-surface-2)",
            }}
          >
            <span>Editor</span>
            {fonts && (
              <span className="ml-3" style={{ color: "var(--a-muted)" }}>
                Brand fonts loaded:{" "}
                <span style={{ fontFamily: fonts.headingStack, color: "var(--a-ink)" }}>
                  {fonts.headingDisplayName}
                </span>{" "}
                +{" "}
                <span style={{ fontFamily: fonts.bodyStack, color: "var(--a-ink)" }}>
                  {fonts.bodyDisplayName}
                </span>
              </span>
            )}
            <span className="ml-auto font-jbm text-[10.5px]">
              Image uploads land in Media · Unlayer
            </span>
          </div>
          <div className="flex-1" style={{ background: "#fff", minHeight: 720 }}>
            {editorOptions && (
              <EmailEditor
                ref={editorRef}
                onReady={() => setEditorReady(true)}
                minHeight={720}
                options={editorOptions}
              />
            )}
          </div>
        </div>

        {/* preview pane */}
        <div className="flex flex-col">
          <div
            className="flex items-center px-3 py-2 text-[11.5px]"
            style={{
              borderBottom: "1px solid var(--a-border-soft)",
              color: "var(--a-muted)",
              background: "var(--a-surface-2)",
            }}
          >
            <span>Preview · sample variables substituted</span>
            <span className="ml-auto font-jbm text-[10.5px]">
              {previewLoading ? "rendering…" : "live"}
            </span>
          </div>
          <div className="flex-1 p-4 overflow-auto" style={{ background: "#F5F5F5" }}>
            <iframe
              srcDoc={previewHtml || "<p style='color:#888; font-family: system-ui'>Make an edit then click Refresh preview.</p>"}
              style={{
                width: "100%",
                minHeight: 700,
                background: "#fff",
                border: "1px solid var(--a-border)",
                borderRadius: 4,
              }}
              sandbox=""
              title="email preview"
            />
            <details className="mt-4 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
              <summary className="cursor-pointer">Variables you can use</summary>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {VAR_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div
                      className="text-[10.5px] uppercase tracking-wider mb-1"
                      style={{ color: "var(--a-muted)" }}
                    >
                      {g.group}
                    </div>
                    {g.items.map((it) => (
                      <div key={it.key} className="flex items-center gap-2 py-0.5">
                        <code
                          className="font-jbm text-[11px]"
                          style={{ color: "var(--a-accent)" }}
                        >
                          {`{{${it.key}}}`}
                        </code>
                        <span style={{ color: "var(--a-muted)" }}>→ {it.example}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>

      {libraryOpen && (
        <PhotoLibraryModal
          photos={photos}
          loading={photosLoading}
          fromUnlayer={pendingSelectRef.current !== null}
          onPick={pickPhoto}
          onClose={closeLibrary}
        />
      )}
    </div>
  );
}

function PhotoLibraryModal({
  photos,
  loading,
  fromUnlayer,
  onPick,
  onClose,
}: {
  photos: PhotoRow[];
  loading: boolean;
  fromUnlayer: boolean;
  onPick: (photo: PhotoRow) => void;
  onClose: () => void;
}) {
  const groups: Array<{ slot: PhotoRow["slot"]; label: string }> = [
    { slot: "marketing", label: "Marketing · logos & brand" },
    { slot: "hero", label: "Hero" },
    { slot: "gallery", label: "Gallery" },
    { slot: "room", label: "Rooms" },
    { slot: "neighbourhood", label: "Neighbourhood" },
  ];
  const bySlot = (s: PhotoRow["slot"]) => photos.filter((p) => p.slot === s);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(10,10,10,0.45)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-md overflow-hidden flex flex-col"
        style={{
          background: "var(--a-surface)",
          border: "1px solid var(--a-border)",
          width: "min(960px, 100%)",
          maxHeight: "84vh",
        }}
      >
        <div
          className="flex items-center px-4 py-3"
          style={{ borderBottom: "1px solid var(--a-border-soft)" }}
        >
          <h2 className="text-[13.5px] font-semibold">
            {fromUnlayer ? "Pick from media library" : "Media library"}
          </h2>
          <span className="ml-3 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
            {fromUnlayer
              ? "Click an image to insert into the Image block"
              : "Click an image to copy its URL · or drag a file onto an Image block in the editor to upload directly"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-[16px]"
            style={{ color: "var(--a-muted)" }}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4" style={{ background: "var(--a-surface-2)" }}>
          {loading ? (
            <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--a-muted)" }}>
              Loading…
            </div>
          ) : photos.length === 0 ? (
            <div className="text-[12.5px] py-10 text-center" style={{ color: "var(--a-muted)" }}>
              No media uploaded yet. Drag a file onto an Image block in the editor to upload, or visit Admin → Media.
            </div>
          ) : (
            groups.map((g) => {
              const ps = bySlot(g.slot);
              if (ps.length === 0) return null;
              return (
                <div key={g.slot} className="mb-5">
                  <div
                    className="text-[10.5px] uppercase tracking-wider mb-2"
                    style={{ color: "var(--a-muted)" }}
                  >
                    {g.label} · {ps.length}
                  </div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
                  >
                    {ps.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onPick(p)}
                        className="rounded overflow-hidden text-left"
                        style={{
                          border: "1px solid var(--a-border)",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.variants?.thumb?.url ?? p.url}
                            alt={p.altText ?? ""}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <div className="px-2 py-1 text-[11px]" style={{ color: "var(--a-muted)" }}>
                          {p.altText || g.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "green" | "gray";
  children: React.ReactNode;
}) {
  const styles =
    tone === "green"
      ? {
          color: "var(--a-green)",
          background: "var(--a-green-soft)",
          border: "1px solid rgba(0,135,90,0.25)",
        }
      : {
          color: "var(--a-muted)",
          background: "#F5F5F5",
          border: "1px solid var(--a-border)",
        };
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0 rounded font-jbm text-[10.5px] font-medium"
      style={styles}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {children}
    </span>
  );
}
