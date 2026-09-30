# PanenKita 🌾

Platform katalog panen untuk **KWT (Kelompok Tani Wanita)**: anggota mencatat hasil panen, katalog publik menampilkan produk beserta stok dan harga, pesanan masuk lewat WhatsApp, dan pembeli **membayar langsung ke KWT** (tunai, transfer, atau QRIS). PanenKita **tidak memegang uang pembeli** — pendapatannya adalah biaya layanan per transaksi yang ditagihkan ke KWT. Harga jual disesuaikan otomatis oleh **Dynamic Pricing Engine** berbasis stok & permintaan — transparan dengan jejak audit.

## Fitur per fase

- **Fase 1 — MVP**: basis data (Drizzle/Neon), autentikasi + peran (ketua/bendahara/anggota), katalog publik, CRUD produk, input panen.
- **Fase 2**: intake pesanan (nama + nomor WA, tanpa akun), Dynamic Pricing Engine (aturan stok & permintaan), notifikasi WhatsApp instan via Fonnte.
- **Fase 3**: pembayaran pembeli langsung ke KWT (rekening + QRIS di halaman pesanan), audit mobile-responsive, halaman panduan & formulir umpan balik pilot.
- **Fase 4 — operasional & ketahanan**: pesanan pending kedaluwarsa otomatis (stok tak terkunci), rate limiting API publik, pengaturan profil KWT + rotasi kode undangan, manajemen anggota lengkap (hapus/keluar/transfer ketua), peringatan WA stok habis (dedupe 24 jam), override aturan harga per produk dari UI, cek status pesanan untuk pembeli (`/cek-pesanan`), ekspor CSV panen & produk, health endpoint `/api/health`, security headers, dan PWA manifest.

## Struktur

```
kwt/
  src/app            Next.js App Router (katalog publik, dashboard, API)
  src/lib            pricing engine, stok, WhatsApp, Midtrans, auth, validasi
  src/lib/db         skema Drizzle + klien database
  drizzle            migrasi yang dihasilkan drizzle-kit
  tests              unit test Vitest (pricing, stok, validasi, pembayaran)
```

## Local setup

```bash
cd kwt
npm install

# 1. Database (Neon free tier)
cp .env.example .env   # isi DATABASE_URL
npm run db:push

# 2. Data contoh (1 KWT + produk + panen + admin)
npm run db:seed        # lihat src/db/seed.ts untuk kredensial demo

# 3. Aplikasi web
npm run dev            # http://localhost:3000
```

## Deploy

### Web (Vercel)
1. Import repo, set root directory ke `kwt`.
2. Isi semua env dari `.env.example` (Production + Preview).
3. Deploy, arahkan `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` ke domain Anda.

### Cron recompute harga (opsional, Fase 2)
Buat Vercel Cron yang memanggil `GET /api/pricing/recompute` setiap 15 menit dengan header `x-cron-secret` (isi `CRON_SHARED_SECRET`). Harga juga dihitung ulang otomatis setiap panen dicatat / pesanan berubah status.

### Cron kedaluwarsa pesanan (Fase 4)
`vercel.json` sudah memuat cron `GET /api/orders/expire` tiap 15 menit: pesanan pending yang melewati batas 24 jam (kolom `orders.expires_at`) dibatalkan otomatis (status `expired`), stok kembali, harga dihitung ulang, dan pengurus dapat WA. Batas waktu dapat diubah lewat `ORDER_PENDING_HOURS` di `src/lib/validation.ts`.

## Integrasi

### WhatsApp (Fonnte)
1. Daftar di https://console.fonnte.com, buat device, scan QR.
2. Isi `FONTE_TOKEN` di env. Notifikasi otomatis: panen dicatat (→ admin), harga berubah (→ anggota opt-in), pesanan baru (→ admin), konfirmasi pesanan (→ pembeli).
3. Kiriman uji: tombol di dashboard → anggota.

### Pembayaran (langsung ke KWT)
1. Pengurus mengisi rekening dan/atau gambar QRIS di **dashboard → Pengaturan → Pembayaran dari pembeli**.
2. Pembeli melihat petunjuk bayar itu di halaman pesanannya, lalu mengirim bukti bayar via WhatsApp ke pengurus.
3. Pengurus menandai pembayaran di **dashboard → Pesanan** (tunai/transfer) — biaya layanan platform otomatis tercatat di ledger.
4. Superadmin menagih biaya layanan di `/admin/settlement` (isi rekening platform dulu di `/admin/pengaturan`).

## Development

```bash
npm run test         # unit test
npm run typecheck    # tsc --noEmit
npm run build        # production build
```
