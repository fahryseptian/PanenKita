import { and, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requireKwtContext } from "@/lib/session";
import { getHarvests } from "@/lib/queries";
import { formatQuantity, timeAgo } from "@/lib/format";
import { deleteHarvest, recordHarvest } from "@/lib/actions/harvests";
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
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Catat Panen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Setiap panen yang dicatat langsung menambah stok katalog dan menyesuaikan harga otomatis.
        </p>
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
                  {h.note ? ` · ${h.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {formatQuantity(h.quantity)} {h.unit}
                </span>
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
