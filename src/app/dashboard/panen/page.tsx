import { and, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requireKwtContext } from "@/lib/session";
import { getHarvests } from "@/lib/queries";
import { formatQuantity, timeAgo } from "@/lib/format";
import { deleteHarvest, recordHarvest, updateHarvestWaste } from "@/lib/actions/harvests";
import { HarvestForm } from "./harvest-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Panen" };

export default async function HarvestPage() {
  const ctx = await requireKwtContext();
  const productRows = await db
    .select({ id: products.id, name: products.name, unit: products.unit })
    .from(products)
    .where(and(eq(products.kwtId, ctx.kwtId), eq(products.isActive, true)))
    .orderBy(products.name);
  const rows = await getHarvests(ctx.kwtId, {
    memberId: ctx.isAdmin ? undefined : ctx.userId,
    limit: 50,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catat Panen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Setiap panen yang dicatat langsung menambah stok katalog dan menyesuaikan harga otomatis.
          </p>
        </div>
        <a
          href="/api/data/export?jenis=panen"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          Ekspor CSV
        </a>
      </header>

      <HarvestForm products={productRows.map((p) => ({ ...p }))} />

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">
            {ctx.isAdmin ? "Riwayat panen KWT" : "Riwayat panen Anda"}
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Belum ada panen dicatat.
            </p>
          )}
          {rows.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">
                  {h.productName}{" "}
                  <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                    {h.quality}
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  {h.memberName} · {timeAgo(h.harvestedAt)}
                  {h.wasteQty > 0
                    ? ` · tak terjual ${formatQuantity(h.wasteQty)} ${h.unit} (${
                        h.wasteDestination === "donasi"
                          ? "🤝 donasi"
                          : h.wasteDestination === "kompos"
                            ? "♻️ kompos"
                            : "🗑️ hilang"
                      })`
                    : ""}
                  {h.note ? ` · ${h.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {formatQuantity(h.quantity)} {h.unit}
                </span>
                {ctx.isAdmin && (
                  <form action={updateHarvestWaste} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={h.id} />
                    <input
                      type="number"
                      name="wasteQty"
                      step="0.01"
                      min="0"
                      max={h.quantity}
                      defaultValue={h.wasteQty > 0 ? h.wasteQty : undefined}
                      title="Catat susut/busuk (tidak masuk stok jual)"
                      placeholder="qty"
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500"
                    />
                    <select
                      name="wasteDestination"
                      defaultValue={h.wasteDestination}
                      title="Jalur ESG"
                      className="rounded-lg border border-slate-200 bg-white px-1 py-1 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="donasi">🤝</option>
                      <option value="kompos">♻️</option>
                      <option value="hilang">🗑️</option>
                    </select>
                    <button
                      type="submit"
                      title="Simpan limbah"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                    >
                      OK
                    </button>
                  </form>
                )}
                {(ctx.isAdmin || h.memberId === ctx.userId) && (
                  <form action={deleteHarvest}>
                    <input type="hidden" name="id" value={h.id} />
                    <button
                      type="submit"
                      title="Hapus"
                      className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
