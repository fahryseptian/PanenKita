"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback, notifications, user } from "@/lib/db/schema";
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

/** Kirim ulang notifikasi WhatsApp yang gagal (maks. 20 terbaru, bila token tersedia). */
export async function resendFailedWa(formData: FormData) {
  const ctx = await requireKwtContext();
  const id = String(formData.get("id") ?? "");

  const [notif] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.kwtId, ctx.kwtId)))
    .limit(1);
  if (!notif || notif.sent) {
    return { ok: false as const, error: "Notifikasi tidak ditemukan atau sudah terkirim" };
  }
  if (!process.env.FONTE_TOKEN) {
    return { ok: false as const, error: "FONTE_TOKEN belum diset di server" };
  }

  // Target kembali ke nomor penerima asli (bukan target override seperti productId).
  const phone = /^\d{8,15}$/.test(notif.target) ? notif.target : null;
  if (!phone) {
    return { ok: false as const, error: "Target asli bukan nomor WA (mis. log dedupe)" };
  }

  const { sendWa } = await import("@/lib/wa");
  await sendWa(notif.kind, ctx.kwtId, { phone }, notif.message);

  const [latest] = await db
    .select({ sent: notifications.sent })
    .from(notifications)
    .where(eq(notifications.kwtId, ctx.kwtId))
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  revalidatePath("/dashboard/panduan");
  return latest?.sent
    ? { ok: true as const }
    : { ok: false as const, error: "Pengiriman gagal lagi — periksa token/device Fonnte" };
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
