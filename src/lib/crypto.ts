import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

// AES-256-GCM at-rest encryption + HMAC-SHA256 state signing for the OAuth
// flow. The same key is used for both — it's a 32-byte secret stored in
// CLOUDBEDS_TOKEN_KEY (base64). Generate locally with:
//
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Never log this key, never paste it into chat, never commit it.

const KEY_ENV = "CLOUDBEDS_TOKEN_KEY";

function getKey(): Buffer {
  const k = process.env[KEY_ENV];
  if (!k) throw new Error(`${KEY_ENV} not set`);
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) {
    throw new Error(`${KEY_ENV} must decode to 32 bytes (got ${buf.length})`);
  }
  return buf;
}

// Output format: iv.tag.ciphertext (all base64). 12-byte IV per encrypt.
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload");
  const [ivB, tagB, encB] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// OAuth state: stateless, signed token containing the property ID + timestamp.
// Verified on callback to confirm the flow originated from us and isn't stale.
export function signOauthState(propertyId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${propertyId}.${timestamp}`;
  const hmac = createHmac("sha256", getKey()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${hmac}`).toString("base64url");
}

export function verifyOauthState(
  state: string,
  maxAgeMs = 10 * 60 * 1000
): { propertyId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [propertyId, timestamp, hmac] = parts;
    const expected = createHmac("sha256", getKey())
      .update(`${propertyId}.${timestamp}`)
      .digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const age = Date.now() - parseInt(timestamp, 10);
    if (age < 0 || age > maxAgeMs) return null;
    return { propertyId };
  } catch {
    return null;
  }
}

// Cancel link token. Embedded in confirmation emails so guests can self-cancel
// without a lookup form. Token has no expiry — its lifetime is bounded by the
// booking's status: once status = 'cancelled' the cancel route refuses to act
// again, so a leaked link is harmless after first use. Timestamp is included
// so we can rotate keys later by checking issue date if needed.
export function signCancelToken(bookingId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${bookingId}.${timestamp}`;
  const hmac = createHmac("sha256", getKey()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${hmac}`).toString("base64url");
}

export function verifyCancelToken(token: string): { bookingId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [bookingId, timestamp, hmac] = parts;
    const expected = createHmac("sha256", getKey())
      .update(`${bookingId}.${timestamp}`)
      .digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { bookingId };
  } catch {
    return null;
  }
}

// Payment-update token. Embedded in re-auth emails so guests can replace a
// declined card without a lookup form. Same shape and security model as
// signCancelToken — booking status guards replay (once status leaves
// 'pms_synced' the page refuses to act). Tag the payload as "pu" so a leaked
// cancel token can't be reused as a payment-update token and vice versa.
export function signPaymentUpdateToken(bookingId: string): string {
  const timestamp = Date.now().toString();
  const payload = `pu.${bookingId}.${timestamp}`;
  const hmac = createHmac("sha256", getKey()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${hmac}`).toString("base64url");
}

export function verifyPaymentUpdateToken(
  token: string
): { bookingId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4 || parts[0] !== "pu") return null;
    const [, bookingId, timestamp, hmac] = parts;
    const expected = createHmac("sha256", getKey())
      .update(`pu.${bookingId}.${timestamp}`)
      .digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { bookingId };
  } catch {
    return null;
  }
}
