"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvests, kwtMembers, products, user } from "@/lib/db/schema";
import { requireKwtContext } from "@/lib/session";
import { harvestInputSchema } from "@/lib/validation";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { sendWa, harvestMessage } from "@/lib/wa";

export async function recordHarvest(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  const parsed = harvestInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    console.error("[recordHarvest]", parsed.error.issues[0]?.message);
    return;
  }
  const input = parsed.data;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!product) return;

  // Limbah tidak boleh melebihi total panen.
  const waste = Math.min(input.wasteQty, input.quantity);

  await db.insert(harvests).values({
    productId: product.id,
    memberId: ctx.userId,
    quantity: String(input.quantity),
    wasteQty: String(waste),
    quality: input.quality,
    note: input.note || null,
  });

  // Pricing engine: panen menambah stok -> harga bisa turun otomatis
  await recomputeProductPrice(product.id);

  // Notifikasi admin (best-effort, tidak pernah melempar error)
  const admins = await db
    .select({ phone: user.phone, name: user.name })
    .from(kwtMembers)
    .innerJoin(user, eq(kwtMembers.userId, user.id))
    .where(
      and(
        eq(kwtMembers.kwtId, ctx.kwtId),
        or(eq(kwtMembers.role, "ketua"), eq(kwtMembers.role, "bendahara")),
      ),
    );
  const msg = harvestMessage({
    productName: product.name,
    memberName: ctx.userName,
    quantity: input.quantity.toLocaleString("id-ID"),
    unit: product.unit,
    quality: input.quality,
  });

  await Promise.allSettled(
    admins
      .filter((a) => a.phone)
      .map((a) => sendWa("harvest", ctx.kwtId, { phone: a.phone!, name: a.name }, msg)),
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/panen");
  revalidatePath("/katalog");
}

/**
 * Admin mencatat susut/limbah pada panen yang sudah ada (mis. sebagian busuk
 * saat penyimpanan). Limbah mengurangi stok jual & masuk perhitungan ESG.
 */
export async function updateHarvestWaste(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) return;
  const id = String(formData.get("id") ?? "");
  const waste = Number(formData.get("wasteQty") ?? 0);
  if (!id || !Number.isFinite(waste) || waste < 0) return;

  const [row] = await db
    .select({ id: harvests.id, productId: harvests.productId, quantity: harvests.quantity })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .where(and(eq(harvests.id, id), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!row) return;

  await db
    .update(harvests)
    .set({ wasteQty: String(Math.min(waste, Number(row.quantity))) })
    .where(eq(harvests.id, id));
  await recomputeProductPrice(row.productId);
  revalidatePath("/dashboard/panen");
  revalidatePath("/katalog");
}

export async function deleteHarvest(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await db
    .select({ id: harvests.id, memberId: harvests.memberId, productId: harvests.productId })
    .from(harvests)
    .innerJoin(products, eq(harvests.productId, products.id))
    .where(and(eq(harvests.id, id), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!row) return;
  // Anggota hanya boleh hapus panen sendiri; admin bebas
  if (row.memberId !== ctx.userId && !ctx.isAdmin) return;

  await db.delete(harvests).where(eq(harvests.id, id));
  await recomputeProductPrice(row.productId);
  revalidatePath("/dashboard/panen");
  revalidatePath("/katalog");
}
