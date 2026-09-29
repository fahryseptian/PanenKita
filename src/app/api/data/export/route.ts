import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, notifications, pricingEvents, products, user } from "@/lib/db/schema";
import { ACTIVE_KWT_COOKIE, assertMembership, getSession } from "@/lib/session";
import { toCsv, csvFilename } from "@/lib/csv";
import { formatYmd } from "@/lib/report-period";

export const dynamic = "force-dynamic";

/**
 * GET /api/data/export?jenis=panen|produk|notifikasi|harga
 * Ekspor data mentah KWT aktif sebagai CSV (Excel-friendly).
 * Akses: anggota KWT terkait (query di-scope ke kwtId).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTIVE_KWT_COOKIE}=([^;]+)`),
  );
  const cookieKwtId = match?.[1];
  if (!cookieKwtId) {
    return NextResponse.json({ error: "no-active-kwt" }, { status: 403 });
  }

  const role = await assertMembership(cookieKwtId, session.user.id).catch(() => null);
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const jenis = new URL(req.url).searchParams.get("jenis") ?? "panen";

  if (jenis === "notifikasi") {
    const rows = await db
      .select({
        kind: notifications.kind,
        target: notifications.target,
        message: notifications.message,
        sent: notifications.sent,
        error: notifications.error,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.kwtId, cookieKwtId))
      .orderBy(desc(notifications.createdAt));

    const csv = toCsv(
      ["Waktu", "Jenis", "Target", "Terkirim", "Error", "Pesan"],
      rows.map((n) => [
        formatYmd(n.createdAt),
        n.kind,
        n.target,
        n.sent ? "ya" : "tidak",
        n.error ?? "",
        n.message,
      ]),
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(["notifikasi", "tanikita"])}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (jenis === "harga") {
    const rows = await db
      .select({
        productName: products.name,
        type: pricingEvents.type,
        oldPrice: pricingEvents.oldPrice,
        newPrice: pricingEvents.newPrice,
        reason: pricingEvents.reason,
        createdAt: pricingEvents.createdAt,
      })
      .from(pricingEvents)
      .innerJoin(products, eq(pricingEvents.productId, products.id))
      .where(eq(products.kwtId, cookieKwtId))
      .orderBy(desc(pricingEvents.createdAt));

    const csv = toCsv(
      ["Waktu", "Produk", "Tipe", "Harga Lama (Rp)", "Harga Baru (Rp)", "Alasan"],
      rows.map((e) => [
        formatYmd(e.createdAt),
        e.productName,
        e.type,
        e.oldPrice,
        e.newPrice,
        e.reason ?? "",
      ]),
   );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(["audit-harga", "tanikita"])}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (jenis === "produk") {
    const rows = await db
      .select({
        name: products.name,
        category: products.category,
        unit: products.unit,
        basePrice: products.basePrice,
        currentPrice: products.currentPrice,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.kwtId, cookieKwtId))
      .orderBy(products.name);

    const csv = toCsv(
      ["Nama Produk", "Kategori", "Satuan", "Harga Dasar (Rp)", "Harga Sekarang (Rp)", "Aktif"],
      rows.map((p) => [
        p.name,
        p.category,
        p.unit,
        p.basePrice,
        p.currentPrice,
        p.isActive ? "ya" : "tidak",
      ]),
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(["produk", "tanikita"])}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: panen
  const rows = await db
    .select({
      productName: products.name,
      unit: products.unit,
      memberName: user.name,
      quantity: harvests.quantity,
      wasteQty: harvests.wasteQty,
      wasteDestination: harvests.wasteDestination,
      quality: harvests.quality,
      note: harvests.note,
      harvestedAt: harvests.harvestedAt,
    })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .innerJoin(user, eq(harvests.memberId, user.id))
    .where(eq(products.kwtId, cookieKwtId))
    .orderBy(desc(harvests.harvestedAt));

  const csv = toCsv(
    [
      "Tanggal Panen",
      "Produk",
      "Satuan",
      "Jumlah",
      "Tidak Layak Jual",
      "Jalur Limbah",
      "Kualitas",
      "Anggota",
      "Catatan",
    ],
    rows.map((h) => [
      formatYmd(h.harvestedAt),
      h.productName,
      h.unit,
      Number(h.quantity),
      Number(h.wasteQty),
      h.wasteDestination,
      h.quality,
      h.memberName,
      h.note ?? "",
    ]),
  );
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(["panen", "tanikita"])}"`,
      "Cache-Control": "no-store",
    },
  });
}
