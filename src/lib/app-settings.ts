import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export const WA_TOKEN_KEY = "fonte_token";

/**
 * Kunci token WA milik satu KWT (`fonte_token:<kwtId>`).
 * Ketua/bendahara menyimpan device Fonnte kelompoknya di sini, sehingga
 * pengaturan satu kelompok tidak menimpa device kelompok lain.
 */
export function waTokenKey(kwtId: string): string {
  return `${WA_TOKEN_KEY}:${kwtId}`;
}

/** Key app_settings untuk rekening platform (penerima pembayaran biaya layanan). */
export const PLATFORM_BANK_KEY = "platform_bank";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

/**
 * `kwt` = device milik kelompok, `database` = token global platform,
 * `env` = FONTE_TOKEN dari server, `none` = tidak ada sama sekali.
 */
export type WaTokenSource = "kwt" | "database" | "env" | "none";

export interface WaTokenCandidates {
  /** Token device milik KWT pemilik notifikasi. */
  kwt?: string | null;
  /** Token global platform — cadangan bila KWT belum mengatur sendiri. */
  platform?: string | null;
  /** FONTE_TOKEN dari environment server — cadangan terakhir. */
  env?: string | null;
}

/**
 * Urutan prioritas token Fonnte: KWT → platform → env server.
 *
 * Sengaja dipisah sebagai fungsi murni agar urutannya bisa diuji tanpa
 * database, dan supaya pengaturan satu kelompok tidak pernah menimpa
 * kelompok lain (bug: keduanya dulu menulis kunci global yang sama).
 */
export function pickWaToken(c: WaTokenCandidates): {
  token: string | null;
  source: WaTokenSource;
} {
  if (c.kwt) return { token: c.kwt, source: "kwt" };
  if (c.platform) return { token: c.platform, source: "database" };
  if (c.env) return { token: c.env, source: "env" };
  return { token: null, source: "none" };
}

/**
 * Token Fonnte efektif untuk sebuah KWT.
 * `kwtId` boleh null untuk notifikasi tingkat platform (mis. reset kata sandi)
 * — saat itu token KWT dilewati dan langsung memakai token platform/env.
 */
export async function getWaToken(kwtId?: string | null): Promise<string | null> {
  const kwtToken = kwtId ? await readSettingSafe(waTokenKey(kwtId)) : null;
  const platformToken = await readSettingSafe(WA_TOKEN_KEY);
  const { token } = pickWaToken({
    kwt: kwtToken,
    platform: platformToken,
    env: process.env.FONTE_TOKEN,
  });
  return token;
}

export type WaTokenStatus = {
  configured: boolean;
  source: WaTokenSource;
  masked: string | null;
};

async function readSettingSafe(key: string): Promise<string | null> {
  try {
    return await getSetting(key);
  } catch (err) {
    console.error("[app-settings] failed to read setting", key, err);
    return null;
  }
}

/** Status untuk UI — tidak pernah mengembalikan nilai token penuh. */
export async function getWaTokenStatus(
  kwtId?: string | null,
): Promise<WaTokenStatus> {
  const kwtToken = kwtId ? await readSettingSafe(waTokenKey(kwtId)) : null;
  const platformToken = await readSettingSafe(WA_TOKEN_KEY);
  const { token, source } = pickWaToken({
    kwt: kwtToken,
    platform: platformToken,
    env: process.env.FONTE_TOKEN,
  });
  return {
    configured: Boolean(token),
    source,
    masked: token ? maskToken(token) : null,
  };
}

/** Sembunyikan nilai: cukup 4 karakter terakhir agar bisa dikenali pemiliknya. */
export function maskToken(token: string): string {
  return token.length <= 4 ? "••••" : `••••${token.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Rekening platform (tujuan pembayaran biaya layanan oleh KWT)
// ---------------------------------------------------------------------------

export interface PlatformBank {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}

/**
 * Rekening platform — tempat KWT membayar biaya layanan.
 * PanenKita tidak memegang uang pembeli, sehingga arah dana hanya KWT → platform.
 * Disimpan sebagai satu nilai JSON agar konsisten.
 */
export async function getPlatformBank(): Promise<PlatformBank | null> {
  try {
    const raw = await getSetting(PLATFORM_BANK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlatformBank>;
    if (!parsed.bankName || !parsed.bankAccountNumber) return null;
    return {
      bankName: parsed.bankName,
      bankAccountNumber: parsed.bankAccountNumber,
      bankAccountHolder: parsed.bankAccountHolder ?? "",
    };
  } catch (err) {
    console.error("[app-settings] failed to read platform bank", err);
    return null;
  }
}

/** Simpan rekening platform (dipakai superadmin di /admin/pengaturan). */
export async function setPlatformBank(bank: PlatformBank): Promise<void> {
  await setSetting(PLATFORM_BANK_KEY, JSON.stringify(bank));
}

/** Hapus rekening platform dari database. */
export async function clearPlatformBank(): Promise<void> {
  await deleteSetting(PLATFORM_BANK_KEY);
}
