/**
 * Register (or inspect) the Ryft webhook endpoint and print the signing secret.
 *
 *   set -a && source .env.local && set +a && npx tsx src/scripts/ryft-register-webhook.ts [url]
 *
 * The base URL is inferred from RYFT_SECRET_KEY's prefix (sk_live_ → live,
 * otherwise sandbox) by the shared client, so pointing this at production is
 * just a matter of sourcing the live key. Webhooks are PLATFORM-level (no
 * Account header) — one endpoint receives events for every sub-account.
 *
 * Modes:
 *   (no args)        List existing webhook endpoints — no side effects.
 *   <url> --create   Register a new endpoint at <url> and print its whs_ secret.
 *
 * The `secret` (whs_…) is returned ONLY at creation. Copy it into the
 * RYFT_WEBHOOK_SECRET env var (Railway) immediately — it can't be retrieved
 * later, and the receiver at /api/ryft/webhooks rejects every delivery without
 * it.
 */
import { ryftFetch } from "@/lib/ryft/client";

// The events /api/ryft/webhooks acts on, plus refund/void/dispute for the audit
// trail. Registering an event the receiver ignores is harmless.
const EVENT_TYPES = [
  "PaymentSession.approved",
  "PaymentSession.captured",
  "PaymentSession.declined",
  "PaymentSession.refunded",
  "PaymentSession.voided",
  "Account.created",
  "Account.updated",
  "Dispute.created",
  "Dispute.challenged",
  "Dispute.closed",
];

interface WebhookEndpoint {
  id: string;
  url: string;
  active: boolean;
  eventTypes?: string[];
  secret?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const create = args.includes("--create");
  const url =
    args.find((a) => a.startsWith("http")) ??
    (process.env.PUBLIC_APP_URL
      ? `${process.env.PUBLIC_APP_URL.replace(/\/+$/, "")}/api/ryft/webhooks`
      : undefined);

  const keyKind = process.env.RYFT_SECRET_KEY?.startsWith("sk_live_")
    ? "LIVE"
    : "SANDBOX";

  // Always list first so you can see what's already registered.
  const existing = await ryftFetch<{ items?: WebhookEndpoint[] }>("/webhooks");
  console.log(`\n[${keyKind}] Existing webhook endpoints:`);
  if (!existing.items?.length) {
    console.log("  (none)");
  } else {
    for (const w of existing.items) {
      console.log(
        `  ${w.id}  active=${w.active}  ${w.url}\n    events: ${(w.eventTypes ?? []).join(", ")}`
      );
    }
  }

  if (!create) {
    console.log(
      "\nDry run (listing only). Re-run with a URL and --create to register:\n" +
        "  npx tsx src/scripts/ryft-register-webhook.ts https://<prod-host>/api/ryft/webhooks --create\n"
    );
    return;
  }

  if (!url) {
    throw new Error(
      "No URL. Pass it explicitly or set PUBLIC_APP_URL.\n" +
        "  npx tsx src/scripts/ryft-register-webhook.ts https://<prod-host>/api/ryft/webhooks --create"
    );
  }
  if (!url.startsWith("https://")) {
    throw new Error(`Webhook URL must be https (got ${url})`);
  }
  if (existing.items?.some((w) => w.url === url && w.active)) {
    throw new Error(
      `An active endpoint for ${url} already exists — refusing to create a duplicate. Delete it first if you mean to rotate the secret.`
    );
  }

  const created = await ryftFetch<WebhookEndpoint>("/webhooks", {
    method: "POST",
    body: { url, active: true, eventTypes: EVENT_TYPES },
  });

  console.log(`\n[${keyKind}] ✅ Webhook registered:`);
  console.log(`  id:     ${created.id}`);
  console.log(`  url:    ${created.url}`);
  console.log(`  events: ${(created.eventTypes ?? EVENT_TYPES).join(", ")}`);
  console.log("\n  >>> SET THIS NOW (shown only once) <<<");
  console.log(`  RYFT_WEBHOOK_SECRET=${created.secret}\n`);
}

main().catch((err) => {
  console.error("\n❌ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
