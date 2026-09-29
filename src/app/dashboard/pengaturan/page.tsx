import { requireAdmin } from "@/lib/session";
import { getKwtById } from "@/lib/queries";
import { getWaTokenStatus } from "@/lib/app-settings";
import { getApiIndonesiaKey } from "@/lib/api-indonesia";
import { listProvinces } from "@/lib/regions-db";
import {
  clearWaToken,
  rotateInviteCode,
  saveApiIndonesiaKey,
  saveWaToken,
  syncRegionsAction,
  updateKwtProfile,
} from "@/lib/actions/kwt";

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
  const [apiConfigured, provinceCount] = await Promise.all([
    getApiIndonesiaKey().then(Boolean),
    listProvinces().then((p) => p.length).catch(() => 0),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan KWT</h1>
        <p className="mt-1 text-sm text-slate-500">
          Data ini tampil di katalog publik dan halaman direktori. Hanya ketua yang
          dapat mengubah profil.
        </p>
      </header>

      {sp.sukses === "wa" && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          ✅ Token WA tersimpan — pesan uji dikirim ke nomor Anda (cek WhatsApp).
        </p>
      )}
      {sp.sukses === "wa-clear" && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          Token WA dihapus dari database — kembali ke konfigurasi server (bila ada).
        </p>
      )}
      {sp.sukses && sp.sukses !== "wa" && sp.sukses !== "wa-clear" && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          ✅ Profil kelompok diperbarui.
        </p>
      )}
      {sp.sukses === "api-key" && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          ✅ API key apiindonesia.id tersimpan — jalankan "Sinkron wilayah" untuk mengisi dropdown.
        </p>
      )}
      {sp.sukses === "sync" && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          ✅ Cache wilayah diperbarui — dropdown resmi aktif di form pendaftaran.
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

      {/* Token WA — diatur admin tanpa akses Vercel */}
      <WaTokenSection status={await getWaTokenStatus()} />

      {/* Data publik Indonesia (apiindonesia.id): API key + sinkron wilayah */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">🗺️ Data wilayah resmi (apiindonesia.id)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mengisi dropdown provinsi & kab/kota yang resmi (Kepmendagri) di form
          pendaftaran, plus cuaca BMKG untuk jadwal panen otomatis. API key dari
          dashboard.apiindonesia.id — tier gratis 1.000 request/bulan cukup.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${apiConfigured ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
            {apiConfigured ? "✅ API key terpasang" : "⚠️ API key belum dipasang"}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${provinceCount > 0 ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
            Cache wilayah: {provinceCount} provinsi
          </span>
        </div>

        <form action={saveApiIndonesiaKey} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            name="key"
            required
            minLength={10}
            placeholder="Tempel API key (aip_live_...)"
            autoComplete="off"
            className="min-w-60 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Simpan key
          </button>
        </form>

        <form action={syncRegionsAction} className="mt-2">
          <button
            type="submit"
            disabled={!apiConfigured}
            title={apiConfigured ? "Sinkronkan provinsi + kab/kota (~6 request API)" : "Isi API key dulu"}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sinkron wilayah ({provinceCount > 0 ? "perbarui" : "isi pertama kali"})
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

function WaTokenSection({
  status,
}: {
  status: Awaited<ReturnType<typeof getWaTokenStatus>>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">📲 Notifikasi WhatsApp (Fonnte)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Notifikasi pesanan/panen dikirim via Fonnte. Tempel device token dari
        dashboard fonnte.com di sini — tidak perlu akses server.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
            status.configured
              ? "bg-brand-50 text-brand-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {status.configured ? "✅ Terpasang" : "⚠️ Belum dipasang"}
        </span>
        {status.configured && (
          <span className="text-xs text-slate-400">
            sumber: {status.source === "database" ? "disimpan di sini" : "env server"}
            {status.masked ? ` (${status.masked})` : ""}
          </span>
        )}
      </div>

      <form action={saveWaToken} className="mt-3 space-y-2">
        <input
          type="password"
          name="token"
          required
          minLength={6}
          placeholder="Tempel token Fonnte baru di sini"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Simpan & kirim pesan uji
          </button>
          {status.source === "database" && (
            <button
              type="submit"
              formAction={clearWaToken}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              Hapus token tersimpan
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
