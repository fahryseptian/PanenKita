"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Email atau kata sandi salah");
      setLoading(false);
      return;
    }
    // Superadmin platform mendarat di /admin; pengguna lain di dashboard KWT.
    const { data } = await authClient.getSession();
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.push(role === "superadmin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-bold">Masuk</h1>

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

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Kata sandi
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="••••••••"
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
        {loading ? "Memproses..." : "Masuk"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Daftar
        </Link>
      </p>

      <p className="text-center text-sm">
        <Link href="/lupa-password" className="text-slate-400 hover:text-brand-600 hover:underline">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
