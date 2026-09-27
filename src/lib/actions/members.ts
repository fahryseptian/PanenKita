"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";

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
