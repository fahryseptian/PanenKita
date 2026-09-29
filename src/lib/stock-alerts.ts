import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, notifications, products, user } from "@/lib/db/schema";
import { sendWa, stockOutMessage } from "./wa";

/**
 * Peringatan WA "stok habis" ke pengurus — dengan dedupe 24 jam per produk
 * agar satu produk tidak membanjiri grup pengurus (cek tabel notifications).
 * Best-effort: tidak pernah melempar error.
 */
export async function notifyStockOut(productId: string): Promise<void> {
  try {
    const [product] = await db
      .select({ name: products.name, unit: products.unit, kwtId: products.kwtId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) return;

    // Dedupe: sudah ada notifikasi stock_out untuk produk ini dalam 24 jam?
    const since = new Date(Date.now() - 24 * 3_600_000);
    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.kwtId, product.kwtId),
          eq(notifications.kind, "stock_out"),
          eq(notifications.target, productId),
          gte(notifications.createdAt, since),
        ),
      )
      .limit(1);
    if (recent) return;

    const admins = await db
      .select({ phone: user.phone, name: user.name })
      .from(kwtMembers)
      .innerJoin(user, eq(kwtMembers.userId, user.id))
      .where(
        and(
          eq(kwtMembers.kwtId, product.kwtId),
          // kirim ke salah satu pengurus saja: cukup satu peringatan
          eq(kwtMembers.role, "ketua"),
        ),
      )
      .limit(1);

    const msg = stockOutMessage({ productName: product.name, unit: product.unit });
    await Promise.allSettled(
      admins
        .filter((a) => a.phone)
        .map((a) =>
          sendWa(
            "stock_out",
            product.kwtId,
            { phone: a.phone!, name: a.name },
            msg,
            // simpan productId sebagai target agar dedupe berjalan
            productId,
          ),
        ),
    );
  } catch (err) {
    console.error("[stock-alerts] failed", err);
  }
}
