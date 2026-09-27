"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/misc";

export function ProfileForm({ phone, name }: { phone: string; name: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await updateProfile(fd);
    setSubmitting(false);
    setMsg(
      res?.ok
        ? { ok: true, text: "Profil tersimpan ✔" }
        : { ok: false, text: res?.error ?? "Gagal menyimpan" },
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="space-y-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nama
          </label>
          <input
            id="name"
            value={name}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Nomor WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            inputMode="tel"
            defaultValue={phone}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="081234567890"
          />
          <p className="mt-1 text-xs text-slate-400">
            Otomatis dinormalisasi ke 628xxxxxxxxxx.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="waOptIn"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span>
            Kirimi saya notifikasi WhatsApp saat harga produk berubah.
          </span>
        </label>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
