import Link from "next/link";
import { formatRupiah, formatQuantity } from "@/lib/format";
import type { TopProductRow } from "@/lib/queries";

/**
 * Grafik bar horizontal CSS-murni — tanpa library, tetap terbaca di HP.
 * Bar atas = terlaris. Nilai = pendapatan; label bawah = qty terjual.
 */
export function TopProductsChart({
  rows,
  days,
}: {
  rows: TopProductRow[];
  days: number;
}) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">🏆 Produk terlaris</h2>
          <p className="text-xs text-slate-500">
            Berdasarkan pendapatan pesanan terbayar · {days} hari terakhir
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/dashboard?top=${d}`}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                d === days
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {d}h
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          Belum ada penjualan terbayar pada periode ini.
        </p>
      ) : (
        <div className="space-y-3 px-5 py-4">
          {rows.map((r, i) => (
            <div key={r.productId}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  <span className="mr-1.5 text-xs text-slate-400">#{i + 1}</span>
                  {r.productName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-brand-700">
                  {formatRupiah(r.revenue)}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max((r.revenue / max) * 100, 2)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatQuantity(r.qtySold)} {r.unit} terjual · {r.orderCount} pesanan
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
