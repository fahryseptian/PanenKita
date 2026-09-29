import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  kwtMembers,
  kwtSettlements,
  kwts,
  orders,
  platformFees,
  products,
  user,
} from "@/lib/db/schema";

/** Metrik ringkasan platform untuk dasbor superadmin (/admin). */
export async function getAdminOverview() {
  const since = new Date(Date.now() - 30 * 24 * 3_600_000);
  const paidStatuses = ["paid", "processing", "completed"] as const;

  const [statusRows, [userRow], [gmvRow], [feeRow], [pendingOrdersRow]] =
    await Promise.all([
      db
        .select({ status: kwts.status, n: count() })
        .from(kwts)
        .groupBy(kwts.status),
      db.select({ n: count() }).from(user),
      db
        .select({ total: sql<number>`coalesce(sum(${orders.total}), 0)::int` })
        .from(orders)
        .where(and(gte(orders.createdAt, since), inArray(orders.status, [...paidStatuses]))),
      db
        .select({ total: sql<number>`coalesce(sum(${platformFees.totalFee}), 0)::int` })
        .from(platformFees)
        .where(gte(platformFees.createdAt, since)),
      db
        .select({ n: count() })
        .from(orders)
        .where(eq(orders.status, "pending")),
    ]);

  const byStatus = Object.fromEntries(
    statusRows.map((r) => [r.status, Number(r.n)]),
  );

  return {
    kwtTotal: statusRows.reduce((acc, r) => acc + Number(r.n), 0),
    kwtApproved: byStatus["approved"] ?? 0,
    kwtPending: byStatus["pending"] ?? 0,
    kwtRejected: byStatus["rejected"] ?? 0,
    kwtSuspended: byStatus["suspended"] ?? 0,
    userTotal: Number(userRow?.n ?? 0),
    gmv30d: gmvRow?.total ?? 0,
    fee30d: feeRow?.total ?? 0,
    pendingOrders: Number(pendingOrdersRow?.n ?? 0),
  };
}

export type KwtModerationStatus = "pending" | "approved" | "rejected" | "suspended";

export interface PendingKwtRow {
  id: string;
  name: string;
  slug: string;
  regency: string | null;
  province: string | null;
  status: KwtModerationStatus;
  createdAt: Date;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorPhone: string | null;
}

/** Daftar KWT dengan pembuatnya (ketua pertama) — untuk moderasi. */
export async function listKwts(status?: string): Promise<PendingKwtRow[]> {
  const where =
    status && status !== "all"
      ? eq(kwts.status, status as KwtModerationStatus)
      : undefined;

  const rows = await db
    .select({
      id: kwts.id,
      name: kwts.name,
      slug: kwts.slug,
      regency: kwts.regency,
      province: kwts.province,
      status: kwts.status,
      createdAt: kwts.createdAt,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorPhone: user.phone,
    })
    .from(kwts)
    .leftJoin(
      kwtMembers,
      and(eq(kwtMembers.kwtId, kwts.id), eq(kwtMembers.role, "ketua")),
    )
    .leftJoin(user, eq(user.id, kwtMembers.userId))
    .where(where)
    .orderBy(desc(kwts.createdAt))
    .limit(100);

  // Dedupe bila KWT punya lebih dari satu ketua.
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    if (seen.has(r.id)) return [];
    seen.add(r.id);
    return [
      {
        ...r,
        status: r.status as KwtModerationStatus,
        creatorName: r.creatorName ?? null,
        creatorEmail: r.creatorEmail ?? null,
        creatorPhone: r.creatorPhone ?? null,
      },
    ];
  });
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "user" | "superadmin";
  kwtCount: number;
  createdAt: Date;
}

/** Daftar pengguna + pencarian nama/email, dengan jumlah keanggotaan KWT. */
export async function listUsers(q?: string): Promise<AdminUserRow[]> {
  const search = q?.trim();
  const conds: SQL[] = [];
  if (search) {
    conds.push(or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))!);
  }

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      kwtCount: sql<number>`(select count(*)::int from kwt_members km where km.user_id = ${user.id})`,
    })
    .from(user)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(100);

  return rows.map((r) => ({
    ...r,
    role: r.role as "user" | "superadmin",
    kwtCount: Number(r.kwtCount),
  }));
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  kwtName: string;
  buyerName: string;
  status: string;
  total: number;
  createdAt: Date;
}

/** Pesanan terbaru lintas KWT. */
export async function listRecentOrders(limit = 10): Promise<AdminOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      kwtName: kwts.name,
      buyerName: orders.buyerName,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(kwts, eq(orders.kwtId, kwts.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, status: r.status as string }));
}

