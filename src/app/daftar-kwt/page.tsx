import { redirect } from "next/navigation";
import { requireSession, getMyKwts } from "@/lib/session";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Daftarkan KWT" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const memberships = await getMyKwts(session.user.id);
  if (memberships.length > 0) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50/50 px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Daftarkan KWT Anda</h1>
        <p className="mt-2 text-sm text-slate-500">
          Buat katalog online untuk kelompok tani wanita Anda — gratis. Anda akan
          menjadi <b>ketua</b> dan bisa mengundang anggota lewat kode undangan.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6">
          <RegistrationForm />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Setelah terdaftar, tambahkan produk & bagikan kode undangan kepada
          anggota. Katalog publik langsung tampil di /katalog.
        </p>
      </div>
    </div>
  );
}
