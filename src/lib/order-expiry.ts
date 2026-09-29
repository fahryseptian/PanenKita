import { and, eq, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, orderItems, orders, user } from "@/lib/db/schema";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, orderExpiredMessage } from "@/lib/wa";

export interface ExpireResult {
  expired: number;
  checked: number;
}

/**
 * Batalkan pesanan pending yang melewati batas waktu (expiresAt):
 * status → expired, stok dilepas, harga dihitung ulang, pengurus diberi tahu via WA.
 * Idempoten: guard status=pending di UPDATE; aman dipanggil berulang.
 */
export async function expireStaleOrders(): Promise<ExpireResult> {
  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        isNotNull(orders.expiresAt),
        lte(orders.expiresAt, new Date()),
      ),
    )
    .limit(200);

  let expired = 0;
  for (const order of stale) {
    // Guard kedua: status bisa berubah (dibayar) sejak select di atas.
    const updated = await db
      .update(orders)
      .set({ status: "expired" })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (updated.length === 0) continue;
    expired += 1;

    // Harga produk terkait dihitung ulang (stok kembali tersedia).
    const items = await db
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    await Promise.allSettled(
      [...new Set(items.map((i) => i.productId))].map((pid) =>
        recomputeProductPrice(pid),
      ),
    );

    // Kabari pengurus (ketua/bendahara) — satu pesan per pesanan kedaluwarsa.
    const admins = await db
      .select({ phone: user.phone, name: user.name })
      .from(kwtMembers)
      .innerJoin(user, eq(kwtMembers.userId, user.id))
      .where(
        and(
          eq(kwtMembers.kwtId, order.kwtId),
          or(eq(kwtMembers.role, "ketua"), eq(kwtMembers.role, "bendahara")),
        ),
      );
    await Promise.allSettled(
      admins
        .filter((a) => a.phone)
        .map((a) =>
          sendWa(
            "order_expired",
            order.kwtId,
            { phone: a.phone!, name: a.name },
            orderExpiredMessage({
              orderNumber: order.orderNumber,
              buyerName: order.buyerName,
              total: order.total,
            }),
          ),
        ),
    );
  }

  return { expired, checked: stale.length };
}
