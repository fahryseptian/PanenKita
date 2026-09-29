import { HandCoins, History } from "lucide-react";
import {
  listSettlementHistory,
  listSettlements,
} from "@/lib/admin-queries";
import { recordSettlement } from "@/lib/actions/superadmin";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pencairan Fee</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fee platform (komisi + handling) yang belum dicairkan ke tiap KWT.
          Mencatat pencairan tidak memindahkan uang — catat setelah transfer
          dilakukan di luar sistem.
        </p>
      </header>

      {sukses === "1" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Pencairan fee tercatat.
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
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">KWT</th>
              <th className="px-4 py-2.5">Belum tercairkan</th>
              <th className="hidden px-4 py-2.5 sm:table-cell">Total fee</th>
              <th className="hidden px-4 py-2.5 md:table-cell">Terakhir cair</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Belum ada KWT.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.kwtId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.kwtName}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {formatRupiah(r.unsettledAmount)}
                    <span className="ml-1 text-xs text-slate-400">
                      ({r.unsettledCount} pesanan)
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 tabular-nums text-slate-500 sm:table-cell">
                    {formatRupiah(r.totalAmount)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-slate-400 md:table-cell">
                    {r.settledThrough ? formatDate(r.settledThrough) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={recordSettlement}>
                      <input type="hidden" name="kwtId" value={r.kwtId} />
                      <button
                        type="submit"
                        disabled={r.unsettledAmount <= 0}
                        className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          r.unsettledAmount > 0
                            ? "Catat pencairan seluruh fee yang belum tercairkan"
                            : "Tidak ada fee untuk dicairkan"
                        }
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Catat pencairan
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                    <td className="hidden px-4 py-2.5 text-xs text-slate-400 sm:table-cell">
                      {h.feeCount} pesanan · s/d {formatDateTime(h.settledThrough)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right text-xs text-slate-400 md:table-cell">
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
