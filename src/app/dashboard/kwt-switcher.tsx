"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";
import { switchKwt } from "@/lib/actions/kwt";

export function KwtSwitcher({
  current,
  memberships,
}: {
  current: string;
  memberships: Array<{ kwtId: string; kwtName: string; role: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (memberships.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <select
          aria-label="Pindah kelompok"
          value={current}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(async () => {
              await switchKwt(id);
              router.refresh();
            });
          }}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 pr-7 text-xs font-medium text-slate-600 outline-none focus:border-brand-500"
        >
          {memberships.map((m) => (
            <option key={m.kwtId} value={m.kwtId}>
              {m.kwtName}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
      <a
        href="/daftar-kwt"
        title="Daftarkan kelompok baru"
        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
      >
        <Plus className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
