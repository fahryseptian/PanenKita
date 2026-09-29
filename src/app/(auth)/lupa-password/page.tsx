"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { appUrl } from "@/lib/app-url";

export default function LupaPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Respons selalu sukses (anti-enumerasi): keberadaan email tidak dibocorkan.
    await authClient.requestPasswordReset({
      email,
      redirectTo: `${appUrl()}/reset-password`,
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Lupa kata sandi?</h1>

      {sent ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Jika email tersebut terdaftar, tautan atur ulang sudah dikirim ke
            email Anda (dan ke WhatsApp bila nomornya terdaftar). Berlaku 1 jam.
          </p>
          <p className="text-sm text-slate-500">
            Tidak menerima tautan? Cek folder spam, pastikan alamat email benar,
            atau hubungi pengurus KWT.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Masukkan email Anda — tautan atur ulang dikirim ke email tersebut,
            dan ke WhatsApp bila nomornya terdaftar di akun.
          </p>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="nama@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Kirim tautan reset"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
