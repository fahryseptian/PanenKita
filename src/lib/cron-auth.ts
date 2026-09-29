import { NextResponse } from "next/server";

/**
 * Autentikasi endpoint cron (expire pesanan, recompute harga, dsb).
 *
 * - Produksi: `CRON_SHARED_SECRET` WAJIB ada. Bila kosong, request ditolak
 *   (fail closed) supaya endpoint tidak bisa dipicu siapa pun — bukan sekadar
 *   dicatat di log seperti sebelumnya.
 * - Dev: secret kosong diizinkan agar mudah diuji manual.
 *
 * Header yang diterima: `x-cron-secret`, atau `Authorization: Bearer <secret>`
 * (format yang dikirim Vercel Cron / cron-job.org).
 */
export function checkCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SHARED_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron] CRON_SHARED_SECRET belum diset — menolak request di produksi",
      );
      return NextResponse.json(
        { error: "cron secret not configured" },
        { status: 503 },
      );
    }
    console.warn("[cron] CRON_SHARED_SECRET belum diset; diizinkan di dev");
    return null;
  }

  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
