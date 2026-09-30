import Link from "next/link";
import {
  BadgeCheck,
  History,
  Landmark,
  Receipt,
  TriangleAlert,
} from "lucide-react";
import {
  listFeeBillHistory,
  listFeeBilling,
  listOpenFeeBills,
} from "@/lib/admin-queries";
import {
  createFeeBill,
  markFeeBillPaid,
  platformBankStatus,
} from "@/lib/actions/superadmin";
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
  const [rows, history, openBills, bank] = await Promise.all([
    listFeeBilling(),
    listFeeBillHistory(15),
    listOpenFeeBills(),
    platformBankStatus(),
  ]);

  const totalUnbilled = rows.reduce((acc, r) => acc + r.unbilledAmount, 0);
  const totalOutstanding = rows.reduce((acc, r) => acc + r.outstandingAmount, 0);
  const withoutChannel = rows.filter((r) => !r.hasPaymentChannel).length;

  const openByKwt = new Map<string, typeof openBills>();
  for (const b of openBills) {
    const list = openByKwt.get(b.kwtId) ?? [];
    list.push(b);
    openByKwt.set(b.kwtId, list);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Tagihan Biaya Layanan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Biaya layanan platform (komisi + handling) per KWT. Pembeli membayar
          langsung ke KWT, jadi biaya ini <b>ditagihkan ke KWT</b> — bukan
          dipotong dari uang pembeli. Baris fee yang dibalik karena
          refund/pembatalan tidak ikut ditagih.
        </p>
      </header>

      {sukses === "tagihan" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Tagihan diterbitkan — tunggu pelunasan dari KWT.
        </p>
      )}
      {sukses === "lunas" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Tagihan ditandai lunas.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Rekening platform: tujuan transfer pelunasan */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Landmark className="h-4 w-4" /> Rekening platform (tujuan pelunasan)
        </h2>
        {bank ? (
          <p className="mt-2 text-sm tabular-nums text-slate-700">
            <b>{bank.bankName}</b> · {bank.bankAccountNumber}
            {bank.bankAccountHolder ? ` a/n ${bank.bankAccountHolder}` : ""}
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
            <TriangleAlert className="h-4 w-4" />
            Belum diatur — KWT belum tahu ke mana harus transfer.{" "}
            <Link href="/admin/pengaturan" className="font-medium underline">
              Isi di Pengaturan
            </Link>
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Belum ditagih (semua KWT)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatRupiah(totalUnbilled)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tagihan belum dilunasi
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatRupiah(totalOutstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {openBills.length} tagihan terbuka
          </p>
        </div>
      </section>

      {withoutChannel > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          ⚠️ {withoutChannel} KWT belum mengisi rekening/QRIS — pembelinya tidak
          melihat petunjuk pembayaran di halaman pesanan. Minta pengurus mengisi
          di dashboard → Pengaturan → Pembayaran dari pembeli.
        </p>
      )}

      <section className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Belum ada KWT.
          </p>
        )}

        {rows.map((r) => {
          const bills = openByKwt.get(r.kwtId) ?? [];
          return (
            <article
              key={r.kwtId}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{r.kwtName}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {r.hasPaymentChannel
                      ? "✅ Pembeli punya kanal bayar (rekening/QRIS)"
                      : "⚠️ Kanal bayar pembeli belum diisi"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    tagihan terakhir{" "}
                    {r.lastBilledAt ? formatDate(r.lastBilledAt) : "—"} · total
                    biaya layanan aktif {formatRupiah(r.totalAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {formatRupiah(r.unbilledAmount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    belum ditagih · {r.unbilledCount} pesanan
                  </p>
                  {r.outstandingAmount > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {formatRupiah(r.outstandingAmount)} belum lunas (
                      {r.outstandingCount} tagihan)
                    </p>
                  )}
                </div>
              </div>

              <form
                action={createFeeBill}
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
              >
                <input type="hidden" name="kwtId" value={r.kwtId} />
                <input
                  name="note"
                  placeholder="Catatan tagihan (opsional)"
                  className={`${inputCls} max-w-xs flex-1`}
                />
                <button
                  type="submit"
                  disabled={r.unbilledAmount <= 0}
                  title={
                    r.unbilledAmount > 0
                      ? "Terbitkan tagihan untuk seluruh biaya layanan yang belum ditagih"
                      : "Tidak ada biaya layanan baru untuk ditagih"
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Buat tagihan
                </button>
              </form>

              {bills.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {bills.map((b) => (
                    <li key={b.id} className="rounded-lg bg-amber-50/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium tabular-nums text-amber-900">
                          {formatRupiah(b.amount)}
                          <span className="ml-2 text-xs font-normal text-amber-800">
                            {b.feeCount} pesanan · dibuat{" "}
                            {formatDate(b.createdAt)}
                          </span>
                        </span>
                      </div>
                      {b.note && (
                        <p className="mt-1 text-xs text-amber-800">📝 {b.note}</p>
                      )}
                      <form
                        action={markFeeBillPaid}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="billId" value={b.id} />
                        <select
                          name="method"
                          defaultValue="transfer"
                          aria-label="Cara pelunasan"
                          className={`${inputCls} max-w-40`}
                        >
                          {SETTLEMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {settlementMethodLabel(m)}
                            </option>
                          ))}
                        </select>
                        <input
                          name="reference"
                          placeholder="No. referensi / bukti transfer"
                          className={`${inputCls} max-w-56 flex-1`}
                        />
                        <button
                          type="submit"
                          className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Tandai lunas
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <History className="h-4 w-4" />
          Riwayat tagihan
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400">
                    Belum ada tagihan diterbitkan.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{h.kwtName}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatRupiah(h.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      {h.paidAt ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Lunas
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Belum dibayar
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 sm:table-cell">
                      {h.paidAt
                        ? `${settlementMethodLabel(h.method)}${h.reference ? ` · ${h.reference}` : ""}`
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-400 md:table-cell">
                      {h.feeCount} pesanan · s/d {formatDateTime(h.settledThrough)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right text-xs text-slate-400 lg:table-cell">
                      dibuat {formatDateTime(h.createdAt)}
                      {h.paidAt ? ` · lunas ${formatDateTime(h.paidAt)}` : ""}
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
