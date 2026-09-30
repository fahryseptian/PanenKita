"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwtMembers, kwts, pricingRules, products, user } from "@/lib/db/schema";
import { ACTIVE_KWT_COOKIE, requireAdmin, requireSession } from "@/lib/session";
import { kwtRegistrationSchema } from "@/lib/validation";
import { WA_TOKEN_KEY, deleteSetting, getWaTokenStatus, setSetting } from "@/lib/app-settings";
import { API_INDONESIA_KEY_SETTING } from "@/lib/api-indonesia";
import { syncRegions } from "@/lib/regions-db";
import { sendWa, testMessage } from "@/lib/wa";
import { isEmailEnabled, newKwtAlertEmail, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

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
    regionCode: formData.get("regionCode") || undefined,
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
      regionCode: input.regionCode || null,
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

  // Kabari superadmin lewat email: kelompok baru perlu ditinjau.
  await alertSuperadminsOfNewKwt({
    kwtName: input.name,
    creatorName: session.user.name,
    creatorEmail: session.user.email,
    ...(input.regency ? { region: [input.regency, input.province].filter(Boolean).join(", ") } : {}),
  });

  revalidatePath("/katalog");
  revalidatePath("/dashboard");
  redirect("/dashboard?baru=1");
}

/** Email ke semua superadmin: ada KWT baru menunggu persetujuan. */
async function alertSuperadminsOfNewKwt(opts: {
  kwtName: string;
  creatorName: string;
  creatorEmail: string;
  region?: string;
}): Promise<void> {
  if (!isEmailEnabled()) return;
  try {
    const admins = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.role, "superadmin"));
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return;

    const template = newKwtAlertEmail({
      ...opts,
      adminUrl: `${appUrl()}/admin/kwt?status=pending`,
    });
    await sendEmail({
      to: recipients,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (err) {
    console.error("[kwt] failed to alert superadmins by email", err);
  }
}

/**
 * Perbarui profil KWT (nama, alamat, wilayah) — hanya ketua.
 * Slug ikut disesuaikan bila nama berubah (tetap unik global).
 */
export async function updateKwtProfile(formData: FormData): Promise<void> {
  const session = await requireSession();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;

  // Hanya ketua KWT terkait yang boleh mengubah profil.
  const [membership] = await db
    .select({ role: kwtMembers.role })
    .from(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, kwtId), eq(kwtMembers.userId, session.user.id)))
    .limit(1);
  if (membership?.role !== "ketua") return;

  const parsed = kwtRegistrationSchema.safeParse({
    name: formData.get("name"),
    regency: formData.get("regency"),
    province: formData.get("province") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/dashboard/pengaturan?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid")}`,
    );
  }
  const input = parsed.data!;

  // Slug unik global; jika tabrakan, tambahkan akhiran -2, -3, ...
  let slug = slugify(input.name);
  for (let i = 2; i < 50; i++) {
    const [taken] = await db
      .select({ id: kwts.id })
      .from(kwts)
      .where(eq(kwts.slug, slug))
      .limit(1);
    if (!taken || taken.id === kwtId) break;
    slug = `${slugify(input.name)}-${i}`;
  }

  await db
    .update(kwts)
    .set({
      name: input.name,
      slug,
      regency: input.regency,
      province: input.province || null,
      address: input.address || null,
    })
    .where(eq(kwts.id, kwtId));

  revalidatePath("/katalog");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");
  redirect("/dashboard/pengaturan?sukses=1");
}

/**
 * Simpan kanal pembayaran KWT untuk pembeli (rekening, QRIS, catatan).
 * PanenKita tidak memegang uang: data inilah yang dipakai pembeli untuk
 * membayar langsung ke KWT, dan ditampilkan di halaman pesanan.
 * Ketua & bendahara boleh mengubah (bukan hanya ketua seperti profil).
 */
