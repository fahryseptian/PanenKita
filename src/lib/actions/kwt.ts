"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts, pricingRules, products } from "@/lib/db/schema";
import { ACTIVE_KWT_COOKIE, requireSession } from "@/lib/session";
import { kwtRegistrationSchema } from "@/lib/validation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function randomCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Pindah KWT aktif (cookie) — hanya antara kelompok yang diikuti. */
export async function switchKwt(kwtId: string): Promise<void> {
  const session = await requireSession();
  const memberships = await db
    .select({ kwtId: kwtMembers.kwtId })
    .from(kwtMembers)
    .where(eq(kwtMembers.userId, session.user.id));
  if (!memberships.some((m) => m.kwtId === kwtId)) return;

  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(ACTIVE_KWT_COOKIE, kwtId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Daftarkan kelompok baru (diri sendiri sebagai ketua).
 * Dibuat untuk skala nasional: setiap ketua KWT bisa memulai tanpa perantara.
 */
export async function createKwt(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = kwtRegistrationSchema.safeParse({
    name: formData.get("name"),
    regency: formData.get("regency"),
    province: formData.get("province") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    redirect(`/daftar-kwt?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid")}`);
  }
  const input = parsed.data!;

  // Slug unik global (katalog publik /katalog/[slug])
  let slug = slugify(input.name);
  for (let i = 2; i < 50; i++) {
    const [taken] = await db.select({ id: kwts.id }).from(kwts).where(eq(kwts.slug, slug)).limit(1);
    if (!taken) break;
    slug = `${slugify(input.name)}-${i}`;
  }

  let inviteCode = randomCode("KWT");
  for (let i = 0; i < 5; i++) {
    const [taken] = await db.select({ id: kwts.id }).from(kwts).where(eq(kwts.inviteCode, inviteCode)).limit(1);
    if (!taken) break;
    inviteCode = randomCode("KWT");
  }

  const [kwt] = await db
    .insert(kwts)
    .values({
      name: input.name,
      slug,
      regency: input.regency,
      province: input.province || null,
      address: input.address || null,
      inviteCode,
    })
    .returning();
  if (!kwt) redirect("/daftar-kwt?error=Gagal%20membuat%20kelompok");

  await db.insert(kwtMembers).values({
    kwtId: kwt.id,
    userId: session.user.id,
    role: "ketua",
  });

  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(ACTIVE_KWT_COOKIE, kwt.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/katalog");
  revalidatePath("/dashboard");
  redirect("/dashboard?baru=1");
}

/** Gabung ke KWT via kode undangan — multi-keanggotaan, tidak menimpa yang lain. */
export async function joinKwt(formData: FormData) {
  const session = await requireSession();
  const code = String(formData.get("inviteCode") ?? "").trim().toUpperCase();
  if (!code) return { ok: false as const, error: "Kode undangan wajib diisi" };

  const [kwt] = await db.select().from(kwts).where(eq(kwts.inviteCode, code)).limit(1);
  if (!kwt) return { ok: false as const, error: "Kode undangan tidak valid" };

  await db
    .insert(kwtMembers)
    .values({ kwtId: kwt.id, userId: session.user.id, role: "anggota" })
    .onConflictDoNothing();

  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(ACTIVE_KWT_COOKIE, kwt.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
