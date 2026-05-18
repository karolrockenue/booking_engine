"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface CloudbedsData {
  connected: boolean;
  cloudbedsPropertyId: string | null;
  tokenExpiresAt: string | null;
  scopes: readonly string[];
  lastSyncedAt: string | null;
  webhooks: Array<{
    id: string;
    cloudbedsSubscriptionId: string;
    event: string;
    createdAt: string | null;
  }>;
}

interface SyncResult {
  ratePlansUpserted: number;
  inventoryRowsUpserted: number;
  extrasUpserted: number;
  extrasDeleted: number;
  rangeStart: string;
  rangeEnd: string;
  durationMs: number;
}

export default function CloudbedsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "1";

  const token = useAdminToken();
  const [data, setData] = useState<CloudbedsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [authorising, setAuthorising] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [hideJustConnected, setHideJustConnected] = useState(false);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/cloudbeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  async function handleSync() {
    if (!token || !propertyId) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/cloudbeds/sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const body = (await r.json()) as
        | { ok: true; result: SyncResult }
        | { ok: false; error: string };
      if (!body.ok) {
        setSyncMessage({ kind: "error", text: body.error });
      } else {
        setSyncMessage({
          kind: "ok",
          text: `${body.result.ratePlansUpserted} rate plans · ${body.result.inventoryRowsUpserted} inventory rows · ${body.result.extrasUpserted} extras · ${(body.result.durationMs / 1000).toFixed(1)}s`,
        });
        await load();
      }
    } catch (e) {
      setSyncMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "request failed",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!token || !propertyId) return;
    const ok = window.confirm(
      "Disconnect Cloudbeds for this property?\n\nThis revokes our OAuth grant at Cloudbeds (postAppState=disabled), unsubscribes our webhooks, and clears the stored tokens. The app will be removed from the hotel's Cloudbeds → Apps & Integrations list. Re-connecting requires a fresh consent."
    );
    if (!ok) return;
    setDisconnecting(true);
    setSyncMessage(null);
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/cloudbeds/disconnect`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        webhookError?: string | null;
        appStateRevoked?: boolean;
        appStateError?: string | null;
      };
      if (!r.ok || !body.ok) {
        setSyncMessage({
          kind: "error",
          text: body.error ?? `Disconnect failed (HTTP ${r.status})`,
        });
        return;
      }
      const parts: string[] = [];
      if (body.appStateRevoked) {
        parts.push("OAuth grant revoked at Cloudbeds.");
      } else if (body.appStateError) {
        parts.push(`Local tokens cleared; postAppState warning: ${body.appStateError}.`);
      }
      if (body.webhookError) {
        parts.push(`Webhook unsubscribe warning: ${body.webhookError}.`);
      }
      setSyncMessage({
        kind: "ok",
        text: parts.length > 0 ? parts.join(" ") : "Disconnected.",
      });
      await load();
    } catch (e) {
      setSyncMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "request failed",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleReauth() {
    if (!token || !propertyId) return;
    setAuthorising(true);
    try {
      const r = await fetch("/api/cloudbeds/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as {
          error?: string;
        };
        alert(body.error ?? `Failed to start OAuth (HTTP ${r.status})`);
        return;
      }
      const body = (await r.json()) as { authorizeUrl: string };
      window.location.href = body.authorizeUrl;
    } finally {
      setAuthorising(false);
    }
  }

  const tokenExpiry = data?.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null;
  const tokenExpiresInDays = tokenExpiry
    ? Math.ceil((tokenExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const tokenExpiringSoon =
    tokenExpiresInDays !== null && tokenExpiresInDays > 0 && tokenExpiresInDays < 7;

  return (
    <>
      <TopStrip
        title="Cloudbeds"
        badge={
          loading
            ? undefined
            : data?.connected
              ? { text: "connected", tone: "green" }
              : { text: "not connected", tone: "red" }
        }
        subtitle={
          data?.cloudbedsPropertyId
            ? `propertyID ${data.cloudbedsPropertyId} · token refreshes auto`
            : "no Cloudbeds property linked yet"
        }
        actions={
          <>
            {data?.connected && (
              <Btn onClick={handleDisconnect}>
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Btn>
            )}
            <Btn onClick={handleReauth}>
              {authorising ? "Redirecting…" : data?.connected ? "Re-authorise" : "Connect"}
            </Btn>
            <Btn variant="primary" onClick={handleSync}>
              {syncing ? "Syncing…" : "Sync now"}
            </Btn>
          </>
        }
      />

      {justConnected && !hideJustConnected && (
        <div
          className="border rounded-md p-3 mb-4 flex items-center gap-3 text-[12.5px]"
          style={{
            borderColor: "rgba(0,135,90,0.25)",
            background: "var(--a-green-soft)",
            color: "var(--a-green)",
          }}
        >
          <strong>Connected.</strong>
          <span>Webhooks were auto-subscribed in the background.</span>
          <button
            className="ml-auto text-[11.5px]"
            onClick={() => setHideJustConnected(true)}
            style={{ color: "var(--a-muted)" }}
          >
            ✕
          </button>
        </div>
      )}

      {syncMessage && (
        <div
          className="border rounded-md p-3 mb-4 flex items-center gap-3 text-[12.5px]"
          style={{
            borderColor:
              syncMessage.kind === "ok"
                ? "rgba(0,135,90,0.25)"
                : "rgba(198,40,40,0.25)",
            background:
              syncMessage.kind === "ok"
                ? "var(--a-green-soft)"
                : "var(--a-red-soft)",
            color:
              syncMessage.kind === "ok" ? "var(--a-green)" : "var(--a-red)",
          }}
        >
          <strong>{syncMessage.kind === "ok" ? "Synced." : "Sync failed."}</strong>
          <span>{syncMessage.text}</span>
          <button
            className="ml-auto text-[11.5px]"
            onClick={() => setSyncMessage(null)}
            style={{ color: "var(--a-muted)" }}
          >
            ✕
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : !data ? (
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          Failed to load Cloudbeds details.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {/* Inventory sync */}
            <Card>
              <CardHead>
                <h2 className="text-[12.5px] font-semibold">Inventory sync</h2>
                <span
                  className="ml-auto font-jbm text-[11px]"
                  style={{ color: "var(--a-muted)" }}
                >
                  cron · 0 */6 * * *
                </span>
              </CardHead>
              <Kv k="Last sync">
                {data.lastSyncedAt ? (
                  <>
                    {formatDateTime(data.lastSyncedAt)}{" "}
                    <span style={{ color: "var(--a-muted)" }}>
                      · {timeAgo(data.lastSyncedAt)}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--a-muted)" }}>never</span>
                )}
              </Kv>
              <Kv k="Cold-start fire-and-forget">
                <Pill tone="green">enabled</Pill>
              </Kv>
              <Kv k="Cache">
                <code style={{ background: "var(--a-surface-2)" }} className="px-1 py-0.5 rounded text-[11.5px]">
                  availability:{propertyId.slice(0, 8)}…
                </code>{" "}
                <span style={{ color: "var(--a-muted)" }}>· revalidate 30s</span>
              </Kv>
              <div
                className="px-4 py-3 text-[11.5px]"
                style={{ color: "var(--a-muted)" }}
              >
                Sync history table lands when we add a sync_runs log. For now,
                the freshest signal is &quot;Last sync&quot; above.
              </div>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHead>
                <h2 className="text-[12.5px] font-semibold">Webhook subscriptions</h2>
                <span
                  className="ml-auto font-jbm text-[11px]"
                  style={{ color: "var(--a-muted)" }}
                >
                  {data.webhooks.length} active
                </span>
              </CardHead>
              {data.webhooks.length === 0 ? (
                <div
                  className="px-4 py-6 text-center text-[12.5px]"
                  style={{ color: "var(--a-muted)" }}
                >
                  No webhook subscriptions. Re-authorise to register.
                </div>
              ) : (
                data.webhooks.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] border-b last:border-b-0"
                    style={{ borderColor: "var(--a-border-soft)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--a-green)" }}
                    />
                    <span className="font-jbm text-[12px]">{w.event}</span>
                    <span
                      className="ml-auto font-jbm text-[11px]"
                      style={{ color: "var(--a-muted)" }}
                    >
                      sub {w.cloudbedsSubscriptionId.slice(0, 8)}…
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Connection */}
            <Card>
              <CardHead>
                <h2 className="text-[12.5px] font-semibold">Connection</h2>
              </CardHead>
              <Kv k="Property ID">
                {data.cloudbedsPropertyId ? (
                  <span className="font-jbm">{data.cloudbedsPropertyId}</span>
                ) : (
                  <span style={{ color: "var(--a-muted)" }}>—</span>
                )}
              </Kv>
              <Kv k="OAuth">
                {data.connected ? (
                  <Pill tone="green">connected</Pill>
                ) : (
                  <Pill tone="red">not connected</Pill>
                )}
              </Kv>
              <Kv k="Token expires">
                {tokenExpiry ? (
                  <>
                    <span className="font-jbm">{formatDateTime(tokenExpiry)}</span>
                    {tokenExpiringSoon && (
                      <>
                        {" "}
                        <Pill tone="amber">in {tokenExpiresInDays}d</Pill>
                      </>
                    )}
                  </>
                ) : (
                  <span style={{ color: "var(--a-muted)" }}>—</span>
                )}
              </Kv>
              <Kv k="Auto-refresh">
                <Pill tone="green">enabled</Pill>
              </Kv>
              <div className="px-4 py-3">
                <div
                  className="text-[10.5px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--a-muted)" }}
                >
                  Scopes
                </div>
                <div
                  className="font-jbm text-[10.5px] leading-relaxed"
                  style={{ color: "var(--a-ink-2)" }}
                >
                  {data.scopes.join(" ")}
                </div>
              </div>
              <div
                className="px-4 py-3 flex gap-1.5 border-t"
                style={{ borderColor: "var(--a-border-soft)" }}
              >
                <Btn size="sm" onClick={handleReauth}>
                  {authorising ? "Redirecting…" : "Re-authorise"}
                </Btn>
                {data.connected && (
                  <Btn size="sm" onClick={handleDisconnect}>
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </Btn>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

// ─── primitives ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      {children}
    </div>
  );
}

function CardHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-2.5 border-b"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      {children}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 px-4 py-2 text-[12.5px] border-b last:border-b-0"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      <div className="w-[160px] flex-shrink-0" style={{ color: "var(--a-muted)" }}>
        {k}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red";
}) {
  const tones = {
    green: {
      color: "var(--a-green)",
      bg: "var(--a-green-soft)",
      border: "rgba(0,135,90,0.25)",
    },
    amber: {
      color: "var(--a-amber)",
      bg: "var(--a-amber-soft)",
      border: "rgba(180,83,9,0.25)",
    },
    red: {
      color: "var(--a-red)",
      bg: "var(--a-red-soft)",
      border: "rgba(198,40,40,0.25)",
    },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] font-medium border"
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: "currentColor" }} />
      {children}
    </span>
  );
}

// ─── format helpers ────────────────────────────────────────────────

function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.round(h / 24);
  return `${d2}d ago`;
}
