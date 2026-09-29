import { HandCoins, History, Landmark } from "lucide-react";
import {
  listSettlementHistory,
  listSettlements,
} from "@/lib/admin-queries";
import { recordSettlement, saveKwtBankAccount } from "@/lib/actions/superadmin";
import { SETTLEMENT_METHODS, settlementMethodLabel } from "@/lib/settlement";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default async function AdminSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ sukses?: string; error?: string }>;
}) {
  const { sukses, error } = await searchParams;
  const [rows, history] = await Promise.all([
    listSettlements(),
    listSettlementHistory(15),
  ]);

  const totalUnsettled = rows.reduce((acc, r) => acc + r.unsettledAmount, 0);
  const withoutBank = rows.filter(
    (r) => r.unsettledAmount > 0 && !r.bankAccountNumber,
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pencairan Fee</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fee platform aktif (komisi + handling) yang belum tercatat cair untuk
          tiap KWT. Baris fee yang dibalik karena refund/pembatalan tidak
          dihitung. Mencatat pencairan tidak memindahkan uang — catat setelah
          transfer dilakukan di luar sistem, lalu simpan nomor referensinya.
        </p>
      </header>

      {sukses === "1" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Pencairan fee tercatat.
        </p>
      )}
      {sukses === "rekening" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Rekening KWT disimpan.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Total fee belum tercairkan (semua KWT)
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {formatRupiah(totalUnsettled)}
        </p>
        {withoutBank > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            ⚠️ {withoutBank} KWT dengan fee belum cair belum punya nomor
            rekening — lengkapi dulu sebelum transfer.
          </p>
        )}
      </section>

      <section className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Belum ada KWT.
          </p>
        )}

        {rows.map((r) => {
          const hasBank = Boolean(r.bankAccountNumber);
          return (
            <article
              key={r.kwtId}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{r.kwtName}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Landmark className="h-3.5 w-3.5" />
                    {hasBank
                      ? `${r.bankName ?? "Bank"} · ${r.bankAccountNumber} · ${r.bankAccountHolder ?? "-"}`
                      : "Rekening belum diisi"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {formatRupiah(r.unsettledAmount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.unsettledCount} pesanan · total{" "}
                    {formatRupiah(r.totalAmount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    terakhir cair{" "}
                    {r.settledThrough ? formatDate(r.settledThrough) : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                <form
                  action={recordSettlement}
                  className="space-y-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Catat pencairan
                  </p>
                  <input type="hidden" name="kwtId" value={r.kwtId} />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      name="method"
                      defaultValue="transfer"
                      className={inputCls}
                      aria-label="Cara pencairan"
                    >
                      {SETTLEMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {settlementMethodLabel(m)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="reference"
                      placeholder="No. referensi / payout id"
                      className={inputCls}
                    />
                  </div>
                  <input
                    name="note"
                    placeholder="Catatan (opsional)"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={r.unsettledAmount <= 0}
                    className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      r.unsettledAmount > 0
                        ? "Catat pencairan seluruh fee aktif yang belum tercairkan"
                        : "Tidak ada fee untuk dicairkan"
                    }
                  >
                    <HandCoins className="h-3.5 w-3.5" />
                    Catat pencairan
                  </button>
                </form>

                <form action={saveKwtBankAccount} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Rekening pencairan
                  </p>
                  <input type="hidden" name="kwtId" value={r.kwtId} />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="bankName"
                      defaultValue={r.bankName ?? ""}
                      placeholder="Bank (mis. BRI)"
                      className={inputCls}
                    />
                    <input
                      name="bankAccountNumber"
                      defaultValue={r.bankAccountNumber ?? ""}
                      placeholder="Nomor rekening"
                      className={inputCls}
                    />
                  </div>
                  <input
                    name="bankAccountHolder"
                    defaultValue={r.bankAccountHolder ?? ""}
                    placeholder="Nama pemilik rekening"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Simpan rekening
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <History className="h-4 w-4" />
          Riwayat pencairan
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400">
                    Belum ada pencairan tercatat.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{h.kwtName}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatRupiah(h.amount)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 sm:table-cell">
                      {settlementMethodLabel(h.method)}
                      {h.reference ? ` · ${h.reference}` : ""}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-400 md:table-cell">
                      {h.feeCount} pesanan · s/d {formatDateTime(h.settledThrough)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right text-xs text-slate-400 lg:table-cell">
                      dicatat {formatDateTime(h.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
