import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL tidak ada di .env");
  const sql = neon(url);

  const kwts = await sql`select id, name, slug from kwts`;
  console.log("KWT:", kwts.map((k) => `${k.name} (${k.slug})`).join(" | ") || "(kosong)");

  const products = await sql`
    select p.id, p.name, p.is_active, p.current_price, k.name as kwt_name
    from products p join kwts k on k.id = p.kwt_id
    order by p.name`;
  console.log("\nProduk:");
  for (const p of products) {
    console.log(` - ${p.name} [${p.is_active ? "aktif" : "nonaktif"}] Rp${p.current_price} — ${p.kwt_name}`);
  }
  if (products.length === 0) console.log(" (tidak ada produk)");

  // Stok sederhana: panen bersih (qty - waste) dikurangi pesanan aktif.
  for (const p of products) {
    const harvested = await sql`
      select coalesce(sum(quantity - waste_qty), 0)::float as q from harvests where product_id = ${p.id}`;
    const held = await sql`
      select coalesce(sum(oi.quantity), 0)::float as q
      from order_items oi join orders o on o.id = oi.order_id
      where oi.product_id = ${p.id} and o.status in ('pending','paid','processing','completed')`;
    const hq = harvested[0]?.q ?? 0;
    const heldq = held[0]?.q ?? 0;
    console.log(`   stok ${p.name}: panen ${hq} - terpegang ${heldq} = ${hq - heldq}`);
  }

  const adminPhones = await sql`
    select k.name as kwt, u.name, u.phone, m.role
    from kwt_members m join "user" u on u.id = m.user_id join kwts k on k.id = m.kwt_id`;
  console.log("\nPengurus/anggota (untuk penerima WA):");
  for (const a of adminPhones) {
    console.log(` - ${a.name} (${a.role}) ${a.phone ? "punya nomor WA" : "TANPA nomor"} — ${a.kwt}`);
  }

  const recentOrders = await sql`
    select order_number, status, total, created_at from orders order by created_at desc limit 5`;
  console.log("\nPesanan terakhir:");
  for (const o of recentOrders) console.log(` - ${o.order_number} ${o.status} Rp${o.total}`);

  const recentNotifs = await sql`
    select kind, sent, error, created_at from notifications order by created_at desc limit 5`;
  console.log("\nNotifikasi terakhir:");
  for (const n of recentNotifs) console.log(` - ${n.kind} sent=${n.sent} ${n.error ?? ""}`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
