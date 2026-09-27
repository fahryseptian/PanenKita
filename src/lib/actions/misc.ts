"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback, user } from "@/lib/db/schema";
import { requireKwtContext, requireSession } from "@/lib/session";
import { feedbackInputSchema, normalizePhone } from "@/lib/validation";
import { sendWa, testMessage } from "@/lib/wa";

/** Perbarui nomor WhatsApp dan preferensi notifikasi. */
export async function updateProfile(formData: FormData) {
  const session = await requireSession();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const waOptIn = formData.get("waOptIn") === "on";
  if (phone && !/^628\d{7,12}$/.test(phone)) {
    return { ok: false as const, error: "Format nomor tidak valid (628xxxxxxxxxx)" };
  }
  await db
    .update(user)
    .set({ phone: phone || null, waOptIn, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  revalidatePath("/dashboard/profil");
  return { ok: true as const };
}

/** Kirim pesan uji WhatsApp (dari dashboard anggota). */
export async function sendTestWa(formData: FormData) {
  const ctx = await requireKwtContext();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!/^628\d{7,12}$/.test(phone)) {
    return { ok: false as const, error: "Nomor tidak valid" };
  }
  await sendWa("test", ctx.kwtId, { phone, name: ctx.userName }, testMessage(ctx.userName));
  revalidatePath("/dashboard/profil");
  return { ok: true as const };
}

/** Umpan balik pilot project. */
export async function submitFeedback(formData: FormData) {
  const ctx = await requireKwtContext();
  const parsed = feedbackInputSchema.safeParse({
    rating: formData.get("rating"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  await db.insert(feedback).values({
    kwtId: ctx.kwtId,
    userId: ctx.userId,
    rating: parsed.data.rating,
    message: parsed.data.message,
  });
  revalidatePath("/dashboard/panduan");
  return { ok: true as const };
}
