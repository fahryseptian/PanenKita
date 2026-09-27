import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Leaf,
  LogOut,
  ShoppingCart,
  Sprout,
  TrendingUp,
  FileBarChart,
  Users,
  Wallet,
} from "lucide-react";
import { requireKwtContext, getMyKwts } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";
import { KwtSwitcher } from "./kwt-switcher";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Leaf;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: BarChart3 },
  { href: "/dashboard/panen", label: "Panen", icon: Sprout },
  { href: "/dashboard/pesanan", label: "Pesanan", icon: ShoppingCart },
  { href: "/dashboard/laporan", label: "Laporan", icon: FileBarChart, adminOnly: true },
  { href: "/dashboard/produk", label: "Produk", icon: Leaf, adminOnly: true },
  { href: "/dashboard/harga", label: "Harga", icon: TrendingUp, adminOnly: true },
  { href: "/dashboard/anggota", label: "Anggota", icon: Users, adminOnly: true },
  { href: "/dashboard/profil", label: "Profil WA", icon: Wallet },
  { href: "/dashboard/panduan", label: "Panduan", icon: BookOpen },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireKwtContext();
  const memberships = await getMyKwts(ctx.userId);
  const items = NAV.filter((n) => !n.adminOnly || ctx.isAdmin);

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
          <KwtSwitcher
            current={ctx.kwtId}
            memberships={memberships.map((m) => ({ kwtId: m.kwtId, kwtName: m.kwtName, role: m.role }))}
          />
          <p className="mt-3 truncate text-sm font-medium">{ctx.userName}</p>
          <p className="text-xs capitalize text-brand-600">{ctx.role}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Konten */}
      <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8">{children}</main>

      {/* Bottom nav mobile */}
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
      <span className="sr-only">
        <LogOut className="hidden" />
      </span>
    </div>
  );
}
