import { NextResponse } from "next/server";
import { listProvinces, listRegencies } from "@/lib/regions-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/regions?provinsi=32
 * Wilayah dari cache lokal (disinkronkan dari apiindonesia.id) — gratis per request.
 * Tanpa parameter: daftar provinsi. Dengan parameter: kabupaten/kota provinsi itu.
 */
export async function GET(req: Request) {
  const provinceCode = new URL(req.url).searchParams.get("provinsi");

  if (!provinceCode) {
    const provinces = await listProvinces();
    if (provinces.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Cache wilayah kosong — admin perlu menjalankan sync di Pengaturan" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, data: provinces });
  }

  const regencies = await listRegencies(provinceCode);
  return NextResponse.json({ ok: true, data: regencies });
}
