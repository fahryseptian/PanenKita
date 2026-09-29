import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { regions } from "@/lib/db/schema";
import { fetchProvinces, fetchRegencies } from "./api-indonesia";

export interface RegionOption {
  code: string;
  name: string;
  level: string;
  parentCode: string | null;
}

/** Provinsi dari cache lokal (terurut abjad). */
export async function listProvinces(): Promise<RegionOption[]> {
  const rows = await db
    .select()
    .from(regions)
    .where(eq(regions.level, "provinsi"))
    .orderBy(asc(regions.name));
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    level: r.level,
    parentCode: r.parentCode,
  }));
}

/** Kabupaten/kota satu provinsi dari cache lokal. */
export async function listRegencies(
  provinceCode: string,
): Promise<RegionOption[]> {
  const rows = await db
    .select()
    .from(regions)
    .where(eq(regions.level, "kabupaten"))
    .orderBy(asc(regions.name));
  return rows
    .filter((r) => r.parentCode === provinceCode)
    .map((r) => ({
      code: r.code,
      name: r.name,
      level: r.level,
      parentCode: r.parentCode,
    }));
}

/**
 * Sinkronkan cache wilayah dari apiindonesia.id ke tabel regions.
 * ~38 provinsi + ~514 kab/kota ≈ 6 request API (hemat kredit).
 * Idempoten: upsert berdasarkan (code, level).
 */
export async function syncRegions(): Promise<{
  provinces: number;
  regencies: number;
}> {
  const provinces = await fetchProvinces();
  if (provinces.length === 0) {
    throw new Error("Daftar provinsi kosong — periksa API key");
  }

  for (const p of provinces) {
    await db
      .insert(regions)
      .values({
        code: p.id,
        level: "provinsi",
        name: p.name,
        parentCode: null,
      })
      .onConflictDoUpdate({
        target: [regions.code, regions.level],
        set: { name: p.name, updatedAt: new Date() },
      });
  }

  let regencyCount = 0;
  for (const p of provinces) {
    const regs = await fetchRegencies(p.id);
    for (const r of regs) {
      await db
        .insert(regions)
        .values({
          code: r.id,
          level: "kabupaten",
          name: r.name,
          parentCode: r.province_id,
        })
        .onConflictDoUpdate({
          target: [regions.code, regions.level],
          set: { name: r.name, parentCode: r.province_id, updatedAt: new Date() },
        });
      regencyCount += 1;
    }
  }

  return { provinces: provinces.length, regencies: regencyCount };
}

/** Judul tampilan: ubah "KABUPATEN BANDUNG" -> "Kabupaten Bandung". */
export function prettyRegionName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
