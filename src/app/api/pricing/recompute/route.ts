import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { recomputeProductPrice } from "@/lib/pricing-db";

export const dynamic = "force-dynamic";

/**
 * Recompute harga berkala (Vercel Cron / scheduler eksternal).
 * Proteksi: header x-cron-secret harus sama dengan CRON_SHARED_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SHARED_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    // Vercel Cron otomatis mengirim `Authorization: Bearer $CRON_SECRET`
    // jika env CRON_SECRET diset di proyek Vercel.
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!secret) {
    console.warn("[pricing-cron] CRON_SHARED_SECRET not set; allowing request (dev mode)");
  }

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.isActive, true));

  let updated = 0;
  for (const p of rows) {
    const result = await recomputeProductPrice(p.id);
    if (result?.changed) updated += 1;
  }

  return NextResponse.json({ ok: true, checked: rows.length, updated });
}
