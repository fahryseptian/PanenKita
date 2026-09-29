import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Recompute harga berkala (Vercel Cron / scheduler eksternal).
 * Proteksi: x-cron-secret / Bearer CRON_SHARED_SECRET — wajib di produksi
 * (fail closed, lihat lib/cron-auth.ts).
 */
export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

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
