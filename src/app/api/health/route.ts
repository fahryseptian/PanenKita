import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — probe uptime sederhana (UptimeRobot, dsb).
 * 200 = DB terjangkau; 503 = DB gagal. Tanpa data sensitif.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // Status konfigurasi WA (boolean saja — tidak pernah mengekspos nilai).
    const waConfigured = Boolean(process.env.FONTE_TOKEN && process.env.FONTE_TOKEN.length > 5);
    return NextResponse.json({
      ok: true,
      db: "up",
      wa: waConfigured ? "configured" : "FONTE_TOKEN missing",
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json(
      { ok: false, db: "down", ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
