import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { listUsers } from "@/lib/admin-queries";
import { createResetLinkForUser, setUserRole } from "@/lib/actions/superadmin";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resetToken?: string; resetEmail?: string }>;
}) {
  const { q, resetToken, resetEmail } = await searchParams;
  const users = await listUsers(q);
  const resetLink = resetToken
    ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola role platform. Role KWT (ketua/bendahara/anggota) diatur di
          dashboard masing-masing kelompok.
        </p>
      </header>

      {resetLink && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Tautan reset untuk {resetEmail}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Berlaku 1 jam dan hanya bisa dipakai sekali. Kirim ke pengguna
            <b> hanya setelah Anda memverifikasi identitasnya</b> (mis. lewat
            telepon/pengurus KWT).
          </p>
          <code className="mt-3 block break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-amber-200">
            {resetLink}
          </code>
        </section>
      )}

      <form className="flex gap-2" action="/admin/pengguna">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cari nama atau email..."
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Cari
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Nama</th>
              <th className="hidden px-4 py-2.5 sm:table-cell">Kontak</th>
              <th className="px-4 py-2.5">KWT</th>
              <th className="px-4 py-2.5">Role Platform</th>
              <th className="hidden px-4 py-2.5 md:table-cell">Terdaftar</th>
              <th className="px-4 py-2.5">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-slate-400 sm:hidden">{u.email}</p>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <p>{u.email}</p>
                    <p className="text-xs text-slate-400">{u.phone ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{u.kwtCount}</td>
                  <td className="px-4 py-2.5">
                    {u.role === "superadmin" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        <ShieldCheck className="h-3 w-3" />
                        Superadmin
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        User
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-slate-400 md:table-cell">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <form action={createResetLinkForUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-slate-400 hover:text-brand-600"
                          title="Buat tautan reset manual (untuk pengguna tanpa WhatsApp)"
                        >
                          <KeyRound className="mr-1 inline h-3.5 w-3.5" />
                          Tautan reset
                        </button>
                      </form>
                      {u.role === "superadmin" ? (
                      <form action={setUserRole}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value="user" />
                        <button
                          type="submit"
                          className="text-xs font-medium text-slate-400 hover:text-red-600"
                        >
                          <ShieldOff className="mr-1 inline h-3.5 w-3.5" />
                          Turunkan
                        </button>
                      </form>
                    ) : (
                      <form action={setUserRole}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value="superadmin" />
                        <button
                          type="submit"
                          className="text-xs font-medium text-slate-500 hover:text-brand-600"
                        >
                          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                          Jadikan superadmin
                        </button>
                      </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
