import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/session";
import { getOrders } from "@/lib/queries";
import { db } from "@/lib/db";
import { orderItems, products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { formatRupiah, formatDateTime, formatQuantity } from "@/lib/format";
import { confirmPayment, updateOrderStatus } from "@/lib/actions/orders";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pesanan" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-warn/10 text-warn",
  paid: "bg-brand-50 text-brand-700",
  processing: "bg-brand-50 text-brand-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-50 text-red-600",
};

const NEXT_STATUS: Record<string, Array<{ value: string; label: string }>> = {
  pending: [
    { value: "paid", label: "Tandai dibayar" },
    { value: "cancelled", label: "Batalkan" },
  ],
  paid: [
    { value: "processing", label: "Proses" },
    { value: "cancelled", label: "Batalkan" },
  ],
  processing: [
    { value: "completed", label: "Selesai" },
    { value: "cancelled", label: "Batalkan" },
  ],
  completed: [],
  cancelled: [],
};

export default async function OrdersPage() {
  const ctx = await requireAdmin();
  const orders = await getOrders(ctx.kwtId, { limit: 100 });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pesanan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pesanan masuk dari katalog publik. Pembeli membayar langsung ke KWT
          (tunai/transfer/QRIS) — konfirmasi setelah uang diterima.
        </p>
      </header>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          Belum ada pesanan.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    {o.buyerName} ·{" "}
                    <a
                      href={`https://wa.me/${o.buyerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {o.buyerPhone}
                    </a>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatRupiah(o.total)}</p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[o.status] ?? "bg-slate-100"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {o.items.map((i, idx) => (
                  <li key={idx}>
                    • {i.productName} × {formatQuantity(i.quantity)} {i.unit} @
                    {formatRupiah(i.unitPrice)}
                  </li>
                ))}
              </ul>
              {o.note && <p className="mt-2 text-sm text-slate-400">📝 {o.note}</p>}
              <p className="mt-2 text-xs text-slate-400">
                {formatDateTime(o.createdAt)}
              </p>

              {NEXT_STATUS[o.status] && NEXT_STATUS[o.status]!.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {NEXT_STATUS[o.status]!.map((s) =>
                    s.value === "paid" ? (
                      <form key={s.value} action={confirmPayment}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Konfirmasi pembayaran
                        </button>
                      </form>
                    ) : (
                      <form key={s.value} action={updateOrderStatus}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="status" value={s.value} />
                        <button
                          type="submit"
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            s.value === "cancelled"
                              ? "text-red-500 hover:bg-red-50"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {s.label}
                        </button>
                      </form>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
