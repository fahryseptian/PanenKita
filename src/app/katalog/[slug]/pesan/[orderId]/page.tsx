import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { getKwtBySlug } from "@/lib/queries";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { isMidtransEnabled } from "@/lib/midtrans";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Menunggu pembayaran", cls: "bg-warn/10 text-warn" },
  paid: { text: "Dibayar — sedang disiapkan", cls: "bg-brand-50 text-brand-700" },
  processing: { text: "Disiapkan", cls: "bg-brand-50 text-brand-700" },
  completed: { text: "Selesai", cls: "bg-brand-50 text-brand-700" },
  cancelled: { text: "Dibatalkan", cls: "bg-red-50 text-red-600" },
};

interface Props {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { slug, orderId } = await params;
  const kwt = await getKwtBySlug(slug);
  if (!kwt) notFound();

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.kwtId, kwt.id)))
    .limit(1);
  if (!order) notFound();

  const items = await db
    .select({
      productName: products.name,
      unit: products.unit,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending!;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${status.cls}`}>
            {order.status === "pending" ? (
              <Clock className="h-7 w-7" />
            ) : order.status === "cancelled" ? (
              <span className="text-2xl">❌</span>
            ) : (
              <CheckCircle2 className="h-7 w-7" />
            )}
          </span>
          <h1 className="mt-4 text-xl font-bold">Pesanan {order.orderNumber}</h1>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${status.cls}`}>
            {status.text}
          </span>

          <div className="mt-6 space-y-2 text-left">
            {items.map((i, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {i.productName} × {Number(i.quantity)} {i.unit}
                </span>
                <span className="tabular-nums">
                  {formatRupiah(Math.round(Number(i.quantity)) * i.unitPrice)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 font-bold">
            <span>Total</span>
            <span className="text-brand-700">{formatRupiah(order.total)}</span>
          </div>

          {order.note && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-500">
              📝 {order.note}
            </p>
          )}

          {order.status === "pending" &&
            (isMidtransEnabled() ? (
              <PayButton orderId={order.id} />
            ) : (
              <p className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
                <MessageCircle className="h-4 w-4" />
                Pengurus KWT akan menghubungi Anda via WhatsApp untuk pembayaran.
              </p>
            ))}

          <p className="mt-4 text-xs text-slate-400">
            Dibuat {formatDateTime(order.createdAt)} · simpan halaman ini untuk cek status
          </p>
          <a
            href={`/katalog/${slug}`}
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            ← Kembali ke katalog
          </a>
        </div>
      </main>
    </div>
  );
}
