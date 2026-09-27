/**
 * Sisi database pricing engine: hitung ulang harga produk dan catat
 * pricing_events sebagai jejak audit. Dipanggil dari server actions,
 * webhook pembayaran, dan cron.
 */

import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, pricingEvents, pricingRules, products } from "@/lib/db/schema";
import {
  DEFAULT_RULE,
  computePrice,
  ruleToInput,
  type PricingRuleRow,
} from "./pricing";
import { getAvailableStock } from "./stock";

export async function getRecentOrderCount(
  productId: string,
  windowHours: number,
): Promise<number> {
  const since = new Date(Date.now() - windowHours * 3_600_000);
  const rows = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.productId, productId), gt(orders.createdAt, since)));
  return rows.length;
}

export async function getRuleForProduct(
  productId: string,
): Promise<PricingRuleRow> {
  const [rule] = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.productId, productId))
    .limit(1);
  return rule ?? DEFAULT_RULE;
}

export interface RecomputeResult {
  changed: boolean;
  oldPrice: number;
  newPrice: number;
  reason: string;
}

/** Hitung ulang harga satu produk; tulis perubahan + event audit. */
export async function recomputeProductPrice(
  productId: string,
  type: "recompute" | "manual" = "recompute",
): Promise<RecomputeResult | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return null;

  const rule = await getRuleForProduct(productId);
  const [recentOrders, stock] = await Promise.all([
    getRecentOrderCount(productId, rule.surgeWindowHours),
    getAvailableStock([productId]),
  ]);
  const available = stock.get(productId)?.available ?? 0;

  const result = computePrice(
    ruleToInput(
      rule,
      { basePrice: product.basePrice, currentPrice: product.currentPrice },
      { availableStock: available, recentOrders },
    ),
  );
  const reason = result.reasons.join("; ");

  if (result.changed) {
    await db
      .update(products)
      .set({ currentPrice: result.price })
      .where(eq(products.id, productId));
    await db.insert(pricingEvents).values({
      productId,
      type,
      oldPrice: product.currentPrice,
      newPrice: result.price,
      reason,
    });
  }
  return {
    changed: result.changed,
    oldPrice: product.currentPrice,
    newPrice: result.price,
    reason,
  };
}
