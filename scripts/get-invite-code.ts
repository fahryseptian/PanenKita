import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const slug = process.argv[2] ?? "sei-menciri";
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const rows = await sql`
    select name, slug, invite_code from kwts where slug = ${slug} limit 1`;
  const kwt = rows[0];
  if (!kwt) {
    console.log("KWT tidak ditemukan:", slug);
    return;
  }
  console.log(`${kwt.name} (${kwt.slug})`);
  console.log(`Kode undangan: ${kwt.invite_code ?? "(belum ada)"}`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
