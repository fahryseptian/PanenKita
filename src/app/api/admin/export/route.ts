import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtSettlements, kwts, orders, platformFees } from "@/lib/db/schema";
import { getPlatformRole, getSession } from "@/lib/session";
import { csvFilename, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export?type=orders|fees|settlements
 * Ekspor data platform untuk superadmin (CSV siap Excel, delimiter ";").
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if ((await getPlatformRole(session.user.id)) !== "superadmin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const type = new URL(req.url).searchParams.get("type") ?? "orders";
  const today = new Date().toISOString().slice(0, 10);

  if (type === "fees") {
    const rows = await db
      .select({
        orderNumber: orders.orderNumber,
        kwtName: kwts.name,
        orderTotal: platformFees.orderTotal,
        ratePercent: platformFees.ratePercent,
        commissionFee: platformFees.commissionFee,
        handlingFee: platformFees.handlingFee,
        totalFee: platformFees.totalFee,
        netToKwt: platformFees.netToKwt,
        createdAt: platformFees.createdAt,
      })
      .from(platformFees)
      .innerJoin(orders, eq(platformFees.orderId, orders.id))
      .innerJoin(kwts, eq(platformFees.kwtId, kwts.id))
      .orderBy(desc(platformFees.createdAt))
      .limit(5000);

    const csv = toCsv(
      [
        "Tanggal",
        "Nomor Pesanan",
        "KWT",
        "Nilai Pesanan",
        "Rate (%)",
        "Komisi",
        "Handling",
        "Total Fee",
        "Bersih ke KWT",
      ],
      rows.map((r) => [
        r.createdAt.toISOString(),
        r.orderNumber,
        r.kwtName,
        r.orderTotal,
        r.ratePercent,
        r.commissionFee,
        r.handlingFee,
        r.totalFee,
        r.netToKwt,
      ]),
    );
    return csvResponse(csv, csvFilename(["fee-platform", today]));
  }

  if (type === "settlements") {
    const rows = await db
      .select({
        kwtName: kwts.name,
        amount: kwtSettlements.amount,
        feeCount: kwtSettlements.feeCount,
        settledThrough: kwtSettlements.settledThrough,
        createdAt: kwtSettlements.createdAt,
      })
      .from(kwtSettlements)
      .innerJoin(kwts, eq(kwtSettlements.kwtId, kwts.id))
      .orderBy(desc(kwtSettlements.createdAt))
      .limit(5000);

    const csv = toCsv(
      ["KWT", "Jumlah Cair", "Jumlah Fee", "Fee s/d", "Dicatat"],
      rows.map((r) => [
        r.kwtName,
        r.amount,
        r.feeCount,
        r.settledThrough.toISOString(),
        r.createdAt.toISOString(),
      ]),
    );
    return csvResponse(csv, csvFilename(["pencairan-fee", today]));
  }

  // default: orders
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      kwtName: kwts.name,
      buyerName: orders.buyerName,
      buyerPhone: orders.buyerPhone,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(kwts, eq(orders.kwtId, kwts.id))
    .orderBy(desc(orders.createdAt))
    .limit(5000);

  const csv = toCsv(
    ["Tanggal", "Nomor", "KWT", "Pembeli", "WhatsApp", "Status", "Total"],
    rows.map((r) => [
      r.createdAt.toISOString(),
      r.orderNumber,
      r.kwtName,
      r.buyerName,
      r.buyerPhone,
      r.status,
      r.total,
    ]),
  );
  return csvResponse(csv, csvFilename(["pesanan-platform", today]));
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
