/**
 * Verifikasi schema di database Neon production.
 * Jalankan: npx tsx scripts/db-verify.ts  (pakai NEON_DATABASE_URL dari .env)
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("NEON_DATABASE_URL tidak ditemukan");
  process.exit(1);
}

const sql = neon(url);

const EXPECTED_TABLES = [
  "user", "session", "account", "verification",
  "kwts", "kwt_members", "products", "harvests",
  "orders", "order_items", "pricing_rules", "pricing_events",
  "notifications", "feedback",
];

const EXPECTED_COLUMNS: Array<[string, string]> = [
  ["kwts", "regency"], ["kwts", "province"], ["kwts", "invite_code"],
  ["products", "current_price"], ["products", "category"],
  ["harvests", "waste_qty"], ["harvests", "quality"],
  ["orders", "midtrans_order_id"], ["orders", "payment_settled_at"],
  ["pricing_rules", "surge_percent"], ["user", "wa_opt_in"],
];

async function main() {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`;
  const names = tables.map((t) => t.table_name);
  const missing = EXPECTED_TABLES.filter((t) => !names.includes(t));
  console.log(`Tabel ditemukan: ${names.length}`);
  for (const n of names) console.log("  •", n);
  if (missing.length) {
    console.error("TABEL KURANG:", missing.join(", "));
    process.exit(1);
  }

  const cols = await sql`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public'`;
  for (const [t, c] of EXPECTED_COLUMNS) {
    const found = cols.some(
      (r) => r.table_name === t && r.column_name === c,
    );
    if (!found) {
      console.error(`KOLOM KURANG: ${t}.${c}`);
      process.exit(1);
    }
  }
  console.log(`Kolom kunci (${EXPECTED_COLUMNS.length}) ✓ semuanya ada`);

  // Hitung baris per tabel inti (harus 0 di DB production yang baru).
  const counts = await sql`SELECT
    (SELECT count(*)::int FROM kwts) AS kwts,
    (SELECT count(*)::int FROM products) AS products,
    (SELECT count(*)::int FROM harvests) AS harvests,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM kwt_members) AS kwt_members`;
  const c = (Array.isArray(counts) ? counts[0] : counts) as Record<string, number>;
  for (const t of ["kwts", "products", "harvests", "orders", "kwt_members"]) {
    console.log(`  ${t}: ${c[t]} baris`);
  }
  console.log("SUCCESS ✓ schema Neon production lengkap");
}

main().catch((e) => {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
});
