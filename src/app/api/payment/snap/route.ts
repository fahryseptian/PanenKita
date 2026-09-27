import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { createSnapToken, isMidtransEnabled, snapPayUrl } from "@/lib/midtrans";
import { formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Body {
  orderId?: string;
}

/** Buat Snap payment URL untuk sebuah pesanan (dipakai halaman pesanan). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.orderId) {
    return NextResponse.json({ ok: false, error: "orderId wajib" }, { status: 400 });
  }
  if (!isMidtransEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Pembayaran online belum aktif" },
      { status: 400 },
    );
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, body.orderId))
    .limit(1);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Pesanan sudah diproses" },
      { status: 400 },
    );
  }

  const items = await db
    .select({
      productId: orderItems.productId,
      name: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  const midtransOrderId = `${order.orderNumber}-${Date.now().toString(36)}`;
  const token = await createSnapToken({
    orderId: midtransOrderId,
    grossAmount: order.total,
    items: items.map((i) => ({
      id: i.productId,
      price: i.unitPrice,
      quantity: Number(i.quantity),
      name: i.name,
    })),
    customerName: order.buyerName,
    customerPhone: order.buyerPhone,
  });
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Gagal membuat token pembayaran" },
      { status: 502 },
    );
  }

  await db
    .update(orders)
    .set({ midtransOrderId })
    .where(eq(orders.id, order.id));

  return NextResponse.json({ ok: true, payUrl: snapPayUrl(token) });
}
