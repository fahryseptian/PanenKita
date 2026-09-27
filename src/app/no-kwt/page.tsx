import { redirect } from "next/navigation";
import { requireSession, getMyKwts } from "@/lib/session";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gabung KWT" };

export default async function NoKwtPage() {
  const session = await requireSession();
  const memberships = await getMyKwts(session.user.id);
  if (memberships.length > 0) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50/50 px-4 py-10">
      <div className="w-full max-w-md">
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
