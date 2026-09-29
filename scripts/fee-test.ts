import "dotenv/config";
import { recordPlatformFee, getKwtFeeSummary } from "../src/lib/fees-db";

async function main() {
  const orderId = process.argv[2]!;
  const kwtId = process.argv[3]!;
  const total = Number(process.argv[4] ?? 64800);
  await recordPlatformFee({ id: orderId, kwtId, total });
  // idempoten: panggil sekali lagi — harus tetap satu baris
  await recordPlatformFee({ id: orderId, kwtId, total });
  console.log(await getKwtFeeSummary(kwtId));
}
main();
