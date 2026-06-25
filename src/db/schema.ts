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
  templateSlug: text("template_slug").notNull().default("default"),
  status: text("status").default("draft"),

  // Which PMS this property runs on — routes the adapter factory (lib/pms).
  pmsType: text("pms_type").notNull().default("cloudbeds"),
  // Mews credentials + connection config. Mews has no OAuth, so this holds the
  // enterprise AccessToken (encrypted via lib/crypto) plus the chosen service /
  // payment / timezone. Shape:
  //   { accessTokenEnc, serviceId, timezone, enterpriseId, taxMode,
  //     externalPaymentType, currency }
  // Cloudbeds keeps using the dedicated cloudbeds_* columns below.
  pmsCredentials: jsonb("pms_credentials"),

  // Cloudbeds OAuth (tokens stored encrypted at app layer — see lib/crypto.ts)
  cloudbedsPropertyId: text("cloudbeds_property_id"),
  cloudbedsAccessToken: text("cloudbeds_access_token"),
  cloudbedsRefreshToken: text("cloudbeds_refresh_token"),
  cloudbedsTokenExpiresAt: timestamp("cloudbeds_token_expires_at", {
    withTimezone: true,
  }),

  // Stripe Connect (Express, direct charges) — legacy rail, retained during the
  // phased Ryft migration so the live storefront keeps transacting. Removed in
  // the final cutover pass once checkout runs on Ryft.
  stripeAccountId: text("stripe_account_id"),
  stripeAccountCurrency: text("stripe_account_currency"),
  stripeAccountStatus: text("stripe_account_status").default("pending"), // pending | active | restricted

  // Ryft sub-account (marketplace / platform-fee model — the Connect equivalent)
  ryftAccountId: text("ryft_account_id"),
  ryftAccountCurrency: text("ryft_account_currency"),
  ryftAccountStatus: text("ryft_account_status").default("pending"), // pending | active | restricted
  platformFeePercent: decimal("platform_fee_percent", {
    precision: 5,
    scale: 2,
  }).default("3.00"),
  payoutSchedule: text("payout_schedule").default("weekly"),

  // Email sender (NULL → falls back to platform default em4689.market-pulse.io)
  emailFromAddress: text("email_from_address"),
  emailFromName: text("email_from_name"),
  emailReplyTo: text("email_reply_to"),

  // Per-property Google Analytics 4 Measurement ID (G-XXXXXXXXXX). NULL = no
  // analytics, which also means no cookie-consent banner for this hotel.
  // Set via the admin Analytics tab; injected (consent-gated) on the storefront.
  gaMeasurementId: text("ga_measurement_id"),

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

// --- Legal pages (privacy / cookies / accessibility / terms) ---
// Per-property hosted policy pages. Body is markdown authored in the admin
// Legal tab, rendered to sanitized HTML at /[property]/legal/[slug]. Only
// `published` pages are reachable and linked from the storefront footer.

