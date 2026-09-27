import { count, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts, products } from "@/lib/db/schema";

export interface DirectoryRow {
  id: string;
  name: string;
  slug: string;
  regency: string | null;
  province: string | null;
  address: string | null;
  productCount: number;
  memberCount: number;
}

/** Direktori KWT untuk katalog publik, dengan pencarian nama/daerah. */
export async function getDirectory(q?: string): Promise<DirectoryRow[]> {
  const search = q?.trim();
  const where = search
    ? or(
        ilike(kwts.name, `%${search}%`),
        ilike(kwts.regency, `%${search}%`),
        ilike(kwts.province, `%${search}%`),
      )
    : undefined;

  const [groups, productCounts, memberCounts] = await Promise.all([
    db
      .select({
        id: kwts.id,
        name: kwts.name,
        slug: kwts.slug,
        regency: kwts.regency,
        province: kwts.province,
        address: kwts.address,
      })
      .from(kwts)
      .where(where)
      .orderBy(kwts.name),
    db
      .select({ kwtId: products.kwtId, n: count() })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.kwtId),
    db
      .select({ kwtId: kwtMembers.kwtId, n: count() })
      .from(kwtMembers)
      .groupBy(kwtMembers.kwtId),
  ]);

  const productMap = new Map(productCounts.map((r) => [r.kwtId, Number(r.n)]));
  const memberMap = new Map(memberCounts.map((r) => [r.kwtId, Number(r.n)]));

  return groups.map((k) => ({
    ...k,
    productCount: productMap.get(k.id) ?? 0,
    memberCount: memberMap.get(k.id) ?? 0,
  }));
}

/** Statistik agregat platform (untuk hero direktori). */
export async function getPlatformStats() {
  const [kwtCount] = await db.select({ n: sql<number>`count(*)::int` }).from(kwts);
  const [productCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.isActive, true));
  const [memberCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(kwtMembers);

  return {
    kwtCount: Number(kwtCount?.n ?? 0),
    productCount: Number(productCount?.n ?? 0),
    memberCount: Number(memberCount?.n ?? 0),
  };
}
