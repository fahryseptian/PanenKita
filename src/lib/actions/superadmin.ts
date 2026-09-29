"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  kwtMembers,
  kwtSettlements,
  kwts,
  platformFees,
  regions,
  user,
  verification,
} from "@/lib/db/schema";
import { requireSuperadmin } from "@/lib/session";
import { kwtApprovedMessage, kwtRejectedMessage, sendWa } from "@/lib/wa";
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
import { backfillPlatformFees } from "@/lib/fees-db";

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

/**
 * Kabari pembuat KWT (ketua pertama yang punya nomor WA) tentang hasil moderasi.
 * Kegagalan kirim tidak boleh menggagalkan aksi admin.
 */
async function notifyKwtCreator(
  kwtId: string,
  message: string,
): Promise<void> {
  try {
    const [creator] = await db
      .select({ name: user.name, phone: user.phone })
      .from(kwtMembers)
      .innerJoin(user, eq(user.id, kwtMembers.userId))
      .where(and(eq(kwtMembers.kwtId, kwtId), eq(kwtMembers.role, "ketua")))
      .limit(1);
    if (!creator?.phone) return;
    await sendWa(
      "kwt_review",
      kwtId,
      { phone: creator.phone, name: creator.name },
      message,
    );
  } catch (err) {
    console.error("[admin] failed to notify KWT creator", err);
  }
}

/** Setujui KWT — tampil di katalog publik & siap menerima pesanan. */
export async function approveKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  const [kwt] = await db
    .update(kwts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(kwts.id, kwtId))
    .returning({ name: kwts.name, slug: kwts.slug });
  if (kwt) {
    await notifyKwtCreator(kwtId, kwtApprovedMessage({ kwtName: kwt.name, slug: kwt.slug }));
  }
  revalidatePath("/admin/kwt");
  revalidatePath("/admin");
  revalidatePath("/katalog");
}

/** Tolak KWT — tidak tampil di katalog publik. */
export async function rejectKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  const [kwt] = await db
    .update(kwts)
    .set({ status: "rejected", approvedAt: null })
    .where(eq(kwts.id, kwtId))
    .returning({ name: kwts.name });
  if (kwt) {
    await notifyKwtCreator(kwtId, kwtRejectedMessage({ kwtName: kwt.name }));
  }
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

/** Suspend sementara — sembunyikan dari katalog tanpa menghapus data. */
export async function suspendKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  await db.update(kwts).set({ status: "suspended" }).where(eq(kwts.id, kwtId));
  revalidatePath("/admin/kwt");
  revalidatePath("/katalog");
}

/** Aktifkan kembali KWT yang disuspend (kembali approved). */
export async function resumeKwt(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;
  await db
    .update(kwts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(kwts.id, kwtId));
  revalidatePath("/admin/kwt");
  revalidatePath("/katalog");
}

/**
 * Buat tautan reset manual untuk pengguna yang tidak punya nomor WhatsApp.
 * Token dibuat persis seperti alur better-auth (`reset-password:<token>` di
 * tabel verification) sehingga endpoint /api/auth/reset-password menerimanya.
 * Tautan hanya ditampilkan di halaman admin — kirim manual setelah verifikasi.
 */
export async function createResetLinkForUser(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const [target] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!target) return;

  const token = randomBytes(24).toString("base64url");
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  revalidatePath("/admin/pengguna");
  redirect(
    `/admin/pengguna?resetToken=${encodeURIComponent(token)}&resetEmail=${encodeURIComponent(target.email)}`,
  );
}

/** Cara pencairan fee yang dicatat superadmin (lihat juga src/lib/settlement.ts). */
const SETTLEMENT_METHODS = ["transfer", "tunai", "otomatis"] as const;
type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

/**
 * Catat pencairan fee platform untuk satu KWT: jumlahkan seluruh fee aktif yang
 * belum tercakup settlement sebelumnya, simpan baris pencairan (beserta cara dan
 * referensi transfer), kembalikan rekapnya.
 */
export async function recordSettlement(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;

  const rawMethod = String(formData.get("method") ?? "transfer");
  const method: SettlementMethod = (SETTLEMENT_METHODS as readonly string[]).includes(
    rawMethod,
  )
    ? (rawMethod as SettlementMethod)
    : "transfer";
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const [last] = await db
    .select({ settledThrough: kwtSettlements.settledThrough })
    .from(kwtSettlements)
    .where(eq(kwtSettlements.kwtId, kwtId))
    .orderBy(sql`${kwtSettlements.settledThrough} desc`)
    .limit(1);

  // Hanya fee AKTIF (bukan hasil refund/pembatalan) yang boleh dicairkan.
  const conditions = [
    eq(platformFees.kwtId, kwtId),
    isNull(platformFees.reversedAt),
  ];
  if (last?.settledThrough) {
    conditions.push(gt(platformFees.createdAt, last.settledThrough));
  }

  const [agg] = await db
    .select({
      amount: sql<number>`coalesce(sum(${platformFees.totalFee}), 0)::int`,
      n: count(),
    })
    .from(platformFees)
    .where(and(...conditions));

  const amount = Number(agg?.amount ?? 0);
  if (amount <= 0) {
    redirect("/admin/settlement?error=Tidak+ada+fee+belum+tercairkan");
  }

  await db.insert(kwtSettlements).values({
    kwtId,
    amount,
    settledThrough: new Date(),
    feeCount: Number(agg?.n ?? 0),
    method,
    reference,
    note,
    createdBy: session.user.id,
  });

  revalidatePath("/admin/settlement");
  redirect("/admin/settlement?sukses=1");
}

/**
 * Simpan rekening bank KWT untuk pencairan (diisi superadmin setelah verifikasi
 * data dari pengurus). Kosongkan nilai untuk menghapus.
 */
export async function saveKwtBankAccount(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const kwtId = String(formData.get("kwtId") ?? "");
  if (!kwtId) return;

  const bankName = String(formData.get("bankName") ?? "").trim() || null;
  const bankAccountNumber =
    String(formData.get("bankAccountNumber") ?? "").trim() || null;
  const bankAccountHolder =
    String(formData.get("bankAccountHolder") ?? "").trim() || null;

  await db
    .update(kwts)
    .set({ bankName, bankAccountNumber, bankAccountHolder })
    .where(eq(kwts.id, kwtId));

  revalidatePath("/admin/settlement");
  redirect("/admin/settlement?sukses=rekening");
}

/**
 * Isi ulang baris ledger fee yang hilang (pesanan terbayar tanpa catatan fee).
 * Idempoten: hanya mencatat yang belum ada, tidak mengubah baris lain.
 */
export async function syncFeeLedger(): Promise<void> {
  await requireSuperadmin();
  const result = await backfillPlatformFees();
  revalidatePath("/admin");
  revalidatePath("/admin/settlement");
  redirect(`/admin?sukses=fee-backfill&n=${result.recorded}`);
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
