import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const SLUG = "bayam-uji-e2e";

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL tidak ada di .env");
  const sql = neon(url);

  const [kwt] = await sql`select id from kwts limit 1`;
  if (!kwt) throw new Error("Tidak ada KWT");

  // Idempoten: pakai produk uji yang sudah ada, atau buat baru.
  let [product] = await sql`select id from products where slug = ${SLUG}`;
  if (!product) {
    const inserted = await sql`
      insert into products (kwt_id, name, slug, category, unit, base_price, current_price, is_active)
      values (${kwt.id}, 'Bayam Uji E2E', ${SLUG}, 'sayur', 'kg', 10000, 10000, true)
      returning id`;
    product = inserted[0]!;
    console.log("Produk dibuat:", SLUG);
  } else {
    console.log("Produk uji sudah ada, dipakai ulang");
  }

  // Panen awal supaya stok > 0 (idempoten: skip bila sudah ada panen).
  const existing = await sql`select id from harvests where product_id = ${product.id} limit 1`;
  if (existing.length === 0) {
    const [ketua] = await sql`
      select u.id from kwt_members m join "user" u on u.id = m.user_id
      where m.kwt_id = ${kwt.id} and m.role = 'ketua' limit 1`;
    if (!ketua) throw new Error("Ketua tidak ditemukan");
    await sql`
      insert into harvests (product_id, member_id, quantity, waste_qty, quality, harvested_at)
      values (${product.id}, ${ketua.id}, 50, 0, 'A', now())`;
    console.log("Panen 50 kg dicatat");
  } else {
    console.log("Panen uji sudah ada, dilewati");
  }

  console.log("PRODUCT_ID:", product.id);
  const [k] = await sql`select id from kwts limit 1`;
  console.log("KWT_ID:", k?.id);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
