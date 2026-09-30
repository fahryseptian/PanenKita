import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const ORDER_NUMBER = process.argv[2] ?? "PK-20260929-CLJIY";

async function main() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const [o] = await sql`
    select order_number, status, total, expires_at, created_at, buyer_phone
    from orders where order_number = ${ORDER_NUMBER}`;
  if (!o) {
    console.log("Order tidak ditemukan:", ORDER_NUMBER);
    return;
  }
  console.log("ORDER:", {
    number: o.order_number,
    status: o.status,
    total: o.total,
    expiresAt: o.expires_at,
    buyer: o.buyer_phone,
  });

  // Kanal bayar KWT yang dilihat pembeli di halaman pesanan.
  const [kwt] = await sql`
    select k.name, k.bank_name, k.bank_account_number, k.qris_image_url
    from kwts k join orders o on o.kwt_id = k.id
    where o.order_number = ${ORDER_NUMBER}`;
  if (kwt) {
    console.log("KANAL BAYAR KWT:", {
      kwt: kwt.name,
      bank: kwt.bank_name ?? "(belum diisi)",
      rekening: kwt.bank_account_number ?? "(belum diisi)",
      qris: Boolean(kwt.qris_image_url),
    });
  }

  const notifs = await sql`
    select kind, target, sent, error from notifications
    where created_at >= ${o.created_at}
    order by created_at asc`;
  console.log("NOTIFIKASI setelah order:");
  for (const n of notifs) {
    console.log(` - ${n.kind} → ${n.target} sent=${n.sent}${n.error ? ` (${n.error})` : ""}`);
  }
  if (notifs.length === 0) console.log(" (tidak ada)");
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
