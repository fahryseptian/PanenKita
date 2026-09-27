"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtCommissionSettings, pricingRules, products } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import type { WholesaleTier } from "@/lib/wholesale";

/** Simpan tier harga grosir satu produk (admin). Contoh input: "10:5, 50:10". */
export async function saveWholesaleTiers(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const raw = String(formData.get("tiers") ?? "").trim();
  if (!productId) return;

  // Produk harus milik KWT aktif.
  const [p] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!p) return;

  let tiers: WholesaleTier[] = [];
  if (raw) {
    tiers = raw
      .split(",")
      .map((pair) => {
        const parts = pair.split(":").map((s) => Number(s.trim()));
        const qty = parts[0] ?? 0;
        const pct = parts[1] ?? 0;
        return { minQty: Math.floor(qty), percentOff: Math.round(pct) };
      })
      .filter(
        (t) =>
          Number.isFinite(t.minQty) &&
          Number.isFinite(t.percentOff) &&
          t.minQty > 0 &&
          t.percentOff > 0 &&
          t.percentOff < 90,
      )
      .sort((a, b) => a.minQty - b.minQty);
  }

  await db
    .insert(pricingRules)
    .values({ productId, wholesaleTiers: JSON.stringify(tiers) })
    .onConflictDoUpdate({
      target: pricingRules.productId,
      set: { wholesaleTiers: JSON.stringify(tiers) },
    });

  revalidatePath("/dashboard/harga");
  revalidatePath(`/katalog`);
}

/** Simpan pengaturan komisi KWT (admin). Input persen & rupiah. */
export async function saveCommissionSettings(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const num = (name: string, def: number) => {
    const v = Number(formData.get(name));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
  };
  const values = {
    ratePercent: Math.min(30, num("ratePercent", 2)),
    handlingFee: Math.min(100_000, num("handlingFee", 500)),
    minOrderValue: Math.min(10_000_000, num("minOrderValue", 10_000)),
    discountThreshold: num("discountThreshold", 1_000_000),
    discountPercent: Math.min(30, num("discountPercent", 1)),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  };

  await db
    .insert(kwtCommissionSettings)
    .values({ kwtId: ctx.kwtId, ...values })
    .onConflictDoUpdate({
      target: kwtCommissionSettings.kwtId,
      set: { ...values, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/harga");
}
