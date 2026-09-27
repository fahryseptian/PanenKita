import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kwtMembers, kwts } from "@/lib/db/schema";

export type MemberRole = "ketua" | "bendahara" | "anggota";

export interface KwtContext {
  kwtId: string;
  kwtName: string;
  kwtSlug: string;
  inviteCode: string | null;
  role: MemberRole;
  userId: string;
  userName: string;
  isAdmin: boolean; // ketua atau bendahara
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
