import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { mapTransactionStatus, verifySignature } from "@/lib/midtrans";
import { sendWa, orderPaidMessage } from "@/lib/wa";
import { recordPlatformFee } from "@/lib/fees-db";

export const dynamic = "force-dynamic";

/**
 * Payment Notification webhook Midtrans.
 * - Verifikasi signature sha512(order_id + status_code + gross_amount + serverKey)
 * - Idempoten: transaksi sudah final diabaikan
 */
export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const valid = await verifySignature(
    payload as Parameters<typeof verifySignature>[0],
  );
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const orderId = String(payload.order_id ?? "");
  const status = mapTransactionStatus(
    String(payload.transaction_status ?? ""),
    typeof payload.fraud_status === "string" ? payload.fraud_status : undefined,
  );
  if (!orderId || !status) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.midtransOrderId, orderId))
    .limit(1);
  if (!order) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempoten: jangan proses ulang transaksi final (expired masih bisa dibayar
  // jika Snap token lama diselesaikan — pembayaran nyata tetap dihormati).
  if (["paid", "completed", "cancelled"].includes(order.status)) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (status === "paid") {
    await db
      .update(orders)
      .set({ status: "paid", paymentSettledAt: new Date(), expiresAt: null })
      .where(eq(orders.id, order.id));
    await recordPlatformFee({ id: order.id, kwtId: order.kwtId, total: order.total });
    await sendWa(
      "order_paid",
      order.kwtId,
      { phone: order.buyerPhone, name: order.buyerName },
      orderPaidMessage({
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        total: order.total,
      }),
    );
  } else if (status === "cancelled") {
    await db
      .update(orders)
      .set({ status: "cancelled" })
      .where(eq(orders.id, order.id));
  }

  return NextResponse.json({ ok: true });
}
