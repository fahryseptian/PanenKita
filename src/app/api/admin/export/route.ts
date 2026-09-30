import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtSettlements, kwts, orders, platformFees } from "@/lib/db/schema";
import { getPlatformRole, getSession } from "@/lib/session";
import { csvFilename, toCsv } from "@/lib/csv";
import { settlementMethodLabel } from "@/lib/settlement";

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
    // Semua baris ledger diekspor (termasuk yang dibalik) dengan penanda status
    // agar jejak audit lengkap; kolom "Berlaku" memisahkan pendapatan nyata.
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
        reversedAt: platformFees.reversedAt,
        reversedReason: platformFees.reversedReason,
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
        "Status",
        "Alasan Pembalikan",
        "Waktu Pembalikan",
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
        r.reversedAt ? "Dibatalkan" : "Aktif",
        r.reversedReason ?? "",
        r.reversedAt ? r.reversedAt.toISOString() : "",
      ]),
    );
    return csvResponse(csv, csvFilename(["fee-platform", today]));
  }

  if (type === "settlements") {
    // Tagihan biaya layanan platform ke KWT (arah dana: KWT → platform).
    const rows = await db
      .select({
        kwtName: kwts.name,
        amount: kwtSettlements.amount,
        feeCount: kwtSettlements.feeCount,
        method: kwtSettlements.method,
        reference: kwtSettlements.reference,
        note: kwtSettlements.note,
        settledThrough: kwtSettlements.settledThrough,
        paidAt: kwtSettlements.paidAt,
        createdAt: kwtSettlements.createdAt,
      })
      .from(kwtSettlements)
      .innerJoin(kwts, eq(kwtSettlements.kwtId, kwts.id))
      .orderBy(desc(kwtSettlements.createdAt))
      .limit(5000);

    const csv = toCsv(
      [
        "KWT",
        "Jumlah Tagihan",
        "Jumlah Fee",
        "Status",
        "Cara Bayar",
        "Referensi",
        "Catatan",
        "Fee s/d",
        "Dibuat",
        "Dibayar",
      ],
      rows.map((r) => [
        r.kwtName,
        r.amount,
        r.feeCount,
        r.paidAt ? "Lunas" : "Belum dibayar",
        r.paidAt ? settlementMethodLabel(r.method) : "",
        r.reference ?? "",
        r.note ?? "",
        r.settledThrough.toISOString(),
        r.createdAt.toISOString(),
        r.paidAt ? r.paidAt.toISOString() : "",
      ]),
    );
    return csvResponse(csv, csvFilename(["tagihan-fee", today]));
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
