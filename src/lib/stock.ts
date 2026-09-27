import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, orderItems, orders, products } from "@/lib/db/schema";

export interface StockInfo {
  productId: string;
  harvested: number;
  reserved: number;
  available: number;
}

/** Status pesanan yang masih memegang stok (belum dibatalkan / selesai-dibatalkan). */
export const STOCK_HOLDING_STATUSES = [
  "pending",
  "paid",
  "processing",
  "completed",
] as const;

export type StockHoldingStatus = (typeof STOCK_HOLDING_STATUSES)[number];

/**
 * Stok tersedia = total panen − jumlah pesanan aktif.
 * Dihitung on-the-fly dari dua tabel agar tidak pernah drift;
 * "completed" tetap memegang stok karena barang dianggap sudah keluar.
 */
export async function getAvailableStock(
  productIds: string[],
): Promise<Map<string, StockInfo>> {
  const result = new Map<string, StockInfo>();
  if (productIds.length === 0) return result;

  const [harvestRows, itemRows] = await Promise.all([
    db
      .select({
        productId: harvests.productId,
        total: harvests.quantity,
      })
      .from(harvests)
      .where(inArray(harvests.productId, productIds)),
    db
      .select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        status: orders.status,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orderItems.productId, productIds)),
  ]);

  for (const id of productIds) {
    result.set(id, { productId: id, harvested: 0, reserved: 0, available: 0 });
  }

  for (const row of harvestRows) {
    const info = result.get(row.productId);
    if (info) info.harvested += Number(row.total);
  }
  for (const row of itemRows) {
    if (!isStockHolding(row.status)) continue;
    const info = result.get(row.productId);
    if (info) info.reserved += Number(row.quantity);
  }
  for (const info of result.values()) {
    info.available = info.harvested - info.reserved;
  }
  return result;
}

export function isStockHolding(
  status: string,
): status is StockHoldingStatus {
  return (STOCK_HOLDING_STATUSES as readonly string[]).includes(status);
}

/** Ketersediaan semua produk aktif milik satu KWT (untuk katalog). */
export async function getKwtStock(kwtId: string): Promise<Map<string, StockInfo>> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.kwtId, kwtId), eq(products.isActive, true)));
  return getAvailableStock(rows.map((r) => r.id));
}

/** Panen terakhir per produk (untuk menampilkan kesegaran di katalog). */
export async function getLatestHarvestAt(
  productIds: string[],
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({
      productId: harvests.productId,
      harvestedAt: harvests.harvestedAt,
    })
    .from(harvests)
    .where(inArray(harvests.productId, productIds))
    .orderBy(desc(harvests.harvestedAt));
  for (const row of rows) {
    if (!map.has(row.productId)) map.set(row.productId, row.harvestedAt);
  }
  return map;
}