export async function saveKwtPaymentInfo(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const text = (name: string, max: number): string | null => {
    const v = String(formData.get(name) ?? "").trim();
    return v ? v.slice(0, max) : null;
  };

  const bankName = text("bankName", 60);
  const bankAccountNumber = text("bankAccountNumber", 40);
  const bankAccountHolder = text("bankAccountHolder", 80);
  const paymentNote = text("paymentNote", 300);
  const qrisImageUrl = text("qrisImageUrl", 500);

  // Rekening harus lengkap: nomor tanpa nama bank tidak bisa dipakai pembeli.
  if (bankAccountNumber && !bankName) {
    redirect(
      `/dashboard/pengaturan?error=${encodeURIComponent("Nama bank wajib diisi bila ada nomor rekening")}`,
    );
  }

  // QRIS hanya menerima key bucket (hasil unggah) atau tautan http(s).
  const qrisValid =
    !qrisImageUrl ||
    /^https?:\/\//i.test(qrisImageUrl) ||
    /^qris\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(qrisImageUrl);
  if (!qrisValid) {
    redirect(
      `/dashboard/pengaturan?error=${encodeURIComponent("Tautan QRIS tidak valid")}`,
    );
  }

  await db
    .update(kwts)
    .set({
      bankName,
      bankAccountNumber,
      bankAccountHolder,
      qrisImageUrl,
      paymentNote,
    })
    .where(eq(kwts.id, ctx.kwtId));

  revalidatePath("/dashboard/pengaturan");
  revalidatePath(`/katalog/${ctx.kwtSlug}`);
  redirect("/dashboard/pengaturan?sukses=pembayaran");
}

/**
 * Simpan token Fonnte (WA) di app_settings — admin KWT bisa mengaturnya sendiri
 * tanpa akses dashboard Vercel. Nilai tidak pernah dikirim balik ke browser.
 */
export async function saveWaToken(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return;
  await setSetting(WA_TOKEN_KEY, token);

  // Verifikasi langsung: kirim pesan uji ke admin yang menyimpan (bila punya nomor).
  const [me] = await db
    .select({ phone: user.phone })
    .from(user)
    .where(eq(user.id, ctx.userId))
    .limit(1);
  if (me?.phone) {
    await sendWa("test", ctx.kwtId, { phone: me.phone, name: ctx.userName }, testMessage(ctx.userName));
  }
  revalidatePath("/dashboard/pengaturan");
  redirect("/dashboard/pengaturan?sukses=wa");
}

/** Hapus token WA dari DB (kembali ke env Vercel bila ada). */
export async function clearWaToken(): Promise<void> {
  const ctx = await requireAdmin();
  await deleteSetting(WA_TOKEN_KEY);
  revalidatePath("/dashboard/pengaturan");
  redirect("/dashboard/pengaturan?sukses=wa-clear");
}

/** Status token untuk halaman pengaturan (masked). */
export async function waTokenStatus() {
  await requireAdmin();
  return getWaTokenStatus();
}

/** Simpan API key apiindonesia.id di app_settings. */
export async function saveApiIndonesiaKey(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return;
  await setSetting(API_INDONESIA_KEY_SETTING, key);
  revalidatePath("/dashboard/pengaturan");
  redirect(`/dashboard/pengaturan?sukses=api-key&kwt=${ctx.kwtId}`);
}

/** Sinkronkan cache wilayah dari apiindonesia.id (~6 request API). */
export async function syncRegionsAction(): Promise<void> {
  await requireAdmin();
  try {
    await syncRegions();
    revalidatePath("/dashboard/pengaturan");
    revalidatePath("/daftar-kwt");
    redirect("/dashboard/pengaturan?sukses=sync");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync gagal";
    redirect(`/dashboard/pengaturan?error=${encodeURIComponent(msg)}`);
  }
}

/** Putar kode undangan KWT (admin) — kode lama tidak berlaku lagi. */
export async function rotateInviteCode(): Promise<void> {
  const ctx = await requireAdmin();
  const code = randomCode("KWT");
  await db.update(kwts).set({ inviteCode: code }).where(eq(kwts.id, ctx.kwtId));
  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/dashboard/anggota");
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
