import { notFound } from "next/navigation";
import { Leaf, Sprout } from "lucide-react";
import { getCatalog, getKwtBySlug } from "@/lib/queries";
import { formatRupiah, formatDate } from "@/lib/format";
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

export default async function CatalogPage({ params }: Props) {
  const { slug } = await params;
  const kwt = await getKwtBySlug(slug);
  if (!kwt) notFound();

  const items = await getCatalog(kwt.id);
  const categories = [...new Set(items.map((i) => i.category))];

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
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">Hasil panen hari ini 🌾</h1>
        <p className="mt-1 text-sm text-slate-500">
          Harga menyesuaikan stok & permintaan — selalu jujur dan transparan.
          Pesan langsung, bayar di tempat atau online.
        </p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Sprout className="mx-auto h-10 w-10 text-brand-600" />
            <p className="mt-3 text-sm text-slate-500">
              Belum ada produk aktif. Pantau lagi nanti ya!
            </p>
          </div>
        ) : (
          <>
            {categories.map((cat) => (
              <section key={cat} className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {cat}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items
                    .filter((i) => i.category === cat)
                    .map((item) => (
                      <ProductCard key={item.id} item={item} />
                    ))}
                </div>
              </section>
            ))}
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex h-32 items-center justify-center bg-brand-50 text-5xl">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>🥬</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{item.name}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              available > 0
                ? "bg-brand-50 text-brand-700"
                : "bg-slate-100 text-slate-400"
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
        <div className="mt-3 flex items-baseline gap-2">
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
