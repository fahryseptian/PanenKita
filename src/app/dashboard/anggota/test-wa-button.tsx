"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { sendTestWa } from "@/lib/actions/misc";

export function TestWaButton({ phone, name }: { phone: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!phone) return null;

  async function onClick() {
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("phone", phone);
    const res = await sendTestWa(fd);
    setLoading(false);
    setMsg(res?.ok ? "terkirim ✔" : (res?.error ?? "gagal"));
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        title={`Kirim pesan uji ke ${name}`}
        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {loading ? "mengirim..." : "WA uji"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </span>
  );
}
