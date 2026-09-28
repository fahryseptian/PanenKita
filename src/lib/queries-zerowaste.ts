import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, kwtMembers, orders, orderItems, products } from "@/lib/db/schema";
import { co2eFromPathways } from "./carbon";
import { PAID_STATUSES } from "./queries-laporan";

export interface ZeroWasteStats {
  /** Kg hasil panen yang tersalurkan lewat penjualan terbayar. */
  salurKg: number;
  /** Kg yang didonasikan (jalur ESG donasi). */
  donasiKg: number;
  /** Kg yang dikomposkan. */
  komposKg: number;
  /** Kg belum tertangani (tidak dihitung sebagai pencapaian). */
  hilangKg: number;
  /** Total kg panen tercatat. */
  totalPanenKg: number;
  /** Total CO2e terhindar (kg) dari tiga jalur. */
  co2ePreventedKg: number;
  jumlahPanen: number;
  jumlahAnggota: number;
  /** Panen pertama (awal pencatatan) — untuk "sejak". */
  sejak: Date | null;
  /** Panen terakhir — data segar sampai kapan. */
  hingga: Date | null;
}

/** Statistik kumulatif zero-waste satu KWT (semua waktu, untuk sertifikat). */
export async function getZeroWasteStats(kwtId: string): Promise<ZeroWasteStats> {
  const [harvestRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${harvests.quantity}), 0)`,
      donasi: sql<string>`coalesce(sum(case when ${harvests.wasteDestination} = 'donasi' then ${harvests.wasteQty} else 0 end), 0)`,
      kompos: sql<string>`coalesce(sum(case when ${harvests.wasteDestination} = 'kompos' then ${harvests.wasteQty} else 0 end), 0)`,
      hilang: sql<string>`coalesce(sum(case when ${harvests.wasteDestination} = 'hilang' then ${harvests.wasteQty} else 0 end), 0)`,
      count: sql<number>`count(*)::int`,
      first: sql<string>`min(${harvests.harvestedAt})`,
      last: sql<string>`max(${harvests.harvestedAt})`,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .where(eq(products.kwtId, kwtId));

  const [soldRow] = await db
    .select({ qty: sql<string>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(eq(products.kwtId, kwtId), inArray(orders.status, [...PAID_STATUSES])),
    );

  const [memberRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(kwtMembers)
    .where(eq(kwtMembers.kwtId, kwtId));

  const salurKg = Number(soldRow?.qty ?? 0);
  const donasiKg = Number(harvestRow?.donasi ?? 0);
  const komposKg = Number(harvestRow?.kompos ?? 0);

  return {
    salurKg,
    donasiKg,
    komposKg,
    hilangKg: Number(harvestRow?.hilang ?? 0),
    totalPanenKg: Number(harvestRow?.total ?? 0),
    co2ePreventedKg: co2eFromPathways({ salur: salurKg, donasi: donasiKg, kompos: komposKg }),
    jumlahPanen: Number(harvestRow?.count ?? 0),
    jumlahAnggota: Number(memberRow?.n ?? 0),
    sejak: harvestRow?.first ? new Date(harvestRow.first) : null,
    hingga: harvestRow?.last ? new Date(harvestRow.last) : null,
  };
}
