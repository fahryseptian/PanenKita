import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, orders, orderItems, products, user } from "@/lib/db/schema";
import { co2eFromPathways, type PathwayBreakdown } from "./carbon";
import { getKwtFeeSummary } from "./fees-db";

/**
 * Rekap laporan bendahara per rentang tanggal (Fase 3).
 * Semua filter tanggal memakai batas atas eksklusif (gte from, lt to).
 */

/** Status pesanan yang uangnya sudah masuk kas. */
export const PAID_STATUSES = ["paid", "processing", "completed"] as const;

export interface LaporanPeriode {
  from: Date;
  to: Date;
  // Ringkasan
  totalPaid: number;
  orderCount: number;
  cancelledCount: number;
  pendingCount: number;
  avgOrder: number | null;
  // Zero-waste / ESG tiga jalur: tersalurkan (terjual), didonasikan, dikomposkan.
  // `hilang` (llegacy) dihitung terpisah dan TIDAK dihitung sebagai emisi terhindar.
  wasteKg: number;
  co2ePrevented: number;
  pathways: PathwayBreakdown & { hilang: number };
  co2eHilangRisk: number;
  // Komisi platform pada pesanan terbayar periode ini
  feeCount: number;
  platformFee: number;
  netToKwt: number;
  // Per produk
  perProduk: Array<{
    productId: string;
    productName: string;
    unit: string;
    qtySold: number;
    revenue: number;
    qtyHarvested: number;
    qtyWaste: number;
  }>;
  // Per anggota (panen)
  perAnggota: Array<{
    memberId: string;
    memberName: string;
    qtyHarvested: number;
    harvestCount: number;
  }>;
}

