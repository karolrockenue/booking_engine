import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Property configuration & theming ---

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  domain: text("domain").unique(),
  currency: text("currency").default("GBP"),
  timezone: text("timezone").default("Europe/London"),
  theme: jsonb("theme").notNull(),
  status: text("status").default("draft"),

  // Cloudbeds OAuth (tokens stored encrypted at app layer — see lib/crypto.ts)
  cloudbedsPropertyId: text("cloudbeds_property_id"),
  cloudbedsAccessToken: text("cloudbeds_access_token"),
  cloudbedsRefreshToken: text("cloudbeds_refresh_token"),
  cloudbedsTokenExpiresAt: timestamp("cloudbeds_token_expires_at", {
    withTimezone: true,
  }),

  // Stripe Connect (Express, direct charges)
  stripeAccountId: text("stripe_account_id"),
  stripeAccountCurrency: text("stripe_account_currency"),
  stripeAccountStatus: text("stripe_account_status").default("pending"), // pending | active | restricted
  platformFeePercent: decimal("platform_fee_percent", {
    precision: 5,
    scale: 2,
  }).default("3.00"),
  payoutSchedule: text("payout_schedule").default("weekly"),

  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`NOW()`
  ),
});

// --- Page layouts per property ---

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    slug: text("slug").notNull(),
    title: text("title"),
    metaDescription: text("meta_description"),
    layout: jsonb("layout").notNull(),
  },
  (table) => [
    uniqueIndex("pages_property_slug_idx").on(table.propertyId, table.slug),
  ]
);

// --- Content blocks ---

export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    key: text("key").notNull(),
    content: jsonb("content").notNull(),
  },
  (table) => [
    uniqueIndex("content_blocks_property_key_idx").on(
      table.propertyId,
      table.key
    ),
  ]
);

// --- Images ---

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    key: text("key").notNull(),
    url: text("url").notNull(),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [
    uniqueIndex("images_property_key_idx").on(table.propertyId, table.key),
  ]
);

// --- Room types (mirrored from Cloudbeds) ---

export const roomTypes = pgTable(
  "room_types",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    otaRoomId: text("ota_room_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    maxOccupancy: integer("max_occupancy"),
    baseOccupancy: integer("base_occupancy"),
    amenities: jsonb("amenities"),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [
    uniqueIndex("room_types_property_ota_idx").on(
      table.propertyId,
      table.otaRoomId
    ),
  ]
);

// --- Rate plans (mirrored from Cloudbeds) ---

export const ratePlans = pgTable(
  "rate_plans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
    otaRateId: text("ota_rate_id").notNull(),
    name: text("name").notNull(),
    namePublic: text("name_public"),
    isPublic: boolean("is_public").default(true),
    isRefundable: boolean("is_refundable").default(true),
    cancellationPolicy: jsonb("cancellation_policy"),
  },
  (table) => [
    uniqueIndex("rate_plans_property_ota_idx").on(
      table.propertyId,
      table.otaRateId
    ),
  ]
);

// --- Inventory cache ---

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
    ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id),
    date: date("date").notNull(),
    unitsAvailable: integer("units_available").notNull().default(0),
    rate: decimal("rate", { precision: 10, scale: 2 }),
    minStay: integer("min_stay").default(1),
    maxStay: integer("max_stay"),
    closedArrival: boolean("closed_arrival").default(false),
    closedDeparture: boolean("closed_departure").default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("inventory_unique_idx").on(
      table.propertyId,
      table.roomTypeId,
      table.ratePlanId,
      table.date
    ),
    index("inventory_search_idx")
      .on(table.propertyId, table.date, table.unitsAvailable),
  ]
);

// --- Bookings ---
//
// Status lifecycle (not strictly sequential — pms_synced and paid can occur in
// either order in the Flex flow, since the Cloudbeds reservation is created at
// booking time but the charge is deferred to the cancellation cutoff):
//   pending             — created, no money or PMS yet
//   payment_authorized  — Flex SetupIntent saved, no charge yet
//   paid                — PaymentIntent succeeded (NR at checkout, or Flex at cutoff)
//   pms_synced          — postReservation succeeded
//   failed              — terminal; auto-charge gave up after 24h grace
//   cancelled           — guest self-cancelled or auto-cancelled after failure

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid("property_id").references(() => properties.id),
  orderId: text("order_id").unique().notNull(),
  cloudbedsReservationId: text("cloudbeds_reservation_id"),
  roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id),
  rateType: text("rate_type"), // flex | nr
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  adults: integer("adults").default(1),
  children: integer("children").default(0),
  guestFirst: text("guest_first").notNull(),
  guestLast: text("guest_last").notNull(),
  guestEmail: text("guest_email").notNull(),
  guestPhone: text("guest_phone"),
  guestCountry: text("guest_country"),

  // Price breakdown
  roomTotal: decimal("room_total", { precision: 10, scale: 2 }).notNull(),
  extrasTotal: decimal("extras_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  taxesTotal: decimal("taxes_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  applicationFee: decimal("application_fee", { precision: 10, scale: 2 }),
  grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),

  // Stripe state
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  stripeCustomerId: text("stripe_customer_id"),
  chargeAt: timestamp("charge_at", { withTimezone: true }),

  cancellationPolicySnapshot: jsonb("cancellation_policy_snapshot"),
  status: text("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`NOW()`
  ),
});

// --- Per-night rate breakdown for bookings ---

export const bookingDayRates = pgTable("booking_day_rates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  date: date("date").notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  rateId: text("rate_id"),
});

// --- Booking extras (Cloudbeds items attached to a reservation as folio line items) ---

export const bookingExtras = pgTable("booking_extras", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  cloudbedsItemId: text("cloudbeds_item_id"),
  name: text("name").notNull(),
  qty: integer("qty").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
});

// --- Payment events (audit trail for Stripe + auto-charge cron) ---

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  type: text("type").notNull(), // payment_intent_created | payment_intent_succeeded | payment_intent_failed | setup_intent_created | setup_intent_succeeded | auto_charge_attempt | auto_charge_succeeded | auto_charge_failed | refund | payment_method_detached
  stripeId: text("stripe_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: text("currency"),
  status: text("status"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`NOW()`
  ),
});
