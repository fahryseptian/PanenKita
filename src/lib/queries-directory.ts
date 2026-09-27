import { and, count, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
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

export interface DirectoryFilter {
  q?: string;
  province?: string;
  regency?: string;
}

/** Direktori KWT untuk katalog publik, dengan pencarian & filter daerah. */
export async function getDirectory(
  filter: string | DirectoryFilter = {},
): Promise<DirectoryRow[]> {
  const { q, province, regency } =
    typeof filter === "string" ? { q: filter } : filter;

  const conds: SQL[] = [];
  const search = q?.trim();
  if (search) {
    conds.push(
      or(
        ilike(kwts.name, `%${search}%`),
        ilike(kwts.regency, `%${search}%`),
        ilike(kwts.province, `%${search}%`),
      )!,
    );
  }
  if (province) conds.push(eq(kwts.province, province));
  if (regency) conds.push(eq(kwts.regency, regency));
  const where = conds.length > 0 ? and(...conds) : undefined;

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

export interface DirectoryFacets {
  provinces: Array<{ province: string; kwtCount: number }>;
  /** Pasangan provinsi+kabupaten/kota yang ada di direktori. */
  regencies: Array<{ province: string; regency: string; kwtCount: number }>;
}

/** Facet daerah untuk filter direktori (jumlah KWT per provinsi & kab/kota). */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  const [provRows, regRows] = await Promise.all([
    db
      .select({ province: kwts.province, n: count() })
      .from(kwts)
      .where(isNotNull(kwts.province))
      .groupBy(kwts.province)
      .orderBy(kwts.province),
    db
      .select({ province: kwts.province, regency: kwts.regency, n: count() })
      .from(kwts)
      .where(and(isNotNull(kwts.province), isNotNull(kwts.regency)))
      .groupBy(kwts.province, kwts.regency)
      .orderBy(kwts.province, kwts.regency),
  ]);

  return {
    provinces: provRows.flatMap((r) =>
      r.province === null ? [] : [{ province: r.province, kwtCount: Number(r.n) }],
    ),
    regencies: regRows.flatMap((r) =>
      r.province === null || r.regency === null
        ? []
        : [{ province: r.province, regency: r.regency, kwtCount: Number(r.n) }],
    ),
  };
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
