import { NextResponse } from "next/server";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — daftar notifikasi untuk pengguna yang login:
 * gabungan notifikasi KWT aktifnya dan notifikasi personal (userId).
 * Ringkas: hanya yang dibutuhkan lonceng (id, kind, message, readAt, createdAt).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      message: notifications.message,
      sent: notifications.sent,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      or(
        eq(notifications.userId, session.user.id),
        sql`${notifications.kwtId} in (select ${sql.raw("kwt_id")} from kwt_members where user_id = ${session.user.id})`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  const unread = rows.filter((r) => r.readAt === null).length;

  return NextResponse.json({
    notifications: rows,
    unread,
  });
}

/** POST /api/notifications — tandai semua notifikasi user sebagai dibaca. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        isNull(notifications.readAt),
        or(
          eq(notifications.userId, session.user.id),
          sql`${notifications.kwtId} in (select ${sql.raw("kwt_id")} from kwt_members where user_id = ${session.user.id})`,
        ),
      ),
    );

  return NextResponse.json({ ok: true });
}
