import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  feedback,
  harvests,
  kwtMembers,
  kwts,
  notifications,
  orderItems,
  orders,
  pricingEvents,
  pricingRules,
  products,
  user,
} from "@/lib/db/schema";
import { getAvailableStock, getLatestHarvestAt, type StockInfo } from "./stock";

// ---------------------------------------------------------------------------
// Katalog publik
// ---------------------------------------------------------------------------

export interface CatalogItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  unit: string;
  description: string | null;
  photoUrl: string | null;
  basePrice: number;
  currentPrice: number;
  stock: StockInfo | null;
  latestHarvestAt: Date | null;
}

export async function getCatalog(kwtId: string): Promise<CatalogItem[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.kwtId, kwtId), eq(products.isActive, true)))
    .orderBy(products.name);

  const ids = rows.map((r) => r.id);
  const [stock, latest] = await Promise.all([
    getAvailableStock(ids),
    getLatestHarvestAt(ids),
  ]);

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    unit: p.unit,
    description: p.description,
    photoUrl: p.photoUrl,
    basePrice: p.basePrice,
    currentPrice: p.currentPrice,
    stock: stock.get(p.id) ?? null,
    latestHarvestAt: latest.get(p.id) ?? null,
  }));
}

export async function getKwtBySlug(slug: string) {
  const [row] = await db.select().from(kwts).where(eq(kwts.slug, slug)).limit(1);
  return row ?? null;
}

export async function getKwtById(id: string) {
  const [row] = await db.select().from(kwts).where(eq(kwts.id, id)).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

export interface DashboardOverview {
  productCount: number;
  memberCount: number;
  harvest30d: number;
  pendingOrders: number;
  paidRevenue: number;
}

export async function getDashboardOverview(kwtId: string): Promise<DashboardOverview> {
  const since = new Date(Date.now() - 30 * 24 * 3_600_000);

  const [prodRows, memberRows, harvestRows, orderRows] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.kwtId, kwtId), eq(products.isActive, true))),
    db
      .select({ id: kwtMembers.userId })
      .from(kwtMembers)
      .where(eq(kwtMembers.kwtId, kwtId)),
    db
      .select({ total: harvests.quantity })
      .from(harvests)
      .innerJoin(products, eq(harvests.productId, products.id))
      .where(and(eq(products.kwtId, kwtId), gte(harvests.harvestedAt, since))),
    db
      .select({ status: orders.status, total: orders.total })
      .from(orders)
      .where(eq(orders.kwtId, kwtId)),
  ]);

  let pendingOrders = 0;
  let paidRevenue = 0;
  for (const o of orderRows) {
    if (o.status === "pending") pendingOrders += 1;
    if (o.status === "paid" || o.status === "completed") paidRevenue += o.total;
  }

  return {
    productCount: prodRows.length,
    memberCount: memberRows.length,
    harvest30d: harvestRows.reduce((acc, h) => acc + Number(h.total), 0),
    pendingOrders,
    paidRevenue,
  };
}

// ---------------------------------------------------------------------------
// Dashboard: produk
// ---------------------------------------------------------------------------

export interface DashboardProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  unit: string;
  description: string | null;
  photoUrl: string | null;
  basePrice: number;
  currentPrice: number;
  isActive: boolean;
  available: number;
  reserved: number;
}

