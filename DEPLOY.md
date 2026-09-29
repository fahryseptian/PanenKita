# Deploy TaniKita — Vercel + Neon Postgres

Panduan deploy produksi lengkap. Perkiraan waktu: 15 menit, tanpa kartu kredit.

---

## 1. Neon Postgres

1. Buka **https://neon.tech** → Sign up (bisa pakai akun GitHub `fahryseptian`).
2. **Create project** → nama `tanikita`, region terdekat: `Singapore (aws ap-southeast-1)`.
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
> (`tanikita123`). Untuk produksi, jalankan seed hanya jika ingin data demo,
> lalu **ganti password** akun demo, atau skip seed dan daftarkan KWT lewat UI.

---

## 2. Vercel

1. Buka **https://vercel.com/new** (login pakai GitHub).
2. **Import** repo `fahryseptian/PanenKita` (nama repo bebas; brand aplikasi = TaniKita).
3. Vercel mendeteksi Next.js otomatis. Sebelum Deploy, buka
   **Environment Variables** dan isi:

### Checklist Environment Variables

| Variabel | Wajib? | Nilai | Catatan |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Connection string **pooled** Neon | Wajib ada `?sslmode=require` |
| `BETTER_AUTH_SECRET` | ✅ | `openssl rand -base64 32` | Jangan pakai fallback dev |
| `BETTER_AUTH_URL` | ✅ | `https://tanikita.vercel.app` | URL final setelah deploy pertama |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://tanikita.vercel.app` | Sama dengan atas |
| `CRON_SECRET` | ✅ (cron) | `openssl rand -hex 32` | Vercel kirim otomatis sbg `Bearer` |
| `CRON_SHARED_SECRET` | ✅ (cron) | **sama dengan** `CRON_SECRET` | Dicek `/api/pricing/recompute` |
| `FONTE_TOKEN` | ⬜ | Token device console.fonnte.com | Kosong = WA nonaktif, app tetap jalan |
| `MIDTRANS_SERVER_KEY` | ⬜ | Dashboard sandbox/production Midtrans | Kosong = bayar online nonaktif |
| `MIDTRANS_CLIENT_KEY` | ⬜ | Pasangan server key | Untuk Snap.js di klien |
| `MIDTRANS_IS_PRODUCTION` | ⬜ | `true` jika production key | Default sandbox |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⬜ | Google Cloud Console | Kosong = login Google hilang |
| `PILOT_ACCESS_CODE` | ⬜ | Kode rahasia | Kosong = signup terbuka |
| `OPEN_DATA_API_KEY` | ⬜ | `openssl rand -hex 24` | Kosong = open data nonaktif (501) |

4. Klik **Deploy** (± 2–3 menit).

---

## 3. Setelah deploy pertama

1. Salin URL final (mis. `https://tanikita-xxx.vercel.app` atau custom domain).
2. Update env `BETTER_AUTH_URL` dan `NEXT_PUBLIC_APP_URL` dengan URL final →
   **Deployments → Redeploy** (env baru hanya berlaku di build/deploy baru).
3. Uji cepat:
   - `/` landing + `/katalog` direktori tampil
   - Signup + daftar KWT baru
   - Login → dashboard → tambah produk → panen
   - Katalog publik → pesan → pesanan muncul di dashboard

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
    https://tanikita-xxx.vercel.app/api/pricing/recompute
  # -> {"ok":true,"checked":N,"updated":M}

  curl -H "x-cron-secret: $CRON_SHARED_SECRET" \
    https://tanikita-xxx.vercel.app/api/orders/expire
  # -> {"ok":true,"expired":N,"checked":N}
  ```

## 4b. Health check

`GET /api/health` — 200 + `db:up` bila database terjangkau, 503 bila gagal.
Daftarkan ke UptimeRobot/BetterStack untuk monitoring gratis.

---

## 5. Midtrans production nanti

Saat sudah siap menerima pembayaran online:

1. Verifikasi identitas di **dashboard.midtrans.com** (production).
2. Isi `MIDTRANS_*` env dengan **production keys** + `MIDTRANS_IS_PRODUCTION=true`.
3. **Settings → Configuration → Payment Notification URL**:
   `https://<domain>/api/payment/webhook`
4. Tombol "Bayar online" otomatis muncul di katalog (kondisional `isMidtransEnabled()`).

## 6. Fonnte (WhatsApp) nanti

1. Daftar **console.fonnte.com**, hubungkan nomor WA, salin token device.
2. Isi `FONTE_TOKEN` di Vercel → redeploy.
3. Monitor keberhasilan kirim: dashboard → **Profil WA → kirim tes**, dan tabel
   `notifications` mencatat setiap pesan beserta statusnya.
