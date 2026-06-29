import { db } from "@/db";
import { bookings, properties, roomTypes, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyCancelToken } from "@/lib/crypto";
import { getPropertyContent } from "@/lib/get-property";
import { CancelClient } from "./cancel-client";

interface CancellationPolicySnapshot {
  deadlineHours?: number;
  penaltyType?: "first_night" | "full_stay" | "percent" | "none";
  penaltyPercent?: number;
  isRefundable?: boolean;
  note?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function symbolFor(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function computeDeadline(
  checkIn: string,
  policy: CancellationPolicySnapshot
): Date | null {
  if (policy.isRefundable === false) return null;
  if (typeof policy.deadlineHours !== "number") return null;
  const checkInDate = new Date(`${checkIn}T00:00:00Z`);
  return new Date(checkInDate.getTime() - policy.deadlineHours * 60 * 60 * 1000);
}

// Extracted to keep the React component pure (Date.now is impure inside a
// component body per react-hooks/purity). The page is force-dynamic so this
// runs once per request server-side.
function isPastDeadline(deadlineAt: Date | null): boolean {
  if (!deadlineAt) return false;
  return Date.now() > deadlineAt.getTime();
}

export const dynamic = "force-dynamic";

export default async function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyCancelToken(token);

  if (!verified) {
    return <ErrorShell title="Link invalid" message="This cancellation link is invalid or has been tampered with. If you'd like to cancel, please reply to your confirmation email." />;
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, verified.bookingId))
    .limit(1);

  if (!booking) {
    return <ErrorShell title="Booking not found" message="We couldn't locate this booking. It may have been removed. Please reply to your confirmation email if you need help." />;
  }

  const [property] = booking.propertyId
    ? await db.select().from(properties).where(eq(properties.id, booking.propertyId)).limit(1)
    : [undefined];
  const [room] = booking.roomTypeId
    ? await db.select().from(roomTypes).where(eq(roomTypes.id, booking.roomTypeId)).limit(1)
    : [undefined];
  const [ratePlan] = booking.ratePlanId
    ? await db.select().from(ratePlans).where(eq(ratePlans.id, booking.ratePlanId)).limit(1)
    : [undefined];

  const hotelName = property?.name ?? "the hotel";
  const content = property ? await getPropertyContent(property.id) : null;
  const contactEmail = content?.contact?.reservationsEmail ?? content?.contact?.generalEmail;
  const contactPhone = content?.contact?.reservationsPhone;

  const policy = (booking.cancellationPolicySnapshot ?? {}) as CancellationPolicySnapshot;
  const deadlineAt = computeDeadline(booking.checkIn, policy);
  const pastDeadline = isPastDeadline(deadlineAt);

  // Eligibility mirror of the API route — keeps the page honest about what
  // will happen if the user clicks Confirm.
  let eligibility:
    | { kind: "eligible"; willRefund: boolean }
    | { kind: "already_cancelled" }
    | { kind: "ineligible"; reason: "non_refundable" | "past_deadline" | "invalid_status" };

  if (booking.status === "cancelled") {
    eligibility = { kind: "already_cancelled" };
  } else if (booking.rateType === "nr" || policy.isRefundable === false) {
    eligibility = { kind: "ineligible", reason: "non_refundable" };
  } else if (pastDeadline) {
    eligibility = { kind: "ineligible", reason: "past_deadline" };
  } else if (
    booking.status !== "pms_synced" &&
    booking.status !== "paid" &&
    booking.status !== "payment_authorized"
  ) {
    eligibility = { kind: "ineligible", reason: "invalid_status" };
  } else {
    // Refund only if money was already taken (Flex auto-charged earlier).
    eligibility = {
      kind: "eligible",
      willRefund: booking.status === "paid" && Boolean(booking.ryftPaymentSessionId),
    };
  }

  const sym = symbolFor(booking.currency);
  const grandTotal = `${sym}${Number(booking.grandTotal).toFixed(2)}`;
  const guestName = `${booking.guestFirst} ${booking.guestLast}`.trim();

