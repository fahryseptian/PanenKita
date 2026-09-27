import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts } from "@/lib/db/schema";

/** Semua kelompok yang diikuti user (untuk pemeriksaan halaman onboarding). */
export async function getPrimaryKwtRow(userId: string) {
  const rows = await db
    .select({
      kwtId: kwts.id,
      kwtName: kwts.name,
      kwtSlug: kwts.slug,
      role: kwtMembers.role,
    })
    .from(kwtMembers)
    .innerJoin(kwts, eq(kwtMembers.kwtId, kwts.id))
    .where(eq(kwtMembers.userId, userId));
  return rows;
}
