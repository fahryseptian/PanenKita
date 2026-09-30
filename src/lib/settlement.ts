/**
 * Cara KWT melunasi tagihan biaya layanan platform (arah dana: KWT → platform).
 * Harus selaras dengan validasi di `markFeeBillPaid`
 * (src/lib/actions/superadmin.ts).
 */
export const SETTLEMENT_METHODS = ["transfer", "tunai", "otomatis"] as const;

export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

const LABELS: Record<string, string> = {
  transfer: "Transfer bank",
  tunai: "Tunai",
  otomatis: "Otomatis (transfer bank)",
};

/** Label manusiawi untuk cara pelunasan (aman untuk nilai tak dikenal). */
export function settlementMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return LABELS[method] ?? method;
}