export async function getDashboardProducts(kwtId: string): Promise<DashboardProduct[]> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.kwtId, kwtId))
    .orderBy(products.name);

  const stock = await getAvailableStock(rows.map((r) => r.id));
  return rows.map((p) => {
    const s = stock.get(p.id);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      unit: p.unit,
      description: p.description,
      photoUrl: p.photoUrl,
      basePrice: p.basePrice,
      currentPrice: p.currentPrice,
      isActive: p.isActive,
      available: s?.available ?? 0,
      reserved: s?.reserved ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Dashboard: panen
// ---------------------------------------------------------------------------

export interface HarvestRow {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  memberName: string;
  memberId: string;
  quantity: number;
  wasteQty: number;
  quality: string;
  note: string | null;
  harvestedAt: Date;
}

export async function getHarvests(
  kwtId: string,
  opts: { memberId?: string; limit?: number } = {},
): Promise<HarvestRow[]> {
  const rows = await db
    .select({
      id: harvests.id,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      memberName: user.name,
      memberId: harvests.memberId,
      quantity: harvests.quantity,
      wasteQty: harvests.wasteQty,
      quality: harvests.quality,
      note: harvests.note,
      harvestedAt: harvests.harvestedAt,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .innerJoin(user, eq(harvests.memberId, user.id))
    .where(eq(products.kwtId, kwtId))
    .orderBy(desc(harvests.harvestedAt))
    .limit(opts.limit ?? 50);

  return rows
    .filter((r) => !opts.memberId || r.memberId === opts.memberId)
    .map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      wasteQty: Number(r.wasteQty),
    }));
}

// ---------------------------------------------------------------------------
// Dashboard: pesanan
// ---------------------------------------------------------------------------

export interface OrderItemRow {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerPhone: string;
  note: string | null;
  status: string;
  total: number;
  midtransOrderId: string | null;
  createdAt: Date;
  items: OrderItemRow[];
}

export async function getOrders(
  kwtId: string,
  opts: { limit?: number } = {},
): Promise<OrderRow[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.kwtId, kwtId))
    .orderBy(desc(orders.createdAt))
    .limit(opts.limit ?? 50);
  if (orderRows.length === 0) return [];

  const itemRows = await db
    .select({
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      productName: products.name,
      quantity: orderItems.quantity,
      unit: products.unit,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(inArray(orderItems.orderId, orderRows.map((o) => o.id)));

  return orderRows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    buyerName: o.buyerName,
    buyerPhone: o.buyerPhone,
    note: o.note,
    status: o.status,
    total: o.total,
    midtransOrderId: o.midtransOrderId,
    createdAt: o.createdAt,
    items: itemRows
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: Number(i.quantity),
        unit: i.unit,
        unitPrice: i.unitPrice,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Dashboard: harga & aturan
// ---------------------------------------------------------------------------

export interface PricingEventRow {
  id: string;
  productName: string;
  type: string;
  oldPrice: number;
  newPrice: number;
  reason: string | null;
  createdAt: Date;
}

export async function getPricingEvents(
  kwtId: string,
  limit = 20,
): Promise<PricingEventRow[]> {
  const rows = await db
    .select({
      id: pricingEvents.id,
      productName: products.name,
      type: pricingEvents.type,
      oldPrice: pricingEvents.oldPrice,
      newPrice: pricingEvents.newPrice,
      reason: pricingEvents.reason,
      createdAt: pricingEvents.createdAt,
    })
    .from(pricingEvents)
    .innerJoin(products, eq(pricingEvents.productId, products.id))
    .where(eq(products.kwtId, kwtId))
    .orderBy(desc(pricingEvents.createdAt))
    .limit(limit);
  return rows;
}

export async function getPricingRules(kwtId: string) {
  const rows = await db
    .select({
      productId: pricingRules.productId,
      lowStockThreshold: pricingRules.lowStockThreshold,
      highStockThreshold: pricingRules.highStockThreshold,
      lowStockPercent: pricingRules.lowStockPercent,
      highStockPercent: pricingRules.highStockPercent,
      surgeWindowHours: pricingRules.surgeWindowHours,
      surgeMinOrders: pricingRules.surgeMinOrders,
      surgePercent: pricingRules.surgePercent,
      minPricePercent: pricingRules.minPricePercent,
      maxPricePercent: pricingRules.maxPricePercent,
      wholesaleTiers: pricingRules.wholesaleTiers,
    })
    .from(pricingRules)
    .innerJoin(products, eq(pricingRules.productId, products.id))
    .where(eq(products.kwtId, kwtId));
  return rows;
}

// ---------------------------------------------------------------------------
// Dashboard: anggota, notifikasi, feedback
// ---------------------------------------------------------------------------

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  waOptIn: boolean;
  role: string;
  joinedAt: Date;
}

export async function getMembers(kwtId: string): Promise<MemberRow[]> {
  return db
    .select({
      userId: kwtMembers.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      waOptIn: user.waOptIn,
      role: kwtMembers.role,
      joinedAt: kwtMembers.joinedAt,
    })
    .from(kwtMembers)
    .innerJoin(user, eq(kwtMembers.userId, user.id))
    .where(eq(kwtMembers.kwtId, kwtId))
    .orderBy(kwtMembers.joinedAt);
}

export async function getNotifications(kwtId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.kwtId, kwtId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getFeedback(kwtId: string, limit = 20) {
  return db
    .select({
      id: feedback.id,
      rating: feedback.rating,
      message: feedback.message,
      userName: user.name,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .leftJoin(user, eq(feedback.userId, user.id))
    .where(eq(feedback.kwtId, kwtId))
    .orderBy(desc(feedback.createdAt))
    .limit(limit);
}
