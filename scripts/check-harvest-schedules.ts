import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const cols = await sql`
    select column_name from information_schema.columns
    where table_name = 'harvest_schedules' order by ordinal_position`;
  console.log("kolom:", cols.map((c) => c.column_name).join(", ") || "(tabel tidak ada)");

  const rows = await sql`select count(*)::int as n from harvest_schedules`;
  console.log("jumlah jadwal:", rows[0]?.n ?? 0);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
