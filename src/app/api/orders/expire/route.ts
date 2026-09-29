import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/order-expiry";
import { runDueHarvestSchedules } from "@/lib/harvest-schedule-runner";

export const dynamic = "force-dynamic";

/**
 * Pembatalan otomatis pesanan pending yang lewat batas waktu.
 * Dipanggil Vercel Cron (harian — lihat vercel.json), scheduler eksternal,
 * atau lazy dari dashboard (after()) pada plan Hobby.
 * Proteksi: header x-cron-secret / Bearer CRON_SHARED_SECRET (opsional di dev).
 *
 * GET /api/orders/expire -> { ok, expired, checked }
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SHARED_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    // Vercel Cron otomatis mengirim `Authorization: Bearer $CRON_SECRET`.
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!secret) {
    console.warn("[orders-expire] CRON_SHARED_SECRET not set; allowing request (dev mode)");
  }

  const result = await expireStaleOrders();
  // Piggyback: jadwal panen berulang ikut jalan tiap tick cron/lazy ini.
  const schedule = await runDueHarvestSchedules(new Date().getUTCDay()).catch(
    (err) => {
      console.error("[orders-expire] schedule run failed", err);
      return { executed: 0, notified: 0 };
    },
  );
  return NextResponse.json({ ok: true, ...result, ...schedule });
}
