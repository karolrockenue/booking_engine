import { randomUUID } from "node:crypto";
import { getValidAccessToken } from "./client";

const API_BASE = "https://hotels.cloudbeds.com/api/v1.3";

interface PostReservationParams {
  cloudbedsPropertyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestCountry?: string;
  guestPhone?: string;
  roomTypeID: string; // Cloudbeds room type ID (otaRoomId in our DB)
  ratesID: string; // Cloudbeds rate plan ID (otaRateId)
  adults: number;
  children: number;
  subtotal: number; // ROOM subtotal, major units (extras are posted separately).
  // Informational only — Cloudbeds prices the room from roomRateID, not this.
  thirdPartyIdentifier: string; // our orderId
  paymentMethod?: string; // "credit" | "cash" | "other"
}

interface PostReservationResponse {
  success: boolean;
  // Cloudbeds returns reservation fields flat at the top level for
  // postReservation (unusual — most v1.3 endpoints wrap in { data }).
  reservationID?: string;
  status?: string;
  guestID?: string;
  message?: string;
}

/**
 * Create a reservation in Cloudbeds via v1.3 postReservation.
 *
 * v1.3 endpoints take form-encoded bodies (NOT JSON) and propertyID in the
 * query string. Returns { success, data: { reservationID, ... } } or
 * { success: false, message }.
 */
