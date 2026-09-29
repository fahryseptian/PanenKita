import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL tidak ada di .env");
  const sql = neon(url);

  const ordersCols = await sql`
    select column_name from information_schema.columns
    where table_name = 'orders' order by ordinal_position`;
  const notifEnum = await sql`
    select unnest(enum_range(null::notification_kind)) as value`;
  const orderStatusEnum = await sql`
    select unnest(enum_range(null::order_status)) as value`;
  const notifCol = await sql`
    select udt_name from information_schema.columns
    where table_name = 'notifications' and column_name = 'kind'`;

  const colNames = ordersCols.map((c) => c.column_name);
  console.log("orders.expires_at:", colNames.includes("expires_at") ? "ADA" : "TIDAK ADA");
  console.log("notifications.kind type:", notifCol[0]?.udt_name ?? "?");
  console.log(
    "notification_kind values:",
    notifEnum.map((r) => r.value).join(", "),
  );
  console.log(
    "order_status values:",
    orderStatusEnum.map((r) => r.value).join(", "),
  );
}

main().catch((err) => {
  console.error("Gagal cek schema:", err.message);
  process.exit(1);
});
