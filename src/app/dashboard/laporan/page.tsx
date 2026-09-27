import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getLaporanPeriode } from "@/lib/queries-laporan";
import { resolveReportRange, formatYmd } from "@/lib/report-period";
import { formatRupiah, formatQuantity } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Laporan Bendahara" };

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const range = resolveReportRange(sp.from, sp.to, sp.preset);
  const laporan = await getLaporanPeriode(ctx.kwtId, range.from, range.to);

  const exportParams = new URLSearchParams();
  if (sp.from || sp.to || sp.preset) {
    if (range.preset === "custom") {
      exportParams.set("from", formatYmd(range.from));
      exportParams.set("to", formatYmd(new Date(range.to.getTime() - 86_400_000)));
    } else if (sp.preset) {
      exportParams.set("preset", sp.preset);
    }
  }
  const exportQuery = exportParams.toString();
  const exportHref = `/api/laporan/export${exportQuery ? `?${exportQuery}` : ""}`;

  const fromValue = range.preset === "custom" ? formatYmd(range.from) : "";
  const toValue =
    range.preset === "custom"
      ? formatYmd(new Date(range.to.getTime() - 86_400_000))
      : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Bendahara</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rekap penjualan terbayar, panen, dan kontribusi anggota — siap dilaporkan
            di rapat KWT.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          Ekspor CSV
        </a>
      </header>

      {/* Filter periode */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Dari tanggal
          </label>
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Sampai tanggal
          </label>
          <input
            type="date"
            name="to"
            defaultValue={toValue}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
        >
          Terapkan
        </button>
        <div className="flex gap-2 text-xs">
          {(
            [
              { label: "30 hari", params: "" },
              { label: "Bulan ini", params: "?preset=bulan-ini" },
              { label: "Bulan lalu", params: "?preset=bulan-lalu" },
            ] as const
          ).map((p) => (
            <Link
              key={p.label}
              href={`/dashboard/laporan${p.params}`}
              className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </form>

      {/* Ringkasan kas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Penerimaan terbayar", value: formatRupiah(laporan.totalPaid), accent: true },
          { label: "Pesanan terbayar", value: String(laporan.orderCount) },
          {
            label: "Rata-rata / pesanan",
            value: laporan.avgOrder === null ? "—" : formatRupiah(laporan.avgOrder),
          },
          {
            label: "Pending / batal",
            value: `${laporan.pendingCount} / ${laporan.cancelledCount}`,
          },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-4 ${
              c.accent
                ? "border-brand-200 bg-brand-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p
              className={`mt-1 text-lg font-bold tabular-nums ${
                c.accent ? "text-brand-700" : ""
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Per produk */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <FileSpreadsheet className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold">Rekap per produk</h2>
        </div>
        {laporan.perProduk.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Belum ada data pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">Produk</th>
                  <th className="px-3 py-2 text-right font-medium">Terjual</th>
                  <th className="px-3 py-2 text-right font-medium">Panen</th>
                  <th className="px-5 py-2 text-right font-medium">Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                {laporan.perProduk.map((p) => (
                  <tr key={p.productId} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium">{p.productName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatQuantity(p.qtySold)} {p.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      {formatQuantity(p.qtyHarvested)} {p.unit}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {formatRupiah(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per anggota */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <FileSpreadsheet className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold">Kontribusi panen anggota</h2>
        </div>
        {laporan.perAnggota.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Belum ada panen pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">Anggota</th>
                  <th className="px-3 py-2 text-right font-medium">Kali panen</th>
                  <th className="px-5 py-2 text-right font-medium">Total panen</th>
                </tr>
              </thead>
              <tbody>
                {laporan.perAnggota.map((m) => (
                  <tr key={m.memberId} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium">{m.memberName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      {m.harvestCount}×
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {formatQuantity(m.qtyHarvested)} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
