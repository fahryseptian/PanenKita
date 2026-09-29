import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * CLI sinkron wilayah dari apiindonesia.id -> tabel regions (Neon).
 * Pemakaian: npx tsx scripts/sync-regions-cli.ts <API_KEY>
 * ≈ 1 + N provinsi request (N ≈ 38) = ±78 kredit.
 * Duplikat logika src/lib/regions-db.ts agar bisa jalan tanpa path-alias.
 */
const BASE = "https://use.apiindonesia.id/api/v1";

async function apiGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  const json = (await res.json()) as { success?: boolean; data?: T };
  if (!json.success || json.data === undefined) {
    throw new Error(`${path} -> respons tak valid`);
  }
  return json.data;
}

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error("Pemakaian: npx tsx scripts/sync-regions-cli.ts <API_KEY>");
    process.exit(1);
  }
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const provinces = await apiGet<Array<{ id: string; name: string }>>(
    "/wilayah/provinsi?per_page=100",
    key,
  );
  console.log("Provinsi diterima:", provinces.length);
  if (provinces.length === 0) throw new Error("Daftar provinsi kosong");

  for (const p of provinces) {
    await sql`
      insert into regions (code, level, name, parent_code, updated_at)
      values (${p.id}, 'provinsi', ${p.name}, null, now())
      on conflict (code, level) do update set name = ${p.name}, updated_at = now()`;
  }
  console.log("Provinsi tersimpan:", provinces.length);

  let regencyCount = 0;
  for (const p of provinces) {
    const regs = await apiGet<Array<{ id: string; name: string; province_id: string }>>(
      `/wilayah/kabupaten?provinsi_id=${encodeURIComponent(p.id)}&per_page=100`,
      key,
    );
    for (const r of regs) {
      await sql`
        insert into regions (code, level, name, parent_code, updated_at)
        values (${r.id}, 'kabupaten', ${r.name}, ${r.province_id}, now())
        on conflict (code, level) do update set name = ${r.name}, parent_code = ${r.province_id}, updated_at = now()`;
      regencyCount += 1;
    }
    process.stdout.write(`\r  ${p.name}: ${regs.length} kab/kota`);
  }
  console.log(`\nSelesai. Total kab/kota tersimpan: ${regencyCount}`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
