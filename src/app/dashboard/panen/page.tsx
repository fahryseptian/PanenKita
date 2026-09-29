import { and, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { harvestSchedules, products, user } from "@/lib/db/schema";
import { requireKwtContext } from "@/lib/session";
import { getHarvests, getMembers } from "@/lib/queries";
import { formatQuantity, timeAgo } from "@/lib/format";
import {
  createHarvestSchedule,
  deleteHarvest,
  deleteHarvestSchedule,
  recordHarvest,
  toggleHarvestSchedule,
  updateHarvestWaste,
} from "@/lib/actions/harvests";
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
  const members = ctx.isAdmin ? await getMembers(ctx.kwtId) : [];
  const schedules = ctx.isAdmin
    ? await db
        .select({
          id: harvestSchedules.id,
          productName: products.name,
          quantity: harvestSchedules.quantity,
          quality: harvestSchedules.quality,
          dayOfWeek: harvestSchedules.dayOfWeek,
          isActive: harvestSchedules.isActive,
          memberName: user.name,
        })
        .from(harvestSchedules)
        .innerJoin(products, eq(harvestSchedules.productId, products.id))
        .innerJoin(user, eq(harvestSchedules.memberId, user.id))
        .where(eq(harvestSchedules.kwtId, ctx.kwtId))
        .orderBy(harvestSchedules.dayOfWeek)
    : [];
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

      {/* Jadwal panen berulang — stok terisi otomatis di hari terpilih */}
      {ctx.isAdmin && (
        <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
          <h2 className="font-semibold">🔁 Jadwal panen berulang</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stok produk terisi otomatis di hari terpilih — tanpa input manual.
            Dijalankan tiap kali cron harian berjalan atau dashboard dibuka.
          </p>

          {schedules.length > 0 && (
            <div className="mt-3 divide-y divide-brand-100 overflow-hidden rounded-xl border border-brand-100 bg-white">
              {schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      {DAY_NAMES[s.dayOfWeek]} · {s.productName} · {s.quantity} ·
                      kualitas {s.quality}
                      {!s.isActive && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">pause</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">pelaksana: {s.memberName}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleHarvestSchedule}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        {s.isActive ? "Pause" : "Aktifkan"}
                      </button>
                    </form>
                    <form action={deleteHarvestSchedule}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
                        Hapus
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={createHarvestSchedule} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">Produk</label>
              <select name="productId" required className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                {productRows.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Hari</label>
              <select name="dayOfWeek" required defaultValue="1" className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Jumlah</label>
              <input type="number" name="quantity" required min="0.01" step="0.01" placeholder="20" className="mt-1 w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Kualitas</label>
              <select name="quality" defaultValue="A" className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Pelaksana</label>
              <select name="memberId" required className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Tambah jadwal
            </button>
          </form>
        </section>
      )}

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
