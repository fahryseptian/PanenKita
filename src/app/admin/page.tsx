import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Download,
  HandCoins,
  RefreshCw,
  Store,
  Users,
} from "lucide-react";
import {
  getAdminOverview,
  listRecentOrders,
} from "@/lib/admin-queries";
import { getFeeLedgerHealth } from "@/lib/fees-db";
import { syncFeeLedger } from "@/lib/actions/superadmin";
import { formatRupiah, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  paid: { label: "Dibayar", cls: "bg-emerald-50 text-emerald-700" },
  processing: { label: "Diproses", cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Selesai", cls: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Batal", cls: "bg-red-50 text-red-600" },
  expired: { label: "Kedaluwarsa", cls: "bg-slate-100 text-slate-400" },
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ sukses?: string; n?: string }>;
}) {
  const { sukses, n } = await searchParams;
  const [overview, recentOrders, feeHealth] = await Promise.all([
    getAdminOverview(),
    listRecentOrders(10),
    getFeeLedgerHealth(5),
  ]);

  const metrics = [
    {
      label: "GMV 30 hari",
      value: formatRupiah(overview.gmv30d),
      icon: HandCoins,
      hint: "Total pesanan terbayar",
    },
    {
      label: "Fee platform 30 hari",
      value: formatRupiah(overview.fee30d),
      icon: BadgeCheck,
      hint: "Komisi + handling terkumpul",
    },
    {
      label: "KWT disetujui",
      value: `${overview.kwtApproved}`,
      icon: Store,
      hint: `${overview.kwtPending} pending · ${overview.kwtSuspended} disuspend · ${overview.kwtRejected} ditolak`,
    },
    {
      label: "Pengguna",
      value: String(overview.userTotal),
      icon: Users,
      hint: `${overview.pendingOrders} pesanan pending`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ringkasan Platform</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau seluruh KWT, pesanan, dan pendapatan platform.
        </p>
      </header>

      {overview.kwtPending > 0 && (
        <Link
          href="/admin/kwt?status=pending"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:border-amber-300"
        >
          <Clock className="mr-2 inline h-4 w-4" />
          {overview.kwtPending} kelompok menunggu persetujuan →
        </Link>
      )}

      {sukses === "fee-backfill" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✅ Ledger fee disinkronkan — {n ?? 0} catatan fee dilengkapi.
        </p>
      )}

      {feeHealth.driftCount > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {feeHealth.driftCount} pesanan terbayar tanpa catatan fee
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            Pendapatan platform pada pesanan ini belum tercatat di ledger.
            Sinkronkan untuk melengkapinya — aksi ini idempoten dan aman
            diulang.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
            {feeHealth.samples.map((s) => (
              <li key={s.orderId} className="font-mono">
                {s.orderNumber} · {s.kwtName} · {formatRupiah(s.total)}
              </li>
            ))}
            {feeHealth.truncated && <li>…dan lainnya</li>}
          </ul>
          <form action={syncFeeLedger} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sinkronkan ledger fee
            </button>
          </form>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <m.icon className="h-4 w-4 text-brand-600" />
            <p className="mt-2 text-xl font-bold tabular-nums">{m.value}</p>
            <p className="text-xs font-medium text-slate-600">{m.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{m.hint}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href="/admin/settlement"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          Pencairan fee KWT →
        </Link>
        <a
          href="/api/admin/export?type=orders"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="h-4 w-4" />
          Ekspor pesanan (CSV)
        </a>
        <a
          href="/api/admin/export?type=fees"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="h-4 w-4" />
          Ekspor fee platform (CSV)
        </a>
        <a
          href="/api/admin/export?type=settlements"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="h-4 w-4" />
          Ekspor pencairan (CSV)
        </a>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Pesanan terbaru (semua KWT)
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Nomor</th>
                <th className="px-4 py-2.5">KWT</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Pembeli</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Belum ada pesanan.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => {
                  const s = STATUS_LABEL[o.status] ?? STATUS_LABEL["pending"]!;
                  return (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">{o.orderNumber}</td>
                      <td className="px-4 py-2.5">{o.kwtName}</td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">{o.buyerName}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatRupiah(o.total)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs text-slate-400 md:table-cell">
                        {formatDateTime(o.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
