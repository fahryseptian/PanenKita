import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Kunci yang WAJIB ada di produksi. Nilai tidak pernah dikembalikan —
 * hanya namanya, agar operator tahu apa yang harus diisi.
 */
const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SHARED_SECRET",
] as const;

/** Fitur opsional: aktif otomatis bila env-nya diisi. */
const OPTIONAL_FEATURES = {
  whatsapp: "FONTE_TOKEN",
  payment: "MIDTRANS_SERVER_KEY",
  uploads: "AWS_ACCESS_KEY_ID",
  googleLogin: "GOOGLE_CLIENT_ID",
  openData: "OPEN_DATA_API_KEY",
  wilayahApi: "API_INDONESIA_KEY",
} as const;

function configReport() {
  const missingRequired = REQUIRED_IN_PRODUCTION.filter(
    (key) => !process.env[key],
  );
  const optional: Record<string, boolean> = {};
  for (const [feature, key] of Object.entries(OPTIONAL_FEATURES)) {
    optional[feature] = Boolean(process.env[key]);
  }
  return {
    /** Kosong = konfigurasi produksi lengkap. */
    missingRequired,
    optional,
    /** Peringatan khusus: secret auth masih memakai fallback dev. */
    authSecretFallback: !process.env.BETTER_AUTH_SECRET,
  };
}

/**
 * GET /api/health — probe uptime sederhana (UptimeRobot, dsb).
 * 200 = DB terjangkau; 503 = DB gagal. Tanpa data sensitif — hanya nama env.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const config = configReport();
    return NextResponse.json({
      ok: true,
      db: "up",
      wa: config.optional["whatsapp"] ? "configured" : "FONTE_TOKEN missing",
      config,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json(
      { ok: false, db: "down", config: configReport(), ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
