import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getKwtBySlug } from "@/lib/queries";
import { getZeroWasteStats } from "@/lib/queries-zerowaste";
import { formatCo2, carKmEquivalent } from "@/lib/carbon";
import { formatQuantity, formatDate } from "@/lib/format";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const kwt = await getKwtBySlug(slug);
  if (!kwt) return { title: "Sertifikat" };
  return {
    title: `Sertifikat Zero-Waste — ${kwt.name}`,
    description: `Dampak zero-waste kumulatif ${kwt.name}: hasil panen tersalurkan, didonasikan, dan dikomposkan beserta emisi karbon terhindar.`,
    robots: { index: true },
  };
}

export default async function CertificatePage({ params }: Props) {
  const { slug } = await params;
  const kwt = await getKwtBySlug(slug);
  if (!kwt) notFound();

  const stats = await getZeroWasteStats(kwt.id);
  const co2e = stats.co2ePreventedKg;
  const treeEquivalent = Math.round(co2e / 21); // 1 pohon dewasa ≈ 21 kg CO2e/tahun

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      {/* Toolbar (tidak ikut tercetak) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <Link
          href={`/katalog/${kwt.slug}`}
          className="text-sm font-medium text-slate-500 hover:text-brand-600"
        >
          ← Katalog {kwt.name}
        </Link>
        <PrintButton />
      </div>

      {/* Sertifikat */}
      <div className="mx-auto max-w-3xl border-8 border-double border-brand-700 bg-white p-10 shadow-lg print:border-4 print:shadow-none">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">
            PanenKita 🌾
          </p>
          <h1 className="mt-4 text-3xl font-bold uppercase tracking-wide text-slate-900">
            Sertifikat Zero-Waste
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pengakuan atas pengelolaan hasil panen berkelanjutan
          </p>
        </header>

        <section className="mt-8 text-center">
          <p className="text-sm text-slate-500">Diberikan kepada</p>
          <p className="mt-2 text-2xl font-bold text-brand-800">{kwt.name}</p>
          <p className="text-sm text-slate-500">
            {[kwt.regency, kwt.province].filter(Boolean).join(", ") || "Indonesia"}
            {" · "}
            {stats.jumlahAnggota} anggota
          </p>
          {stats.sejak && (
            <p className="mt-0.5 text-xs text-slate-400">
              Mencatat panen sejak {formatDate(stats.sejak)}
              {stats.hingga ? ` — data terbaru ${formatDate(stats.hingga)}` : ""}
            </p>
          )}
        </section>

        {/* Angka utama */}
        <section className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/60 p-6 text-center">
          <p className="text-sm text-slate-600">Total emisi karbon terhindar</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-brand-700">
            {formatCo2(co2e)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ≈ {carKmEquivalent(co2e).toLocaleString("id-ID")} km berkendara mobil ·{" "}
            {treeEquivalent} pohon dewasa menyerap CO₂ setahun
          </p>
        </section>

        {/* Tiga jalur */}
        <section className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { label: "✅ Tersalurkan", kg: stats.salurKg, note: "dijual ke pembeli" },
            { label: "🤝 Didonasikan", kg: stats.donasiKg, note: "bank pangan" },
            { label: "♻️ Dikomposkan", kg: stats.komposKg, note: "pupuk organik" },
          ].map((j) => (
            <div key={j.label} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">{j.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {formatQuantity(j.kg)} kg
              </p>
              <p className="text-[10px] text-slate-400">{j.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 text-center text-sm text-slate-600">
          <p>
            Dari total <b>{formatQuantity(stats.totalPanenKg)} kg</b> panen tercatat (
            {stats.jumlahPanen} kali panen),{" "}
            <b>
              {formatQuantity(
                Math.max(0, stats.salurKg + stats.donasiKg + stats.komposKg),
              )}{" "}
              kg
            </b>{" "}
            berhasil tersalurkan ke konsumsi & lingkungan — bukan menjadi sampah.
          </p>
        </section>

        {/* Penjelasan metode */}
        <section className="mt-6 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-400">
          Metode: emisi terhindar dihitung dari faktor dekomposisi anaerobik TPA —
          pangan dikonsumsi/didonasi 2,5 kg CO₂e/kg; komposting aerobik 0,5 kg
          CO₂e/kg (estimasi konservatif, Food Wastage Footprint FAO/WRAP). Angka
          bersifat estimasi berbasis catatan panen & penjualan digital di platform
          PanenKita dan dapat diverifikasi dari riwayat transaksi.
        </section>

        {/* Tanda tangan */}
        <section className="mt-8 flex items-end justify-between text-sm">
          <div className="text-center">
            <div className="mt-14 w-44 border-t border-slate-400 pt-1 text-xs text-slate-500">
              Ketua {kwt.name}
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Diverifikasi oleh</p>
            <p className="font-semibold text-brand-700">PanenKita</p>
            <div className="mt-8 w-44 border-t border-slate-400 pt-1 text-xs text-slate-500">
              {formatDate(new Date())}
            </div>
          </div>
        </section>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-slate-400 print:hidden">
        Untuk menyimpan sebagai PDF: klik «Cetak / Simpan PDF» lalu pilih
        «Save as PDF» pada dialog cetak.
      </p>
    </div>
  );
}
