# Deploy PanenKita — Vercel + Neon Postgres

Panduan deploy produksi lengkap. Perkiraan waktu: 15 menit, tanpa kartu kredit.

---

## 1. Neon Postgres

1. Buka **https://neon.tech** → Sign up (bisa pakai akun GitHub `fahryseptian`).
2. **Create project** → nama `panenkita`, region terdekat: `Singapore (aws ap-southeast-1)`.
3. Buka **Dashboard → Connection string** → salin string **pooled** (berisi `-pooler`):
   ```
   postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   > Selalu pakai connection string **pooled** untuk Vercel serverless.

### Push schema

Dari folder `kwt/` (DATABASE_URL sementara di `kwt/.env`):

```bash
npm run db:push
```

> ℹ️ Fase 4 menambah kolom `orders.expires_at`, enum status `expired`, dan enum
> notifikasi baru (`order_created`, `stock_out`, `order_expired`). Jalankan
> `db:push` sekali lagi setelah update ini; pesanan lama yang masih pending tanpa
> `expires_at` tidak akan pernah kedaluwarsa (aman).

### Seed (opsional, untuk demo/pilot)

```bash
npm run db:seed
```

> ⚠️ Seed membuat 2 KWT demo dengan akun demo berpassword publik
> (`panenkita123`). Untuk produksi, jalankan seed hanya jika ingin data demo,
> lalu **ganti password** akun demo, atau skip seed dan daftarkan KWT lewat UI.

---

## 2. Vercel

1. Buka **https://vercel.com/new** (login pakai GitHub).
2. **Import** repo `fahryseptian/PanenKita` (nama repo bebas; brand aplikasi = PanenKita).
3. Vercel mendeteksi Next.js otomatis. Sebelum Deploy, buka
   **Environment Variables** dan isi:

### Checklist Environment Variables

| Variabel | Wajib? | Nilai | Catatan |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Connection string **pooled** Neon | Wajib ada `?sslmode=require` |
| `BETTER_AUTH_SECRET` | ✅ | `openssl rand -base64 32` | Jangan pakai fallback dev |
| `BETTER_AUTH_URL` | ✅ | `https://panenkita.vercel.app` | URL final setelah deploy pertama |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://panenkita.vercel.app` | Sama dengan atas |
| `CRON_SECRET` | ✅ (cron) | `openssl rand -hex 32` | Vercel kirim otomatis sbg `Bearer` |
| `CRON_SHARED_SECRET` | ✅ (cron) | **sama dengan** `CRON_SECRET` | Dicek `/api/pricing/recompute` |
| `FONTE_TOKEN` | ⬜ | Token device console.fonnte.com | Kosong = WA nonaktif, app tetap jalan |
| `RESEND_API_KEY` | ⬜ | Dashboard Resend → API Keys | Kosong = email transaksional nonaktif (reset sandi tetap jalan via WA) |
| `EMAIL_FROM` | ⬜ | `PanenKita <notifikasi@domainAnda.id>` | Wajib setelah domain diverifikasi; default `onboarding@resend.dev` (hanya bisa ke email pemilik akun) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⬜ | Google Cloud Console | Kosong = login Google hilang |
| `OPEN_DATA_API_KEY` | ⬜ | `openssl rand -hex 24` | Kosong = open data nonaktif (501) |
| `API_INDONESIA_KEY` | ⬜ | dashboard.apiindonesia.id | Kosong = dropdown wilayah tetap jalan dari cache DB; bisa juga diisi di `/admin/pengaturan` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_ENDPOINT_URL_S3` / `NEON_UPLOADS_BUCKET` | ⬜ | Kredensial S3-compatible (Neon Object Storage) | Kosong = unggah foto produk/QRIS nonaktif (masih bisa tempel tautan) |

> **Model pembayaran (penting):** PanenKita **tidak memegang uang pembeli** dan
> tidak punya kanal pembayaran sendiri. Pembeli membayar **langsung ke KWT**
> (tunai saat mengambil, transfer ke rekening KWT, atau scan QRIS KWT). Karena
> itu **tidak ada `MIDTRANS_*`** — kanal pembayaran platform sudah dihapus.
> Pengurus mengisi rekening/QRIS di **dashboard → Pengaturan → Pembayaran dari
> pembeli**, dan pembeli melihatnya di halaman pesanan.
>
> Pendapatan platform berasal dari **biaya layanan per transaksi terbayar**
> (komisi + handling, `platform_fees`) yang **ditagihkan ke KWT** — bukan
> dipotong dari uang pembeli. Buat tagihan & tandai lunas di
> `/admin/settlement`; tujuan transfer pelunasan diatur di
> `/admin/pengaturan → Rekening platform`.

> **Perilaku cron sejak pembaruan:** bila `CRON_SHARED_SECRET` kosong di
> produksi, `/api/orders/expire` dan `/api/pricing/recompute` **menolak semua
> request (503)** — bukan lagi diizinkan dengan peringatan. Set secret-nya
> sebelum menyalakan cron.
>
> **Pemeriksaan konfigurasi:** `GET /api/health` mengembalikan `config.missingRequired`
> (daftar nama env wajib yang belum diisi) tanpa pernah menampilkan nilainya.
>
> **Email (Resend):** reset kata sandi dikirim lewat **email + WhatsApp** (mana
> pun yang tersedia). Verifikasi domain di dashboard Resend, lalu set
> `EMAIL_FROM`. Cek kesiapan tanpa mengirim pesan:
>
> ```bash
> npx tsx scripts/check-email.ts
> ```

4. Klik **Deploy** (± 2–3 menit).

---

## 3. Setelah deploy pertama

1. Salin URL final (mis. `https://panenkita-xxx.vercel.app` atau custom domain).
2. Update env `BETTER_AUTH_URL` dan `NEXT_PUBLIC_APP_URL` dengan URL final →
   **Deployments → Redeploy** (env baru hanya berlaku di build/deploy baru).
