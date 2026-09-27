import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtCommissionSettings, platformFees } from "@/lib/db/schema";
import {
  computeCommission,
  DEFAULT_COMMISSION,
  type CommissionConfig,
} from "@/lib/komisi";

/**
 * Catat fee platform untuk pesanan terbayar (idempoten: satu baris per
 * pesanan, onConflictDoNothing). Dipanggil dari semua jalur "paid".
 */
export async function recordPlatformFee(order: {
  id: string;
  kwtId: string;
  total: number;
}): Promise<void> {
  const [cfgRow] = await db
    .select()
    .from(kwtCommissionSettings)
    .where(eq(kwtCommissionSettings.kwtId, order.kwtId))
    .limit(1);

  if (cfgRow && !cfgRow.enabled) return; // komisi dimatikan untuk KWT ini

  const config: CommissionConfig = cfgRow
    ? {
        ratePercent: cfgRow.ratePercent,
        handlingFee: cfgRow.handlingFee,
        minOrderValue: cfgRow.minOrderValue,
        discountThreshold: cfgRow.discountThreshold,
        discountPercent: cfgRow.discountPercent,
      }
    : DEFAULT_COMMISSION;

  const result = computeCommission(order.total, config);
  if (result.totalFee === 0 && result.waived) {
    // Tetap catat baris 0 agar ledger lengkap dan auditabel.
  }
  await db
    .insert(platformFees)
    .values({
      orderId: order.id,
      kwtId: order.kwtId,
      orderTotal: order.total,
      ratePercent: result.effectiveRatePercent,
      commissionFee: result.commissionFee,
      handlingFee: result.handlingFee,
      totalFee: result.totalFee,
      netToKwt: result.netToKwt,
    })
    .onConflictDoNothing();
}

/** Rekap fee KWT untuk laporan bendahara. */
export async function getKwtFeeSummary(kwtId: string) {
  const rows = await db
    .select({
      orderTotal: platformFees.orderTotal,
      commissionFee: platformFees.commissionFee,
      handlingFee: platformFees.handlingFee,
      totalFee: platformFees.totalFee,
      netToKwt: platformFees.netToKwt,
    })
    .from(platformFees)
    .where(eq(platformFees.kwtId, kwtId));

  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  return {
    feeCount: rows.length,
    grossTotal: sum((r) => r.orderTotal),
    totalFee: sum((r) => r.totalFee),
    netTotal: sum((r) => r.netToKwt),
  };
}
