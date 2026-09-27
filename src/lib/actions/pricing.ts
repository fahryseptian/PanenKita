"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, products, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, priceChangeMessage } from "@/lib/wa";

/** Hitung ulang harga semua produk KWT (admin) + notify anggota opt-in. */
export async function recomputeAllPrices(): Promise<{
  ok: true;
  updated: number;
} | { ok: false; error: string }> {
  const ctx = await requireAdmin();
  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.kwtId, ctx.kwtId), eq(products.isActive, true)));

  let updated = 0;
  const changes: Array<{ productName: string; oldPrice: number; newPrice: number; reason: string }> = [];

  for (const p of productRows) {
    const result = await recomputeProductPrice(p.id);
    if (result?.changed) {
      updated += 1;
      changes.push({
        productName: p.name,
        oldPrice: result.oldPrice,
        newPrice: result.newPrice,
        reason: result.reason,
      });
    }
  }

  // Kabari anggota yang opt-in via WhatsApp (best-effort)
  if (changes.length > 0) {
    const members = await db
      .select({ phone: user.phone, name: user.name })
      .from(kwtMembers)
      .innerJoin(user, eq(kwtMembers.userId, user.id))
      .where(
        and(
          eq(kwtMembers.kwtId, ctx.kwtId),
          eq(kwtMembers.role, "anggota"),
          eq(user.waOptIn, true),
        ),
      );
    const optIns = members.filter((m) => m.phone);
    await Promise.allSettled(
      optIns.flatMap((m) =>
        changes.map((c) =>
          sendWa(
            "price_change",
            ctx.kwtId,
            { phone: m.phone!, name: m.name },
            priceChangeMessage(c),
          ),
        ),
      ),
    );
  }

  revalidatePath("/dashboard/harga");
  revalidatePath("/katalog");
  return { ok: true, updated };
}
