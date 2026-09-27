"use client";

import { useState } from "react";
import { joinKwt } from "@/lib/actions/kwt";

export function JoinForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await joinKwt(fd);
    setSubmitting(false);
    // joinKwt melakukan redirect saat sukses; jika kembali, tampilkan error
    if (res && !res.ok) setError(res.error ?? "Gagal bergabung");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-slate-700">
          Kode undangan
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase tracking-widest outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="MIS. MEKAR2026"
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
        {submitting ? "Memproses..." : "Gabung"}
      </button>
    </form>
  );
}
