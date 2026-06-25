import crypto from "node:crypto";

// Ryft webhook verification + event taxonomy.
//
// Ryft signs every webhook with HMAC-SHA256 over the RAW request body, keyed by
// the endpoint secret (`whs_…`, returned only when the webhook is created), and
// delivers the result in the `Signature` header. We must verify against the
// exact bytes Ryft sent — so the route reads req.text() and passes it here
// untouched (JSON.parse first would re-serialise and change the bytes).
//
// NOTE: Ryft's docs state the algorithm but not the digest encoding. Rather
// than guess hex vs base64 and risk silently rejecting every real event, we
// compute our HMAC once and timing-safe-compare it against the header in BOTH
// encodings. This stays secure — a forged signature must still equal a genuine
// HMAC-SHA256 keyed by the secret — and collapses to a one-line simplification
// once a real delivery confirms the encoding. [VERIFY against first live event]

export const RYFT_SIGNATURE_HEADER = "Signature";

// Event names exactly as Ryft emits them (verified against the OpenAPI spec).
export const RyftEvent = {
  PaymentApproved: "PaymentSession.approved",
  PaymentCaptured: "PaymentSession.captured",
  PaymentDeclined: "PaymentSession.declined",
  PaymentRefunded: "PaymentSession.refunded",
  PaymentVoided: "PaymentSession.voided",
  AccountCreated: "Account.created",
  AccountUpdated: "Account.updated",
  DisputeCreated: "Dispute.created",
  DisputeChallenged: "Dispute.challenged",
  DisputeClosed: "Dispute.closed",
  PayoutCreated: "Payout.created",
  PersonCreated: "Person.created",
  PersonUpdated: "Person.updated",
  PersonDeleted: "Person.deleted",
} as const;

export type RyftEventType = (typeof RyftEvent)[keyof typeof RyftEvent];

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Length-mismatched compares can't be timing-safe; bail before the throw.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Ryft webhook signature. `rawBody` MUST be the exact request body
 * string (not a re-serialised object). Returns false on any mismatch or
 * missing input rather than throwing, so the route can answer 400 uniformly.
 */
export function verifyRyftSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const mac = crypto.createHmac("sha256", secret).update(rawBody, "utf8");
  const digest = mac.digest();
  const expectedHex = digest.toString("hex");
  const expectedB64 = digest.toString("base64");
  const got = signatureHeader.trim();
  return safeEqual(got, expectedHex) || safeEqual(got, expectedB64);
}

// Minimal shape of a Ryft webhook envelope — enough to route on. The full
// event payload lives under `data` and is persisted verbatim for audit.
export interface RyftWebhookEvent {
  id?: string;
  eventType: string;
  data?: Record<string, unknown>;
}
