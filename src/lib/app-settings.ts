import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export const WA_TOKEN_KEY = "fonte_token";

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

/** Token Fonnte: prioritas token yang disimpan admin via UI, fallback env Vercel. */
export async function getWaToken(): Promise<string | null> {
  try {
    const fromDb = await getSetting(WA_TOKEN_KEY);
    if (fromDb) return fromDb;
  } catch (err) {
    console.error("[app-settings] failed to read WA token from DB", err);
  }
  return process.env.FONTE_TOKEN || null;
}

export type WaTokenStatus = {
  configured: boolean;
  source: "database" | "env" | "none";
  masked: string | null;
};

/** Status untuk UI — tidak pernah mengembalikan nilai token penuh. */
export async function getWaTokenStatus(): Promise<WaTokenStatus> {
  let fromDb: string | null = null;
  try {
    fromDb = await getSetting(WA_TOKEN_KEY);
  } catch {
    fromDb = null;
  }
  if (fromDb) {
    return { configured: true, source: "database", masked: maskToken(fromDb) };
  }
  const envToken = process.env.FONTE_TOKEN || null;
  if (envToken) {
    return { configured: true, source: "env", masked: maskToken(envToken) };
  }
  return { configured: false, source: "none", masked: null };
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
