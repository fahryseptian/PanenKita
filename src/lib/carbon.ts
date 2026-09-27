/**
 * Kalkulasi emisi karbon terhindar dari pencegahan food waste (zero-waste).
 *
 * Faktor emisi: setiap kg pangan yang TIDAK membusuk di TPA mencegah
 * pelepasan metana (CH4) setara ±2,5 kg CO2e — gabungan faktor dekomposisi
 * anaerobik (FAO/WRAP Food Wastage Footprint, dibulatkan konservatif).
 * Konstanta ini kesengaja disederhanakan agar angka laporan mudah
 * dikomunikasikan; update berbasis studinya bisa lewat satu tempat di sini.
 */

export const PREVENTED_EMISSION_KG_CO2E_PER_KG = 2.5;

/** Kg CO2e yang terhindar dari kg limbah pangan yang dicegah. */
export function co2ePreventedKg(
  wasteKg: number,
  factor = PREVENTED_EMISSION_KG_CO2E_PER_KG,
): number {
  if (!Number.isFinite(wasteKg) || wasteKg <= 0) return 0;
  return Math.round(wasteKg * factor * 100) / 100;
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
