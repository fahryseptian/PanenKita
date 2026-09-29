import "dotenv/config";
import { backfillPlatformFees, findFeeLedgerDrift } from "../src/lib/fees-db";

/**
 * CLI: lengkapi ledger fee platform yang hilang (pesanan terbayar tanpa baris fee).
 * Pemakaian: npx tsx scripts/backfill-fees.ts [--dry-run]
 *
 * Idempoten: hanya mencatat baris yang belum ada; baris lama tidak diubah.
 * KWT dengan komisi dimatikan dikecualikan (memang tidak dikenakan fee).
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const drift = await findFeeLedgerDrift(500);

  console.log(`Pesanan terbayar tanpa catatan fee: ${drift.length}`);
  for (const d of drift) {
    console.log(
      ` - ${d.orderNumber} · ${d.kwtName} · Rp${d.total.toLocaleString("id-ID")} (${d.status})`,
    );
  }

  if (drift.length === 0) {
    console.log("✓ Ledger fee sudah sinkron.");
    return;
  }

  if (dryRun) {
    console.log("ℹ️  --dry-run: tidak ada yang dicatat. Jalankan tanpa flag untuk melengkapi.");
    return;
  }

  const result = await backfillPlatformFees();
  console.log(`✓ ${result.recorded} baris fee dicatat.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Gagal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
