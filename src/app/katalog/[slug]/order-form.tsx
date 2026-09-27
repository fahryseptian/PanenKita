"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBasket } from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
  unit: string;
  price: number;
  available: number;
}

interface Props {
  kwtId: string;
  kwtSlug: string;
  products: ProductOption[];
}

export function OrderForm({ kwtId, kwtSlug, products }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === id);
          if (!p || qty <= 0) return null;
          return { ...p, qty, subtotal: p.price * qty };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [cart, products],
  );
  const total = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError("Pilih minimal satu produk");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kwtId,
          buyerName,
          buyerPhone,
          note,
          items: lines.map((l) => ({ productId: l.id, quantity: l.qty })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; orderId?: string; error?: string };
      if (!data.ok || !data.orderId) {
        setError(data.error ?? "Gagal membuat pesanan");
        setSubmitting(false);
        return;
      }
      router.push(`/katalog/${kwtSlug}/pesan/${data.orderId}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-3">
          {products.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.price.toLocaleString("id-ID")} / {p.unit} · stok {p.available}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Kurangi ${p.name}`}
                    onClick={() => setQty(p.id, qty - 1)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                    disabled={qty <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    aria-label={`Jumlah ${p.name}`}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                    value={qty === 0 ? "" : qty}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isNaN(v)) return;
                      setQty(p.id, Math.min(v, p.available));
                    }}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    aria-label={`Tambah ${p.name}`}
                    onClick={() => setQty(p.id, Math.min(qty + 1, p.available))}
                    className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                    disabled={qty >= p.available}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="buyerName" className="mb-1 block text-sm font-medium text-slate-700">
              Nama Anda
            </label>
            <input
              id="buyerName"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Nama pembeli"
            />
          </div>
          <div>
            <label htmlFor="buyerPhone" className="mb-1 block text-sm font-medium text-slate-700">
              Nomor WhatsApp
            </label>
            <input
              id="buyerPhone"
              required
              inputMode="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="081234567890"
            />
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-slate-700">
            Catatan <span className="text-slate-400">(opsional)</span>
          </label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mis. ambil sore setelah maghrib"
          />
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShoppingBasket className="h-4 w-4 text-brand-600" /> Ringkasan
        </h3>
        <div className="mt-3 space-y-1.5 text-sm">
          {lines.length === 0 ? (
            <p className="text-slate-400">Keranjang masih kosong</p>
          ) : (
            lines.map((l) => (
              <div key={l.id} className="flex justify-between">
                <span className="text-slate-600">
                  {l.name} × {l.qty}
                </span>
                <span className="tabular-nums">{l.subtotal.toLocaleString("id-ID")}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums text-brand-700">
            Rp{total.toLocaleString("id-ID")}
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || lines.length === 0}
          className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Mengirim..." : `Pesan (${count} item)`}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Konfirmasi & info pembayaran dikirim via WhatsApp.
        </p>
      </aside>
    </form>
  );
}
