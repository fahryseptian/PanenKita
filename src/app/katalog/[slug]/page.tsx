import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf, Sprout } from "lucide-react";
import { getCatalog, getKwtBySlug } from "@/lib/queries";
import { formatRupiah, formatDate } from "@/lib/format";
import { canonicalCategory, categoryLabel } from "@/lib/categories";
import { photoSrc } from "@/lib/photo-url";
import { db } from "@/lib/db";
import { pricingRules } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import type { WholesaleTier } from "@/lib/wholesale";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const kwt = await getKwtBySlug(slug);
  return { title: kwt ? `Katalog ${kwt.name}` : "Katalog" };
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kategori?: string }>;
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { kategori: kategoriParam } = await searchParams;
  const kwt = await getKwtBySlug(slug);
  if (!kwt) notFound();

  const items = await getCatalog(kwt.id);
  // Tier grosir per produk untuk form pesan.
  const tierRows = items.length
    ? await db
        .select({ productId: pricingRules.productId, tiers: pricingRules.wholesaleTiers })
        .from(pricingRules)
        .where(inArray(pricingRules.productId, items.map((i) => i.id)))
    : [];
  const tiersOf = (productId: string): WholesaleTier[] => {
    const raw = tierRows.find((r) => r.productId === productId)?.tiers;
    if (!raw) return [];
    try {
      return JSON.parse(raw) as WholesaleTier[];
    } catch {
      return [];
    }
  };
  // Kategori kanonik dari produk yang ada, terurut sesuai daftar resmi.
  const ORDER = [
    "sayur",
    "buah",
    "umbi",
    "rempah",
    "protein",
    "lainnya",
  ] as const;
  const categories = [...new Set(items.map((i) => canonicalCategory(i.category)))].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  const active = categories.includes(kategoriParam as never)
    ? (kategoriParam as string)
    : null;
  const shown = active ? items.filter((i) => canonicalCategory(i.category) === active) : items;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">{kwt.name}</p>
            <p className="text-xs text-slate-500">Katalog panen</p>
          </div>
          <Link
            href={`/katalog/${kwt.slug}/sertifikat`}
            className="badge badge-brand ml-auto border border-brand-200 px-3 py-1 transition hover:bg-brand-100"
            title="Lihat sertifikat zero-waste KWT ini"
          >
            🌱 Sertifikat Zero-Waste
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">Hasil panen hari ini 🌾</h1>
        <p className="mt-1 text-sm text-slate-500">
          Harga menyesuaikan stok & permintaan — selalu jujur dan transparan.
          Pesan langsung; bayar di tempat, transfer, atau QRIS ke kelompok.
        </p>

        {items.length === 0 ? (
          <div className="card mt-10 border-dashed border-slate-300 p-12 text-center">
            <Sprout className="mx-auto h-10 w-10 text-brand-600" />
            <p className="mt-3 text-sm text-slate-500">
              Belum ada produk aktif. Pantau lagi nanti ya!
            </p>
          </div>
        ) : (
          <>
            {/* Filter kategori */}
            {categories.length > 1 && (
              <div className="mt-6 flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/katalog/${kwt.slug}`}
                  className={`chip ${!active ? "chip-active" : ""}`}
                >
                  Semua
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c}
                    href={`/katalog/${kwt.slug}?kategori=${c}`}
                    className={`chip ${active === c ? "chip-active" : ""}`}
                  >
                    {categoryLabel(c)}
                  </Link>
                ))}
              </div>
            )}
            {(active ? categories.filter((c) => c === active) : categories).map(
              (cat) => (
                <section key={cat} className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {categoryLabel(cat)}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shown
                      .filter((i) => canonicalCategory(i.category) === cat)
                      .map((item) => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                  </div>
                </section>
              ),
            )}
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold">Pesan sekarang</h2>
              <OrderForm
                kwtId={kwt.id}
                kwtSlug={kwt.slug}
                products={items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  unit: i.unit,
                  price: i.currentPrice,
                  available: Math.max(0, i.stock?.available ?? 0),
                  tiers: tiersOf(i.id),
                }))}
              />
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Ditenagai PanenKita 🌾
      </footer>
    </div>
  );
}

function ProductCard({
  item,
}: {
  item: Awaited<ReturnType<typeof getCatalog>>[number];
}) {
  const available = Math.max(0, item.stock?.available ?? 0);
  const discounted = item.currentPrice < item.basePrice;
  return (
    <div className="card card-hover flex h-full flex-col overflow-hidden">
      <div className="flex h-32 items-center justify-center bg-brand-50 text-5xl">
        {photoSrc(item.photoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc(item.photoUrl)!}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>🥬</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{item.name}</h3>
          <span
            className={`badge shrink-0 ${
              available > 0 ? "badge-brand" : "badge-muted"
            }`}
          >
            {available > 0 ? `Stok ${available} ${item.unit}` : "Habis"}
          </span>
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
            {item.description}
          </p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-3">
          <span className="text-lg font-bold text-brand-700">
            {formatRupiah(item.currentPrice)}
          </span>
          <span className="text-xs text-slate-400">/{item.unit}</span>
          {discounted && (
            <span className="text-xs text-slate-400 line-through">
              {formatRupiah(item.basePrice)}
            </span>
          )}
        </div>
        {item.latestHarvestAt && (
          <p className="mt-1 text-xs text-slate-400">
            Panen terakhir {formatDate(item.latestHarvestAt)}
          </p>
        )}
      </div>
    </div>
  );
}
