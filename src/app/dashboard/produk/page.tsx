import { Leaf } from "lucide-react";
import { requireKwtContext } from "@/lib/session";
import { getDashboardProducts } from "@/lib/queries";
import { formatRupiah, formatQuantity } from "@/lib/format";
import { toggleProductActive, deleteProduct } from "@/lib/actions/products";
import { ProductModal } from "./product-modal";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produk" };

export default async function ProductsPage() {
  const ctx = await requireKwtContext();
  const items = await getDashboardProducts(ctx.kwtId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Katalog yang tampil di halaman publik {`/katalog/${ctx.kwtSlug}`}
          </p>
        </div>
        <ProductModal />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Leaf className="mx-auto h-10 w-10 text-brand-600" />
          <h2 className="mt-4 text-lg font-semibold">Belum ada produk</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Tambahkan produk pertama Anda — harga jual akan disesuaikan otomatis
            oleh pricing engine mengikuti stok & permintaan.
          </p>
          <div className="mt-6">
            <ProductModal />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{p.name}</p>
                  {!p.isActive && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      nonaktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {p.category} · per {p.unit} · stok tersedia {formatQuantity(p.available)}{" "}
                  {p.unit}
                  {p.reserved > 0 ? ` (${formatQuantity(p.reserved)} dipesan)` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold tabular-nums text-brand-700">
                    {formatRupiah(p.currentPrice)}
                  </p>
                  <p className="text-xs text-slate-400">
                    dasar {formatRupiah(p.basePrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ProductModal product={p} />
                  <form action={toggleProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </form>
                  <form action={deleteProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
