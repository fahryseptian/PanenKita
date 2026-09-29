import Link from "next/link";
import { ArrowRight, Leaf, MessageCircle, TrendingUp, Wallet } from "lucide-react";

const FEATURES = [
  {
    icon: Leaf,
    title: "Stok selalu segar",
    desc: "Setiap panen yang dicatat anggota langsung memperbarui katalog.",
  },
  {
    icon: TrendingUp,
    title: "Harga dinamis transparan",
    desc: "Harga menyesuaikan stok & permintaan, dengan alasan yang bisa dilihat siapa pun.",
  },
  {
    icon: MessageCircle,
    title: "Notifikasi WhatsApp",
    desc: "Pesanan, panen, dan perubahan harga dikirim instan ke WhatsApp.",
  },
  {
    icon: Wallet,
    title: "Pembayaran digital",
    desc: "QRIS, e-wallet, dan transfer via Midtrans Snap — konfirmasi otomatis.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf className="h-5 w-5" />
          </span>
          TaniKita
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Masuk
          </Link>
          <Link
            href="/katalog"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Lihat Katalog <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            🌾 Dibuat untuk Kelompok Tani Wanita
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
            Hasil panen KWT Anda,{" "}
            <span className="text-brand-600">tampil profesional</span> di katalog
            online
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Anggota mencatat panen dari HP, katalog publik otomatis terbarui,
            harga menyesuaikan stok & permintaan secara transparan, dan pesanan
            masuk lewat WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/katalog"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Lihat Katalog <ArrowRight className="h-5 w-5" />
            </Link>
          <Link
            href="/daftar-kwt"
            className="rounded-xl border border-brand-200 bg-brand-50 px-6 py-3 font-semibold text-brand-700 hover:bg-brand-100"
          >
            Daftarkan KWT Anda — gratis
          </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        TaniKita — katalog panen untuk KWT 🌾
      </footer>
    </div>
  );
}
