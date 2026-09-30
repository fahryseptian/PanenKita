import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Landmark,
  Leaf,
  MessageCircle,
  PackageCheck,
  QrCode,
  ScrollText,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import { getDirectory, getPlatformStats } from "@/lib/queries-directory";
import { GroupCard } from "./katalog/group-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PanenKita — katalog panen Kelompok Tani Wanita",
};

const FEATURES = [
  {
    icon: Sprout,
    title: "Stok selalu segar",
    desc: "Setiap panen yang dicatat anggota langsung memperbarui katalog publik.",
  },
  {
    icon: TrendingUp,
    title: "Harga dinamis transparan",
    desc: "Harga menyesuaikan stok & permintaan, dengan alasan yang bisa dilihat siapa pun.",
  },
  {
    icon: MessageCircle,
    title: "Notifikasi WhatsApp",
    desc: "Pesanan baru, panen tercatat, dan perubahan harga dikirim instan ke pengurus.",
  },
  {
    icon: Landmark,
    title: "Bayar langsung ke KWT",
    desc: "Tunai saat mengambil, transfer ke rekening KWT, atau scan QRIS — tanpa perantara.",
  },
  {
    icon: Users,
    title: "Banyak kelompok, satu akun",
    desc: "Ketua & bendahara mengelola kelompok, anggota, dan undangan dari satu tempat.",
  },
  {
    icon: ScrollText,
    title: "Laporan & sertifikat",
    desc: "Rekap penjualan, panen, dan jalur zero-waste siap dicetak untuk laporan kelompok.",
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    title: "Anggota mencatat panen",
    desc: "Lewat HP, dalam hitungan detik. Kualitas & susut ikut tercatat.",
  },
  {
    icon: ShoppingBasket,
    title: "Katalog terbentuk sendiri",
    desc: "Stok dan harga jual ikut menyesuaikan, lengkap dengan jejak alasannya.",
  },
  {
    icon: PackageCheck,
    title: "Pembeli pesan tanpa akun",
    desc: "Cukup nama dan nomor WhatsApp. Pengurus langsung dapat notifikasi.",
  },
  {
    icon: QrCode,
    title: "Bayar langsung ke KWT",
    desc: "Uang masuk ke kelompok, bukan ke platform. PanenKita tidak menahan dana.",
  },
];

const FOR_KWT = [
  "Katalog online tayang otomatis setelah disetujui admin",
  "Harga jual menyesuaikan stok & permintaan, tanpa hitung manual",
  "Undang anggota lewat kode undangan, atur peran ketua/bendahara/anggota",
  "Rekap penjualan & panen untuk laporan kelompok",
  "Biaya layanan dihitung terbuka per transaksi — bukan potongan diam-diam",
];

const FOR_BUYER = [
  "Pesan tanpa membuat akun: cukup nama dan nomor WhatsApp",
  "Tahu persis panen terakhir dan sisa stok setiap produk",
  "Bayar ke rekening/QRIS kelompok sesuai petunjuk di halaman pesanan",
  "Kirim bukti bayar sekali klik ke pengurus via WhatsApp",
  "Cek status pesanan kapan saja lewat nomor pesanan + nomor WA",
];

