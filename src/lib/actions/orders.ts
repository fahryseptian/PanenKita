"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, orderItems, orders, products, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import { orderInputSchema } from "@/lib/validation";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { getAvailableStock } from "@/lib/stock";
import { sendWa, newOrderMessage, orderPaidMessage } from "@/lib/wa";
import { formatRupiah } from "@/lib/format";
import { recordPlatformFee } from "@/lib/fees-db";
import { wholesaleLineTotal, activeTier } from "@/lib/wholesale";
import { pricingRules } from "@/lib/db/schema";
import type { WholesaleTier } from "@/lib/wholesale";

const ORDER_STATUSES = ["paid", "processing", "completed", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PK-${ymd}-${rand}`;
}

/**
 * Pesanan dari katalog publik — pembeli tanpa akun.
 * Return { ok, orderNumber, orderId } untuk redirect ke halaman pesanan.
 */
export async function placeOrder(
  kwtId: string,
  input: {
    buyerName: string;
    buyerPhone: string;
    note?: string;
    items: Array<{ productId: string; quantity: number }>;
  },
): Promise<{ ok: true; orderNumber: string; orderId: string } | { ok: false; error: string }> {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const ids = parsed.data.items.map((i) => i.productId);
  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.kwtId, kwtId), eq(products.isActive, true)));
  const byId = new Map(productRows.filter((p) => ids.includes(p.id)).map((p) => [p.id, p]));
  if (byId.size === 0) return { ok: false, error: "Produk tidak tersedia" };

  // Validasi stok on-the-fly + harga grosir bertingkat per baris.
  const stock = await getAvailableStock([...byId.keys()]);
  const tierRows = await db
    .select({ productId: pricingRules.productId, tiers: pricingRules.wholesaleTiers })
    .from(pricingRules)
    .where(inArray(pricingRules.productId, [...byId.keys()]));
  const tiersByProduct = new Map<string, WholesaleTier[]>(
    tierRows.map((r) => {
      let tiers: WholesaleTier[] = [];
      try {
        tiers = r.tiers ? (JSON.parse(r.tiers) as WholesaleTier[]) : [];
      } catch {
        tiers = [];
      }
      return [r.productId ?? "", tiers];
    }),
  );

  const lines: Array<{
    product: (typeof products.$inferSelect)["id"] extends string ? typeof productRows[number] : never;
    quantity: number;
    unitPrice: number;
    wholesalePercent: number;
  }> = [];
  for (const item of parsed.data.items) {
    const p = byId.get(item.productId);
    if (!p) continue;
    const available = stock.get(p.id)?.available ?? 0;
    if (item.quantity > available) {
      return { ok: false, error: `Stok ${p.name} tinggal ${available} ${p.unit}` };
    }
    const tiers = tiersByProduct.get(p.id) ?? [];
    const tier = activeTier(item.quantity, tiers);
    const unitPrice = wholesaleLineTotal(p.currentPrice, item.quantity, tiers) / item.quantity;
    lines.push({
      product: p as never,
      quantity: item.quantity,
      unitPrice: Math.round(unitPrice),
      wholesalePercent: tier?.percentOff ?? 0,
    });
  }
  if (lines.length === 0) return { ok: false, error: "Produk keranjang kosong" };

  const total = lines.reduce(
    (acc, l) => acc + Math.round(l.quantity * l.unitPrice),
    0,
  );

  const orderNumber = generateOrderNumber();
  const [order] = await db
    .insert(orders)
    .values({
      kwtId,
      orderNumber,
      buyerName: parsed.data.buyerName,
      buyerPhone: parsed.data.buyerPhone,
      note: parsed.data.note || null,
      status: "pending",
      total,
    })
    .returning();
  if (!order) return { ok: false, error: "Gagal membuat pesanan" };

  await db.insert(orderItems).values(
    lines.map((l) => ({
      orderId: order.id,
      productId: l.product.id,
      quantity: String(l.quantity),
      unitPrice: l.unitPrice,
      wholesalePercent: l.wholesalePercent,
    })),
  );

  // Pricing engine: pesanan baru = sinyal permintaan
  await Promise.allSettled(lines.map((l) => recomputeProductPrice(l.product.id)));

  // Notifikasi admin: pesanan baru (best-effort)
  const summary = lines
    .map(
      (l) =>
        `• ${(l.product as typeof productRows[number]).name} × ${l.quantity} ${(l.product as typeof productRows[number]).unit} @${formatRupiah(l.unitPrice)}`,
    )
    .join("\n");
  const admins = await db
    .select({ phone: user.phone, name: user.name })
    .from(kwtMembers)
    .innerJoin(user, eq(kwtMembers.userId, user.id))
    .where(
      and(
        eq(kwtMembers.kwtId, kwtId),
        or(eq(kwtMembers.role, "ketua"), eq(kwtMembers.role, "bendahara")),
      ),
    );
  await Promise.allSettled(
    admins
      .filter((a) => a.phone)
      .map((a) =>
        sendWa(
          "new_order",
          kwtId,
          { phone: a.phone!, name: a.name },
          newOrderMessage({
            orderNumber,
            buyerName: parsed.data.buyerName,
            buyerPhone: parsed.data.buyerPhone,
            summary,
            total,
          }),
        ),
      ),
  );

  revalidatePath("/katalog");
  return { ok: true, orderNumber, orderId: order.id };
}

/** Ubah status pesanan (admin). */
export async function updateOrderStatus(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!ORDER_STATUSES.includes(status as OrderStatus)) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.kwtId, ctx.kwtId)))
    .limit(1);
  if (!order) return;

  const patch: Partial<typeof orders.$inferInsert> = { status: status as OrderStatus };
  if (status === "paid" && !order.paymentSettledAt) {
    patch.paymentSettledAt = new Date();
    await recordPlatformFee({ id: order.id, kwtId: order.kwtId, total: order.total });
  }
  await db.update(orders).set(patch).where(eq(orders.id, orderId));

  revalidatePath("/dashboard/pesanan");
  revalidatePath("/katalog");
}

/** Konfirmasi pembayaran tunai/transfer manual (admin) + struk WA ke pembeli. */
export async function confirmPayment(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.kwtId, ctx.kwtId)))
    .limit(1);
  if (!order) return;
  if (order.status === "paid" || order.status === "completed") return;

  await db
    .update(orders)
    .set({ status: "paid", paymentSettledAt: new Date() })
    .where(eq(orders.id, orderId));
  await recordPlatformFee({ id: order.id, kwtId: ctx.kwtId, total: order.total });

  await sendWa(
    "order_paid",
    ctx.kwtId,
    { phone: order.buyerPhone, name: order.buyerName },
    orderPaidMessage({
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      total: order.total,
    }),
  );

  revalidatePath("/dashboard/pesanan");
}
