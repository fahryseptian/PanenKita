import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth, type Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { kwtMembers, kwts, user as userTable } from "@/lib/db/schema";

export type MemberRole = "ketua" | "bendahara" | "anggota";

/** Status moderasi KWT di level platform. */
export type KwtModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface KwtContext {
  kwtId: string;
  kwtName: string;
  kwtSlug: string;
  inviteCode: string | null;
  role: MemberRole;
  userId: string;
  userName: string;
  isAdmin: boolean; // ketua atau bendahara
  /** Status moderasi platform: pending | approved | rejected | suspended */
  kwtStatus: KwtModerationStatus;
}

export interface Membership {
  kwtId: string;
  kwtName: string;
  kwtSlug: string;
  role: MemberRole;
}

export const ACTIVE_KWT_COOKIE = "panenkita_kwt";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Semua keanggotaan KWT seorang user (platform multi-kelompok). */
export async function getMyKwts(userId: string): Promise<Membership[]> {
  return db
    .select({
      kwtId: kwts.id,
      kwtName: kwts.name,
      kwtSlug: kwts.slug,
      role: kwtMembers.role,
      inviteCode: kwts.inviteCode,
    })
    .from(kwtMembers)
    .innerJoin(kwts, eq(kwtMembers.kwtId, kwts.id))
    .where(eq(kwtMembers.userId, userId))
    .orderBy(kwts.name)
    .then((rows) =>
      rows.map(({ kwtId, kwtName, kwtSlug, role }) => ({
        kwtId,
        kwtName,
        kwtSlug,
        role: role as MemberRole,
      })),
    );
}

/**
 * Sesi + konteks KWT aktif (dari cookie, fallback ke anggotaan pertama).
 * Satu user bisa tergabung di banyak kelompok; redirect ke /no-kwt jika belum.
 */
export async function requireKwtContext(): Promise<KwtContext> {
  const session = await requireSession();

  const memberships = await db
    .select({
      kwtId: kwts.id,
      kwtName: kwts.name,
      kwtSlug: kwts.slug,
      inviteCode: kwts.inviteCode,
      role: kwtMembers.role,
      kwtStatus: kwts.status,
    })
    .from(kwtMembers)
    .innerJoin(kwts, eq(kwtMembers.kwtId, kwts.id))
    .where(eq(kwtMembers.userId, session.user.id))
    .orderBy(kwts.name);

  if (memberships.length === 0) redirect("/no-kwt");

  const store = await cookies();
  const wanted = store.get(ACTIVE_KWT_COOKIE)?.value;
  const active = memberships.find((m) => m.kwtId === wanted) ?? memberships[0]!;
  const role = active.role as MemberRole;

  // Sinkronkan cookie jika belum ada/mengarah ke kelompok yang tidak diikuti.
  // Di RSC cookie tidak bisa ditulis — aman diabaikan (server action berikutnya
  // akan menyetelnya dengan benar).
  if (wanted !== active.kwtId) {
    try {
      store.set(ACTIVE_KWT_COOKIE, active.kwtId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    } catch {
      // read-only di RSC — abaikan
    }
  }

  return {
    kwtId: active.kwtId,
    kwtName: active.kwtName,
    kwtSlug: active.kwtSlug,
    inviteCode: active.inviteCode,
    role,
    isAdmin: role === "ketua" || role === "bendahara",
    userId: session.user.id,
    userName: session.user.name,
    kwtStatus: active.kwtStatus as KwtModerationStatus,
  };
}

/** Guard aksi admin (ketua/bendahara) pada KWT aktif. */
export async function requireAdmin(): Promise<KwtContext> {
  const ctx = await requireKwtContext();
  if (!ctx.isAdmin) {
    throw new Error("Hanya ketua/bendahara yang dapat melakukan aksi ini");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Superadmin (role level platform, terpisah dari role keanggotaan KWT)
// ---------------------------------------------------------------------------

export type PlatformRole = "user" | "superadmin";

/** Role platform seorang user ("user" jika baris/tabel belum berisi). */
export async function getPlatformRole(userId: string): Promise<PlatformRole> {
  const [row] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return (row?.role as PlatformRole | undefined) ?? "user";
}

/** Cek ringan tanpa redirect — untuk menyembunyikan/menampilkan elemen UI. */
export async function isSuperadmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return (await getPlatformRole(session.user.id)) === "superadmin";
}

/**
 * Guard aksi superadmin (kelola seluruh platform via /admin).
 * Melempar Error — dipakai di server actions & API.
 */
export async function requireSuperadmin(): Promise<Session> {
  const session = await requireSession();
  const role = await getPlatformRole(session.user.id);
  if (role !== "superadmin") {
    throw new Error("Hanya superadmin yang dapat melakukan aksi ini");
  }
  return session;
}

/** Guard halaman: redirect ke /dashboard bila bukan superadmin. */
export async function requireSuperadminPage(): Promise<Session> {
  const session = await requireSession();
  const role = await getPlatformRole(session.user.id);
  if (role !== "superadmin") redirect("/dashboard");
  return session;
}

/** Pastikan userId adalah anggota KWT tertentu. Return perannya. */
export async function assertMembership(
  kwtId: string,
  userId: string,
): Promise<MemberRole> {
  const [row] = await db
    .select({ role: kwtMembers.role })
    .from(kwtMembers)
    .where(and(eq(kwtMembers.kwtId, kwtId), eq(kwtMembers.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Bukan anggota KWT ini");
  return row.role as MemberRole;
}
