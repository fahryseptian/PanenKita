/**
 * Mesin komisi platform (take-rate) — murni, tanpa DB.
 *
 * Model: Potongan % dari transaksi terbayar + handling fee tetap.
 * Semua rupiah dibulatkan ke bawah agar KWT tidak pernah dirugikan
 * oleh pembulatan.
 */

export interface CommissionConfig {
  /** Persen take-rate (mis. 2 = 2%). 0 = gratis. */
  ratePercent: number;
  /** Biaya tetap per transaksi terbayar (rupiah). 0 = gratis. */
  handlingFee: number;
  /** Nilai minimum transaksi yang kena fee (gratis di bawah ini). 0 = semua. */
  minOrderValue: number;
  /** Ambang transaksi besar: di atas ini, rate diturunkan (big buyer). */
  discountThreshold: number;
  /** Pengurangan rate (poin persen) di atas threshold. */
  discountPercent: number;
}

export const DEFAULT_COMMISSION: CommissionConfig = {
  ratePercent: 2,
  handlingFee: 500,
  minOrderValue: 10_000,
  discountThreshold: 1_000_000,
  discountPercent: 1,
};

export interface CommissionResult {
  /** Nilai transaksi yang dijadikan dasar (setelah minOrderValue). */
  base: number;
  effectiveRatePercent: number;
  commissionFee: number;
  handlingFee: number;
  /** Total fee platform (komisi + handling). */
  totalFee: number;
  /** Pendapatan bersih KWT = total - totalFee. */
  netToKwt: number;
  /** True jika transaksi di bawah ambang minimum (tidak dikenakan fee). */
  waived: boolean;
}

export function computeCommission(
  orderTotal: number,
  config: CommissionConfig = DEFAULT_COMMISSION,
): CommissionResult {
  const total = Math.max(0, Math.floor(orderTotal));

  const waived = config.minOrderValue > 0 && total < config.minOrderValue;
  if (waived || total === 0) {
    return {
      base: total,
      effectiveRatePercent: 0,
      commissionFee: 0,
      handlingFee: 0,
      totalFee: 0,
      netToKwt: total,
      waived,
    };
  }

  const discounted =
    config.discountThreshold > 0 && total >= config.discountThreshold;
  const rate = discounted
    ? Math.max(0, config.ratePercent - config.discountPercent)
    : config.ratePercent;

  // Floor agar KWT tidak dirugikan pembulatan.
  const commissionFee = Math.floor((total * rate) / 100);
  const handlingFee = Math.max(0, Math.floor(config.handlingFee));

  return {
    base: total,
    effectiveRatePercent: rate,
    commissionFee,
    handlingFee,
    totalFee: commissionFee + handlingFee,
    netToKwt: total - commissionFee - handlingFee,
    waived: false,
  };
}
