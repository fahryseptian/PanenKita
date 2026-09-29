import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * Bersihkan data uji E2E dari produksi:
 * 1. Order uji (beserta order_items via cascade)
 * 2. Produk uji (beserta panen, pricing rules/events via cascade)
 * Log notifications sengaja dibiarkan sebagai jejak audit.
 * Idempoten: aman dijalankan berulang.
 */
const TEST_ORDER_NUMBERS = ["PK-20260929-CLJIY", "PK-20260929-T91CT"];
const TEST_PRODUCT_SLUG = "bayam-uji-e2e";

async function main() {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const orders = await sql`
    delete from orders where order_number = any(${TEST_ORDER_NUMBERS}) returning order_number`;
  console.log(
    "Order uji dihapus:",
    orders.map((o) => o.order_number).join(", ") || "(tidak ada — sudah bersih)",
  );

  const products = await sql`
    delete from products where slug = ${TEST_PRODUCT_SLUG} returning name`;
  console.log(
    "Produk uji dihapus:",
    products.map((p) => p.name).join(", ") || "(tidak ada — sudah bersih)",
  );

  // Verifikasi sisa.
  const leftOrders = await sql`
    select count(*)::int as n from orders where order_number = any(${TEST_ORDER_NUMBERS})`;
  const leftProduct = await sql`
    select count(*)::int as n from products where slug = ${TEST_PRODUCT_SLUG}`;
  const notifs = await sql`
    select count(*)::int as n from notifications
    where message like '%PK-20260929-%'`;
  console.log("Sisa order uji:", leftOrders[0]?.n ?? 0);
  console.log("Sisa produk uji:", leftProduct[0]?.n ?? 0);
  console.log(
    `Log notifikasi uji: ${notifs[0]?.n ?? 0} entri (dibiarkan sebagai audit trail)`,
  );
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
