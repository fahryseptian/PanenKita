"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, X } from "lucide-react";
import { NAV } from "./nav-items";
import { KwtSwitcher } from "./kwt-switcher";
import { SignOutButton } from "./sign-out-button";

/**
 * Menu mobile dashboard: tombol di header membuka sheet berisi SEMUA nav item
 * (termasuk Pengaturan/Anggota/Harga yang sebelumnya tak terjangkau di HP),
 * switcher KWT, dan tombol keluar.
 */
export function MobileMenu({
  isAdmin,
  isSuperadmin,
  kwtId,
  kwtName,
  userName,
  role,
  memberships,
}: {
  isAdmin: boolean;
  isSuperadmin: boolean;
  kwtId: string;
  kwtName: string;
  userName: string;
  role: string;
  memberships: Array<{ kwtId: string; kwtName: string; role: string }>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40"
          onClick={close}
          aria-hidden
        />
      ) : null}

      {open ? (
        <div className="fixed inset-x-0 top-0 z-50">
          <div className="mx-3 mt-3 rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{kwtName}</p>
                <p className="text-xs capitalize text-brand-600">
                  {role} · {userName}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Tutup menu"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="max-h-[60vh] overflow-y-auto p-2">
              {isSuperadmin && (
                <Link
                  href="/admin"
                  onClick={close}
                  className="mb-1 flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Panel Admin
                </Link>
              )}
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700"
                        : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <KwtSwitcher current={kwtId} memberships={memberships} />
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
