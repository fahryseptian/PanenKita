import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRoleEnum = pgEnum("member_role", [
  "ketua",
  "bendahara",
  "anggota",
]);
export const qualityGradeEnum = pgEnum("quality_grade", ["A", "B", "C"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "processing",
  "completed",
  "cancelled",
]);
export const pricingEventTypeEnum = pgEnum("pricing_event_type", [
  "recompute",
  "manual",
]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "harvest",
  "price_change",
  "new_order",
  "order_paid",
  "test",
]);

// ---------------------------------------------------------------------------
// Better Auth tables (generated with the auth CLI, kept in our schema)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Nomor WhatsApp, format internasional tanpa tanda +, mis. 6281234567890 */
  phone: text("phone"),
  /** Ikut menerima notifikasi perubahan harga via WhatsApp */
  waOptIn: boolean("wa_opt_in").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Product tables
// ---------------------------------------------------------------------------

export const kwts = pgTable(
  "kwts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address"),
    /** Kabupaten/kota — untuk direktori publik */
    regency: text("regency"),
    /** Provinsi — untuk direktori publik */
    province: text("province"),
    inviteCode: text("invite_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("kwts_slug_key").on(t.slug)],
);

export const kwtMembers = pgTable(
  "kwt_members",
  {
    kwtId: uuid("kwt_id")
      .notNull()
      .references(() => kwts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("anggota"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.kwtId, t.userId] }),
    index("kwt_members_user_idx").on(t.userId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kwtId: uuid("kwt_id")
      .notNull()
      .references(() => kwts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull().default("sayur"),
    /** kg | ikat | buah | pack */
    unit: text("unit").notNull().default("kg"),
    description: text("description"),
    photoUrl: text("photo_url"),
    /** Harga dasar ditetapkan admin (rupiah integer, tanpa desimal) */
    basePrice: integer("base_price").notNull(),
    /** Harga jual sekarang; diisi ulang oleh pricing engine (Fase 2) */
    currentPrice: integer("current_price").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("products_kwt_idx").on(t.kwtId),
    uniqueIndex("products_kwt_slug_key").on(t.kwtId, t.slug),
  ],
);

export const harvests = pgTable(
  "harvests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    harvestedAt: timestamp("harvested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    quality: qualityGradeEnum("quality").notNull().default("A"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("harvests_product_time_idx").on(t.productId, t.harvestedAt),
    index("harvests_member_idx").on(t.memberId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kwtId: uuid("kwt_id")
      .notNull()
      .references(() => kwts.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    note: text("note"),
    status: orderStatusEnum("status").notNull().default("pending"),
    total: integer("total").notNull().default(0),
    /** Nomor pesanan Midtrans (snap token reference) */
    midtransOrderId: text("midtrans_order_id"),
    paymentSettledAt: timestamp("payment_settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_key").on(t.orderNumber),
    uniqueIndex("orders_midtrans_key").on(t.midtransOrderId),
    index("orders_kwt_status_idx").on(t.kwtId, t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    /** Snapshot harga saat pesanan dibuat (rupiah integer) */
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
  ],
);

export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = berlaku untuk semua produk KWT */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    /** Ambang stok: jika available <= lowStockThreshold -> markup */
    lowStockThreshold: numeric("low_stock_threshold", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("10"),
    /** Ambang stok: jika available >= highStockThreshold -> diskon */
    highStockThreshold: numeric("high_stock_threshold", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("100"),
    /** Persen penyesuaian (bisa negatif untuk diskon) */
    lowStockPercent: integer("low_stock_percent").notNull().default(10),
    highStockPercent: integer("high_stock_percent").notNull().default(-10),
    /** Pesanan N jam terakhir >= surgeMinOrders -> markup permintaan */
    surgeWindowHours: integer("surge_window_hours").notNull().default(24),
    surgeMinOrders: integer("surge_min_orders").notNull().default(5),
    surgePercent: integer("surge_percent").notNull().default(5),
    /** Batas harga akhir relatif terhadap harga dasar (persen) */
    minPricePercent: integer("min_price_percent").notNull().default(70),
    maxPricePercent: integer("max_price_percent").notNull().default(150),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("pricing_rules_product_key").on(t.productId)],
);

export const pricingEvents = pgTable(
  "pricing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** recompute | manual */
    type: pricingEventTypeEnum("type").notNull().default("recompute"),
    oldPrice: integer("old_price").notNull(),
    newPrice: integer("new_price").notNull(),
    /** Penjelasan manusiawi, mis. "stok tinggi (150 kg ≥ 100): -10%" */
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pricing_events_product_time_idx").on(t.productId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kwtId: uuid("kwt_id")
      .notNull()
      .references(() => kwts.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    target: text("target").notNull(),
    message: text("message").notNull(),
    /** true = terkirim ke Fonnte, false = gagal atau token tidak diset */
    sent: boolean("sent").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_kwt_time_idx").on(t.kwtId, t.createdAt)],
);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  kwtId: uuid("kwt_id")
    .notNull()
    .references(() => kwts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(user, ({ many }) => ({
  memberships: many(kwtMembers),
  harvests: many(harvests),
}));

export const kwtsRelations = relations(kwts, ({ many }) => ({
  members: many(kwtMembers),
  products: many(products),
  orders: many(orders),
  notifications: many(notifications),
}));

export const kwtMembersRelations = relations(kwtMembers, ({ one }) => ({
  kwt: one(kwts, {
    fields: [kwtMembers.kwtId],
    references: [kwts.id],
  }),
  user: one(user, {
    fields: [kwtMembers.userId],
    references: [user.id],
  }),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  harvests: many(harvests),
  orderItems: many(orderItems),
  kwt: one(kwts, { fields: [products.kwtId], references: [kwts.id] }),
}));

export const harvestsRelations = relations(harvests, ({ one }) => ({
  product: one(products, {
    fields: [harvests.productId],
    references: [products.id],
  }),
  member: one(user, {
    fields: [harvests.memberId],
    references: [user.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  kwt: one(kwts, { fields: [orders.kwtId], references: [kwts.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
