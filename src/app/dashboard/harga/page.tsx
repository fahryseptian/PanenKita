import { requireAdmin } from "@/lib/session";
import {
  getDashboardProducts,
  getPricingEvents,
  getPricingRules,
} from "@/lib/queries";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { recomputeAllPrices } from "@/lib/actions/pricing";
import { saveWholesaleTiers, saveCommissionSettings } from "@/lib/actions/monetisasi";
import { getKwtFeeSummary } from "@/lib/fees-db";
import { DEFAULT_COMMISSION } from "@/lib/komisi";
import type { WholesaleTier } from "@/lib/wholesale";
import { DEFAULT_RULE } from "@/lib/pricing";
import { RecomputeButton } from "./recompute-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Harga" };

export default async function PricingPage() {
  const ctx = await requireAdmin();
  const [products, rules, events, feeSummary] = await Promise.all([
    getDashboardProducts(ctx.kwtId),
    getPricingRules(ctx.kwtId),
    getPricingEvents(ctx.kwtId, 30),
    getKwtFeeSummary(ctx.kwtId),
  ]);
  const ruleByProduct = new Map(rules.map((r) => [r.productId, r]));
  const tiersText = (raw: string | null): string => {
    if (!raw) return "";
    try {
      return (JSON.parse(raw) as WholesaleTier[])
        .map((t) => `${t.minQty}:${t.percentOff}`)
        .join(", ");
    } catch {
      return "";
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Harga Dinamis</h1>
          <p className="mt-1 text-sm text-slate-500">
            Engine menyesuaikan harga dari stok & permintaan. Semua perubahan tercatat di bawah.
          </p>
        </div>
        <RecomputeButton />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Aturan aktif</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>
            • Stok menipis ≤ <b>{Number(DEFAULT_RULE.lowStockThreshold)}</b> →{" "}
            <b>+{DEFAULT_RULE.lowStockPercent}%</b>
          </li>
          <li>
            • Stok menumpuk ≥ <b>{Number(DEFAULT_RULE.highStockThreshold)}</b> →{" "}
            <b>{DEFAULT_RULE.highStockPercent}%</b> (diskon)
          </li>
          <li>
            • ≥ <b>{DEFAULT_RULE.surgeMinOrders}</b> pesanan dalam{" "}
            <b>{DEFAULT_RULE.surgeWindowHours} jam</b> terakhir →{" "}
            <b>+{DEFAULT_RULE.surgePercent}%</b>
          </li>
          <li>
            • Batas akhir: <b>{DEFAULT_RULE.minPricePercent}%–{DEFAULT_RULE.maxPricePercent}%</b>{" "}
            dari harga dasar, dibulatkan ke ratusan
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Aturan khusus per produk (override) bisa ditambahkan lewat tabel pricing_rules.
        </p>
      </section>

      {/* Komisi platform */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Komisi platform</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Dipotong otomatis dari transaksi terbayar. Terkumpul sejauh ini:{" "}
              <b>{formatRupiah(feeSummary.totalFee)}</b> dari {feeSummary.feeCount} transaksi
              (bersih KWT {formatRupiah(feeSummary.netTotal)}).
            </p>
          </div>
        </div>
        <form action={saveCommissionSettings} className="mt-3 grid gap-3 sm:grid-cols-6">
          {[
            { name: "ratePercent", label: "Rate %", def: DEFAULT_COMMISSION.ratePercent },
            { name: "handlingFee", label: "Handling Rp", def: DEFAULT_COMMISSION.handlingFee },
            { name: "minOrderValue", label: "Min. order Rp", def: DEFAULT_COMMISSION.minOrderValue },
            { name: "discountThreshold", label: "Diskon ≥ Rp", def: DEFAULT_COMMISSION.discountThreshold },
            { name: "discountPercent", label: "Diskon %", def: DEFAULT_COMMISSION.discountPercent },
          ].map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="mb-1 block text-xs font-medium text-slate-500">
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                type="number"
                min={0}
                defaultValue={f.def}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand-500"
              />
            </div>
          ))}
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
              Aktif
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
            >
              Simpan
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Harga sekarang & tier grosir</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Harga grosir otomatis berlaku di form pesan, mis. format tier: <code>10:5, 50:10</code> = ≥10 kuantitas −5%, ≥50 −10%.
          </p>
        </div>
        <div className="divide-y divide-slate-50">
          {products.map((p) => {
            const rule = ruleByProduct.get(p.id);
            const low = rule ? Number(rule.lowStockThreshold) : Number(DEFAULT_RULE.lowStockThreshold);
            const high = rule
              ? Number(rule.highStockThreshold)
              : Number(DEFAULT_RULE.highStockThreshold);
            const zone =
              p.available <= low ? "red" : p.available >= high ? "blue" : "green";
            return (
              <div key={p.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      stok {p.available} {p.unit} · zona{" "}
                      {zone === "red" ? "menipis" : zone === "blue" ? "menumpuk" : "normal"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-brand-700">
                      {formatRupiah(p.currentPrice)}
                    </p>
                    <p className="text-xs text-slate-400">dasar {formatRupiah(p.basePrice)}</p>
                  </div>
                </div>
                <form action={saveWholesaleTiers} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="productId" value={p.id} />
                  <input
                    name="tiers"
                    defaultValue={tiersText(rule?.wholesaleTiers ?? null)}
                    placeholder="10:5, 50:10 (kosong = tanpa grosir)"
                    className="w-72 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  >
                    Simpan tier
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Jejak audit harga</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {events.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">
              Belum ada perubahan harga tercatat.
            </p>
          )}
          {events.map((e) => (
            <div key={e.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{e.productName}</p>
                <p className="text-sm tabular-nums">
                  {formatRupiah(e.oldPrice)} → <b>{formatRupiah(e.newPrice)}</b>
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDateTime(e.createdAt)} · {e.type === "manual" ? "manual" : "otomatis"} ·{" "}
                {e.reason}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
