import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, orders, orderItems, products } from "@/lib/db/schema";

/**
 * Open Data API v0 — data agregat anonim untuk lembaga/pemerintah.
 * Autentikasi: header `x-api-key` harus sama dengan env OPEN_DATA_API_KEY.
 * Privasi: k-anonymity — wilayah dengan < 3 KWT tidak disertakan.
 */

export function isOpenDataEnabled(): boolean {
  return Boolean(process.env.OPEN_DATA_API_KEY);
}

export function verifyOpenDataKey(req: Request): boolean {
  const expected = process.env.OPEN_DATA_API_KEY;
  if (!expected) return false;
  const provided = req.headers.get("x-api-key");
  return provided === expected;
}

export interface RegionalPrices {
  province: string;
  regency: string;
  kwtCount: number;
  products: Array<{
    category: string;
    unit: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    sampleCount: number;
  }>;
}

/** Harga rata-rata produk aktif per wilayah (k-anonymity ≥ MIN_KWT). */
export async function getRegionalPrices(minKwt = 3): Promise<RegionalPrices[]> {
  const result = await db.execute(sql`
    SELECT
      k.province,
      k.regency,
      count(DISTINCT k.id)::int AS kwt_count,
      json_agg(
        json_build_object(
          'category', p_agg.category,
          'unit', p_agg.unit,
          'avgPrice', p_agg.avg_price,
          'minPrice', p_agg.min_price,
          'maxPrice', p_agg.max_price,
          'sampleCount', p_agg.sample_count
        ) ORDER BY p_agg.category
      ) AS products
    FROM kwts k
    JOIN (
      SELECT
        pr.kwt_id,
        pr.category,
        pr.unit,
        round(avg(pr.current_price))::int AS avg_price,
        min(pr.current_price) AS min_price,
        max(pr.current_price) AS max_price,
        count(*)::int AS sample_count
      FROM products pr
      WHERE pr.is_active = true
      GROUP BY pr.kwt_id, pr.category, pr.unit
    ) p_agg ON p_agg.kwt_id = k.id
    WHERE k.province IS NOT NULL
    GROUP BY k.province, k.regency
    HAVING count(DISTINCT k.id) >= ${minKwt}
    ORDER BY k.province, k.regency
  `);

  const rowsOut = (result as unknown as { rows: Array<{
    province: string;
    regency: string;
    kwt_count: number;
    products: RegionalPrices["products"];
  }> }).rows;

  return rowsOut.map((r) => ({
    province: r.province,
    regency: r.regency,
    kwtCount: r.kwt_count,
    products: r.products ?? [],
  }));
}

export interface FoodLossEntry {
  province: string;
  periodMonth: string;
  harvestedKg: number;
  wasteKg: number;
  lossPercent: number;
}

/** Peta food-loss bulanan per provinsi (k-anonymity ≥ MIN_KWT). */
export async function getFoodLoss(
  since: Date,
  minKwt = 3,
): Promise<FoodLossEntry[]> {
  const result = await db.execute(sql`
    SELECT
      k.province,
      to_char(date_trunc('month', h.harvested_at), 'YYYY-MM') AS period_month,
      round(sum(h.quantity))::int AS harvested_kg,
      round(sum(h.waste_qty))::int AS waste_kg,
      round(100.0 * sum(h.waste_qty) / greatest(sum(h.quantity), 1), 2)::float AS loss_percent
    FROM harvests h
    JOIN products p ON p.id = h.product_id
    JOIN kwts k ON k.id = p.kwt_id
    WHERE h.harvested_at >= ${since} AND k.province IS NOT NULL
    GROUP BY k.province, date_trunc('month', h.harvested_at)
    HAVING count(DISTINCT k.id) >= ${minKwt}
    ORDER BY k.province, period_month
  `);

  const rowsOut = (result as unknown as { rows: Array<{
    province: string;
    period_month: string;
    harvested_kg: number;
    waste_kg: number;
    loss_percent: number;
  }> }).rows;

  return rowsOut.map((r) => ({
    province: r.province,
    periodMonth: r.period_month,
    harvestedKg: r.harvested_kg,
    wasteKg: r.waste_kg,
    lossPercent: r.loss_percent,
  }));
}

export interface PlatformVolume {
  totalHarvestedKg: number;
  totalWasteKg: number;
  paidOrderCount: number;
  paidGmv: number;
  activeKwtCount: number;
}

/** Ringkasan volume platform (tanpa wilayah — aman untuk skala kecil). */
export async function getPlatformVolume(since?: Date): Promise<PlatformVolume> {
  const harvestWhere = since ? gte(harvests.harvestedAt, since) : undefined;

  const [hRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${harvests.quantity}), 0)`,
      waste: sql<string>`coalesce(sum(${harvests.wasteQty}), 0)`,
    })
    .from(harvests)
    .where(harvestWhere);

  const paidStatuses = ["paid", "processing", "completed"] as const;
  const [oRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
      gmv: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
    })
    .from(orders)
    .where(
      since
        ? and(inArray(orders.status, paidStatuses), gte(orders.createdAt, since))
        : inArray(orders.status, paidStatuses),
    );

  // KWT dianggap aktif bila punya ≥1 produk aktif (katalog terbuka untuk publik).
  const [kRow] = await db
    .select({ count: sql<number>`count(distinct ${products.kwtId})::int` })
    .from(products)
    .where(eq(products.isActive, true));

  return {
    totalHarvestedKg: Number(hRow?.total ?? 0),
    totalWasteKg: Number(hRow?.waste ?? 0),
    paidOrderCount: Number(oRow?.count ?? 0),
    paidGmv: Number(oRow?.gmv ?? 0),
    activeKwtCount: Number(kRow?.count ?? 0),
  };
}
