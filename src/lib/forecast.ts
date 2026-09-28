/**
 * Prediksi panen baseline statistik — murni, tanpa DB, tanpa dependensi ML.
 *
 * Pendekatan (sengaja sederhana & bisa dijelaskan ke pengurus KWT):
 * - Rata-rata bergerak 4 minggu per produk sebagai prediksi minggu depan.
 * - Perbandingan 2 minggu terakhir vs 4 minggu sebelumnya untuk arah tren.
 * - Keandalan: jumlah minggu yang punya data (butuh >= 3 dari 4 minggu agar
 *   prediksi ditampilkan; di bawah itu "data belum cukup").
 *
 * Input: daftar panen (productId, tanggal, kuantitas dalam satuan yang sudah
 * dinormalisasi ke kg oleh pemanggil bila perlu). Minggu = 7 hari kalender.
 */

export interface HarvestPoint {
  productId: string;
  date: Date;
  quantityKg: number;
}

export interface WeeklySum {
  /** Awal minggu (00:00 lokal). */
  weekStart: Date;
  kg: number;
}

export interface ProductForecast {
  productId: string;
  /** Rata-rata bergerak 4 minggu (kg/minggu) = prediksi minggu depan. */
  forecastKg: number;
  /** Total 4 minggu terakhir. */
  last4TotalKg: number;
  /** Total 2 minggu terakhir (minggu berjalan + sebelumnya). */
  last2TotalKg: number;
  /** Total 2 minggu sebelum itu, untuk arah tren. */
  prev2TotalKg: number;
  /** naik | turun | stabil | belum-cukup-data */
  trend: "naik" | "turun" | "stabil" | "belum-cukup-data";
  /** Persen perubahan last2 vs prev2 (dibulatkan). */
  trendPercent: number;
  /** Jumlah minggu (dari 4) yang memiliki panen. */
  activeWeeks: number;
  unit: string;
}

const WEEK_MS = 7 * 86_400_000;

/** Awal minggu (Senin, 00:00) dari sebuah tanggal. */
function weekStartOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Senin = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Jumlah kg per minggu untuk 4 minggu terakhir (indeks 3 = minggu berjalan). */
export function weeklySums(
  points: HarvestPoint[],
  now = new Date(),
): WeeklySum[] {
  const currentWeek = weekStartOf(now);
  const sums: WeeklySum[] = [];
  for (let i = 3; i >= 0; i--) {
    sums.push({ weekStart: new Date(currentWeek.getTime() - i * WEEK_MS), kg: 0 });
  }
  const index = new Map(sums.map((s, idx) => [s.weekStart.getTime(), idx]));
  for (const p of points) {
    const ws = weekStartOf(p.date).getTime();
    const idx = index.get(ws);
    if (idx !== undefined) sums[idx]!.kg += p.quantityKg;
  }
  return sums;
}

/** Prediksi satu produk dari poin panennya. */
export function forecastProduct(
  productId: string,
  points: HarvestPoint[],
  unit = "kg",
  now = new Date(),
): ProductForecast {
  const weeks = weeklySums(points, now);
  const kg = weeks.map((w) => w.kg);
  const last4TotalKg = kg.reduce((a, b) => a + b, 0);
  const activeWeeks = kg.filter((k) => k > 0).length;

  const forecastKg = Math.round((last4TotalKg / 4) * 100) / 100;
  const last2TotalKg = Math.round((kg[2]! + kg[3]!) * 100) / 100;
  const prev2TotalKg = Math.round((kg[0]! + kg[1]!) * 100) / 100;

  let trend: ProductForecast["trend"] = "stabil";
  let trendPercent = 0;
  if (activeWeeks < 3 || prev2TotalKg === 0) {
    trend = "belum-cukup-data";
  } else {
    trendPercent = Math.round(((last2TotalKg - prev2TotalKg) / prev2TotalKg) * 100);
    if (trendPercent >= 15) trend = "naik";
    else if (trendPercent <= -15) trend = "turun";
  }

  return {
    productId,
    forecastKg,
    last4TotalKg: Math.round(last4TotalKg * 100) / 100,
    last2TotalKg,
    prev2TotalKg,
    trend,
    trendPercent,
    activeWeeks,
    unit,
  };
}

/** Prediksi untuk banyak produk sekaligus (dari seluruh poin panen KWT). */
export function forecastAll(
  points: HarvestPoint[],
  units: Map<string, string>,
  now = new Date(),
): ProductForecast[] {
  const byProduct = new Map<string, HarvestPoint[]>();
  for (const p of points) {
    const list = byProduct.get(p.productId) ?? [];
    list.push(p);
    byProduct.set(p.productId, list);
  }
  return [...byProduct.entries()]
    .map(([productId, pts]) =>
      forecastProduct(productId, pts, units.get(productId) ?? "kg", now),
    )
    .sort((a, b) => b.forecastKg - a.forecastKg);
}
