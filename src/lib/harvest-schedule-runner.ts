import { and, eq, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  harvestSchedules,
  harvests,
  kwtMembers,
  products,
  user,
} from "@/lib/db/schema";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, scheduledHarvestMessage } from "@/lib/wa";

export interface ScheduleRunResult {
  executed: number;
  notified: number;
}

/**
 * Jalankan jadwal panen berulang yang jatuh tempo pada dayOfWeek (getDay()).
 * Idempoten: satu panen otomatis per produk per hari (cek panen hari ini).
 * Hanya produk aktif yang dijalankan. WA ke pengurus best-effort.
 */
export async function runDueHarvestSchedules(
  dayOfWeek: number,
): Promise<ScheduleRunResult> {
  const schedules = await db
    .select({
      id: harvestSchedules.id,
      kwtId: harvestSchedules.kwtId,
      productId: harvestSchedules.productId,
      memberId: harvestSchedules.memberId,
      quantity: harvestSchedules.quantity,
      quality: harvestSchedules.quality,
      productName: products.name,
      productUnit: products.unit,
      productActive: products.isActive,
    })
    .from(harvestSchedules)
    .innerJoin(products, eq(harvestSchedules.productId, products.id))
    .where(
      and(
        eq(harvestSchedules.isActive, true),
        eq(harvestSchedules.dayOfWeek, dayOfWeek),
      ),
    );
  if (schedules.length === 0) return { executed: 0, notified: 0 };

  // Awal hari (UTC) untuk deteksi "sudah dipanen hari ini".
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  let executed = 0;
  let notified = 0;
  for (const s of schedules) {
    if (!s.productActive) continue;

    const already = await db
      .select({ id: harvests.id })
      .from(harvests)
      .where(
        and(
          eq(harvests.productId, s.productId),
          gte(harvests.harvestedAt, startOfDay),
        ),
      )
      .limit(1);
    if (already.length > 0) continue;

    await db.insert(harvests).values({
      productId: s.productId,
      memberId: s.memberId,
      quantity: s.quantity,
      wasteQty: "0",
      wasteDestination: "hilang",
      quality: s.quality as "A" | "B" | "C",
      note: "Panen otomatis (jadwal)",
    });
    await recomputeProductPrice(s.productId);
    executed += 1;

    // Kabari pengurus KWT terkait (best-effort, jangan gagalkan runner).
    try {
      const admins = await db
        .select({ phone: user.phone, name: user.name })
        .from(kwtMembers)
        .innerJoin(user, eq(kwtMembers.userId, user.id))
        .where(
          and(
            eq(kwtMembers.kwtId, s.kwtId),
            or(eq(kwtMembers.role, "ketua"), eq(kwtMembers.role, "bendahara")),
          ),
        );
      const msg = scheduledHarvestMessage({
        productName: s.productName,
        quantity: Number(s.quantity).toLocaleString("id-ID"),
        unit: s.productUnit,
      });
      await Promise.allSettled(
        admins
          .filter((a) => a.phone)
          .map((a) =>
            sendWa("harvest", s.kwtId, { phone: a.phone!, name: a.name }, msg),
          ),
      );
      notified += 1;
    } catch (err) {
      console.error("[harvest-schedule] notify failed", err);
    }
  }
  return { executed, notified };
}
