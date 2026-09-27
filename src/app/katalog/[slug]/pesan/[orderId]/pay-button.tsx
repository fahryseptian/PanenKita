"use client";

import { useState } from "react";

export function PayButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as { ok: boolean; payUrl?: string; error?: string };
      if (data.ok && data.payUrl) {
        window.location.href = data.payUrl;
        return;
      }
      setError(data.error ?? "Gagal memproses pembayaran");
    } catch {
      setError("Terjadi kesalahan jaringan");
    }
    setLoading(false);
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Menyiapkan pembayaran..." : "Bayar online (QRIS/e-wallet)"}
      </button>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
