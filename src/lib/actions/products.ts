"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pricingRules, products } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";
import { productInputSchema } from "@/lib/validation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function saveProduct(
  formData: FormData,
): Promise<void> {
  const ctx = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[saveProduct]", parsed.error.issues[0]?.message);
    return;
  }
  const input = parsed.data;

  // Slug unik dalam KWT (kecuali produk yang sedang diedit)
  let slug = slugify(input.name);
  for (let i = 2; i < 50; i++) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.kwtId, ctx.kwtId), eq(products.slug, slug)))
      .limit(1);
    if (!existing || existing.id === id) break;
    slug = `${slugify(input.name)}-${i}`;
  }

  if (id) {
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.kwtId, ctx.kwtId)))
      .limit(1);
    if (!existing) return;
    // Harga dasar boleh berubah; harga jual tetap dipegang pricing engine.
    await db
      .update(products)
      .set({
        name: input.name,
        slug,
        category: input.category,
        unit: input.unit,
        description: input.description || null,
        photoUrl: input.photoUrl || null,
        basePrice: input.basePrice,
      })
      .where(eq(products.id, id));
  } else {
    const [created] = await db
      .insert(products)
      .values({
        kwtId: ctx.kwtId,
        name: input.name,
        slug,
        category: input.category,
        unit: input.unit,
        description: input.description || null,
        photoUrl: input.photoUrl || null,
        basePrice: input.basePrice,
        currentPrice: input.basePrice,
      })
      .returning({ id: products.id });
    // Aturan harga default untuk produk baru (engine menghitung ulang otomatis)
    if (created) {
      await db
        .insert(pricingRules)
        .values({ productId: created.id })
        .onConflictDoNothing();
    }
  }

  revalidatePath("/dashboard/produk");
  revalidatePath("/katalog");
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!p) return;
  await db
    .update(products)
    .set({ isActive: !p.isActive })
    .where(eq(products.id, id));
  revalidatePath("/dashboard/produk");
  revalidatePath("/katalog");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.kwtId, ctx.kwtId)));
  revalidatePath("/dashboard/produk");
  revalidatePath("/katalog");
}
