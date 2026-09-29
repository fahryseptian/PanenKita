import Link from "next/link";
import { Check, RotateCcw, X } from "lucide-react";
import { listKwts, getKwtCounts } from "@/lib/admin-queries";
import {
  approveKwt,
  rejectKwt,
  resetKwtToPending,
} from "@/lib/actions/superadmin";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
  { key: "all", label: "Semua" },
];

export default async function AdminKwtPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = TABS.some((t) => t.key === status) ? status! : "all";
  const [rows, counts] = await Promise.all([
    listKwts(active === "all" ? undefined : active),
    getKwtCounts(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Kelompok KWT</h1>
        <p className="mt-1 text-sm text-slate-500">
          Setujui kelompok baru sebelum tampil di katalog publik.
        </p>
      </header>

      <nav className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/kwt?status=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              active === t.key
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Tidak ada kelompok pada kategori ini.
          </p>
        )}

        {rows.map((k) => {
          const c = counts.get(k.id) ?? { products: 0, members: 0 };
          return (
            <div
              key={k.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{k.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : k.status === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-600"
                      }`}
                    >
                      {k.status === "approved"
                        ? "Disetujui"
                        : k.status === "pending"
                          ? "Menunggu"
                          : "Ditolak"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[k.regency, k.province].filter(Boolean).join(", ") || "—"}
                    {" · "}
                    {c.products} produk · {c.members} anggota
                  </p>
                  {k.creatorEmail && (
                    <p className="mt-1 text-xs text-slate-400">
                      Ketua: {k.creatorName} ({k.creatorEmail}
                      {k.creatorPhone ? ` · WA ${k.creatorPhone}` : ""})
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    Didaftarkan {formatDate(k.createdAt)} ·{" "}
                    <Link
                      href={`/katalog/${k.slug}`}
                      className="hover:text-brand-600 hover:underline"
                    >
                      /katalog/{k.slug}
                    </Link>
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {k.status !== "approved" && (
                    <form action={approveKwt}>
                      <input type="hidden" name="kwtId" value={k.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        <Check className="h-4 w-4" />
                        Setujui
                      </button>
                    </form>
                  )}
                  {k.status !== "rejected" && k.status !== "pending" && (
                    <form action={resetKwtToPending}>
                      <input type="hidden" name="kwtId" value={k.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                        title="Kembalikan ke menunggu persetujuan"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Pending
                      </button>
                    </form>
                  )}
                  {k.status !== "rejected" && (
                    <form action={rejectKwt}>
                      <input type="hidden" name="kwtId" value={k.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-100 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Tolak
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
