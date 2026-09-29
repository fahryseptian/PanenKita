"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kwts, regions, user } from "@/lib/db/schema";
import { requireSuperadmin } from "@/lib/session";
import {
  WA_TOKEN_KEY,
  deleteSetting,
  getWaTokenStatus,
  maskToken,
  setSetting,
} from "@/lib/app-settings";
import {
  API_INDONESIA_KEY_SETTING,
  getApiIndonesiaKey,
} from "@/lib/api-indonesia";
import { syncRegions } from "@/lib/regions-db";

/**
 * Aksi superadmin — kelola seluruh platform via /admin.
 * Semua aksi memanggil requireSuperadmin() (role level platform, terpisah
 * dari role keanggotaan KWT) sehingga tidak bisa dipanggil user biasa.
 */

/** Promosi/turunkan role platform seorang pengguna. */
export async function setUserRole(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || (role !== "user" && role !== "superadmin")) return;
  await db
    .update(user)
    .set({ role: role as "user" | "superadmin" })
    .where(eq(user.id, userId));
  revalidatePath("/admin/pengguna");
  revalidatePath("/admin");
}

/** Setujui KWT — tampil di katalog publik & siap menerima pesanan. */
export async function approveKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  await db
    .update(kwts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(kwts.id, kwtId));
  revalidatePath("/admin/kwt");
  revalidatePath("/admin");
  revalidatePath("/katalog");
}

/** Tolak KWT — tidak tampil di katalog publik. */
export async function rejectKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  await db
    .update(kwts)
    .set({ status: "rejected", approvedAt: null })
    .where(eq(kwts.id, kwtId));
  revalidatePath("/admin/kwt");
  revalidatePath("/admin");
  revalidatePath("/katalog");
}

/** Balikkan KWT ke pending (mis. ulasan ulang). */
export async function resetKwtToPending(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  await db
    .update(kwts)
    .set({ status: "pending", approvedAt: null })
    .where(eq(kwts.id, kwtId));
  revalidatePath("/admin/kwt");
  revalidatePath("/katalog");
}

/** Status token WA global untuk halaman /admin/pengaturan. */
export async function adminWaTokenStatus() {
  await requireSuperadmin();
  return getWaTokenStatus();
}

/** Simpan token WA global di app_settings (nilai tak pernah dikirim balik). */
export async function saveGlobalWaToken(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return;
  await setSetting(WA_TOKEN_KEY, token);
  revalidatePath("/admin/pengaturan");
  redirect("/admin/pengaturan?sukses=wa");
}

/** Hapus token WA global (kembali ke env bila ada). */
export async function clearGlobalWaToken(): Promise<void> {
  await requireSuperadmin();
  await deleteSetting(WA_TOKEN_KEY);
  revalidatePath("/admin/pengaturan");
  redirect("/admin/pengaturan?sukses=wa-clear");
}

// ---------------------------------------------------------------------------
// API key apiindonesia.id (wilayah resmi + cuaca BMKG)
// ---------------------------------------------------------------------------

export interface AdminApiIndonesiaStatus {
  configured: boolean;
  source: "database" | "env" | "none";
  masked: string | null;
  provinceCount: number;
  regencyCount: number;
}

/** Status key apiindonesia + isi cache wilayah (untuk /admin/pengaturan). */
export async function adminApiIndonesiaStatus(): Promise<AdminApiIndonesiaStatus> {
  await requireSuperadmin();

  const fromDb = await getSettingSafe(API_INDONESIA_KEY_SETTING);
  const envKey = process.env.API_INDONESIA_KEY || null;
  const key = fromDb ?? envKey;
  const source: AdminApiIndonesiaStatus["source"] = fromDb
    ? "database"
    : envKey
      ? "env"
      : "none";

  const [provRow] = await db
    .select({ n: count() })
    .from(regions)
    .where(eq(regions.level, "provinsi"));
  const [regRow] = await db
    .select({ n: count() })
    .from(regions)
    .where(eq(regions.level, "kabupaten"));

  return {
    configured: Boolean(key),
    source,
    masked: key ? maskToken(key) : null,
    provinceCount: Number(provRow?.n ?? 0),
    regencyCount: Number(regRow?.n ?? 0),
  };
}

async function getSettingSafe(key: string): Promise<string | null> {
  try {
    const { getSetting } = await import("@/lib/app-settings");
    return await getSetting(key);
  } catch {
    return null;
  }
}

/** Simpan API key apiindonesia.id global (tersimpan di DB, tak pernah dikirim balik). */
export async function saveAdminApiIndonesiaKey(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return;
  await setSetting(API_INDONESIA_KEY_SETTING, key);
  revalidatePath("/admin/pengaturan");
  redirect("/admin/pengaturan?sukses=api-key");
}

/** Sinkronkan cache wilayah provinsi + kab/kota (~6 request API). */
export async function adminSyncRegions(): Promise<void> {
  await requireSuperadmin();
  try {
    await syncRegions();
    revalidatePath("/admin/pengaturan");
    revalidatePath("/daftar-kwt");
    redirect("/admin/pengaturan?sukses=sync");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync gagal";
    redirect(`/admin/pengaturan?error=${encodeURIComponent(msg)}`);
  }
}
