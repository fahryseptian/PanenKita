import Link from "next/link";
import { Leaf, MapPin, Search, Sprout, Users } from "lucide-react";
import { getDirectory, getPlatformStats } from "@/lib/queries-directory";

export const dynamic = "force-dynamic";

export const metadata = { title: "Katalog" };

export default async function KatalogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [groups, stats] = await Promise.all([getDirectory(q), getPlatformStats()]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="font-bold">PanenKita</span>
          <Link
            href="/login"
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Masuk
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
          <h1 className="text-2xl font-bold">Katalog Kelompok Tani Wanita</h1>
          <p className="mt-1 text-sm text-slate-600">
            Belanja langsung dari kelompok tani wanita di seluruh Indonesia —
            panen segar, harga jujur dan transparan.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              <Leaf className="h-3.5 w-3.5" /> {stats.kwtCount} kelompok
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              <Sprout className="h-3.5 w-3.5" /> {stats.productCount} produk
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-brand-700 shadow-sm">
              <Users className="h-3.5 w-3.5" /> {stats.memberCount} anggota
            </span>
          </div>
        </section>

        <form className="mt-6 flex gap-2" action="/katalog">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari kelompok, kabupaten/kota, atau provinsi..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Cari
          </button>
        </form>

        {groups.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Belum ada kelompok yang cocok. Coba kata kunci lain.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((k) => (
              <Link
                key={k.id}
                href={`/katalog/${k.slug}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
              >
                <h2 className="font-semibold">{k.name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[k.regency, k.province].filter(Boolean).join(", ") || "Indonesia"}
                </p>
                {k.address && (
                  <p className="mt-0.5 text-xs text-slate-400">{k.address}</p>
                )}
                <div className="mt-3 flex gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Sprout className="h-3.5 w-3.5 text-brand-500" /> {k.productCount} produk
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-brand-500" /> {k.memberCount} anggota
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-brand-600">
                  Lihat katalog →
                </p>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-6 text-center">
          <h2 className="font-semibold">Punya kelompok tani wanita?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Daftarkan kelompok Anda, catat panen, dan katalog online langsung
            tampil di sini — gratis.
          </p>
          <Link
            href="/daftar-kwt"
            className="mt-4 inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Daftarkan KWT Anda
          </Link>
        </section>
      </main>
    </div>
  );
}
