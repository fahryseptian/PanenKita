"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts, user } from "@/lib/db/schema";
import { requireAdmin, requireKwtContext, requireSession } from "@/lib/session";
import { ACTIVE_KWT_COOKIE } from "@/lib/session";
import { sendWa, broadcastMessage } from "@/lib/wa";

/** Ambil kode undangan KWT; generate jika belum ada (admin). */
export async function getInviteCode(): Promise<string> {
  const ctx = await requireAdmin();
  if (ctx.inviteCode) return ctx.inviteCode;
  const code = `KWT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await db.update(kwts).set({ inviteCode: code }).where(eq(kwts.id, ctx.kwtId));
  return code;
}

/** Ganti peran anggota — hanya ketua yang boleh. */
export async function changeMemberRole(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  if (ctx.role !== "ketua") return;
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["ketua", "bendahara", "anggota"].includes(role)) return;
  if (userId === ctx.userId) return;
  await db
    .update(kwtMembers)
    .set({ role: role as "ketua" | "bendahara" | "anggota" })
    .where(
      and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, userId)),
    );
  revalidatePath("/dashboard/anggota");
}

/**
 * Broadcast WA pengumuman ke seluruh anggota KWT yang mengaktifkan notifikasi.
 * Hanya admin (ketua/bendahara). Dikirim berurutan dengan jeda kecil agar Fonnte
 * tidak kewalahan; setiap pengiriman tercatat di tabel notifications.
 */
export async function broadcastWa(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 3 || text.length > 1000) return;

  const recipients = await db
    .select({ phone: user.phone, name: user.name })
    .from(kwtMembers)
    .innerJoin(user, eq(kwtMembers.userId, user.id))
    .where(
      and(
        eq(kwtMembers.kwtId, ctx.kwtId),
        eq(user.waOptIn, true),
      ),
    );

  const message = broadcastMessage({ kwtName: ctx.kwtName, text });
  for (const r of recipients) {
    if (!r.phone) continue;
    await sendWa("broadcast", ctx.kwtId, { phone: r.phone, name: r.name }, message);
    await new Promise((resolve) => setTimeout(resolve, 300)); // throttle Fonnte
  }

  revalidatePath("/dashboard/anggota");
}

/**
 * Hapus anggota dari KWT (admin, biasanya ketua).
 * Panen yang pernah dicatat tetap tersimpan (riwayat laporan utuh);
 * yang hilang hanya keanggotaannya.
 */
export async function removeMember(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === ctx.userId) return; // tidak bisa hapus diri sendiri

  // Cegah menghapus ketua lain — transfer ketua dulu.
  const [target] = await db
    .select({ role: kwtMembers.role })
    .from(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, userId)))
    .limit(1);
  if (!target || target.role === "ketua") return;

  await db
    .delete(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, userId)));
  revalidatePath("/dashboard/anggota");
}

/**
 * Anggota keluar sendiri dari KWT aktif.
 * Ketua tidak boleh keluar tanpa transfer ketua / anggota lain tersisa.
 */
export async function leaveKwt(): Promise<void> {
  const ctx = await requireKwtContext();

  if (ctx.role === "ketua") {
    const members = await db
      .select({ userId: kwtMembers.userId })
      .from(kwtMembers)
      .where(eq(kwtMembers.kwtId, ctx.kwtId));
    if (members.length > 1) return; // transfer ketua dulu bila masih ada anggota
    // Ketua terakhir = kelompok ditinggalkan; biarkan (katalog tetap ada).
  }

  await db
    .delete(kwtMembers)
    .where(
      and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, ctx.userId)),
    );

  // Pindahkan cookie ke keanggotaan lain yang masih diikuti (bila ada).
  const remaining = await db
    .select({ kwtId: kwtMembers.kwtId })
    .from(kwtMembers)
    .where(eq(kwtMembers.userId, ctx.userId));

  const { cookies } = await import("next/headers");
  const store = await cookies();
  if (remaining.length > 0) {
    store.set(ACTIVE_KWT_COOKIE, remaining[0]!.kwtId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/dashboard");
  }
  redirect("/no-kwt");
}

/**
 * Transfer peran ketua ke anggota lain (ketua saat ini menjadi anggota).
 * Hanya ketua yang boleh; target harus anggota KWT yang sama.
 */
export async function transferChairmanship(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  if (ctx.role !== "ketua") return;
  const targetUserId = String(formData.get("userId") ?? "");
  if (!targetUserId || targetUserId === ctx.userId) return;

  const [target] = await db
    .select({ userId: kwtMembers.userId })
    .from(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, targetUserId)))
    .limit(1);
  if (!target) return;

  await db
    .update(kwtMembers)
    .set({ role: "anggota" })
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, ctx.userId)));
  await db
    .update(kwtMembers)
    .set({ role: "ketua" })
    .where(and(eq(kwtMembers.kwtId, ctx.kwtId), eq(kwtMembers.userId, targetUserId)));

  revalidatePath("/dashboard/anggota");
  revalidatePath("/dashboard/pengaturan");
}
