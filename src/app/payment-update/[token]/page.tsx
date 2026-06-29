import { db } from "@/db";
import { bookings, properties, roomTypes, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaymentUpdateToken } from "@/lib/crypto";
import { createBookingCardSave, RyftSessionError } from "@/lib/ryft/sessions";
import { RyftPaymentUpdateClient } from "./ryft-payment-update-client";

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

export const dynamic = "force-dynamic";

export default async function PaymentUpdatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyPaymentUpdateToken(token);

  if (!verified) {
    return (
      <ErrorShell
        title="Link invalid"
        message="This card-update link is invalid or has been tampered with. Please reply to your most recent email and we'll help."
      />
    );
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, verified.bookingId))
    .limit(1);

  if (!booking) {
    return (
      <ErrorShell
        title="Booking not found"
        message="We couldn't locate this booking. Please reply to your most recent email and we'll help."
      />
    );
  }

  const [property] = booking.propertyId
    ? await db
        .select()
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .limit(1)
    : [undefined];
  const [room] = booking.roomTypeId
    ? await db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.id, booking.roomTypeId))
        .limit(1)
    : [undefined];
  const [rate] = booking.ratePlanId
    ? await db
        .select()
        .from(ratePlans)
        .where(eq(ratePlans.id, booking.ratePlanId))
        .limit(1)
    : [undefined];

  const hotelName = property?.name ?? "the hotel";
  const sym = symbolFor(booking.currency);
  const grandTotal = `${sym}${Number(booking.grandTotal).toFixed(2)}`;

  // Terminal states get a plain message — no Stripe form. The cron either
  // already charged successfully, or the 24h grace expired and the booking
  // was auto-cancelled.
  if (booking.status === "paid") {
    return (
      <Shell hotelName={hotelName}>
        <h1 style={titleStyle}>Already paid</h1>
        <p style={bodyStyle}>
          We took payment for this booking. No action is needed.
        </p>
        <Summary
          reservationId={booking.cloudbedsReservationId ?? booking.orderId}
          roomName={room?.name ?? "Room"}
          rateName={rate?.name ?? "Rate"}
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          grandTotal={grandTotal}
        />
      </Shell>
    );
  }
  if (booking.status === "cancelled" || booking.status === "failed") {
    return (
      <Shell hotelName={hotelName}>
        <h1 style={titleStyle}>Booking cancelled</h1>
        <p style={bodyStyle}>
          This booking has been cancelled. If you didn&rsquo;t expect this,
          please reply to your most recent email and we&rsquo;ll help.
        </p>
        <Summary
          reservationId={booking.cloudbedsReservationId ?? booking.orderId}
          roomName={room?.name ?? "Room"}
          rateName={rate?.name ?? "Rate"}
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          grandTotal={grandTotal}
        />
      </Shell>
    );
  }
  if (booking.status !== "pms_synced") {
    return (
      <ErrorShell
        title="Card update not available"
        message="This booking isn't currently awaiting payment. Please reply to your most recent email and we'll help."
      />
    );
  }

  // Rail branch: a Ryft-active property's Flex booking saves a new card via a
  // fresh zero-value card-save (COF mandate) session; the legacy Stripe path
  // below mints a SetupIntent. Resolution mirrors get-property's paymentRail.
  if (property?.ryftAccountStatus === "active") {
    if (!booking.ryftCustomerId) {
      return (
        <ErrorShell
          title="Card update not available"
          message="We can't update the card on this booking automatically. Please reply to your most recent email and we'll help."
        />
      );
    }
    // Mint a fresh card-save session against the same customer (get-or-create by
    // email reuses it). The new mandate replaces the old one server-side once
    // the guest saves a card.
    let cardSave;
    try {
      cardSave = await createBookingCardSave({
        property,
        orderId: booking.orderId,
        guestEmail: booking.guestEmail || undefined,
        guestFirst: booking.guestFirst || undefined,
        guestLast: booking.guestLast || undefined,
      });
    } catch (err) {
      console.error(
        `payment-update: failed to create Ryft card-save for booking ${booking.id}:`,
        err instanceof RyftSessionError ? err.message : err
      );
      return (
        <ErrorShell
          title="Couldn't start card update"
          message="We hit a problem preparing the form. Please reload the page in a few minutes, or reply to your most recent email if it keeps happening."
        />
      );
    }

    return (
      <Shell hotelName={hotelName}>
        <h1 style={titleStyle}>Update card</h1>
        <p style={bodyStyle}>
          We tried to take payment for your stay at <strong>{hotelName}</strong>{" "}
          but the bank wouldn&rsquo;t authorise it. Save a new card below and
          we&rsquo;ll retry the charge automatically.
        </p>
        <Summary
          reservationId={booking.cloudbedsReservationId ?? booking.orderId}
          roomName={room?.name ?? "Room"}
          rateName={rate?.name ?? "Rate"}
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          grandTotal={grandTotal}
        />
        <RyftPaymentUpdateClient
          token={token}
          clientSecret={cardSave.clientSecret}
          verifySessionId={cardSave.paymentSessionId}
          accountId={property.ryftAccountId}
          publicKey={process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY ?? ""}
          customerEmail={booking.guestEmail || undefined}
        />
      </Shell>
    );
  }

  // Not a Ryft-active property → no rail to update the card on (Ryft is the only
  // payment rail). Nothing actionable for the guest here.
  return (
    <ErrorShell
      title="Card update not available"
      message="We can't update the card on this booking automatically. Please reply to your most recent email and we'll help."
    />
  );
}

function Shell({
  hotelName,
  children,
}: {
  hotelName: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f2f2f2",
        padding: "48px 16px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            padding: "32px 32px 20px",
            background: "#1a1a1a",
            color: "#fff",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
            Card update
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {hotelName}
          </p>
        </div>
        <div style={{ padding: "28px 32px" }}>{children}</div>
        <div
          style={{
            padding: "16px 32px",
            background: "#fafafa",
            borderTop: "1px solid #f0f0f0",
            textAlign: "center",
            fontSize: 11,
            color: "#888",
          }}
        >
          {hotelName} · Booking management
        </div>
      </div>
    </div>
  );
}

function Summary({
  reservationId,
  roomName,
  rateName,
  checkIn,
  checkOut,
  grandTotal,
}: {
  reservationId: string;
  roomName: string;
  rateName: string;
  checkIn: string;
  checkOut: string;
  grandTotal: string;
}) {
  return (
    <div
      style={{
        background: "#f5f5f5",
        borderRadius: 6,
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#888",
        }}
      >
        Reservation
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "monospace",
          marginTop: 2,
        }}
      >
        {reservationId}
      </div>
      <div
        style={{ marginTop: 12, fontSize: 14, color: "#444", lineHeight: 1.6 }}
      >
        <div>
          {roomName} · {rateName}
        </div>
        <div>
          {formatDate(checkIn)} → {formatDate(checkOut)}
        </div>
        <div style={{ marginTop: 4, fontWeight: 600, color: "#1a1a1a" }}>
          {grandTotal}
        </div>
      </div>
    </div>
  );
}

const titleStyle = { margin: "0 0 12px", fontSize: 20, fontWeight: 600 };
const bodyStyle = {
  margin: "0 0 20px",
  fontSize: 14,
  color: "#444",
  lineHeight: 1.6,
};

function ErrorShell({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f2f2f2",
        padding: "48px 16px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 8,
          padding: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 600 }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.6 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
