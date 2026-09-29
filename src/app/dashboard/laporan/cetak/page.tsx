import { requireAdmin } from "@/lib/session";
import { getLaporanPeriode } from "@/lib/queries-laporan";
import { getKwtById } from "@/lib/queries";
import { resolveReportRange, formatYmd } from "@/lib/report-period";
import { formatRupiah, formatQuantity, formatDate } from "@/lib/format";
import { co2ePreventedKg, formatCo2, carKmEquivalent } from "@/lib/carbon";

export const dynamic = "force-dynamic";

export const metadata = { title: "Laporan Dampak (Cetak)" };

/**
 * Laporan dampak siap cetak (ESG) — untuk dilampirkan ke proposal/laporan
 * korporat. Layout hitam-putih, ada kop & kolom tanda tangan.
 */
export default async function CetakLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const range = resolveReportRange(sp.from, sp.to, sp.preset);
  const [laporan, kwt] = await Promise.all([
    getLaporanPeriode(ctx.kwtId, range.from, range.to),
    getKwtById(ctx.kwtId),
  ]);

  const dari = formatDate(range.from);
  const sampai = formatDate(new Date(range.to.getTime() - 86_400_000));
  const wasteKg = laporan.wasteKg;
  const co2e = wasteKg > 0 ? co2ePreventedKg(wasteKg) : laporan.co2ePrevented;

  return (
    <div className="mx-auto max-w-3xl bg-white p-2 print:p-0">
      {/* Kop */}
      <header className="border-b-2 border-slate-800 pb-4 text-center">
        <h1 className="text-lg font-bold uppercase">Laporan Dampak & Penjualan</h1>
        <p className="text-sm font-semibold">{kwt?.name ?? ctx.kwtName}</p>
        <p className="text-xs text-slate-600">
          {[kwt?.regency, kwt?.province].filter(Boolean).join(", ") || "Indonesia"}
          {" · "}Platform TaniKita
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Periode: {dari} s.d. {sampai} · Dicetak {formatDate(new Date())}
        </p>
      </header>

      {/* Dampak lingkungan */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase">Dampak Lingkungan (Zero-Waste — Tiga Jalur)</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border border-slate-300 bg-slate-50">
              <th className="border border-slate-300 px-3 py-1.5 text-left">Jalur</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Kuantitas</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Faktor</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">CO₂e Terhindar</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border border-slate-300">
              <td className="border border-slate-300 px-3 py-1.5">1. Tersalurkan — dijual via katalog</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                {formatQuantity(laporan.perProduk.reduce((a, p) => a + p.qtySold, 0))} kg
              </td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">2,5</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                {formatCo2(laporan.co2ePrevented === 0 ? 0 : laporan.pathways.salur * 2.5)}
              </td>
            </tr>
            <tr className="border border-slate-300">
              <td className="border border-slate-300 px-3 py-1.5">2. Didonasikan (bank pangan)</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatQuantity(laporan.pathways.donasi)} kg</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">2,5</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatCo2(laporan.pathways.donasi * 2.5)}</td>
            </tr>
            <tr className="border border-slate-300">
              <td className="border border-slate-300 px-3 py-1.5">3. Dikomposkan (aerobik)</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatQuantity(laporan.pathways.kompos)} kg</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">0,5</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatCo2(laporan.pathways.kompos * 0.5)}</td>
            </tr>
            {laporan.pathways.hilang > 0 && (
              <tr className="border border-slate-300">
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">(Belum tertangani — hilang)</td>
                <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums text-slate-500">{formatQuantity(laporan.pathways.hilang)} kg</td>
                <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums text-slate-500">—</td>
                <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums text-slate-500">risiko {formatCo2(laporan.co2eHilangRisk)}</td>
              </tr>
            )}
            <tr className="border border-slate-300 bg-slate-50">
              <td className="border border-slate-300 px-3 py-1.5 font-semibold">Total emisi terhindar</td>
              <td className="border border-slate-300 px-3 py-1.5" />
              <td className="border border-slate-300 px-3 py-1.5" />
              <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold tabular-nums">
                {formatCo2(co2e)} (≈ {carKmEquivalent(co2e).toLocaleString("id-ID")} km mobil)
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-slate-500">
          Faktor emisi (kg CO₂e per kg, estimasi konservatif dekomposisi anaerobik TPA): pangan dikonsumsi/didonasi 2,5; komposting aerobik 0,5.
        </p>
      </section>

      {/* Kinerja ekonomi */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase">Kinerja Ekonomi</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border border-slate-300">
              <td className="border border-slate-300 px-3 py-1.5">Penerimaan terbayar</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatRupiah(laporan.totalPaid)}</td>
            </tr>
            <tr className="border border-slate-300">
              <td className="border border-slate-300 px-3 py-1.5">Jumlah transaksi terbayar</td>
              <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{laporan.orderCount}</td>
            </tr>
            {laporan.feeCount > 0 && (
              <tr className="border border-slate-300">
                <td className="border border-slate-300 px-3 py-1.5">Komisi platform</td>
                <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                  −{formatRupiah(laporan.platformFee)} (bersih {formatRupiah(laporan.netToKwt)})
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Rekap produk */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase">Rekap per Produk</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border border-slate-300 bg-slate-50">
              <th className="border border-slate-300 px-3 py-1.5 text-left">Produk</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Panen</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Terjual</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Pendapatan</th>
            </tr>
          </thead>
          <tbody>
            {laporan.perProduk.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-300 px-3 py-2 text-center text-slate-400">
                  Tidak ada data pada periode ini.
                </td>
              </tr>
            ) : (
              laporan.perProduk.map((p) => (
                <tr key={p.productId} className="border border-slate-300">
                  <td className="border border-slate-300 px-3 py-1.5">{p.productName}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                    {formatQuantity(p.qtyHarvested)} {p.unit}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                    {formatQuantity(p.qtySold)} {p.unit}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">
                    {formatRupiah(p.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Tanda tangan */}
      <section className="mt-10 flex justify-between text-sm">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p className="text-xs text-slate-600">Ketua</p>
          <div className="mt-16 w-40 border-t border-slate-400 pt-1 text-xs text-slate-500">(………………)</div>
        </div>
        <div className="text-center">
          <p>Disusun oleh,</p>
          <p className="text-xs text-slate-600">Bendahara — {ctx.userName}</p>
          <div className="mt-16 w-40 border-t border-slate-400 pt-1 text-xs text-slate-500">(………………)</div>
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
        Dokumen dihasilkan otomatis oleh TaniKita · {formatYmd(new Date())}
      </footer>

      {/* CSS cetak */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print { aside, nav, form, button { display: none !important; } body { background: white !important; } }`,
        }}
      />
    </div>
  );
}
