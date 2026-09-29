import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export const WA_TOKEN_KEY = "fonte_token";

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
