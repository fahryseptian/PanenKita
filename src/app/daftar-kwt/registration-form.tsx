"use client";

import { useEffect, useState } from "react";
import { createKwt } from "@/lib/actions/kwt";

interface RegionOption {
  code: string;
  name: string;
}

function pretty(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function RegistrationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [regencies, setRegencies] = useState<RegionOption[]>([]);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [regencyCode, setRegencyCode] = useState("");

  // Muat provinsi dari cache lokal; bila kosong, form kembali ke input teks.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/regions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("empty"))))
      .then((json) => {
        if (!cancelled && json.ok) setProvinces(json.data as RegionOption[]);
      })
      .catch(() => {
        if (!cancelled) setRegionError("manual");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cascade: muat kabupaten/kota saat provinsi berubah.
  useEffect(() => {
    if (!provinceCode) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    setRegencyCode("");
    fetch(`/api/regions?provinsi=${encodeURIComponent(provinceCode)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("empty"))))
      .then((json) => {
        if (!cancelled && json.ok) setRegencies(json.data as RegionOption[]);
      })
      .catch(() => {
        if (!cancelled) setRegencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    await createKwt(fd); // redirect saat sukses
    setSubmitting(false);
    setError("Gagal mendaftarkan kelompok — coba lagi");
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Nama kelompok
        </label>
        <input id="name" name="name" required minLength={3} className={inputCls} placeholder="Mis. KWT Srikandi Makmur" />
      </div>

      {provinces.length > 0 ? (
        <>
          {/* Dropdown resmi dari cache wilayah apiindonesia.id */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="provinceCode" className="mb-1 block text-sm font-medium text-slate-700">
                Provinsi
              </label>
              <select
                id="provinceCode"
                value={provinceCode}
                onChange={(e) => setProvinceCode(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">Pilih provinsi…</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {pretty(p.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="regencyCode" className="mb-1 block text-sm font-medium text-slate-700">
                Kabupaten/Kota
              </label>
              <select
                id="regencyCode"
                value={regencyCode}
                onChange={(e) => setRegencyCode(e.target.value)}
                required
                disabled={regencies.length === 0}
                className={inputCls}
              >
                <option value="">
                  {regencies.length === 0 ? "Pilih provinsi dulu…" : "Pilih kab/kota…"}
                </option>
                {regencies.map((r) => (
                  <option key={r.code} value={r.code}>
                    {pretty(r.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Nama wilayah ikut terkirim (dipakai direktori); kode untuk data resmi. */}
          {provinceCode && (
            <input type="hidden" name="province" value={pretty(provinces.find((p) => p.code === provinceCode)?.name ?? "")} />
          )}
          {regencyCode && (
            <input type="hidden" name="regency" value={pretty(regencies.find((r) => r.code === regencyCode)?.name ?? "")} />
          )}
          {provinceCode && regencyCode && (
            <input type="hidden" name="regionCode" value={regencyCode} />
          )}
        </>
      ) : (
        <>
          {regionError !== "manual" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Data wilayah resmi belum tersedia — isi manual dulu. Admin dapat mengaktifkan
              dropdown resmi lewat Pengaturan → Sinkron wilayah.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="regency" className="mb-1 block text-sm font-medium text-slate-700">
                Kabupaten/Kota
              </label>
              <input id="regency" name="regency" required className={inputCls} placeholder="Mis. Bandung" />
            </div>
            <div>
              <label htmlFor="province" className="mb-1 block text-sm font-medium text-slate-700">
                Provinsi <span className="text-slate-400">(opsional)</span>
              </label>
              <input id="province" name="province" className={inputCls} placeholder="Mis. Jawa Barat" />
            </div>
          </div>
        </>
      )}

      <div>
        <label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-700">
          Alamat sekretariat <span className="text-slate-400">(opsional)</span>
        </label>
        <input id="address" name="address" className={inputCls} placeholder="Desa/kelurahan, kecamatan" />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Mendaftarkan..." : "Daftarkan kelompok"}
      </button>
    </form>
  );
}
