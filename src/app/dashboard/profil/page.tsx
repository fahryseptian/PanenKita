import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, user } from "@/lib/db/schema";
import { requireKwtContext } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { ProfileForm } from "./profile-form";
import { SendTestButton } from "./send-test-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const ctx = await requireKwtContext();

  const [me] = await db
    .select({ phone: user.phone })
    .from(user)
    .where(eq(user.id, ctx.userId))
    .limit(1);
  const phone = me?.phone ?? "";

  const history = await db
    .select()
    .from(notifications)
    .where(
      phone
        ? and(eq(notifications.kwtId, ctx.kwtId), eq(notifications.target, phone))
        : eq(notifications.kwtId, ctx.kwtId),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profil WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur nomor WA dan preferensi notifikasi Anda.
        </p>
      </header>

      <ProfileForm phone={phone} name={ctx.userName} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Uji notifikasi</h2>
        {phone ? (
          <div className="mt-3">
            <SendTestButton phone={phone} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Simpan nomor WhatsApp dulu untuk bisa menerima pesan uji.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Riwayat notifikasi terbaru</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {history.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">Belum ada notifikasi.</p>
          )}
          {history.map((n) => (
            <div key={n.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium capitalize">{n.kind.replace("_", " ")}</p>
                <p className="text-xs text-slate-400">
                  ke {n.target} · {formatDateTime(n.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  n.sent ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
                }`}
              >
                {n.sent ? "terkirim" : (n.error ?? "gagal")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