3. **Buat superadmin pertama** (satu kali, dari mesin lokal yang punya akses DB):

   ```bash
   # daftar dulu lewat /signup di situs produksi, lalu:
   npm run promote:superadmin -- admin@emailAnda.com
   # batalkan bila salah orang:
   npm run promote:superadmin -- admin@emailAnda.com --revoke
   ```

   Login berikutnya langsung diarahkan ke `/admin` — pantau GMV & fee, setujui
   KWT baru, kelola pengguna, dan atur token WA/API wilayah.

4. Catatan moderasi KWT: kelompok yang mendaftar berstatus **menunggu** dan
   belum tampil di `/katalog` sampai disetujui di `/admin/kwt` (pembuatnya
   otomatis dikabari lewat WhatsApp bila nomornya terdaftar).

5. Operasional biaya layanan (arah dana: KWT → platform):
   - **Rekening platform** diisi di `/admin/pengaturan` → *Rekening platform*
     (tujuan transfer pelunasan; tampil di halaman tagihan).
   - **Terbitkan tagihan** di `/admin/settlement`: kartu per KWT menampilkan
     biaya layanan yang belum ditagih; tombol *Buat tagihan* mengunci jumlah itu
     menjadi satu tagihan. Baris fee yang dibalik karena refund/pembatalan tidak
     ikut dihitung.
   - **Tandai lunas** pada tagihan terbuka setelah uang masuk, sekaligus catat
     **cara** (transfer/tunai/otomatis) + **nomor referensi**.
   - **Kanal bayar KWT** (rekening/QRIS pembeli) diisi pengurus di
     `/dashboard/pengaturan`; halaman tagihan memperingatkan KWT yang belum
     mengisinya karena pembelinya tidak melihat petunjuk bayar.
   - **Sinkronisasi ledger**: bila ada pesanan terbayar yang fee-nya belum
     tercatat, `/admin` menampilkan peringatan kuning dengan tombol
     *Sinkronkan ledger fee* (idempoten). Dari CLI:
     ```bash
     npm run backfill:fees -- --dry-run   # lihat dulu
     npm run backfill:fees                # catat yang hilang
     ```
   - Ekspor CSV `/api/admin/export?type=fees` menyertakan kolom `Status`
     (Aktif/Dibatalkan) supaya jejak audit refund tetap utuh, dan
     `?type=settlements` mengekspor tagihan beserta status Lunas/Belum dibayar.

6. Uji cepat:
   - `/` landing + `/katalog` direktori tampil
   - Signup + daftar KWT baru → muncul di `/admin/kwt` sebagai menunggu
   - Setujui → katalog publik memuat kelompok tersebut
   - Login → dashboard → tambah produk → panen
   - Katalog publik → pesan → pesanan muncul di dashboard
   - Lupa kata sandi → tautan reset terkirim via WhatsApp (butuh `FONTE_TOKEN`)

---

## 4. Cron recompute harga

Sudah dikonfigurasi di `vercel.json`:

```json
{ "crons": [{ "path": "/api/pricing/recompute", "schedule": "0 2 * * *" }] }
```

- Menjalankan **GET /api/pricing/recompute setiap hari 02:00 UTC** (09:00 WIB).
- Vercel mengirim header `Authorization: Bearer $CRON_SECRET` otomatis —
  route membandingkannya dengan `CRON_SHARED_SECRET`.
- Vercel Hobby: cron harian gratis (1 cron). Pro: unlimited + sub-menit.
- Cron kedua: `GET /api/orders/expire` tiap 15 menit (lihat `vercel.json`) —
  membatalkan pesanan pending yang lewat batas waktu.
- Uji manual:

  ```bash
  curl -H "x-cron-secret: $CRON_SHARED_SECRET" \
    https://panenkita-xxx.vercel.app/api/pricing/recompute
  # -> {"ok":true,"checked":N,"updated":M}

  curl -H "x-cron-secret: $CRON_SHARED_SECRET" \
    https://panenkita-xxx.vercel.app/api/orders/expire
  # -> {"ok":true,"expired":N,"checked":N}
  ```

## 4b. Health check

`GET /api/health` — 200 + `db:up` bila database terjangkau, 503 bila gagal.
Daftarkan ke UptimeRobot/BetterStack untuk monitoring gratis.

---

## 5. Pembayaran online per KWT (rencana berikutnya)

Saat ini pembeli membayar langsung ke KWT (tunai/transfer/QRIS), sehingga
platform tidak menyimpan uang siapa pun. Bila nanti satu KWT ingin menerima
pembayaran online otomatis:

1. KWT membuat akun penyedia pembayaran **atas namanya sendiri** (merchant of
   record = KWT), lalu menyimpan kredensialnya **per KWT** — bukan satu kunci
   global di env platform.
2. Webhook penyedia menandai pesanan lunas; biaya layanan platform tetap
   ditagihkan lewat `/admin/settlement` seperti sekarang.

Jangan menyalakan kanal pembayaran level platform: itu membuat platform
memegang dana KWT (rekonsiliasi, refund, dan soal perizinan).

Untuk volume besar, opsi paling praktis adalah **QRIS statis milik KWT**
(sudah didukung: gambar QRIS diunggah di dashboard).

## 6. Fonnte (WhatsApp) nanti

1. Daftar **console.fonnte.com**, hubungkan nomor WA, salin token device.
2. Isi `FONTE_TOKEN` di Vercel → redeploy.
3. Monitor keberhasilan kirim: dashboard → **Profil WA → kirim tes**, dan tabel
   `notifications` mencatat setiap pesan beserta statusnya.
