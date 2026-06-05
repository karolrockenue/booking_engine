"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface Status {
  connected: boolean;
  pmsType: string;
  enterpriseId: string | null;
  serviceId: string | null;
  timezone: string | null;
  currency: string | null;
  taxMode: string | null;
  externalPaymentType: string | null;
}

interface ValidateResult {
  enterpriseId: string;
  enterpriseName: string;
  timezone: string;
  currency: string;
  taxMode: string;
  services: Array<{ id: string; name: string }>;
  externalPaymentTypes: string[];
}

export default function MewsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [status, setStatus] = useState<Status | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [validating, setValidating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [options, setOptions] = useState<ValidateResult | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function loadStatus() {
    if (!token || !propertyId) return;
    const r = await fetch(`/api/admin/properties/${propertyId}/mews`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setStatus(await r.json());
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  async function handleValidate() {
    if (!token || !accessToken.trim()) return;
    setValidating(true);
    setMsg(null);
    setOptions(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/mews/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      });
      const body = await r.json();
      if (!r.ok) {
        setMsg({ kind: "error", text: body.error ?? `HTTP ${r.status}` });
        return;
      }
      const result = body as ValidateResult;
      setOptions(result);
      setServiceId(result.services[0]?.id ?? "");
      setPaymentType(result.externalPaymentTypes[0] ?? "");
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "request failed" });
    } finally {
      setValidating(false);
    }
  }

  async function handleConnect() {
    if (!token || !serviceId) return;
    setConnecting(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/mews/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          serviceId,
          externalPaymentType: paymentType || undefined,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setMsg({ kind: "error", text: body.error ?? `HTTP ${r.status}` });
        return;
      }
      setMsg({ kind: "ok", text: `Connected to ${body.enterpriseName}.` });
      setOptions(null);
      setAccessToken("");
      await loadStatus();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "request failed" });
    } finally {
      setConnecting(false);
    }
  }

  const connected = status?.connected ?? false;

  return (
    <>
      <TopStrip
        title="Mews"
        badge={
          status === null
            ? undefined
            : connected
              ? { text: "connected", tone: "green" }
              : { text: "not connected", tone: "red" }
        }
        subtitle={
          connected
            ? `enterprise ${status?.enterpriseId?.slice(0, 8)}… · token stored encrypted`
            : "paste an enterprise AccessToken to connect (Mews has no OAuth)"
        }
      />

      {msg && (
        <div
          className="border rounded-md p-3 mb-4 flex items-center gap-3 text-[12.5px]"
          style={{
            borderColor: msg.kind === "ok" ? "rgba(0,135,90,0.25)" : "rgba(198,40,40,0.25)",
            background: msg.kind === "ok" ? "var(--a-green-soft)" : "var(--a-red-soft)",
            color: msg.kind === "ok" ? "var(--a-green)" : "var(--a-red)",
          }}
        >
          <strong>{msg.kind === "ok" ? "Done." : "Error."}</strong>
          <span>{msg.text}</span>
          <button className="ml-auto text-[11.5px]" onClick={() => setMsg(null)} style={{ color: "var(--a-muted)" }}>
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Connect / reconnect */}
        <Card>
          <CardHead>
            <h2 className="text-[12.5px] font-semibold">
              {connected ? "Reconnect / change token" : "Connect a Mews enterprise"}
            </h2>
          </CardHead>
          <div className="px-4 py-3 flex flex-col gap-3">
            <label className="text-[11px] uppercase tracking-wider" style={{ color: "var(--a-muted)" }}>
              Enterprise AccessToken
            </label>
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="paste the Mews-issued AccessToken"
              className="font-jbm text-[12px] px-2.5 py-2 rounded border w-full"
              style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)", color: "var(--a-ink)" }}
            />
            <div>
              <Btn onClick={handleValidate}>{validating ? "Validating…" : "Validate"}</Btn>
            </div>

            {options && (
              <div className="mt-1 flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--a-border-soft)" }}>
                <div className="text-[12.5px]">
                  <span style={{ color: "var(--a-muted)" }}>Enterprise:</span>{" "}
                  <strong>{options.enterpriseName}</strong>{" "}
                  <span className="font-jbm" style={{ color: "var(--a-muted)" }}>
                    · {options.timezone} · {options.currency} · {options.taxMode} tax
                  </span>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider block mb-1" style={{ color: "var(--a-muted)" }}>
                    Reservable service ({options.services.length})
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="text-[12.5px] px-2.5 py-2 rounded border w-full"
                    style={{ borderColor: "var(--a-border)", background: "var(--a-surface)", color: "var(--a-ink)" }}
                  >
                    {options.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider block mb-1" style={{ color: "var(--a-muted)" }}>
                    External payment type (for recording the Stripe charge)
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="text-[12.5px] px-2.5 py-2 rounded border w-full"
                    style={{ borderColor: "var(--a-border)", background: "var(--a-surface)", color: "var(--a-ink)" }}
                  >
                    {options.externalPaymentTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Btn variant="primary" onClick={handleConnect}>
                    {connecting ? "Connecting…" : "Connect"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Current status */}
        <Card>
          <CardHead>
            <h2 className="text-[12.5px] font-semibold">Connection</h2>
          </CardHead>
          <Kv k="PMS">
            <span className="font-jbm">{status?.pmsType ?? "—"}</span>
          </Kv>
          <Kv k="Status">
            {connected ? <Pill tone="green">connected</Pill> : <Pill tone="red">not connected</Pill>}
          </Kv>
          <Kv k="Enterprise ID">
            <span className="font-jbm">{status?.enterpriseId ?? "—"}</span>
          </Kv>
          <Kv k="Service ID">
            <span className="font-jbm">{status?.serviceId ?? "—"}</span>
          </Kv>
          <Kv k="Timezone">{status?.timezone ?? "—"}</Kv>
          <Kv k="Currency">{status?.currency ?? "—"}</Kv>
          <Kv k="Tax mode">{status?.taxMode ?? "—"}</Kv>
          <Kv k="External payment">{status?.externalPaymentType ?? "—"}</Kv>
          <div className="px-4 py-3 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
            Inventory sync + bookings land in the next phases. Connecting only
            stores the (encrypted) token + service so the sync can run.
          </div>
        </Card>
      </div>
    </>
  );
}

// ─── primitives (mirrors the Cloudbeds page) ──────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-md overflow-hidden" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}>
      {children}
    </div>
  );
}

function CardHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: "var(--a-border-soft)" }}>
      {children}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2 text-[12.5px] border-b last:border-b-0" style={{ borderColor: "var(--a-border-soft)" }}>
      <div className="w-[150px] flex-shrink-0" style={{ color: "var(--a-muted)" }}>
        {k}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "red" }) {
  const tones = {
    green: { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.25)" },
    red: { color: "var(--a-red)", bg: "var(--a-red-soft)", border: "rgba(198,40,40,0.25)" },
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
