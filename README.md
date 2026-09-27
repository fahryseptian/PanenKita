# PanenKita 🌾

Platform katalog panen untuk **KWT (Kelompok Tani Wanita)**: anggota mencatat hasil panen, katalog publik menampilkan produk beserta stok dan harga, pesanan masuk lewat WhatsApp, dan pembayaran digital via Midtrans Snap. Harga jual disesuaikan otomatis oleh **Dynamic Pricing Engine** berbasis stok & permintaan — transparan dengan jejak audit.

## Fitur per fase

- **Fase 1 — MVP**: basis data (Drizzle/Neon), autentikasi + peran (ketua/bendahara/anggota), katalog publik, CRUD produk, input panen.
- **Fase 2**: intake pesanan (nama + nomor WA, tanpa akun), Dynamic Pricing Engine (aturan stok & permintaan), notifikasi WhatsApp instan via Fonnte.
- **Fase 3**: pembayaran Midtrans Snap + webhook terverifikasi, audit mobile-responsive, halaman panduan & formulir umpan balik pilot.

## Struktur

```
kwt/
  src/app            Next.js App Router (katalog publik, dashboard, API)
  src/lib            pricing engine, stok, WhatsApp, Midtrans, auth, validasi
  src/lib/db         skema Drizzle + klien database
  drizzle            migrasi yang dihasilkan drizzle-kit
  tests              unit test Vitest (pricing, stok, validasi, Midtrans)
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

## Integrasi

### WhatsApp (Fonnte)
1. Daftar di https://console.fonnte.com, buat device, scan QR.
2. Isi `FONTE_TOKEN` di env. Notifikasi otomatis: panen dicatat (→ admin), harga berubah (→ anggota opt-in), pesanan baru (→ admin), konfirmasi pesanan (→ pembeli).
3. Kiriman uji: tombol di dashboard → anggota.

### Pembayaran (Midtrans Snap)
1. Buat akun, ambil `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` (sandbox dulu).
2. Set `MIDTRANS_IS_PRODUCTION=false` selama uji, `true` saat produksi.
3. Buat webhook (Payment Notification) ke `https://domain-anda/api/payment/webhook` — HTTP POST dengan `order_id`, `status_code`, `gross_amount`, `signature_key`; verifikasi sha512 otomatis, idempoten.

## Development

```bash
npm run test         # unit test
npm run typecheck    # tsc --noEmit
npm run build        # production build
```