  return (
    <div style={{ minHeight: "100vh", background: "#f2f2f2", padding: "48px 16px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", color: "#1a1a1a" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "32px 32px 20px", background: "#1a1a1a", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
            {eligibility.kind === "already_cancelled" ? "Booking already cancelled" : "Cancel booking"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{hotelName}</p>
        </div>

        <div style={{ padding: "28px 32px" }}>
          {guestName && (
            <p style={{ margin: "0 0 16px", fontSize: 15 }}>Hi {booking.guestFirst},</p>
          )}

          {/* Booking summary — always shown */}
          <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#888" }}>Reservation</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>
              {booking.cloudbedsReservationId ?? booking.orderId}
            </div>
            <div style={{ marginTop: 12, fontSize: 14, color: "#444", lineHeight: 1.6 }}>
              <div>{room?.name ?? "Room"} · {ratePlan?.name ?? "Rate"}</div>
              <div>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</div>
              <div style={{ marginTop: 4, fontWeight: 600, color: "#1a1a1a" }}>{grandTotal}</div>
            </div>
          </div>

          {eligibility.kind === "already_cancelled" && (
            <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.6 }}>
              This booking has already been cancelled. A confirmation email was sent at the time. If you didn&rsquo;t receive it, please reply to your original confirmation email and we&rsquo;ll resend.
            </p>
          )}

          {eligibility.kind === "eligible" && (
            <CancelClient
              token={token}
              willRefund={eligibility.willRefund}
              refundAmount={eligibility.willRefund ? Number(booking.grandTotal) : 0}
              currencySymbol={sym}
              policyNote={policy.note}
            />
          )}

          {eligibility.kind === "ineligible" && (
            <IneligibleBlock
              reason={eligibility.reason}
              deadlineAt={deadlineAt}
              hotelName={hotelName}
              contactEmail={contactEmail}
              contactPhone={contactPhone}
            />
          )}
        </div>

        <div style={{ padding: "16px 32px", background: "#fafafa", borderTop: "1px solid #f0f0f0", textAlign: "center", fontSize: 11, color: "#888" }}>
          {hotelName} · Booking management
        </div>
      </div>
    </div>
  );
}

function IneligibleBlock({
  reason,
  deadlineAt,
  hotelName,
  contactEmail,
  contactPhone,
}: {
  reason: "non_refundable" | "past_deadline" | "invalid_status";
  deadlineAt: Date | null;
  hotelName: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const titles: Record<typeof reason, string> = {
    non_refundable: "This booking is non-refundable",
    past_deadline: "Cancellation window has closed",
    invalid_status: "This booking can't be cancelled online",
  };
  const messages: Record<typeof reason, string> = {
    non_refundable: `The rate you booked doesn't include free cancellation. To request a cancellation, please get in touch with ${hotelName} directly.`,
    past_deadline: deadlineAt
      ? `Free cancellation ended on ${deadlineAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. To discuss your options, please contact ${hotelName} directly.`
      : `The cancellation window has closed. Please contact ${hotelName} directly.`,
    invalid_status: `Please contact ${hotelName} directly so we can help.`,
  };

  return (
    <div>
      <div style={{ padding: "14px 16px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#92400e" }}>{titles[reason]}</div>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444", lineHeight: 1.5 }}>{messages[reason]}</p>
      </div>

      {(contactEmail || contactPhone) && (
        <div style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>
          {contactEmail && (
            <div>
              Email:{" "}
              <a href={`mailto:${contactEmail}`} style={{ color: "#1a1a1a", textDecoration: "underline" }}>
                {contactEmail}
              </a>
            </div>
          )}
          {contactPhone && (
            <div>
              Phone:{" "}
              <a href={`tel:${contactPhone.replace(/\s/g, "")}`} style={{ color: "#1a1a1a", textDecoration: "underline" }}>
                {contactPhone}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorShell({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f2f2f2", padding: "48px 16px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", color: "#1a1a1a" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", borderRadius: 8, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 600 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  );
}