export const legalPages = pgTable(
  "legal_pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    slug: text("slug").notNull(), // privacy | cookies | accessibility | terms
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    published: boolean("published").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("legal_pages_property_slug_idx").on(
      table.propertyId,
      table.slug
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
    // Slot tag: where the photo shows up on the customer site.
    // hero | gallery | room | neighbourhood
    slot: text("slot").notNull().default("gallery"),
    // When slot=room, links to a specific room type for per-room galleries.
    roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
    sortOrder: integer("sort_order").notNull().default(0),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    // Web-sized variants generated at upload time. Shape:
    //   { hero: { key, url, width, height, sizeBytes },
    //     gallery: ..., thumb: ... }
    // Customer-facing pages pick the variant matching their layout.
    variants: jsonb("variants"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("images_property_key_idx").on(table.propertyId, table.key),
    index("images_property_slot_idx").on(table.propertyId, table.slot),
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
    // Admin-controlled visibility in the booking engine. Our own config
    // (Cloudbeds doesn't expose it), so the inventory sync never writes it —
    // re-syncs preserve the admin's choice. Use to hide e.g. virtual/staff
    // room types that exist in Cloudbeds but shouldn't be sold online.
    hiddenFromBooking: boolean("hidden_from_booking").notNull().default(false),
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
    // Admin-set display name for the booking engine. Our own config — the sync
    // never writes it, so it survives re-syncs. NULL → fall back to the
    // Cloudbeds name (namePublic ?? name).
    displayName: text("display_name"),
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

// --- Mews-native inventory (stored in Mews's own shape, not the combined
// `inventory` table) ---
//
// Mews splits what Cloudbeds returns together: availability is per
// ResourceCategory+day, price is per Rate(+Category)+day. We store each
// faithfully and the MewsAdapter joins them at read time (getAvailability), so
// nothing is forced into the Cloudbeds-shaped `inventory` table.

export const mewsCategoryAvailability = pgTable(
  "mews_category_availability",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    categoryId: text("category_id").notNull(), // Mews ResourceCategory Id
    date: date("date").notNull(),
    unitsAvailable: integer("units_available").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("mews_cat_avail_unique_idx").on(
      table.propertyId,
      table.categoryId,
      table.date
    ),
    index("mews_cat_avail_search_idx").on(table.propertyId, table.date),
  ]
);

export const mewsRatePrices = pgTable(
  "mews_rate_prices",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    rateId: text("rate_id").notNull(), // Mews Rate Id
    categoryId: text("category_id").notNull(), // Mews ResourceCategory Id
    date: date("date").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("mews_rate_prices_unique_idx").on(
      table.propertyId,
      table.rateId,
      table.categoryId,
      table.date
    ),
    index("mews_rate_prices_search_idx").on(table.propertyId, table.date),
  ]
);

// --- Property extras (Cloudbeds addons catalog, mirrored per property) ---

export const propertyExtras = pgTable(
  "property_extras",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    // Neutral PMS id for this extra: Cloudbeds addon id OR Mews ProductId.
    // Unique per property; the source of truth for upserts across both PMSs.
    otaExtraId: text("ota_extra_id").notNull(),
    // Mews only: the Orderable ServiceId the product lives on (required by
    // orders/add — extras can't be ordered against the accommodation service).
    pmsServiceId: text("pms_service_id"),
    // Cloudbeds-native ids, kept for the Cloudbeds path; null for Mews rows.
    cloudbedsAddonId: text("cloudbeds_addon_id"),
    cloudbedsProductId: text("cloudbeds_product_id"),
    name: text("name").notNull(),
    description: text("description"),
    priceMinorUnits: integer("price_minor_units").notNull(),
    currency: text("currency").notNull(),
    // How this extra is charged — our own config (Cloudbeds doesn't expose it).
    // per_stay | per_guest_per_night. Admin-set; never written by the sync, so
    // catalog re-syncs preserve it.
    pricingModel: text("pricing_model").notNull().default("per_stay"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("property_extras_property_ota_idx").on(
      table.propertyId,
      table.otaExtraId
    ),
    index("property_extras_property_idx").on(table.propertyId),
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
  // Provider-neutral PMS ids (Mews + future PMSs). Cloudbeds keeps writing the
  // cloudbeds_* column above; the adapter reads/writes the one for its PMS.
  pmsReservationId: text("pms_reservation_id"),
  pmsPaymentId: text("pms_payment_id"),
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

  // Stripe state — legacy rail, retained during the phased Ryft migration.
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  stripeCustomerId: text("stripe_customer_id"),

  // Ryft state. ryftPaymentSessionId is the pay-now (NR) session. For Flex,
  // ryftVerifySessionId is the zero-auth (verifyAccount, amount:0) session that
  // saves the card to ryftCustomerId, and ryftPaymentMethodId is the saved card
  // the auto-charge cron later charges off-session.
  ryftPaymentSessionId: text("ryft_payment_session_id"),
  ryftVerifySessionId: text("ryft_verify_session_id"),
  ryftPaymentMethodId: text("ryft_payment_method_id"),
  ryftCustomerId: text("ryft_customer_id"),
  chargeAt: timestamp("charge_at", { withTimezone: true }),

  // Auto-charge cron state (Phase 5). attempts counter is the simple loop
  // throttle; firstAutoChargeFailureAt anchors the 24h grace window. Both
  // null until the cron first touches the booking.
  autoChargeAttempts: integer("auto_charge_attempts").notNull().default(0),
  firstAutoChargeFailureAt: timestamp("first_auto_charge_failure_at", {
    withTimezone: true,
  }),

  // PMS retry state. Mirrors the auto-charge fields but for the
  // postReservation recovery path (money taken / card saved but no CB
  // reservation yet).
  pmsRetryAttempts: integer("pms_retry_attempts").notNull().default(0),
  firstPmsFailureAt: timestamp("first_pms_failure_at", {
    withTimezone: true,
  }),

  cancellationPolicySnapshot: jsonb("cancellation_policy_snapshot"),
  status: text("status").notNull().default("pending"),

  // Fulfilment orchestration (Step 0, create-before-pay). One idempotent
  // fulfilBooking() runs from three triggers (inline, Ryft webhook, retry
  // cron); fulfilmentLockedAt is an optimistic claim so two triggers can't
  // create the same reservation at once, confirmationEmailSentAt makes the
  // guest confirmation send exactly once.
  fulfilmentLockedAt: timestamp("fulfilment_locked_at", { withTimezone: true }),
  confirmationEmailSentAt: timestamp("confirmation_email_sent_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`NOW()`
  ),
});

// --- Cloudbeds webhook subscriptions ---
//
// One row per (property, object, action) — Cloudbeds requires one subscribe
// call per event type. We persist the returned subscription ID so we can
// unsubscribe later (e.g. when a property disconnects).

export const cloudbedsWebhookSubscriptions = pgTable(
  "cloudbeds_webhook_subscriptions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    cloudbedsSubscriptionId: text("cloudbeds_subscription_id").notNull(),
    object: text("object").notNull(),
    action: text("action").notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("cloudbeds_webhooks_property_event_idx").on(
      table.propertyId,
      table.object,
      table.action
    ),
  ]
);

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
  pmsItemId: text("pms_item_id"), // provider-neutral folio line id (Mews+)
  name: text("name").notNull(),
  qty: integer("qty").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  // Fulfilment intent (persisted at booking time so the PMS post can run from
  // the webhook/cron, not just inline). propertyExtraId links to the catalogue
  // row (resolves ota/product + service id at post time); postingPlan carries
  // the resolved per-guest-per-night plan ({ model, perMorning, mornings }).
  propertyExtraId: uuid("property_extra_id").references(() => propertyExtras.id),
  postingPlan: jsonb("posting_plan"),
});

