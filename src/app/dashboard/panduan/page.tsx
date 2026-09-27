import { requireKwtContext } from "@/lib/session";
import {
  getDashboardOverview,
  getFeedback,
  getNotifications,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Panduan & Pilot" };

export default async function GuidePage() {
  const ctx = await requireKwtContext();
  const [overview, notifs, feedbackRows] = await Promise.all([
    getDashboardOverview(ctx.kwtId),
    getNotifications(ctx.kwtId, 50),
    getFeedback(ctx.kwtId, 10),
  ]);

  const waSent = notifs.filter((n) => n.sent).length;
  const waFailed = notifs.length - waSent;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Panduan & Pilot</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cara memakai PanenKita + metrik uji coba terbatas untuk KWT Anda.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">🌾 Panduan anggota</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Login dengan akun dari pengurus.</li>
          <li>
            Buka <b>Panen</b> → pilih produk, isi jumlah & kualitas → <b>Catat panen</b>.
          </li>
          <li>Stok katalog bertambah otomatis; harga menyesuaikan diri.</li>
          <li>
            Atur nomor WA di <b>Profil</b> agar menerima kabar perubahan harga.
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">🧺 Panduan pengurus (ketua/bendahara)</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            Tambah produk di <b>Produk</b> (nama, satuan, harga dasar).
          </li>
          <li>
            Bagikan kode undangan (menu <b>Anggota</b>) ke calon anggota.
          </li>
          <li>
            Pantau <b>Pesanan</b>: konfirmasi pembayaran tunai, ubah status
            (proses → selesai), atau batalkan.
          </li>
          <li>
            Menu <b>Harga</b> menampilkan aturan engine + jejak audit setiap perubahan.
          </li>
          <li>
            Katalog publik: <code className="rounded bg-slate-100 px-1">/katalog/{ctx.kwtSlug}</code>{" "}
            — bagikan ke pembeli via WA/grup.
          </li>
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Panen tercatat (30 hari)", value: overview.harvest30d },
          { label: "Pesanan pending", value: overview.pendingOrders },
          { label: "WA terkirim", value: waSent },
          { label: "WA gagal", value: waFailed },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-bold tabular-nums">{m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </section>

      <FeedbackSection kwtId={ctx.kwtId} feedbackRows={feedbackRows} />
    </div>
  );
}

function FeedbackSection({
  kwtId,
  feedbackRows,
}: {
  kwtId: string;
  feedbackRows: Awaited<ReturnType<typeof getFeedback>>;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">💬 Umpan balik pilot</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sampaikan kendala atau saran — ini membantu pengembangan berikutnya.
        </p>
        <div className="mt-3">
          <FeedbackForm />
        </div>
      </div>

      {feedbackRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold">Umpan balik masuk</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {feedbackRows.map((f) => (
              <div key={f.id} className="px-5 py-3">
                <p className="text-sm">
                  <span className="mr-2">{"⭐".repeat(f.rating)}</span>
                  {f.message}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {f.userName ?? "Anonim"} · {formatDateTime(f.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
