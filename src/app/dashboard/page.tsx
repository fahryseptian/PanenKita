import Link from "next/link";
import {
  ArrowRight,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireKwtContext } from "@/lib/session";
import {
  getDashboardOverview,
  getHarvests,
  getOrders,
} from "@/lib/queries";
import { getHarvestForecast } from "@/lib/queries-forecast";
import { formatRupiah, formatDateTime, formatQuantity, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ringkasan" };

export default async function DashboardPage() {
  const ctx = await requireKwtContext();
  const [overview, recentHarvests, recentOrders, forecast] = await Promise.all([
    getDashboardOverview(ctx.kwtId),
    getHarvests(ctx.kwtId, { limit: 5 }),
    getOrders(ctx.kwtId, { limit: 5 }),
    getHarvestForecast(ctx.kwtId),
  ]);
  const forecastVisible = ctx.isAdmin ? forecast : forecast.filter((f) => f.trend !== "belum-cukup-data");

  const metrics = [
    { label: "Produk aktif", value: String(overview.productCount), icon: TrendingUp, href: "/dashboard/produk" },
    { label: "Anggota", value: String(overview.memberCount), icon: Users, href: "/dashboard/anggota" },
    { label: "Panen 30 hari", value: `${formatQuantity(overview.harvest30d)}`, icon: Sprout, href: "/dashboard/panen" },
    { label: "Pesanan pending", value: String(overview.pendingOrders), icon: ShoppingCart, href: "/dashboard/pesanan" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ringkasan</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ctx.kwtName} · halo, {ctx.userName} 👋
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300"
          >
            <m.icon className="h-4 w-4 text-brand-600" />
            <p className="mt-2 text-2xl font-bold tabular-nums">{m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </Link>
        ))}
      </section>

      {overview.paidRevenue > 0 && (
        <section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
          <p className="text-sm text-brand-700">
            Total pembayaran diterima:{" "}
            <span className="text-xl font-bold">{formatRupiah(overview.paidRevenue)}</span>
          </p>
        </section>
      )}

      {/* Prediksi panen (baseline statistik) */}
      {forecastVisible.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold">📈 Prediksi panen minggu depan</h2>
              <p className="text-xs text-slate-500">
                Rata-rata bergerak 4 minggu terakhir per produk — angka kasar untuk
                merencanakan tanam & stok, bukan jaminan.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {forecastVisible.map((f) => (
              <div
                key={f.productId}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {f.forecastKg > 0 ? formatQuantity(f.forecastKg) : "0"} {f.unit}
                    <span className="ml-1 text-xs font-normal text-slate-400">/ minggu (est.)</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    4 minggu terakhir: {formatQuantity(f.last4TotalKg)} {f.unit} ·{" "}
                    {f.activeWeeks}/4 minggu aktif
                    {ctx.isAdmin &&
                      f.productId &&
                      ` · data terbatas, tambah panen untuk akurasi`}
                  </p>
                </div>
                {f.trend === "naik" && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    ↗ naik {f.trendPercent}%
                  </span>
                )}
                {f.trend === "turun" && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                    ↘ turun {Math.abs(f.trendPercent)}%
                  </span>
                )}
                {f.trend === "stabil" && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    → stabil
                  </span>
                )}
                {f.trend === "belum-cukup-data" && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    data belum cukup
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="px-5 py-3 text-[10px] text-slate-400">
            Basis: panen 28 hari terakhir. Tren = 2 minggu terakhir vs 2 minggu
            sebelumnya (ambang ±15%). Makin rajin mencatat panen, makin akurat.
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Panen terbaru</h2>
            <Link
              href="/dashboard/panen"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentHarvests.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400">Belum ada panen dicatat.</p>
            )}
            {recentHarvests.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{h.productName}</p>
                  <p className="text-xs text-slate-400">
                    {h.memberName} · {timeAgo(h.harvestedAt)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatQuantity(h.quantity)} {h.unit}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Pesanan terbaru</h2>
            <Link
              href="/dashboard/pesanan"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentOrders.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400">Belum ada pesanan masuk.</p>
            )}
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{o.buyerName}</p>
                  <p className="text-xs text-slate-400">
                    {o.orderNumber} · {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatRupiah(o.total)}</p>
                  <span
                    className={`text-xs ${
                      o.status === "pending" ? "text-warn" : "text-brand-600"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
