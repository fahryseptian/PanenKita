/**
 * Penanganan rentang tanggal untuk laporan (murni, mudah dites).
 * Semua tanggal URL memakai format YYYY-MM-DD (input type="date").
 */

/** Parse "2026-09-01" menjadi Date tengah malam waktu lokal; null jika tidak valid. */
export function parseYmdParam(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  // Tolak tanggal tidak valid seperti 2026-02-30.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Format Date lokal menjadi "2026-09-28" (untuk value input date & URL). */
export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ResolvedRange {
  from: Date;
  to: Date;
  /** Label default preset, mis. "30 hari terakhir". */
  preset: "30d" | "bulan-ini" | "bulan-lalu" | "custom";
}

/**
 * Resolve rentang dari parameter URL.
 * - from/to eksplisit menang (custom); batas atas digeser +1 hari agar lt eksklusif.
 * - to sebelum from -> dibalik.
 * - tanpa parameter: 30 hari terakhir (termasuk hari ini).
 * - ?preset=bulan-ini / bulan-lalu.
 */
export function resolveReportRange(
  fromParam?: string | null,
  toParam?: string | null,
  presetParam?: string | null,
): ResolvedRange {
  const now = new Date();
  // Batas atas eksklusif = awal hari besok, agar pesanan hari ini ikut terhitung.
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  if (presetParam === "bulan-ini" || presetParam === "bulan-lalu") {
    if (presetParam === "bulan-ini") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: startOfTomorrow, preset: "bulan-ini" };
    }
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to, preset: "bulan-lalu" };
  }

  const fromParsed = parseYmdParam(fromParam);
  const toParsed = parseYmdParam(toParam);
  if (fromParsed && toParsed) {
    const [from, to] =
      fromParsed.getTime() <= toParsed.getTime()
        ? [fromParsed, toParsed]
        : [toParsed, fromParsed];
    const toExclusive = new Date(to);
    toExclusive.setDate(toExclusive.getDate() + 1); // inklusif s.d. akhir hari `to`
    return { from, to: toExclusive, preset: "custom" };
  }

  const from = new Date(startOfTomorrow);
  from.setDate(from.getDate() - 30); // 30 hari terakhir, termasuk hari ini
  return { from, to: startOfTomorrow, preset: "30d" };
}
