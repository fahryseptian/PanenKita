import { and, eq, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  harvestSchedules,
  harvests,
  kwtMembers,
  kwts,
  products,
  user,
} from "@/lib/db/schema";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, scheduledHarvestMessage } from "@/lib/wa";
import { fetchHolidays, fetchWeather, isBadWeather } from "@/lib/api-indonesia";

export interface ScheduleRunResult {
  executed: number;
  notified: number;
  skippedHoliday?: boolean;
}

/**
 * Jalankan jadwal panen berulang yang jatuh tempo pada dayOfWeek (getDay()).
 * Idempoten: satu panen otomatis per produk per hari (cek panen hari ini).
 * Hanya produk aktif yang dijalankan. WA ke pengurus best-effort.
 */
export async function runDueHarvestSchedules(
  dayOfWeek: number,
): Promise<ScheduleRunResult> {
  // Hari libur nasional/cuti bersama: panen otomatis ditunda (hemat 1 kredit/hari).
  if (await isNationalHoliday(new Date())) {
    return { executed: 0, notified: 0, skippedHoliday: true };
  }

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

    // Cek cuaca kab/kota KWT sebelum eksekusi (2 kredit, cache 6 jam di API).
    const weatherNote = await weatherWarningForKwt(s.kwtId);
    if (weatherNote?.severe) {
      // Cuaca buruk: jangan catat panen, cukup WA peringatan ke pelaksana.
      try {
        const [executor] = await db
          .select({ phone: user.phone, name: user.name })
          .from(user)
          .where(eq(user.id, s.memberId))
          .limit(1);
        if (executor?.phone) {
          await sendWa(
            "harvest",
            s.kwtId,
            { phone: executor.phone, name: executor.name },
            weatherHarvestWarning(s.productName, weatherNote.desc),
          );
        }
      } catch (err) {
        console.error("[harvest-schedule] weather warn failed", err);
      }
      continue;
    }

    await db.insert(harvests).values({
      productId: s.productId,
      memberId: s.memberId,
      quantity: s.quantity,
      wasteQty: "0",
      wasteDestination: "hilang",
      quality: s.quality as "A" | "B" | "C",
      note: weatherNote ? `Panen otomatis (jadwal) — catatan: ${weatherNote.desc}` : "Panen otomatis (jadwal)",
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

/** True bila hari ini (UTC tanggal) libur nasional/cuti bersama. */
async function isNationalHoliday(date: Date): Promise<boolean> {
  try {
    const holidays = await fetchHolidays(date.getUTCFullYear());
    const ymd = date.toISOString().slice(0, 10);
    return holidays.some((h) => h.date === ymd);
  } catch (err) {
    // API gagal/key belum ada -> jangan blok panen karena itu.
    console.error("[harvest-schedule] holiday check failed", err);
    return false;
  }
}

export interface WeatherNote {
  severe: boolean;
  desc: string;
}

/**
 * Prakiraan cuaca kab/kota KWT untuk beberapa jam ke depan.
 * severe = ada indikasi hujan/badai -> panen otomatis ditunda + WA peringatan.
 */
async function weatherWarningForKwt(kwtId: string): Promise<WeatherNote | null> {
  try {
    const [kwt] = await db
      .select({ regionCode: kwts.regionCode })
      .from(kwts)
      .where(eq(kwts.id, kwtId))
      .limit(1);
    if (!kwt?.regionCode) return null; // wilayah belum diisi via dropdown resmi

    const rows = await fetchWeather(kwt.regionCode);
    if (rows.length === 0) return null;
    const next = rows[0]!;
    return { severe: isBadWeather(next.weather_desc), desc: next.weather_desc };
  } catch (err) {
    console.error("[harvest-schedule] weather check failed", err);
    return null;
  }
}

/** Pesan WA peringatan cuaca ke pelaksana panen otomatis. */
export function weatherHarvestWarning(productName: string, weatherDesc: string): string {
  return [
    `🌧️ *Panen otomatis ditunda — cuaca buruk*`,
    ``,
    `Prakiraan BMKG: ${weatherDesc}.`,
    `Panen otomatis untuk ${productName} tidak dijalankan hari ini demi kualitas hasil.`,
    `Catat panen manual di dashboard bila kondisi di lapangan aman.`,
  ].join("\n");
}
