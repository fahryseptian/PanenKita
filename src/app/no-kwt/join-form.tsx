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
        <label htmlFor="inviteCode" className="field-label">
          Kode undangan
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          className="field uppercase tracking-widest"
          placeholder="MIS. MEKAR2026"
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary btn-md btn-block"
      >
        {submitting ? "Memproses..." : "Gabung"}
      </button>
    </form>
  );
}
