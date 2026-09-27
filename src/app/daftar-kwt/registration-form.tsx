"use client";

import { useState } from "react";
import { createKwt } from "@/lib/actions/kwt";

export function RegistrationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    await createKwt(fd); // redirect saat sukses
    setSubmitting(false);
    setError("Gagal mendaftarkan kelompok — coba lagi");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Nama kelompok
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Mis. KWT Srikandi Makmur"
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mis. Bandung"
          />
        </div>
        <div>
          <label htmlFor="province" className="mb-1 block text-sm font-medium text-slate-700">
            Provinsi <span className="text-slate-400">(opsional)</span>
          </label>
          <input
            id="province"
            name="province"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mis. Jawa Barat"
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
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Desa/kelurahan, kecamatan"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
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
