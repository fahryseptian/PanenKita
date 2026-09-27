"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { joinKwt } from "@/lib/actions/kwt";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      phone: phone ? phone : undefined,
      waOptIn: true,
    });
    if (error) {
      setError(error.message ?? "Pendaftaran gagal");
      setLoading(false);
      return;
    }

    // Gabung otomatis bila kode undangan diisi; jika tidak, arahkan ke /no-kwt
    if (inviteCode) {
      const fd = new FormData();
      fd.set("inviteCode", inviteCode);
      await joinKwt(fd); // redirect ke /dashboard saat sukses
      setError("Kode undangan tidak valid — lanjutkan dari halaman gabung");
      router.push("/no-kwt");
      return;
    }
    router.push("/no-kwt");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-bold">Daftar Anggota</h1>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Nama lengkap
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Ibu Nama Anda"
        />
      </div>

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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Minimal 8 karakter"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
          Nomor WhatsApp
        </label>
        <input
          id="phone"
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="081234567890"
        />
        <p className="mt-1 text-xs text-slate-400">
          Untuk notifikasi harga & pesanan. Disimpan format 628xxxxxxxxxx.
        </p>
      </div>

      <div>
        <label htmlFor="invite" className="mb-1 block text-sm font-medium text-slate-700">
          Kode undangan KWT <span className="text-slate-400">(jika ada)</span>
        </label>
        <input
          id="invite"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Mis. MEKAR2026"
        />
        <p className="mt-1 text-xs text-slate-400">
          Dengan kode undangan Anda langsung bergabung ke KWT.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Memproses..." : "Daftar"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
