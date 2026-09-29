import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireSession, getMyKwts, getPlatformRole } from "@/lib/session";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gabung KWT" };

export default async function NoKwtPage() {
  const session = await requireSession();
  const memberships = await getMyKwts(session.user.id);
  if (memberships.length > 0) redirect("/dashboard");
  const isSuperadmin = (await getPlatformRole(session.user.id)) === "superadmin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50/50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Superadmin platform tidak butuh KWT — beri jalan langsung ke /admin. */}
        {isSuperadmin && (
          <div className="mb-4 rounded-2xl bg-slate-900 p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Anda superadmin platform
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Kelola kelompok KWT, pengguna, dan pendaftaran dari panel admin —
              tanpa perlu bergabung ke kelompok.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Buka Panel Admin →
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-xl font-bold">Gabung ke KWT Anda</h1>
          <p className="mt-2 text-sm text-slate-500">
            Akun Anda belum terhubung ke kelompok manapun. Masukkan{" "}
            <b>kode undangan</b> dari ketua/bendahara untuk mulai mencatat panen.
          </p>
          <div className="mt-6">
            <JoinForm />
          </div>
          <p className="mt-6 text-xs text-slate-400">
            Belum punya kode? Hubungi pengurus KWT Anda — mereka bisa melihatnya
            di menu Anggota pada dashboard.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Belum ada kelompok?{" "}
          <a href="/daftar-kwt" className="font-medium text-brand-600 hover:underline">
            Daftarkan kelompok baru →
          </a>
        </p>
      </div>
    </div>
  );
}
