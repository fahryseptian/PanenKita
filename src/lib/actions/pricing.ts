"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, pricingRules, products, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, priceChangeMessage } from "@/lib/wa";

/** Hitung ulang harga semua produk KWT (admin) + notify anggota opt-in. */
export async function recomputeAllPrices(): Promise<
  { ok: true; updated: number } | { ok: false; error: string }
> {
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

/**
 * Simpan override aturan harga satu produk (admin). Kosong = kembali ke
 * aturan default engine. Nilai persen bisa negatif untuk diskon stok tinggi.
 */
export async function saveProductPricingRule(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  // Produk harus milik KWT aktif.
  const [p] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!p) return;

  const num = (name: string): number | null => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.trunc(v) : null;
  };

  const lowStockThreshold = num("lowStockThreshold");
  const highStockThreshold = num("highStockThreshold");
  const lowStockPercent = num("lowStockPercent");
  const highStockPercent = num("highStockPercent");
  const surgeMinOrders = num("surgeMinOrders");
  const surgePercent = num("surgePercent");
  const minPricePercent = num("minPricePercent");
  const maxPricePercent = num("maxPricePercent");

  const hasAny =
    lowStockThreshold !== null ||
    highStockThreshold !== null ||
    lowStockPercent !== null ||
    highStockPercent !== null ||
    surgeMinOrders !== null ||
    surgePercent !== null ||
    minPricePercent !== null ||
    maxPricePercent !== null;

  if (!hasAny) {
    // Semua kosong -> hapus override, kembali ke default engine.
    await db
      .delete(pricingRules)
      .where(eq(pricingRules.productId, productId));
    revalidatePath("/dashboard/harga");
    return;
  }

  // Ambil baris yang ada agar kolom yang tak diisi (mis. wholesaleTiers) utuh.
  const [existing] = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.productId, productId))
    .limit(1);

  const values = {
    productId,
    lowStockThreshold: String(lowStockThreshold ?? Number(existing?.lowStockThreshold ?? 10)),
    highStockThreshold: String(
      highStockThreshold ?? Number(existing?.highStockThreshold ?? 100),
    ),
    lowStockPercent: lowStockPercent ?? existing?.lowStockPercent ?? 10,
    highStockPercent: highStockPercent ?? existing?.highStockPercent ?? -10,
    surgeMinOrders: surgeMinOrders ?? existing?.surgeMinOrders ?? 5,
    surgePercent: surgePercent ?? existing?.surgePercent ?? 5,
    minPricePercent: minPricePercent ?? existing?.minPricePercent ?? 70,
    maxPricePercent: maxPricePercent ?? existing?.maxPricePercent ?? 150,
    updatedAt: new Date(),
  };

  await db
    .insert(pricingRules)
    .values(values)
    .onConflictDoUpdate({ target: pricingRules.productId, set: values });

  // Terapkan langsung agar audit trail menunjukkan efek override.
  await recomputeProductPrice(productId);

  revalidatePath("/dashboard/harga");
  revalidatePath("/katalog");
}
