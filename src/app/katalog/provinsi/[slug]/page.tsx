import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  getDirectory,
  getDirectoryFacets,
  getPlatformStats,
} from "@/lib/queries-directory";
import { provinceFromSlug } from "@/lib/provinces";
import { GroupCard, ProvinceChip } from "../../group-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const facets = await getDirectoryFacets();
  const province = provinceFromSlug(
    slug,
    facets.provinces.map((p) => p.province),
  );
  if (!province) return { title: "Provinsi tidak ditemukan" };

  const kwtCount = facets.provinces.find((p) => p.province === province)?.kwtCount ?? 0;
  return {
    title: `Katalog KWT ${province} — ${kwtCount} kelompok tani wanita`,
    description: `Belanja hasil panen langsung dari ${kwtCount} Kelompok Tani Wanita di ${province}. Sayur segar, harga jujur dan transparan, pesan lewat WhatsApp.`,
    alternates: { canonical: `/katalog/provinsi/${slug}` },
    openGraph: {
      title: `Katalog KWT ${province}`,
      description: `${kwtCount} kelompok tani wanita di ${province} menjual hasil panen segar langsung dari petani.`,
      type: "website",
    },
  };
}

export default async function ProvinceDirectoryPage({ params }: Props) {
  const { slug } = await params;
  const [facets, stats] = await Promise.all([
    getDirectoryFacets(),
    getPlatformStats(),
  ]);
  const province = provinceFromSlug(
    slug,
    facets.provinces.map((p) => p.province),
  );
  if (!province) notFound();

  const groups = await getDirectory({ province });
  const regencies = facets.regencies.filter((r) => r.province === province);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
          <Link href="/katalog" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              🌾
            </span>
            <span className="font-bold">PanenKita</span>
          </Link>
          <Link
            href="/login"
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Masuk
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/katalog"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          <ChevronLeft className="h-4 w-4" /> Semua provinsi
        </Link>

        <section className="mt-4 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
          <h1 className="text-2xl font-bold">
            Katalog KWT {province}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Belanja hasil panen langsung dari {groups.length} kelompok tani wanita
            di {province} — sayur segar, harga jujur dan transparan.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              🌾 {groups.length} kelompok
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              🥬 {groups.reduce((a, g) => a + g.productCount, 0)} produk
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              👩‍🌾 {groups.reduce((a, g) => a + g.memberCount, 0)} anggota
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              🇮🇩 {stats.kwtCount} kelompok di Indonesia
            </span>
          </div>
        </section>

        {/* Kab/kota dalam provinsi ini */}
        {regencies.length > 1 && (
          <div className="mt-6 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kab/Kota
            </span>
            {regencies.map((r) => (
              <Link
                key={`${r.province}-${r.regency}`}
                href={`/katalog?provinsi=${encodeURIComponent(r.province)}&kabupaten=${encodeURIComponent(r.regency)}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                {r.regency} ({r.kwtCount})
              </Link>
            ))}
          </div>
        )}

        {/* Provinsi lain */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Provinsi lain
          </span>
          {facets.provinces
            .filter((p) => p.province !== province)
            .map((p) => (
              <ProvinceChip key={p.province} province={p.province} kwtCount={p.kwtCount} />
            ))}
        </div>

        {groups.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Belum ada kelompok terdaftar di {province}. Coba provinsi lain.
          </p>
          ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-6 text-center">
          <h2 className="font-semibold">Punya KWT di {province}?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Daftarkan kelompok Anda, catat panen, dan katalog online langsung
            tampil di halaman ini — gratis.
          </p>
          <Link
            href="/daftar-kwt"
            className="mt-4 inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Daftarkan KWT Anda
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Ditenagai PanenKita 🌾
      </footer>
    </div>
  );
}