export async function postReservation(
  ourPropertyId: string,
  params: PostReservationParams
): Promise<{ reservationID: string }> {
  const token = await getValidAccessToken(ourPropertyId);

  const url = new URL(`${API_BASE}/postReservation`);
  url.searchParams.set("propertyID", params.cloudbedsPropertyId);

  const form = new URLSearchParams();
  form.set("startDate", params.startDate);
  form.set("endDate", params.endDate);
  form.set("guestFirstName", params.guestFirstName);
  form.set("guestLastName", params.guestLastName);
  form.set("guestEmail", params.guestEmail);
  if (params.guestCountry) form.set("guestCountry", params.guestCountry);
  if (params.guestPhone) form.set("guestCellPhone", params.guestPhone);
  // Single-room booking shape. Multi-room would use rooms[i][roomTypeID].
  form.set("rooms[0][roomTypeID]", params.roomTypeID);
  form.set("rooms[0][quantity]", "1");
  // roomRateID is what actually selects the rate Cloudbeds prices the room at.
  // `ratesID` (singular) and `subtotal[][subtotal]` are NOT honored for pricing:
  // without roomRateID, Cloudbeds falls back to the room's master/base rate.
  // Verified against the demo property 2026-05-20 — a derived "Direct Rate"
  // (rateID 3117104, base − 10%) booked via ratesID alone priced at the base
  // 120 instead of 108; adding rooms[0][roomRateID]=3117104 priced it at 108.
  // Set it to the same rate we sold so the PMS folio matches the guest's quote.
  form.set("rooms[0][roomRateID]", params.ratesID);
  form.set("adults[0][roomTypeID]", params.roomTypeID);
  form.set("adults[0][quantity]", String(params.adults));
  form.set("children[0][roomTypeID]", params.roomTypeID);
  form.set("children[0][quantity]", String(params.children));
  form.set("ratesID", params.ratesID);
  form.set("subtotal[0][roomTypeID]", params.roomTypeID);
  form.set("subtotal[0][subtotal]", params.subtotal.toFixed(2));
  form.set("paymentMethod", params.paymentMethod ?? "credit");
  form.set("thirdPartyIdentifier", params.thirdPartyIdentifier);
  form.set("sendEmailConfirmation", "false");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let body: PostReservationResponse;
  try {
    body = JSON.parse(text) as PostReservationResponse;
  } catch {
    throw new Error(
      `Cloudbeds postReservation: non-JSON response (${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok || !body.success || !body.reservationID) {
    throw new Error(
      `Cloudbeds postReservation failed: ${body.message ?? `HTTP ${res.status}`} — ${text.slice(0, 300)}`
    );
  }

  return { reservationID: body.reservationID };
}

interface PostCustomItemParams {
  cloudbedsPropertyId: string;
  reservationID: string;
  name: string;
  amount: number; // major units, in property currency
  quantity: number;
  // Optional folio service date (YYYY-MM-DD). Used to date each breakfast to
  // the morning it's served, so the folio + "items by date" reports show staff
  // the per-day counts. Defaults (omitted) to the post date.
  serviceDate?: string;
}

interface PostCustomItemResponse {
  success: boolean;
  // Real shape (verified against the demo property 2026-05-20): wrapped in
  // `data`, NOT flat. soldProductID is the prefixed line handle ("p_64862080");
  // externalRelationID is its numeric form.
  data?: {
    soldProductID?: string;
    externalRelationID?: string;
  };
  message?: string;
}

/**
 * Attach a folio line item (extra) to an existing reservation.
 *
 * v1.3 postCustomItem takes a PHP-style indexed `items[]` array — each entry
 * requires `appItemID` (an app-supplied unique ID — we mint a UUID per line),
 * `itemName`, `itemQuantity`, and a price (`itemPrice` = unit price, or
 * `itemAmount` = line total). The array *can* hold multiple items, but we send
 * one per call so a single bad extra doesn't fail the rest of the folio.
 */
export async function postCustomItem(
  ourPropertyId: string,
  params: PostCustomItemParams
): Promise<{ itemID: string }> {
  const token = await getValidAccessToken(ourPropertyId);

  const url = new URL(`${API_BASE}/postCustomItem`);
  url.searchParams.set("propertyID", params.cloudbedsPropertyId);

  const form = new URLSearchParams();
  form.set("reservationID", params.reservationID);
  form.set("items[0][appItemID]", randomUUID());
  form.set("items[0][itemName]", params.name);
  form.set("items[0][itemQuantity]", String(params.quantity));
  form.set("items[0][itemPrice]", params.amount.toFixed(2));
  if (params.serviceDate) form.set("items[0][serviceDate]", params.serviceDate);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let body: PostCustomItemResponse;
  try {
    body = JSON.parse(text) as PostCustomItemResponse;
  } catch {
    throw new Error(
      `Cloudbeds postCustomItem: non-JSON response (${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudbeds postCustomItem failed: ${body.message ?? `HTTP ${res.status}`} — ${text.slice(0, 300)}`
    );
  }

  return {
    itemID: body.data?.soldProductID ?? body.data?.externalRelationID ?? "",
  };
}

interface PostPaymentParams {
  cloudbedsPropertyId: string;
  reservationID: string;
  amount: number; // major units
  type?: string; // "credit" | "cash" | "other" — defaults to "credit"
  description?: string;
}

interface PostPaymentResponse {
  success: boolean;
  paymentID?: string;
  transactionID?: string;
  message?: string;
}

/**
 * Record a payment against a reservation in Cloudbeds. For NR rates we call
 * this after a successful Stripe charge so the hotel's accounting reflects
 * the payment. Description includes the Stripe PaymentIntent ID for
 * reconciliation.
 */
export async function postPayment(
  ourPropertyId: string,
  params: PostPaymentParams
): Promise<{ paymentID: string }> {
  const token = await getValidAccessToken(ourPropertyId);

  const url = new URL(`${API_BASE}/postPayment`);
  url.searchParams.set("propertyID", params.cloudbedsPropertyId);

  const form = new URLSearchParams();
  form.set("reservationID", params.reservationID);
  form.set("amount", params.amount.toFixed(2));
  form.set("type", params.type ?? "credit");
  if (params.description) form.set("description", params.description);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let body: PostPaymentResponse;
  try {
    body = JSON.parse(text) as PostPaymentResponse;
  } catch {
    throw new Error(
      `Cloudbeds postPayment: non-JSON response (${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudbeds postPayment failed: ${body.message ?? `HTTP ${res.status}`} — ${text.slice(0, 300)}`
    );
  }

  return { paymentID: body.paymentID ?? body.transactionID ?? "" };
}

interface PutReservationStatusParams {
  cloudbedsPropertyId: string;
  reservationID: string;
  // Cloudbeds spells it "canceled" (single l). Other accepted values include
  // "confirmed", "checked_in", "checked_out", "no_show". We only need cancel.
  status: "canceled";
  reason?: string;
}

interface PutReservationStatusResponse {
  success: boolean;
  reservationID?: string;
  status?: string;
  message?: string;
}

/**
 * Cancel an existing Cloudbeds reservation. Idempotent on Cloudbeds' side:
 * calling this on an already-canceled reservation returns success.
 *
 * Releases the held inventory back to the property's availability — the
 * `reservation/status_changed` webhook will fire and trigger our inventory
 * sync, so the freed room becomes bookable again automatically.
 */
export async function putReservationStatus(
  ourPropertyId: string,
  params: PutReservationStatusParams
): Promise<{ reservationID: string; status: string }> {
  const token = await getValidAccessToken(ourPropertyId);

  // Cloudbeds doesn't expose a dedicated /putReservationStatus endpoint —
  // status changes go through /putReservation with `status=canceled` in
  // the form body. /putReservationStatus 404s with the marketing HTML
  // page; /putReservation is the real path. Verified against the demo
  // property during cert prep (smoke test 2026-05-18).
  const url = new URL(`${API_BASE}/putReservation`);
  url.searchParams.set("propertyID", params.cloudbedsPropertyId);

  const form = new URLSearchParams();
  form.set("reservationID", params.reservationID);
  form.set("status", params.status);
  if (params.reason) form.set("reason", params.reason);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let body: PutReservationStatusResponse;
  try {
    body = JSON.parse(text) as PutReservationStatusResponse;
  } catch {
    throw new Error(
      `Cloudbeds putReservation (cancel): non-JSON response (${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudbeds putReservation (cancel) failed: ${body.message ?? `HTTP ${res.status}`} — ${text.slice(0, 300)}`
    );
  }

  return {
    reservationID: body.reservationID ?? params.reservationID,
    status: body.status ?? params.status,
  };
}

interface PostReservationNoteParams {
  cloudbedsPropertyId: string;
  reservationID: string;
  note: string;
}

interface PostReservationNoteResponse {
  success: boolean;
  reservationNoteID?: string;
  message?: string;
}

/**
 * Add a staff-facing note to a reservation (the reservation's Notes tab). We
 * use it to summarise breakfast — how many, on which mornings — so the front
 * desk sees it at a glance. The field is `reservationNote` (verified against
 * the demo property 2026-05-20). Non-fatal: a failed note never voids a
 * booking.
 */
export async function postReservationNote(
  ourPropertyId: string,
  params: PostReservationNoteParams
): Promise<{ noteID: string }> {
  const token = await getValidAccessToken(ourPropertyId);

  const url = new URL(`${API_BASE}/postReservationNote`);
  url.searchParams.set("propertyID", params.cloudbedsPropertyId);

  const form = new URLSearchParams();
  form.set("reservationID", params.reservationID);
  form.set("reservationNote", params.note);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let body: PostReservationNoteResponse;
  try {
    body = JSON.parse(text) as PostReservationNoteResponse;
  } catch {
    throw new Error(
      `Cloudbeds postReservationNote: non-JSON response (${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudbeds postReservationNote failed: ${body.message ?? `HTTP ${res.status}`} — ${text.slice(0, 300)}`
    );
  }

  return { noteID: body.reservationNoteID ?? "" };
}