export interface SettlementRow {
  kwtId: string;
  kwtName: string;
  /** Fee belum tercairkan (setelah settlement terakhir). */
  unsettledAmount: number;
  unsettledCount: number;
  /** Total fee sepanjang waktu (informasi). */
  totalAmount: number;
  settledThrough: Date | null;
}

/** Rekap fee per KWT: berapa yang sudah dicairkan dan berapa yang belum. */
export async function listSettlements(): Promise<SettlementRow[]> {
  // Subquery korelatif: fee setelah settlement terakhir dianggap belum tercairkan.
  const rows = await db
    .select({
      kwtId: kwts.id,
      kwtName: kwts.name,
      totalAmount: sql<number>`coalesce((
        select sum(pf.total_fee) from platform_fees pf where pf.kwt_id = ${kwts.id}
      ), 0)::int`,
      unsettledAmount: sql<number>`coalesce((
        select sum(pf.total_fee) from platform_fees pf
        where pf.kwt_id = ${kwts.id}
          and pf.created_at > coalesce((
            select max(s.settled_through) from kwt_settlements s where s.kwt_id = ${kwts.id}
          ), to_timestamp(0))
      ), 0)::int`,
      unsettledCount: sql<number>`coalesce((
        select count(*) from platform_fees pf
        where pf.kwt_id = ${kwts.id}
          and pf.created_at > coalesce((
            select max(s.settled_through) from kwt_settlements s where s.kwt_id = ${kwts.id}
          ), to_timestamp(0))
      ), 0)::int`,
      settledThrough: sql<Date | null>`(
        select max(s.settled_through) from kwt_settlements s where s.kwt_id = ${kwts.id}
      )`,
    })
    .from(kwts)
    .orderBy(kwts.name);

  return rows.map((r) => ({
    kwtId: r.kwtId,
    kwtName: r.kwtName,
    unsettledAmount: Number(r.unsettledAmount),
    unsettledCount: Number(r.unsettledCount),
    totalAmount: Number(r.totalAmount),
    settledThrough: r.settledThrough ? new Date(r.settledThrough) : null,
  }));
}

/** Fee yang belum tercairkan untuk satu KWT (untuk aksi pencairan). */
export async function getUnsettledFees(kwtId: string): Promise<{
  amount: number;
  count: number;
}> {
  const [last] = await db
    .select({ settledThrough: kwtSettlements.settledThrough })
    .from(kwtSettlements)
    .where(eq(kwtSettlements.kwtId, kwtId))
    .orderBy(desc(kwtSettlements.settledThrough))
    .limit(1);

  const conds: SQL[] = [eq(platformFees.kwtId, kwtId)];
  if (last?.settledThrough) conds.push(gt(platformFees.createdAt, last.settledThrough));

  const [agg] = await db
    .select({
      amount: sql<number>`coalesce(sum(${platformFees.totalFee}), 0)::int`,
      n: count(),
    })
    .from(platformFees)
    .where(and(...conds));

  return { amount: Number(agg?.amount ?? 0), count: Number(agg?.n ?? 0) };
}

/** Riwayat pencairan fee terbaru lintas KWT. */
export async function listSettlementHistory(limit = 20) {
  return db
    .select({
      id: kwtSettlements.id,
      kwtName: kwts.name,
      amount: kwtSettlements.amount,
      feeCount: kwtSettlements.feeCount,
      settledThrough: kwtSettlements.settledThrough,
      createdAt: kwtSettlements.createdAt,
    })
    .from(kwtSettlements)
    .innerJoin(kwts, eq(kwtSettlements.kwtId, kwts.id))
    .orderBy(desc(kwtSettlements.createdAt))
    .limit(limit);
}

/** Jumlah produk & anggota per KWT (untuk tabel /admin/kwt). */
export async function getKwtCounts(): Promise<
  Map<string, { products: number; members: number }>
> {
  const [prodRows, memberRows] = await Promise.all([
    db
      .select({ kwtId: products.kwtId, n: count() })
      .from(products)
      .groupBy(products.kwtId),
    db
      .select({ kwtId: kwtMembers.kwtId, n: count() })
      .from(kwtMembers)
      .groupBy(kwtMembers.kwtId),
  ]);
  const map = new Map<string, { products: number; members: number }>();
  for (const r of prodRows) map.set(r.kwtId, { products: Number(r.n), members: 0 });
  for (const r of memberRows) {
    const cur = map.get(r.kwtId) ?? { products: 0, members: 0 };
    cur.members = Number(r.n);
    map.set(r.kwtId, cur);
  }
  return map;
}
