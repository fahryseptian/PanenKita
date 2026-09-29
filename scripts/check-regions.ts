import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const cols = await sql`
    select column_name from information_schema.columns
    where table_name = 'regions' order by ordinal_position`;
  console.log("kolom regions:", cols.map((c) => c.column_name).join(", ") || "(tabel tidak ada)");

  const byLevel = await sql`
    select level, count(*)::int as n from regions group by level order by level`;
  for (const r of byLevel) console.log(`- ${r.level}: ${r.n}`);

  const kwtRegion = await sql`
    select name, region_code from kwts where region_code is not null limit 5`;
  for (const k of kwtRegion) console.log(`KWT ${k.name} -> ${k.region_code}`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
