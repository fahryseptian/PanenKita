import Link from "next/link";
import { Leaf } from "lucide-react";
import { requireKwtContext, getMyKwts } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";
import { KwtSwitcher } from "./kwt-switcher";
import { NAV } from "./nav-items";
import { MobileMenu } from "./mobile-menu";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireKwtContext();
  const memberships = await getMyKwts(ctx.userId);
  const items = NAV.filter((n) => !n.adminOnly || ctx.isAdmin);
  const membershipsLite = memberships.map((m) => ({
    kwtId: m.kwtId,
    kwtName: m.kwtName,
    role: m.role,
  }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link href="/" className="flex h-16 items-center gap-2 border-b border-slate-100 px-5 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="truncate">{ctx.kwtName}</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <KwtSwitcher current={ctx.kwtId} memberships={membershipsLite} />
          <p className="mt-3 truncate text-sm font-medium">{ctx.userName}</p>
          <p className="text-xs capitalize text-brand-600">{ctx.role}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Kolom utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile: brand + menu lengkap */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4 md:hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {ctx.kwtName}
          </span>
          <MobileMenu
            isAdmin={ctx.isAdmin}
            kwtId={ctx.kwtId}
            kwtName={ctx.kwtName}
            userName={ctx.userName}
            role={ctx.role}
            memberships={membershipsLite}
          />
        </header>

        {/* Konten */}
        <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile: pintasan 5 halaman teratas */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white py-2 md:hidden">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-w-16 flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-brand-600"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
