import Link from "next/link";
import { Leaf, Search, Sprout, Users, X } from "lucide-react";
import {
  getDirectory,
  getDirectoryFacets,
  getPlatformStats,
} from "@/lib/queries-directory";
import { getRecentProducts } from "@/lib/queries";
import {
  PRODUCT_CATEGORIES,
  categoryLabel,
  parseCategoryParam,
} from "@/lib/categories";
import { formatRupiah } from "@/lib/format";
import { photoSrc } from "@/lib/photo-url";
import { GroupCard, ProvinceChip } from "./group-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Katalog" };

export default async function KatalogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    provinsi?: string;
    kabupaten?: string;
    kategori?: string;
    tersedia?: string;
  }>;
}) {
  const { q, provinsi, kabupaten, kategori: kategoriParam, tersedia } =
    await searchParams;
  const kategori = parseCategoryParam(kategoriParam);
  const onlyAvailable = tersedia === "1";
  const filter = {
    q,
    province: provinsi,
    regency: kabupaten,
    category: kategori ?? undefined,
  };
  const [groups, facets, stats, recent] = await Promise.all([
    getDirectory(filter),
    getDirectoryFacets(),
    getPlatformStats(),
    getRecentProducts(8),
  ]);

  // Query string helper: mempertahankan filter lain saat toggle satu chip.
  const qs = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, provinsi, kabupaten, kategori, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  const availableQs = onlyAvailable
    ? qs({ tersedia: undefined })
    : qs({ tersedia: "1" });

  // Kabupaten yang tersedia mengikuti provinsi terpilih (atau semua).
  const regencyOptions = facets.regencies.filter(
    (r) => !provinsi || r.province === provinsi,
  );
  const hasRegionFilter = Boolean(provinsi || kabupaten);
  const shownGroups = onlyAvailable
    ? groups.filter((g) => g.availableProducts > 0)
    : groups;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="font-bold">TaniKita</span>
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
          {provinsi && <input type="hidden" name="provinsi" value={provinsi} />}
          {kabupaten && <input type="hidden" name="kabupaten" value={kabupaten} />}
          {kategori && <input type="hidden" name="kategori" value={kategori} />}
          {onlyAvailable && (
            <input type="hidden" name="tersedia" value="1" />
          )}
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Cari
          </button>
        </form>

        {/* Filter daerah */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kategori
            </span>
            {PRODUCT_CATEGORIES.map((c) => {
              const active = kategori === c;
              return (
                <Link
                  key={c}
                  href={`/katalog${
                    active ? qs({ kategori: undefined }) : qs({ kategori: c })
                  }`}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {categoryLabel(c)}
                </Link>
              );
            })}
            <Link
              href={`/katalog${availableQs}`}
              className={`ml-2 rounded-full px-3 py-1 text-xs font-medium transition ${
                onlyAvailable
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              Hanya tersedia
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Provinsi
            </span>
            {facets.provinces.length === 0 && (
              <span className="text-xs text-slate-400">Belum ada data wilayah</span>
            )}
            {facets.provinces.map((p) => (
              <ProvinceChip
                key={p.province}
                province={p.province}
                kwtCount={p.kwtCount}
              />
            ))}
          </div>
          {provinsi && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kab/Kota
              </span>
              {regencyOptions.map((r) => {
                const active = kabupaten === r.regency;
                return (
                  <Link
                    key={`${r.province}-${r.regency}`}
                    href={`/katalog${
                      active
                        ? qs({ kabupaten: undefined })
                        : qs({ kabupaten: r.regency })
                    }`}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-brand-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    }`}
                  >
                    {r.regency} ({r.kwtCount})
                  </Link>
                );
              })}
            </div>
          )}
          {(hasRegionFilter || kategori || onlyAvailable) && (
            <Link
              href={`/katalog${qs({
                provinsi: undefined,
                kabupaten: undefined,
                kategori: undefined,
                tersedia: undefined,
              })}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
            >
              <X className="h-3 w-3" /> Hapus semua filter
            </Link>
          )}
        </div>

        {/* Produk terbaru dengan status stok */}
        {recent.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Baru ditambahkan
            </h2>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {recent.map((p) => (
                <Link
                  key={p.id}
                  href={`/katalog/${p.kwtSlug}`}
                  className="w-40 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex h-20 items-center justify-center bg-brand-50">
                    {photoSrc(p.photoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoSrc(p.photoUrl)!}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🥬</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.kwtName}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-brand-700">
                        {formatRupiah(p.currentPrice)}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          p.available > 0
                            ? "bg-brand-50 text-brand-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {p.available > 0 ? `Stok ${p.available}` : "Habis"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {shownGroups.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            {onlyAvailable
              ? "Tidak ada kelompok dengan stok tersedia saat ini. Coba hapus filter."
              : "Belum ada kelompok yang cocok. Coba kata kunci lain."}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownGroups.map((k) => (
              <GroupCard key={k.id} group={k} />
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