export async function getLaporanPeriode(
  kwtId: string,
  from: Date,
  to: Date,
): Promise<LaporanPeriode> {
  const paidStatuses = [...PAID_STATUSES];

  // ---- Ringkasan pesanan (semua status dihitung terpisah) ----
  const orderRows = await db
    .select({
      status: orders.status,
      total: sql<number>`${orders.total}::int`,
    })
    .from(orders)
    .where(and(eq(orders.kwtId, kwtId), gte(orders.createdAt, from), lt(orders.createdAt, to)));

  let totalPaid = 0;
  let paidCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;
  for (const o of orderRows) {
    if (paidStatuses.includes(o.status as (typeof paidStatuses)[number])) {
      totalPaid += o.total;
      paidCount += 1;
    } else if (o.status === "cancelled") cancelledCount += 1;
    else if (o.status === "pending") pendingCount += 1;
  }

  // ---- Per produk: penjualan (item pesanan terbayar) ----
  const paidOrderIds = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.kwtId, kwtId),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to),
        inArray(orders.status, paidStatuses),
      ),
    );

  const soldRows = paidOrderIds.length
    ? await db
        .select({
          productId: products.id,
          productName: products.name,
          unit: products.unit,
          qty: sql<string>`sum(${orderItems.quantity})`,
          revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})::int`,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, paidOrderIds.map((o) => o.id)))
        .groupBy(products.id, products.name, products.unit)
    : [];

  // ---- Per produk: panen pada periode yang sama (termasuk limbah per jalur) ----
  const harvestRows = await db
    .select({
      productId: products.id,
      qty: sql<string>`sum(${harvests.quantity})`,
      waste: sql<string>`sum(${harvests.wasteQty})`,
      unit: products.unit,
      wasteDonasi: sql<string>`sum(case when ${harvests.wasteDestination} = 'donasi' then ${harvests.wasteQty} else 0 end)`,
      wasteKompos: sql<string>`sum(case when ${harvests.wasteDestination} = 'kompos' then ${harvests.wasteQty} else 0 end)`,
      wasteHilang: sql<string>`sum(case when ${harvests.wasteDestination} = 'hilang' then ${harvests.wasteQty} else 0 end)`,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .where(
      and(
        eq(products.kwtId, kwtId),
        gte(harvests.harvestedAt, from),
        lt(harvests.harvestedAt, to),
      ),
    )
    .groupBy(products.id, products.unit);

  // Gabungkan (produk yang hanya panen / hanya terjual tetap tampil).
  const productMap = new Map<string, LaporanPeriode["perProduk"][number]>();
  for (const s of soldRows) {
    productMap.set(s.productId, {
      productId: s.productId,
      productName: s.productName,
      unit: s.unit,
      qtySold: Number(s.qty),
      revenue: Number(s.revenue),
      qtyHarvested: 0,
      qtyWaste: 0,
    });
  }
  let wasteKg = 0;
  const pathways: PathwayBreakdown & { hilang: number } = {
    salur: 0,
    donasi: 0,
    kompos: 0,
    hilang: 0,
  };
  for (const h of harvestRows) {
    const existing = productMap.get(h.productId);
    const qtyHarvested = Number(h.qty);
    const qtyWaste = Number(h.waste);
    if (h.unit === "kg") {
      wasteKg += qtyWaste;
      pathways.donasi += Number(h.wasteDonasi);
      pathways.kompos += Number(h.wasteKompos);
      pathways.hilang += Number(h.wasteHilang);
    }
    if (existing) {
      existing.qtyHarvested = qtyHarvested;
      existing.qtyWaste = qtyWaste;
    } else {
      const [p] = await db
        .select({ name: products.name, unit: products.unit })
        .from(products)
        .where(eq(products.id, h.productId))
        .limit(1);
      productMap.set(h.productId, {
        productId: h.productId,
        productName: p?.name ?? "(produk terhapus)",
        unit: p?.unit ?? "kg",
        qtySold: 0,
        revenue: 0,
        qtyHarvested,
        qtyWaste,
      });
    }
  }
  wasteKg = Math.round(wasteKg * 100) / 100;
  for (const k of ["salur", "donasi", "kompos", "hilang"] as const) {
    pathways[k] = Math.round(pathways[k] * 100) / 100;
  }
  const perProduk = [...productMap.values()].sort((a, b) => b.revenue - a.revenue || b.qtyHarvested - a.qtyHarvested);

  // ---- Per anggota: kontribusi panen ----
  // Fee hanya dari pesanan periode ini (createdAt fee = waktu pesanan terbayar).
  const feeSummary = await getKwtFeeSummary(kwtId, { from, to });

  const memberRows = await db
    .select({
      memberId: harvests.memberId,
      memberName: user.name,
      qty: sql<string>`sum(${harvests.quantity})`,
      count: sql<number>`count(*)::int`,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .innerJoin(user, eq(harvests.memberId, user.id))
    .where(
      and(
        eq(products.kwtId, kwtId),
        gte(harvests.harvestedAt, from),
        lt(harvests.harvestedAt, to),
      ),
    )
    .groupBy(harvests.memberId, user.name)
    .orderBy(desc(sql`sum(${harvests.quantity})`));

  const perAnggota = memberRows.map((m) => ({
    memberId: m.memberId,
    memberName: m.memberName,
    qtyHarvested: Number(m.qty),
    harvestCount: m.count,
  }));

  return {
    from,
    to,
    totalPaid,
    orderCount: paidCount,
    cancelledCount,
    pendingCount,
    avgOrder: paidCount > 0 ? Math.round(totalPaid / paidCount) : null,
    wasteKg,
    co2ePrevented: co2eFromPathways({
      salur: pathways.salur,
      donasi: pathways.donasi,
      kompos: pathways.kompos,
    }),
    pathways,
    // Potensi emisi dari limbah yang belum tertangani (bukan pencapaian).
    co2eHilangRisk: Math.round(pathways.hilang * 2.5 * 100) / 100,
    feeCount: feeSummary.feeCount,
    platformFee: feeSummary.totalFee,
    netToKwt: feeSummary.netTotal,
    perProduk,
    perAnggota,
  };
}
