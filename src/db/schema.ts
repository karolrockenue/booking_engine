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
  myaPropertyId: text("mya_property_id"),
  otaPropertyId: text("ota_property_id"),
  hotelKey: text("hotel_key"),
  currency: text("currency").default("GBP"),
  timezone: text("timezone").default("Europe/London"),
  theme: jsonb("theme").notNull(),
  status: text("status").default("draft"),
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

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid("property_id").references(() => properties.id),
  orderId: text("order_id").unique().notNull(),
  roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  adults: integer("adults").default(1),
  children: integer("children").default(0),
  guestFirst: text("guest_first").notNull(),
  guestLast: text("guest_last").notNull(),
  guestEmail: text("guest_email").notNull(),
  guestPhone: text("guest_phone"),
  guestCountry: text("guest_country"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  stripePaymentIntentId: text("stripe_pi_id"),
  myaStatus: text("mya_status").default("pending"),
  myaResponse: jsonb("mya_response"),
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
