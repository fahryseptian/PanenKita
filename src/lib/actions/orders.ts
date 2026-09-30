"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts, orderItems, orders, products, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import { ORDER_PENDING_HOURS, orderInputSchema } from "@/lib/validation";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { getAvailableStock } from "@/lib/stock";
import { sendWa, newOrderMessage, orderPaidMessage, orderConfirmMessage } from "@/lib/wa";
import { formatRupiah } from "@/lib/format";
import { recordPlatformFee, reversePlatformFee } from "@/lib/fees-db";
import { notifyStockOut } from "@/lib/stock-alerts";
import { paymentHintOf, type KwtPaymentInfo } from "@/lib/payment-info";
import { appUrl } from "@/lib/app-url";
import { wholesaleLineTotal, activeTier } from "@/lib/wholesale";
import { pricingRules } from "@/lib/db/schema";
import type { WholesaleTier } from "@/lib/wholesale";

const ORDER_STATUSES = ["paid", "processing", "completed", "cancelled"] as const;

/** Status yang berarti uang sudah masuk — fee platform ikut tercatat. */
const PAID_ORDER_STATUSES = ["paid", "processing", "completed"] as const;

/** Format rincian pesanan untuk pesan WA (dipakai admin & pembeli). */
function waSummary(
  lines: Array<{ name: string; quantity: number; unit: string; unitPrice: number }>,
): string {
  return lines
    .map(
      (l) =>
        `• ${l.name} × ${l.quantity} ${l.unit} @${formatRupiah(l.unitPrice)}`,
    )
    .join("\n");
}

/**
 * Konteks pembayaran KWT: slug (untuk link halaman pesanan) + kanal bayar yang
 * dipakai pembeli. PanenKita tidak memegang uang, jadi pembeli diarahkan
 * membayar langsung ke KWT.
 */
async function paymentContextOf(
  kwtId: string,
): Promise<KwtPaymentInfo & { slug: string | null }> {
  const [row] = await db
    .select({
      slug: kwts.slug,
      bankName: kwts.bankName,
      bankAccountNumber: kwts.bankAccountNumber,
      bankAccountHolder: kwts.bankAccountHolder,
      qrisImageUrl: kwts.qrisImageUrl,
      paymentNote: kwts.paymentNote,
    })
    .from(kwts)
    .where(eq(kwts.id, kwtId))
    .limit(1);
  return (
    row ?? {
      slug: null,
      bankName: null,
      bankAccountNumber: null,
      bankAccountHolder: null,
      qrisImageUrl: null,
      paymentNote: null,
    }
  );
}
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
  // Batas waktu pembayaran: stok otomatis bebas setelah lewat (lihat stock.ts).
  const expiresAt = new Date(Date.now() + ORDER_PENDING_HOURS * 3_600_000);
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
      expiresAt,
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

  // Pricing engine: pesanan baru = sinyal permintaan + cek stok habis
  await Promise.allSettled(lines.map((l) => recomputeProductPrice(l.product.id)));
  const stockAfterOrder = await getAvailableStock([...byId.keys()]);
  await Promise.allSettled(
    lines
      .filter((l) => (stockAfterOrder.get(l.product.id)?.available ?? 0) <= 0)
      .map((l) => notifyStockOut(l.product.id)),
  );

  const summary = waSummary(
    lines.map((l) => ({
      name: (l.product as typeof productRows[number]).name,
      quantity: l.quantity,
      unit: (l.product as typeof productRows[number]).unit,
      unitPrice: l.unitPrice,
    })),
  );

  // Struk awal ke pembeli (best-effort). Link halaman pesanan selalu dikirim
  // karena di sana pembeli melihat cara bayar KWT (tunai/transfer/QRIS).
  const kwtPayment = await paymentContextOf(kwtId);
  const orderUrl = kwtPayment.slug
    ? `${appUrl()}/katalog/${kwtPayment.slug}/pesan/${order.id}`
    : null;
  await sendWa(
    "order_created",
    kwtId,
    { phone: parsed.data.buyerPhone, name: parsed.data.buyerName },
    orderConfirmMessage({
      orderNumber,
      buyerName: parsed.data.buyerName,
      summary,
      total,
      orderUrl,
      paymentHint: paymentHintOf(kwtPayment),
      expiresAt,
    }),
  );

  // Notifikasi admin: pesanan baru (best-effort)
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
  if (status === "paid") {
    // Pesanan kembali hidup: hapus batas waktu supaya cron tidak menyentuhnya.
    patch.expiresAt = null;
  }
  await db.update(orders).set(patch).where(eq(orders.id, orderId));

  // Batal/refund pesanan yang pernah terbayar → tarik kembali fee platformnya.
  // Baris ledger tetap ada (audit), hanya ditandai dibalik. Bila pesanan
  // dibayar lagi, recordPlatformFee otomatis membersihkan penanda ini.
  const wasPaid =
    PAID_ORDER_STATUSES.includes(order.status as (typeof PAID_ORDER_STATUSES)[number]) ||
    Boolean(order.paymentSettledAt);
  if (status === "cancelled" && wasPaid) {
    await reversePlatformFee(order.id, {
      reason: `Pesanan dibatalkan (status sebelumnya: ${order.status})`,
      byUserId: ctx.userId,
    });
  }

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
    .set({ status: "paid", paymentSettledAt: new Date(), expiresAt: null })
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
