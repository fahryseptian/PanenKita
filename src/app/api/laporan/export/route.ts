import { NextResponse } from "next/server";
import { ACTIVE_KWT_COOKIE, assertMembership, getSession } from "@/lib/session";
import { getLaporanPeriode } from "@/lib/queries-laporan";
import { resolveReportRange, formatYmd } from "@/lib/report-period";
import { toCsv, csvFilename } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * GET /api/laporan/export?from=&to=&preset=
 * Ekspor rekap laporan bendahara KWT aktif sebagai CSV (Excel-friendly).
 * Akses: anggota KWT terkait (query di-scope ke kwtId).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // KWT aktif via cookie (sama seperti dashboard); validasi keanggotaan.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTIVE_KWT_COOKIE}=([^;]+)`),
  );
  const cookieKwtId = match?.[1];
  if (!cookieKwtId) {
    return NextResponse.json({ error: "no-active-kwt" }, { status: 403 });
  }

  const role = await assertMembership(cookieKwtId, session.user.id).catch(
    () => null,
  );
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const range = resolveReportRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    url.searchParams.get("preset"),
  );
  const laporan = await getLaporanPeriode(cookieKwtId!, range.from, range.to);

  const labelDari = formatYmd(range.from);
  const labelSampai = formatYmd(new Date(range.to.getTime() - 86_400_000));

  // ---- Bagian 1: ringkasan + rekap per produk ----
  const produkRows: Array<Array<string | number>> = laporan.perProduk.map(
    (p) => [p.productName, p.unit, p.qtySold, p.qtyHarvested, p.qtyWaste, p.revenue],
  );

  // ---- Bagian 2: kontribusi panen anggota ----
  const anggotaRows: Array<Array<string | number>> = laporan.perAnggota.map(
    (m) => [m.memberName, m.harvestCount, m.qtyHarvested],
  );

  const csv = [
    toCsv(
      ["Laporan Bendahara PanenKita"],
      [[`Periode: ${labelDari} s.d. ${labelSampai}`]],
    ),
    toCsv(
      ["Produk", "Satuan", "Terjual", "Panen", "Tidak Layak Jual", "Pendapatan (Rp)"],
      produkRows,
    ),
    toCsv(
      ["Kontribusi Panen Anggota", "Kali Panen", "Total Panen (kg)"],
      anggotaRows,
    ),
    toCsv(
      ["Zero-Waste / ESG (Tiga Jalur)", "Kg", "Faktor CO2e/kg", "CO2e Terhindar (kg)"],
      [
        ["1. Tersalurkan (terjual)", laporan.perProduk.reduce((a, p) => a + p.qtySold, 0), 2.5, laporan.pathways.salur * 2.5],
        ["2. Didonasikan", laporan.pathways.donasi, 2.5, laporan.pathways.donasi * 2.5],
        ["3. Dikomposkan", laporan.pathways.kompos, 0.5, laporan.pathways.kompos * 0.5],
        ["(Belum tertangani - hilang)", laporan.pathways.hilang, "", ""],
        ["TOTAL CO2e terhindar", "", "", laporan.co2ePrevented],
      ],
    ),
  ].join("");

  const filename = csvFilename(["laporan", labelDari, labelSampai]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
