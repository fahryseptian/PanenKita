"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { harvestSchedules, harvests, kwtMembers, products, user } from "@/lib/db/schema";
import { getAvailableStock } from "@/lib/stock";
import { requireKwtContext } from "@/lib/session";
import { harvestInputSchema } from "@/lib/validation";
import { recomputeProductPrice } from "@/lib/pricing-db";
import { notifyStockOut } from "@/lib/stock-alerts";
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
  // Jalur ESG hanya relevan bila ada limbah; default hilang (konservatif).
  const destination = waste > 0 ? input.wasteDestination : "hilang";

  await db.insert(harvests).values({
    productId: product.id,
    memberId: ctx.userId,
    quantity: String(input.quantity),
    wasteQty: String(waste),
    wasteDestination: destination,
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
 * Buat jadwal panen berulang: stok produk terisi otomatis tiap hari terpilih.
 * Satu jadwal per produk per hari (unik di DB). Admin saja.
 */
export async function createHarvestSchedule(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) return;
  const productId = String(formData.get("productId") ?? "");
  const memberId = String(formData.get("memberId") ?? ctx.userId);
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const quantity = Number(formData.get("quantity"));
  const quality = String(formData.get("quality") ?? "A");
  if (
    !productId ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !["A", "B", "C"].includes(quality)
  ) {
    return;
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.kwtId, ctx.kwtId)))
    .limit(1);
  if (!product) return;

  // Anggota pelaksana harus anggota KWT ini.
  const [member] = await db
    .select({ userId: kwtMembers.userId })
    .from(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, memberId)))
    .limit(1);
  if (!member) return;

  await db
    .insert(harvestSchedules)
    .values({
      kwtId: ctx.kwtId,
      productId,
      memberId,
      quantity: String(quantity),
      quality,
      dayOfWeek,
    })
    .onConflictDoNothing(); // (product_id, day_of_week) sudah ada -> abaikan

  revalidatePath("/dashboard/panen");
}

/** Aktifkan/pause jadwal tanpa menghapusnya. */
export async function toggleHarvestSchedule(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await db
    .select({ isActive: harvestSchedules.isActive })
    .from(harvestSchedules)
    .where(and(eq(harvestSchedules.id, id), eq(harvestSchedules.kwtId, ctx.kwtId)))
    .limit(1);
  if (!row) return;

  await db
    .update(harvestSchedules)
    .set({ isActive: !row.isActive })
    .where(eq(harvestSchedules.id, id));
  revalidatePath("/dashboard/panen");
}

export async function deleteHarvestSchedule(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .delete(harvestSchedules)
    .where(and(eq(harvestSchedules.id, id), eq(harvestSchedules.kwtId, ctx.kwtId)));
  revalidatePath("/dashboard/panen");
}

/**
 * Admin mencatat susut/limbah pada panen yang sudah ada (mis. sebagian busuk
 * saat penyimpanan) beserta jalur ESG-nya (donasi/kompos/hilang). Limbah
 * mengurangi stok jual & masuk perhitungan ESG sesuai jalur.
 */
export async function updateHarvestWaste(formData: FormData): Promise<void> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) return;
  const id = String(formData.get("id") ?? "");
  const waste = Number(formData.get("wasteQty") ?? 0);
  const destRaw = String(formData.get("wasteDestination") ?? "hilang");
  const destination = (["donasi", "kompos", "hilang"] as const).includes(
    destRaw as "donasi" | "kompos" | "hilang",
  )
    ? (destRaw as "donasi" | "kompos" | "hilang")
    : "hilang";
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
    .set({
      wasteQty: String(Math.min(waste, Number(row.quantity))),
      wasteDestination: waste > 0 ? destination : "hilang",
    })
    .where(eq(harvests.id, id));
  await recomputeProductPrice(row.productId);
  // Limbah naik bisa membuat stok menyentuh 0 -> peringatkan pengurus.
  const stockAfter = await getAvailableStock([row.productId]);
  if ((stockAfter.get(row.productId)?.available ?? 0) <= 0) {
    await notifyStockOut(row.productId);
  }
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
  // Panen dihapus bisa membuat stok habis -> peringatkan pengurus.
  const stockNow = await getAvailableStock([row.productId]);
  if ((stockNow.get(row.productId)?.available ?? 0) <= 0) {
    await notifyStockOut(row.productId);
  }
  revalidatePath("/dashboard/panen");
  revalidatePath("/katalog");
}
