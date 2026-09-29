import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/order-expiry";
import { runDueHarvestSchedules } from "@/lib/harvest-schedule-runner";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Pembatalan otomatis pesanan pending yang lewat batas waktu.
 * Dipanggil Vercel Cron (harian — lihat vercel.json), scheduler eksternal,
 * atau lazy dari dashboard (after()) pada plan Hobby.
 * Proteksi: header x-cron-secret / Bearer CRON_SHARED_SECRET.
 * Di produksi secret WAJIB diset (fail closed) — lihat lib/cron-auth.ts.
 *
 * GET /api/orders/expire -> { ok, expired, checked }
 */
export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

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
