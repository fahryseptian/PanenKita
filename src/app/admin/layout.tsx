import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";
import { requireSuperadminPage } from "@/lib/session";
import { NotificationBell } from "@/app/dashboard/notification-bell";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Platform" };

const ADMIN_NAV = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/kwt", label: "Kelompok KWT" },
  { href: "/admin/settlement", label: "Tagihan Fee" },
  { href: "/admin/pengguna", label: "Pengguna" },
  { href: "/admin/pengaturan", label: "Pengaturan" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperadminPage();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link
          href="/"
          className="flex h-16 items-center gap-2 border-b border-slate-100 px-5 font-semibold"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span>Admin Platform</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.user.name}</p>
              <p className="truncate text-xs text-slate-400">
                {session.user.email}
              </p>
            </div>
            <NotificationBell />
          </div>
          <Link
            href="/dashboard"
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600"
          >
            <Leaf className="h-3.5 w-3.5" />
            Ke dashboard KWT
          </Link>
        </div>
      </aside>

      {/* Kolom utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 overflow-x-auto border-b border-slate-200 bg-white px-4 md:hidden">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="shrink-0 text-sm font-semibold">Admin</span>
          <NotificationBell />
          <nav className="flex gap-2">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