// --- Payment events (audit trail for Ryft + auto-charge cron) ---

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  type: text("type").notNull(), // payment_session_created | payment_session_approved | payment_session_declined | card_save_succeeded | card_save_failed | auto_charge_attempt | auto_charge_succeeded | auto_charge_failed | refund | payment_method_detached | (legacy Stripe: payment_intent_*/setup_intent_*)
  stripeId: text("stripe_id"), // legacy rail
  ryftId: text("ryft_id"),
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

// --- Email templates (per-property, editable) ---
//
// One row per (propertyId, key). The 5 canonical keys are:
//   confirmation | cancellation | pre_arrival | welcome | post_stay
// `body` is Unlayer design JSON (for re-edit). `htmlCached` is the last-rendered
// HTML with {{var}} tokens still in place; the send-time renderer just substitutes
// vars into this. `bodyFormat` flags which composer produced the row — kept so a
// future legacy 'maily' row could be detected, but only 'unlayer' is written now.

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    body: jsonb("body").notNull(),
    bodyFormat: text("body_format").notNull().default("unlayer"),
    htmlCached: text("html_cached"),
    status: text("status").notNull().default("active"),
    isTransactional: boolean("is_transactional").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
    updatedBy: text("updated_by"),
  },
  (table) => [
    uniqueIndex("email_templates_property_key_idx").on(
      table.propertyId,
      table.key
    ),
  ]
);

// --- Email schedules (event-relative triggers, one row per scheduled template) ---

export const emailSchedules = pgTable(
  "email_schedules",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    templateKey: text("template_key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    trigger: text("trigger").notNull(),
    offsetDays: integer("offset_days").notNull().default(0),
    timeOfDay: text("time_of_day").notNull().default("09:00"),
    audience: text("audience").notNull().default("all"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    uniqueIndex("email_schedules_property_template_idx").on(
      table.propertyId,
      table.templateKey
    ),
  ]
);

// --- Email sends (audit trail; SendGrid Event Webhook updates status) ---

export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    templateKey: text("template_key").notNull(),
    toEmail: text("to_email").notNull(),
    fromEmail: text("from_email").notNull(),
    subject: text("subject").notNull(),
    sendgridMessageId: text("sendgrid_message_id"),
    status: text("status").notNull().default("queued"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
  },
  (table) => [
    index("email_sends_property_idx").on(table.propertyId, table.createdAt),
    index("email_sends_booking_idx").on(table.bookingId),
    index("email_sends_sendgrid_msg_idx").on(table.sendgridMessageId),
  ]
);

// --- Google Hotel Center ARI message log/queue (Sprint 5) ---
//
// Audit + retry queue for every ARI/Transaction message pushed to Google.
// status: pending → sent (HTTP 200) | failed. Built against a mock endpoint
// until Google allowlists us; see "Google Hotel Center — Blueprint.md" §11.

export const googleAriMessages = pgTable(
  "google_ari_messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id").references(() => properties.id),
    // property_data | transaction_price | ota_rate | ota_avail | ota_inv
    messageType: text("message_type").notNull(),
    status: text("status").notNull().default("pending"),
    httpStatus: integer("http_status"),
    payload: text("payload").notNull(), // the XML we sent
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`NOW()`
    ),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("google_ari_messages_property_idx").on(
      table.propertyId,
      table.createdAt
    ),
    index("google_ari_messages_status_idx").on(table.status),
  ]
);