export default async function HomePage() {
  const [stats, directory] = await Promise.all([
    getPlatformStats(),
    getDirectory(),
  ]);

  // Tampilkan kelompok yang paling siap dipesan lebih dulu.
  const highlights = [...directory]
    .sort(
      (a, b) =>
        b.availableProducts - a.availableProducts ||
        b.productCount - a.productCount ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf className="h-5 w-5" />
            </span>
            PanenKita
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <Link
              href="/katalog"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Katalog
            </Link>
            <a
              href="#cara-kerja"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Cara kerja
            </a>
            <a
              href="#untuk-kwt"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Untuk KWT
            </a>
            <Link
              href="/cek-pesanan"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Cek pesanan
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Masuk
            </Link>
            <Link href="/daftar-kwt" className="btn btn-primary btn-sm">
              Daftarkan KWT
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-surface relative overflow-hidden border-b border-slate-200/70">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="animate-rise">
            <span className="badge badge-brand border border-brand-200 px-4 py-1.5 text-sm">
              🌾 Dibuat untuk Kelompok Tani Wanita
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
              Hasil panen KWT Anda,{" "}
              <span className="text-brand-600">tampil profesional</span> dan
              laku lebih cepat
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Anggota mencatat panen dari HP, katalog publik terbarui otomatis,
              harga menyesuaikan stok & permintaan secara transparan, dan pesanan
              masuk lewat WhatsApp. Pembeli membayar{" "}
              <b className="text-slate-800">langsung ke kelompok Anda</b>.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/katalog" className="btn btn-primary btn-lg">
                Lihat katalog panen
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/daftar-kwt" className="btn btn-secondary btn-lg">
                Daftarkan KWT Anda — gratis
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { label: "kelompok tani wanita", value: stats.kwtCount, icon: Leaf },
                { label: "produk aktif", value: stats.productCount, icon: Sprout },
                { label: "anggota terdaftar", value: stats.memberCount, icon: Users },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <s.icon className="h-3.5 w-3.5 text-brand-500" />
                    {s.label}
                  </dt>
                  <dd className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
                    {s.value.toLocaleString("id-ID")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <OrderPreviewCard />
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara-kerja" className="scroll-mt-20 py-16 md:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Cara kerja
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Dari catatan panen sampai uang diterima kelompok
            </h2>
            <p className="mt-3 text-slate-600">
              Empat langkah, tanpa aplikasi tambahan dan tanpa pelatihan panjang.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="card card-pad card-hover animate-rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-slate-300">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {s.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitur */}
      <section className="border-y border-slate-100 bg-slate-50/70 py-16 md:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Fitur
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Yang membuat kelompok kecil bisa tampil seperti toko besar
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-pad card-hover">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Untuk KWT & pembeli */}
      <section id="untuk-kwt" className="scroll-mt-20 py-16 md:py-20">
        <div className="container-page grid gap-4 lg:grid-cols-2">
          <div className="card card-pad">
            <span className="badge badge-brand">Untuk kelompok</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Kelola penjualan kelompok tanpa ribet
            </h2>
            <ul className="mt-5 space-y-3">
              {FOR_KWT.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm text-slate-600">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/daftar-kwt" className="btn btn-primary btn-md mt-6">
              Mulai daftarkan kelompok
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="card card-pad">
            <span className="badge badge-muted">Untuk pembeli</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Belanja langsung dari petaninya
            </h2>
            <ul className="mt-5 space-y-3">
              {FOR_BUYER.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm text-slate-600">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/katalog" className="btn btn-secondary btn-md">
                Jelajahi katalog
              </Link>
              <Link href="/cek-pesanan" className="btn btn-ghost btn-md">
                Cek pesanan saya
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Kepercayaan pembayaran — sejalan dengan model dana langsung ke KWT */}
      <section className="border-y border-slate-100 bg-slate-900 py-16 text-white md:py-20">
        <div className="container-page grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="badge bg-white/10 text-brand-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Transparansi dana
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Uang Anda tidak pernah lewat PanenKita
            </h2>
            <p className="mt-3 text-slate-300">
              Kami membangun katalog dan alat kelola panennya — bukan menjadi
              perantara uang. Pembeli membayar langsung, kelompok yang menerima
              penuh.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Landmark,
                title: "Tanpa perantara",
                desc: "Transfer/QRIS menuju rekening kelompok, bukan rekening platform.",
              },
              {
                icon: MessageCircle,
                title: "Bukti bayar jelas",
                desc: "Pengurus menerima konfirmasi dan menandai pesanan sudah dibayar.",
              },
              {
                icon: ScrollText,
                title: "Biaya layanan terbuka",
                desc: "Yang dibayar kelompok ke platform ditampilkan sebagai tagihan berkala.",
              },
            ].map((c) => (
              <li
                key={c.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <c.icon className="h-5 w-5 text-brand-300" />
                <h3 className="mt-3 text-sm font-semibold">{c.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {c.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Kelompok pilihan */}
      {highlights.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Sudah bergabung
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  Pilih kelompok, lihat panen hari ini
                </h2>
              </div>
              <Link
                href="/katalog"
                className="btn btn-ghost btn-sm text-brand-700 hover:bg-brand-50"
              >
                Semua kelompok
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA akhir */}
      <section className="pb-20">
        <div className="container-page">
          <div className="card relative overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-white p-8 text-center sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight">
              Siap membuat katalog panen kelompok Anda?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Gratis untuk memulai. Catat panen pertama hari ini, katalognya
              tayang setelah disetujui admin.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/daftar-kwt" className="btn btn-primary btn-lg">
                Daftarkan KWT Anda
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/katalog" className="btn btn-neutral btn-lg">
                Lihat contoh katalog
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="container-page grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <span className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Leaf className="h-4 w-4" />
              </span>
              PanenKita
            </span>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
              Katalog panen untuk Kelompok Tani Wanita di seluruh Indonesia.
              Stok segar, harga jujur, dan pembayaran langsung ke kelompok.
            </p>
          </div>
          <nav>
            <h3 className="text-sm font-semibold text-slate-900">Untuk pembeli</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>
                <Link href="/katalog" className="hover:text-brand-700">
                  Katalog kelompok
                </Link>
              </li>
              <li>
                <Link href="/cek-pesanan" className="hover:text-brand-700">
                  Cek status pesanan
                </Link>
              </li>
            </ul>
          </nav>
          <nav>
            <h3 className="text-sm font-semibold text-slate-900">Untuk KWT</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>
                <Link href="/daftar-kwt" className="hover:text-brand-700">
                  Daftarkan kelompok
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-brand-700">
                  Masuk dashboard
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="container-page mt-10 border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-400">
            PanenKita — katalog panen untuk KWT 🌾
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Contoh kartu pesanan pembeli (statis, bukan data) supaya pengunjung langsung
 * paham alur bayar langsung ke KWT tanpa harus membuka katalog.
 */
function OrderPreviewCard() {
  return (
    <div className="animate-rise" style={{ animationDelay: "120ms" }}>
      <div className="card p-5 shadow-lg shadow-brand-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Pesanan
            </p>
            <p className="font-mono text-sm font-semibold">PK-20260930-AB12C</p>
          </div>
          <span className="badge badge-warn">Menunggu pembayaran</span>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {[
            { name: "Bayam hijau", qty: "3 ikat", price: "Rp18.000" },
            { name: "Telur ayam kampung", qty: "1 kg", price: "Rp28.000" },
          ].map((r) => (
            <div key={r.name} className="flex justify-between">
              <span className="text-slate-600">
                {r.name} <span className="text-slate-400">× {r.qty}</span>
              </span>
              <span className="tabular-nums">{r.price}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 font-bold">
          <span>Total</span>
          <span className="tabular-nums text-brand-700">Rp46.000</span>
        </div>

        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Landmark className="h-4 w-4" /> Cara bayar
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Transfer bank
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              BRI 003401011234567
            </p>
            <p className="text-xs text-slate-500">a/n KWT Mekar Sari</p>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <QrCode className="h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">
              atau pindai <b>QRIS kelompok</b> senilai Rp46.000
            </p>
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4" />
            Konfirmasi bukti bayar
          </p>
        </div>
      </div>

      <div className="card mt-4 flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <p className="text-xs leading-relaxed text-slate-500">
          Uang masuk langsung ke rekening kelompok. PanenKita tidak menyimpan
          dana pembeli.
        </p>
      </div>
    </div>
  );
}
