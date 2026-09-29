import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * CLI: set nilai app_settings tanpa lewat UI.
 * Pemakaian: npx tsx scripts/set-app-setting.ts <key> <value>
 * (value dipass via argv agar tidak di-hardcode di repo)
 */
async function main() {
  const [key, value] = process.argv.slice(2);
  if (!key || !value) {
    console.error("Pemakaian: npx tsx scripts/set-app-setting.ts <key> <value>");
    process.exit(1);
  }
  const sql = neon(process.env.NEON_DATABASE_URL!);
  await sql`
    insert into app_settings (key, value, updated_at)
    values (${key}, ${value}, now())
    on conflict (key) do update set value = ${value}, updated_at = now()`;
  console.log(`Tersimpan: ${key} (${value.length} karakter)`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
