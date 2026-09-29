import { requireAdmin } from "@/lib/session";
import { getKwtById } from "@/lib/queries";
import { rotateInviteCode, updateKwtProfile } from "@/lib/actions/kwt";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pengaturan KWT" };

export default async function KwtSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sukses?: string; error?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const kwt = await getKwtById(ctx.kwtId);
  if (!kwt) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan KWT</h1>
        <p className="mt-1 text-sm text-slate-500">
          Data ini tampil di katalog publik dan halaman direktori. Hanya ketua yang
          dapat mengubah profil.
        </p>
      </header>

      {sp.sukses && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          ✅ Profil kelompok diperbarui.
        </p>
      )}
      {sp.error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{sp.error}</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Profil kelompok</h2>
        <form action={updateKwtProfile} className="mt-4 space-y-3">
          <input type="hidden" name="kwtId" value={ctx.kwtId} />
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
              Nama kelompok
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={3}
              defaultValue={kwt.name}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="regency" className="mb-1 block text-sm font-medium text-slate-700">
                Kabupaten/Kota
              </label>
              <input
                id="regency"
                name="regency"
                required
                defaultValue={kwt.regency ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label htmlFor="province" className="mb-1 block text-sm font-medium text-slate-700">
                Provinsi <span className="text-slate-400">(opsional)</span>
              </label>
              <input
                id="province"
                name="province"
                defaultValue={kwt.province ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-700">
              Alamat sekretariat <span className="text-slate-400">(opsional)</span>
            </label>
            <input
              id="address"
              name="address"
              defaultValue={kwt.address ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <p className="text-xs text-slate-400">
            Mengubah nama juga memperbarui alamat katalog
            <code className="mx-1">/katalog/{kwt.slug}</code>
            (URL lama otomatis mengikuti).
          </p>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Simpan profil
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Kode undangan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dipakai anggota baru saat mendaftar. Putar kode jika tersalahkan atau
          disebar ke luar kelompok — kode lama langsung tidak berlaku.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-slate-50 px-4 py-2 text-lg font-bold tracking-widest text-brand-800">
            {ctx.inviteCode ?? "—"}
          </code>
          <form action={rotateInviteCode}>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
            >
              Putar kode
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
