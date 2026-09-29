"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Token dikirim oleh callback better-auth via query string.
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setLoading(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token: token ?? undefined,
    });
    if (err) {
      setError(
        err.message === "INVALID_TOKEN" || err.status === 400
          ? "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru."
          : (err.message ?? "Gagal mengatur ulang kata sandi"),
      );
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    // Semua sesi lama sudah dicabut; arahkan login dengan sandi baru.
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Tautan tidak valid</h1>
        <p className="text-sm text-slate-500">
          Token tidak ditemukan. Minta tautan atur ulang yang baru lewat
          halaman lupa kata sandi.
        </p>
        <Link
          href="/lupa-password"
          className="block w-full rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
        >
          Minta tautan baru
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Kata sandi diperbarui ✅</h1>
        <p className="text-sm text-slate-500">
          Kata sandi berhasil diatur ulang dan semua sesi lama sudah keluar.
          Mengalihkan ke halaman masuk...
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
        >
          Masuk sekarang
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-bold">Kata sandi baru</h1>
      <p className="text-sm text-slate-500">
        Buat kata sandi baru untuk akun Anda. Setelah berhasil, semua perangkat
        akan diminta masuk ulang.
      </p>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Kata sandi baru
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Minimal 8 karakter"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-700">
          Ulangi kata sandi
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Ulangi kata sandi baru"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Menyimpan..." : "Simpan kata sandi baru"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
