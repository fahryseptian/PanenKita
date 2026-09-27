"use client";

import { useState } from "react";
import { sendTestWa } from "@/lib/actions/misc";

export function SendTestButton({ phone }: { phone: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("phone", phone);
    await sendTestWa(fd);
    setLoading(false);
    setMsg("Jika perangkat Fonnte aktif, pesan sudah dikirim. Cek riwayat di bawah.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
      >
        {loading ? "Mengirim..." : "Kirim pesan uji ke nomor saya"}
      </button>
      {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
