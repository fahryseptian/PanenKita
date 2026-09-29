import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  kwtCommissionSettings,
  kwts,
  orders,
  platformFees,
} from "@/lib/db/schema";
import {
  computeCommission,
  DEFAULT_COMMISSION,
  type CommissionConfig,
} from "@/lib/komisi";

/** Hanya baris fee aktif (belum dibalik) yang dihitung sebagai pendapatan. */
const ACTIVE_FEE = isNull(platformFees.reversedAt);

/**
 * Catat fee platform untuk pesanan terbayar (idempoten: satu baris per pesanan).
 * Bila baris sudah ada tetapi pernah dibalik (pesanan batal lalu dibayar lagi),
 * pembalikannya dibersihkan otomatis agar ledger mencerminkan kondisi terkini.
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

  // Pesanan dibayar (ulang) → batalkan pembalikan fee sebelumnya.
  await restorePlatformFee(order.id);
}

/** Bersihkan penanda pembalikan bila ada (dipakai saat pesanan aktif kembali). */
export async function restorePlatformFee(orderId: string): Promise<number> {
  const rows = await db
    .update(platformFees)
    .set({ reversedAt: null, reversedReason: null, reversedBy: null })
    .where(and(eq(platformFees.orderId, orderId), sql`${platformFees.reversedAt} is not null`))
    .returning({ id: platformFees.id });
  return rows.length;
}

/**
 * Balikkan fee sebuah pesanan (refund/pembatalan pesanan terbayar).
 * Baris ledger dipertahankan sebagai jejak audit, hanya ditandai dibalik.
 * Idempoten: pemanggilan kedua tidak mengubah apa pun.
 */
export async function reversePlatformFee(
  orderId: string,
  opts: { reason: string; byUserId?: string | null },
): Promise<boolean> {
  const rows = await db
    .update(platformFees)
    .set({
      reversedAt: new Date(),
      reversedReason: opts.reason,
      reversedBy: opts.byUserId ?? null,
    })
    .where(and(eq(platformFees.orderId, orderId), isNull(platformFees.reversedAt)))
    .returning({ id: platformFees.id });
  return rows.length > 0;
}

/**
 * Rekap fee KWT untuk laporan bendahara (baris dibalik tidak dihitung).
 * @param range opsional — batasi ke periode [from, to).
 */
export async function getKwtFeeSummary(
  kwtId: string,
  range?: { from: Date; to: Date },
) {
  const rows = await db
    .select({
      orderTotal: platformFees.orderTotal,
      commissionFee: platformFees.commissionFee,
      handlingFee: platformFees.handlingFee,
      totalFee: platformFees.totalFee,
      netToKwt: platformFees.netToKwt,
    })
    .from(platformFees)
    .where(
      range
        ? and(
            eq(platformFees.kwtId, kwtId),
            ACTIVE_FEE,
            gte(platformFees.createdAt, range.from),
            lt(platformFees.createdAt, range.to),
          )
        : and(eq(platformFees.kwtId, kwtId), ACTIVE_FEE),
    );

  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  return {
    feeCount: rows.length,
    grossTotal: sum((r) => r.orderTotal),
    totalFee: sum((r) => r.totalFee),
    netTotal: sum((r) => r.netToKwt),
  };
}

export interface FeeDriftRow {
  orderId: string;
  orderNumber: string;
  kwtId: string;
  kwtName: string;
  total: number;
  status: string;
  createdAt: Date;
}

/** Status pesanan yang seharusnya sudah punya baris fee. */
const DRIFT_STATUSES = ["paid", "processing", "completed"] as const;

/** KWT dengan komisi dimatikan — memang tidak dikenakan fee. */
function disabledCommissionKwtIds() {
  return db
    .select({ kwtId: kwtCommissionSettings.kwtId })
    .from(kwtCommissionSettings)
    .where(eq(kwtCommissionSettings.enabled, false));
}

/** Predikat drift: pesanan terbayar tanpa baris fee (KWT bebas komisi dikecualikan). */
function feeDriftFilter() {
  return and(
    inArray(orders.status, [...DRIFT_STATUSES]),
    notInArray(orders.kwtId, disabledCommissionKwtIds()),
    sql`not exists (select 1 from platform_fees pf where pf.order_id = ${orders.id})`,
  );
}

/**
 * Deteksi drift ledger: pesanan berstatus terbayar yang TIDAK punya baris fee.
 * KWT dengan komisi dimatikan dikecualikan (memang tidak dikenakan fee).
 */
export async function findFeeLedgerDrift(limit = 200): Promise<FeeDriftRow[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      kwtId: orders.kwtId,
      kwtName: kwts.name,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(kwts, eq(orders.kwtId, kwts.id))
    .where(feeDriftFilter())
    .orderBy(orders.createdAt)
    .limit(limit);

  return rows.map((r) => ({ ...r, status: r.status as string }));
}

/** Jumlah pasti pesanan terbayar tanpa catatan fee (untuk health & panel admin). */
export async function countFeeLedgerDrift(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(feeDriftFilter());
  return Number(row?.n ?? 0);
}

/** Ringkasan kesehatan ledger fee untuk panel superadmin (/admin). */
export interface FeeLedgerHealth {
  /** Jumlah pesanan terbayar tanpa baris fee (dibatasi `limit`). */
  driftCount: number;
  /** Contoh pesanan bermasalah (terbaru lebih dulu). */
  samples: FeeDriftRow[];
  /** true bila masih ada drift di luar `limit` — jalankan backfill lagi. */
  truncated: boolean;
}

export async function getFeeLedgerHealth(limit = 10): Promise<FeeLedgerHealth> {
  const [driftCount, samples] = await Promise.all([
    countFeeLedgerDrift(),
    findFeeLedgerDrift(limit),
  ]);
  return { driftCount, samples, truncated: driftCount > samples.length };
}

/**
 * Isi ulang baris fee yang hilang (mis. pesanan terbayar sebelum ledger ada,
 * atau kegagalan pencatatan). Mengembalikan jumlah yang dicatat.
 */
export async function backfillPlatformFees(limit = 500): Promise<{
  found: number;
  recorded: number;
}> {
  const drift = await findFeeLedgerDrift(limit);
  for (const row of drift) {
    await recordPlatformFee({ id: row.orderId, kwtId: row.kwtId, total: row.total });
  }
  return { found: drift.length, recorded: drift.length };
}
