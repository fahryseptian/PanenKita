import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  CheckCircle2,
  Clock,
  Landmark,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { getKwtBySlug, getKwtContact } from "@/lib/queries";
import { formatRupiah, formatDateTime, formatQuantity } from "@/lib/format";
import { photoSrc } from "@/lib/photo-url";
import { bankAccountLine, hasPaymentChannel } from "@/lib/payment-info";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Menunggu pembayaran", cls: "bg-warn/10 text-warn" },
  paid: { text: "Dibayar — sedang disiapkan", cls: "bg-brand-50 text-brand-700" },
  processing: { text: "Disiapkan", cls: "bg-brand-50 text-brand-700" },
  completed: { text: "Selesai", cls: "bg-brand-50 text-brand-700" },
  cancelled: { text: "Dibatalkan", cls: "bg-red-50 text-red-600" },
  expired: { text: "Kedaluwarsa — silakan pesan ulang", cls: "bg-red-50 text-red-600" },
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

  const [items, contact] = await Promise.all([
    db
      .select({
        productName: products.name,
        unit: products.unit,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id)),
    getKwtContact(kwt.id),
  ]);

  const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending!;
  const account = bankAccountLine(kwt);
  const qris = photoSrc(kwt.qrisImageUrl);
  const hasChannel = hasPaymentChannel(kwt);
  const waText = encodeURIComponent(
    `Halo, saya ${order.buyerName}. Saya mau konfirmasi pembayaran pesanan ${order.orderNumber} (total ${formatRupiah(order.total)}).`,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${status.cls}`}>
            {order.status === "pending" ? (
              <Clock className="h-7 w-7" />
            ) : order.status === "cancelled" || order.status === "expired" ? (
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
                  {i.productName} × {formatQuantity(Number(i.quantity))} {i.unit}
                </span>
                <span className="tabular-nums">
                  {formatRupiah(Math.round(Number(i.quantity) * i.unitPrice))}
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

          {order.status === "pending" && order.expiresAt && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              ⏳ Selesaikan pembayaran sebelum {formatDateTime(order.expiresAt)} — setelah itu
              pesanan otomatis dibatalkan dan stok dilepas.
            </p>
          )}

          {order.status === "pending" && (
            <section className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <Landmark className="h-4 w-4" /> Cara bayar
              </p>
              <p className="mt-1 text-xs leading-relaxed text-brand-900/80">
                Pembayaran langsung ke <b>{kwt.name}</b> — tunai saat mengambil, transfer,
                atau QRIS. Sertakan nomor pesanan <b>{order.orderNumber}</b> sebagai
                berita transfer.
              </p>

              {account && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Transfer bank
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-800">{account}</p>
                </div>
              )}

              {qris && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <QrCode className="h-3.5 w-3.5" /> QRIS {kwt.name}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qris}
                    alt={`QRIS ${kwt.name}`}
                    className="mx-auto mt-2 h-56 w-56 rounded-lg object-contain"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Buka aplikasi bank/e-wallet, pindai, lalu masukkan nominal{" "}
                    {formatRupiah(order.total)}.
                  </p>
                </div>
              )}

              {kwt.paymentNote && (
                <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
                  📝 {kwt.paymentNote}
                </p>
              )}

              {!hasChannel && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-brand-700">
                  <MessageCircle className="h-4 w-4" />
                  Pengurus KWT akan menghubungi Anda via WhatsApp untuk pembayaran.
                </p>
              )}

              {contact && (
                <a
                  href={`https://wa.me/${contact.phone}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  Konfirmasi bukti bayar ke {contact.name}
                </a>
              )}
            </section>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Dibuat {formatDateTime(order.createdAt)} · simpan halaman ini untuk cek status
          </p>
          <a
            href="/cek-pesanan"
            className="mt-2 inline-block text-xs font-medium text-slate-500 hover:underline"
          >
            Kehilangan link? Cek pesanan lewat nomor pesanan + nomor WA →
          </a>
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
