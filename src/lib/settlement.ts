/**
 * Cara pencairan fee platform.
 * Harus selaras dengan validasi di `recordSettlement` (src/lib/actions/superadmin.ts).
 */
export const SETTLEMENT_METHODS = ["transfer", "tunai", "otomatis"] as const;

export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

const LABELS: Record<string, string> = {
  transfer: "Transfer bank",
  tunai: "Tunai",
  otomatis: "Otomatis (API)",
};

/** Label manusiawi untuk cara pencairan (aman untuk nilai tak dikenal). */
export function settlementMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return LABELS[method] ?? method;
}
