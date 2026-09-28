/**
 * Kalkulasi emisi karbon terhindar — model ESG tiga jalur (zero-waste).
 *
 * Jalur limbah pangan & faktor emisi terhindar (kg CO2e per kg, estimasi
 * konservatif berbasis dekomposisi anaerobik TPA — FAO/WRAP Food Wastage
 * Footprint):
 *
 * 1. TERSALURKAN  (dijual via katalog) — 2,5 kg CO2e/kg:
 *    pangan dikonsumsi manusia, sepenuhnya menggantikan pembusukan TPA.
 * 2. DIDONASIKAN  — 2,5 kg CO2e/kg: tetap dikonsumsi manusia (bank pangan),
 *    dampak iklim setara tersalurkan.
 * 3. DIKOMPOSKAN  — 0,5 kg CO2e/kg: komposting aerobik masih melepas sebagian
 *    gas (CH4 residuals + proses), jauh lebih rendah dari TPA tapi tidak nol.
 *
 * Semua faktor di satu tempat agar mudah diperbarui saat ada studi spesifik.
 */

export const PREVENTED_EMISSION_KG_CO2E_PER_KG = 2.5;
export const COMPOST_EMISSION_KG_CO2E_PER_KG = 0.5;

export type WastePathway = "salur" | "donasi" | "kompos";

/** Faktor emisi terhindar per jalur. */
export const PATHWAY_FACTORS: Record<WastePathway, number> = {
  salur: PREVENTED_EMISSION_KG_CO2E_PER_KG,
  donasi: PREVENTED_EMISSION_KG_CO2E_PER_KG,
  kompos: COMPOST_EMISSION_KG_CO2E_PER_KG,
};

export interface PathwayBreakdown {
  salur: number;
  donasi: number;
  kompos: number;
}

/** Kg CO2e terhindar dari satu jalur. */
export function co2ePreventedKg(
  wasteKg: number,
  pathway: WastePathway = "salur",
): number {
  if (!Number.isFinite(wasteKg) || wasteKg <= 0) return 0;
  return Math.round(wasteKg * PATHWAY_FACTORS[pathway] * 100) / 100;
}

/**
 * Total CO2e terhindar dari breakdown tiga jalur (kg per jalur).
 * Label "terhindar" untuk salur/donasi; kompos dihitung sebagai pengurangan
 * emisi vs TPA (bukan nol emisi).
 */
export function co2eFromPathways(
  breakdown: PathwayBreakdown,
): number {
  const total =
    co2ePreventedKg(breakdown.salur, "salur") +
    co2ePreventedKg(breakdown.donasi, "donasi") +
    co2ePreventedKg(breakdown.kompos, "kompos");
  return Math.round(total * 100) / 100;
}

/** Perbandingan yang mudah dipahami: km berkendara mobil penumpang rata-rata (~0,17 kg CO2e/km). */
export function carKmEquivalent(co2eKg: number): number {
  if (!Number.isFinite(co2eKg) || co2eKg <= 0) return 0;
  return Math.round(co2eKg / 0.17);
}

/** Format ringkas gaya Indonesia: 12,5 kg CO₂e. */
export function formatCo2(kg: number): string {
  return `${kg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg CO₂e`;
}
