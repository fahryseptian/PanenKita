import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, products } from "@/lib/db/schema";
import { forecastAll, type ProductForecast } from "./forecast";

/** Unit yang 1:1 dengan kg (selain itu, kuantitas tetap dipakai apa adanya). */
const KG_LIKE = new Set(["kg"]);

/**
 * Prediksi panen 4 minggu ke depan per produk (baseline statistik).
 * Kuantitas non-kg dipakai sebagai "satuan produk" — label UI mengikuti unit.
 */
export async function getHarvestForecast(
  kwtId: string,
): Promise<ProductForecast[]> {
  const since = new Date(Date.now() - 28 * 86_400_000);

  const rows = await db
    .select({
      productId: harvests.productId,
      date: harvests.harvestedAt,
      quantity: harvests.quantity,
      unit: products.unit,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .where(and(eq(products.kwtId, kwtId), gte(harvests.harvestedAt, since)));

  const points = rows.map((r) => ({
    productId: r.productId,
    date: r.date,
    // Seluruh kuantitas dinormalisasi ke angka; unit non-kg tetap diperlakukan
    // sebagai satuan produk (prediksi per unit, bukan per kg).
    quantityKg: Number(r.quantity),
  }));
  const units = new Map(rows.map((r) => [r.productId, r.unit]));
  void KG_LIKE;

  return forecastAll(points, units);
}
