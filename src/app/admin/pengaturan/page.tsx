import { KeyRound, Landmark, MapPin, RefreshCw, Trash2 } from "lucide-react";
import {
  adminApiIndonesiaStatus,
  adminWaTokenStatus,
  clearGlobalWaToken,
  clearPlatformBankAccount,
  platformBankStatus,
  saveAdminApiIndonesiaKey,
  adminSyncRegions,
  saveGlobalWaToken,
  savePlatformBankAccount,
} from "@/lib/actions/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sukses?: string; error?: string }>;
}) {
  const { sukses, error } = await searchParams;
  const [waStatus, apiStatus, platformBank] = await Promise.all([
    adminWaTokenStatus(),
    adminApiIndonesiaStatus(),
    platformBankStatus(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Platform</h1>
        <p className="mt-1 text-sm text-slate-500">
          Konfigurasi global yang berlaku untuk seluruh KWT.
        </p>
      </header>

      {(sukses === "wa" || sukses === "wa-clear") && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {sukses === "wa"
            ? "Token WA global tersimpan."
            : "Token WA global dihapus — kembali memakai env (bila ada)."}
        </p>
      )}

      {sukses === "api-key" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ API key apiindonesia.id tersimpan — klik “Sinkron wilayah” untuk
          mengisi/memperbarui dropdown wilayah.
        </p>
      )}
      {sukses === "sync" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ Cache wilayah berhasil disinkronkan dari apiindonesia.id.
        </p>
      )}
      {(sukses === "rekening-platform" || sukses === "rekening-platform-clear") && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {sukses === "rekening-platform"
            ? "✅ Rekening platform tersimpan — tampil di halaman Tagihan Fee."
            : "Rekening platform dihapus."}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* API key apiindonesia.id */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 text-brand-600" />
          Data wilayah resmi (apiindonesia.id)
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Mengisi dropdown provinsi & kab/kota resmi (Kepmendagri) di form
          pendaftaran KWT dan filter wilayah katalog, plus cuaca BMKG untuk
          jadwal panen otomatis. Key dari{" "}
          <span className="font-medium">dashboard.apiindonesia.id</span> — tier
          gratis 1.000 request/bulan cukup (sync ≈ 6 request).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              apiStatus.configured
                ? "bg-brand-50 text-brand-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {apiStatus.configured
              ? `✅ API key terpasang (${apiStatus.source === "database" ? "database" : "env"}) · ${apiStatus.masked}`
              : "⚠️ API key belum dipasang"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              apiStatus.provinceCount > 0
                ? "bg-brand-50 text-brand-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            Cache: {apiStatus.provinceCount} provinsi ·{" "}
            {apiStatus.regencyCount.toLocaleString("id-ID")} kab/kota
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={saveAdminApiIndonesiaKey} className="flex flex-1 gap-2">
            <input
              type="password"
              name="key"
              required
              minLength={10}
              placeholder="Tempel API key (aip_live_...)"
              autoComplete="off"
              className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Simpan key
            </button>
          </form>

          <form action={adminSyncRegions}>
            <button
              type="submit"
              disabled={!apiStatus.configured}
              title={
                apiStatus.configured
                  ? "Sinkronkan provinsi + kab/kota (~6 request API)"
                  : "Isi API key dulu"
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Sinkron wilayah
            </button>
          </form>
        </div>
      </section>

      {/* Rekening platform: tujuan pembayaran biaya layanan oleh KWT */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Landmark className="h-4 w-4 text-brand-600" />
          Rekening platform
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          PanenKita tidak memegang uang pembeli: pembeli membayar langsung ke KWT,
          lalu KWT melunasi biaya layanan platform ke rekening ini. Rekening ini
          tampil di halaman <span className="font-medium">Tagihan Fee</span> supaya
          pengurus KWT tahu ke mana harus transfer.
        </p>

        <p className="mt-3 text-sm">
          Status:{" "}
          {platformBank ? (
            <span className="font-medium tabular-nums text-emerald-700">
              {platformBank.bankName} · {platformBank.bankAccountNumber}
              {platformBank.bankAccountHolder
                ? ` a/n ${platformBank.bankAccountHolder}`
                : ""}
            </span>
          ) : (
            <span className="font-medium text-amber-700">belum diatur</span>
          )}
        </p>

        <form action={savePlatformBankAccount} className="mt-4 flex flex-wrap items-end gap-2">
          {(
            [
              { name: "bankName", label: "Bank", value: platformBank?.bankName ?? "", placeholder: "Mis. BRI" },
              { name: "bankAccountNumber", label: "Nomor rekening", value: platformBank?.bankAccountNumber ?? "", placeholder: "012345678901" },
              { name: "bankAccountHolder", label: "Nama pemilik", value: platformBank?.bankAccountHolder ?? "", placeholder: "Mis. PanenKita" },
            ] as const
          ).map((f) => (
            <div key={f.name} className="min-w-40 flex-1">
              <label htmlFor={f.name} className="mb-1 block text-xs font-medium text-slate-500">
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                defaultValue={f.value}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          ))}
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Simpan
          </button>
        </form>

        {platformBank && (
          <form action={clearPlatformBankAccount} className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-100 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Hapus rekening
            </button>
          </form>
        )}
      </section>

      {/* Token WA global */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4 text-brand-600" />
          Token WhatsApp (Fonnte)
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Dipakai sebagai cadangan global bila KWT belum mengatur token sendiri
          di pengaturan dashboardnya.
        </p>

        <p className="mt-3 text-sm">
          Status:{" "}
          {waStatus.configured ? (
            <span className="font-medium text-emerald-700">
              aktif ({waStatus.source === "database" ? "database" : "env"}) ·{" "}
              {waStatus.masked}
            </span>
          ) : (
            <span className="font-medium text-amber-700">belum diatur</span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={saveGlobalWaToken} className="flex flex-1 gap-2">
            <input
              type="password"
              name="token"
              required
              placeholder="Token device Fonnte"
              className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Simpan
            </button>
          </form>

          {waStatus.source === "database" && (
            <form action={clearGlobalWaToken}>
              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-100 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
