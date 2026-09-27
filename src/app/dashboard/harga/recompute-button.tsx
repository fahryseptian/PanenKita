"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { recomputeAllPrices } from "@/lib/actions/pricing";

export function RecomputeButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMsg(null);
    const res = await recomputeAllPrices();
    setLoading(false);
    setMsg(res.ok ? `Selesai: ${res.updated} harga berubah` : res.error ?? "Gagal");
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Hitung ulang sekarang
      </button>
    </div>
  );
}
