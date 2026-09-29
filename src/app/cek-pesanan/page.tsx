import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwts, orders } from "@/lib/db/schema";
import { formatRupiah, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cek Pesanan" };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Menunggu pembayaran", cls: "bg-amber-50 text-amber-700" },
  paid: { text: "Dibayar — sedang disiapkan", cls: "bg-brand-50 text-brand-700" },
  processing: { text: "Disiapkan", cls: "bg-brand-50 text-brand-700" },
  completed: { text: "Selesai", cls: "bg-brand-50 text-brand-700" },
  cancelled: { text: "Dibatalkan", cls: "bg-red-50 text-red-600" },
  expired: { text: "Kedaluwarsa — silakan pesan ulang", cls: "bg-red-50 text-red-600" },
};

export default async function CekPesananPage({
  searchParams,
}: {
  searchParams: Promise<{ nomor?: string; hp?: string }>;
}) {
  const { nomor, hp } = await searchParams;

  const orderNumber = nomor?.trim().toUpperCase();
  const phoneDigits = hp?.replace(/\D/g, "").replace(/^62/, "0") ?? "";

  // Cari pesanan hanya jika kedua input terisi (pencarian butuh dua faktor).
  let result: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: Date;
    kwtSlug: string;
    kwtName: string;
  } | null = null;
  let notFound = false;

  if (orderNumber && phoneDigits) {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        kwtSlug: kwts.slug,
        kwtName: kwts.name,
      })
      .from(orders)
      .innerJoin(kwts, eq(orders.kwtId, kwts.id))
      .where(
        and(
          eq(orders.orderNumber, orderNumber),
          // Pencocokan longgar: 0812... atau 62812... sama saja.
          eq(orders.buyerPhone, phoneDigits.startsWith("0") ? `62${phoneDigits.slice(1)}` : phoneDigits),
        ),
      )
      .limit(1);
    if (rows[0]) {
      result = rows[0];
    } else {
      notFound = true;
    }
  }

  const status = result ? (STATUS_LABEL[result.status] ?? STATUS_LABEL.pending!) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center px-4 py-4">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            ← PanenKita
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-xl font-bold">Cek status pesanan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Masukkan nomor pesanan (mis. PK-20260101-AB12C) dan nomor WhatsApp yang Anda
          pakai saat memesan.
        </p>

        <form method="get" className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="nomor" className="mb-1 block text-sm font-medium text-slate-700">
              Nomor pesanan
            </label>
            <input
              id="nomor"
              name="nomor"
              required
              defaultValue={orderNumber ?? ""}
              placeholder="PK-..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="hp" className="mb-1 block text-sm font-medium text-slate-700">
              Nomor WhatsApp
            </label>
            <input
              id="hp"
              name="hp"
              required
              inputMode="tel"
              defaultValue={hp ?? ""}
              placeholder="081234567890"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            Cari pesanan
          </button>
        </form>

        {notFound && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            Pesanan tidak ditemukan. Pastikan nomor pesanan dan nomor WhatsApp sesuai
            saat memesan.
          </p>
        )}

        {result && status && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">{result.kwtName}</p>
            <h2 className="mt-1 text-lg font-bold">{result.orderNumber}</h2>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${status.cls}`}>
              {status.text}
            </span>
            <p className="mt-4 text-sm text-slate-500">
              Total <b className="text-brand-700">{formatRupiah(result.total)}</b> ·{" "}
              {formatDateTime(result.createdAt)}
            </p>
            <Link
              href={`/katalog/${result.kwtSlug}/pesan/${result.id}`}
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
            >
              Buka halaman pesanan →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
