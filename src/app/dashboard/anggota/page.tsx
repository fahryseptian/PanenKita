import { requireAdmin } from "@/lib/session";
import { getMembers } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { changeMemberRole, getInviteCode } from "@/lib/actions/members";
import { TestWaButton } from "./test-wa-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Anggota" };

const ROLE_LABEL: Record<string, string> = {
  ketua: "Ketua",
  bendahara: "Bendahara",
  anggota: "Anggota",
};

export default async function MembersPage() {
  const ctx = await requireAdmin();
  const members = await getMembers(ctx.kwtId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Anggota</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bagikan kode undangan agar anggota baru bisa bergabung setelah mendaftar.
        </p>
      </header>

      <section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
        <h2 className="text-sm font-semibold text-brand-700">Kode undangan KWT</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-white px-4 py-2 text-lg font-bold tracking-widest text-brand-800">
            {await getInviteCode()}
          </code>
          <span className="text-xs text-brand-600">
            anggota mendaftar di /signup lalu memasukkan kode ini
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">{members.length} anggota</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {members.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">
                  {m.name}
                  {m.userId === ctx.userId && (
                    <span className="ml-2 text-xs text-brand-600">(Anda)</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {m.email} · {m.phone ?? "Belum ada nomor WA"}
                  {m.waOptIn ? " · 📳 notifikasi aktif" : ""}
                </p>
                <p className="text-xs text-slate-300">bergabung {formatDate(m.joinedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <TestWaButton phone={m.phone ?? ""} name={m.name} />
                {m.role !== "ketua" && (
                  <form action={changeMemberRole}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <input
                      type="hidden"
                      name="role"
                      value={m.role === "anggota" ? "bendahara" : "anggota"}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {m.role === "anggota" ? "Jadikan bendahara" : "Jadikan anggota"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
