import { requireAdmin, requireKwtContext } from "@/lib/session";
import { getMembers } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import {
  broadcastWa,
  changeMemberRole,
  getInviteCode,
  leaveKwt,
  removeMember,
  transferChairmanship,
} from "@/lib/actions/members";
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
            anggota mendaftar di /signup lalu memasukkan kode ini — putar kode di Pengaturan
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
                  {m.role === "ketua" && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                      ketua
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {m.email} · {m.phone ?? "Belum ada nomor WA"}
                  {m.waOptIn ? " · 📳 notifikasi aktif" : ""}
                </p>
                <p className="text-xs text-slate-300">bergabung {formatDate(m.joinedAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TestWaButton phone={m.phone ?? ""} name={m.name} />

                {/* Transfer ketua — hanya ketua, ke anggota lain */}
                {ctx.role === "ketua" && m.userId !== ctx.userId && (
                  <form action={transferChairmanship}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <button
                      type="submit"
                      title="Jadikan ketua; Anda menjadi anggota"
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                    >
                      Jadikan ketua
                    </button>
                  </form>
                )}

                {/* Ganti peran anggota ↔ bendahara (ketua saja) */}
                {m.role !== "ketua" && ctx.role === "ketua" && (
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

                {/* Hapus anggota (admin; bukan diri sendiri, bukan ketua) */}
                {m.userId !== ctx.userId && m.role !== "ketua" && (
                  <form action={removeMember}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Broadcast pengumuman ke anggota (opt-in WA) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">📣 Broadcast pengumuman</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kirim pesan WhatsApp ke semua anggota yang mengaktifkan notifikasi (opt-in).
          Cocok untuk info harga, jadwal panen, atau pengumuman rapat.
        </p>
        <form action={broadcastWa} className="mt-3 space-y-2">
          <textarea
            name="text"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            placeholder="Contoh: Besok panen kangkung, siapkan keranjang. Harga naik tipis karena stok sedikit."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Kirim ke semua anggota (opt-in)
          </button>
        </form>
      </section>

      {/* Keluar dari kelompok — semua peran, dengan guard di action */}
      <section className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
        <h2 className="text-sm font-semibold text-red-700">Keluar dari {ctx.kwtName}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Riwayat panen Anda tetap tersimpan di laporan. Ketua harus transfer peran dulu bila
          masih ada anggota lain.
        </p>
        <form action={leaveKwt} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Keluar dari kelompok
          </button>
        </form>
      </section>
    </div>
  );
}
