import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const cols = await sql`
    select column_name from information_schema.columns
    where table_name = 'app_settings' order by ordinal_position`;
  console.log("kolom:", cols.map((c) => c.column_name).join(", ") || "(tabel tidak ada)");
  const keys = await sql`select key, length(value) as len, updated_at from app_settings`;
  for (const k of keys) {
    console.log(`- ${k.key} (nilai ${k.len} karakter, diperbarui ${k.updated_at})`);
  }
  if (keys.length === 0) console.log("(belum ada pengaturan tersimpan)");
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
