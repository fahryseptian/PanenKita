"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout } from "lucide-react";
import { recordHarvest } from "@/lib/actions/harvests";

interface Props {
  products: Array<{ id: string; name: string; unit: string }>;
}

export function HarvestForm({ products }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    await recordHarvest(fd);
    setSubmitting(false);
    setMessage("Panen tercatat ✔ stok katalog diperbarui");
    form.reset();
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Sprout className="mx-auto h-8 w-8 text-brand-600" />
        <p className="mt-2 text-sm text-slate-500">
          Belum ada produk aktif. Minta ketua/bendahara menambahkan produk dulu.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="productId" className="mb-1 block text-sm font-medium text-slate-700">
            Produk
          </label>
          <select
            id="productId"
            name="productId"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-slate-700">
            Jumlah
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mis. 12.5"
          />
        </div>
        <div>
          <label htmlFor="wasteQty" className="mb-1 block text-sm font-medium text-slate-700">
            Tidak layak jual <span className="text-slate-400">(susut/busuk, opsional)</span>
          </label>
          <input
            id="wasteQty"
            name="wasteQty"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="0"
          />
          <p className="mt-1 text-xs text-slate-400">
            Tidak masuk stok jual — pilih jalurnya untuk laporan ESG.
          </p>
        </div>
        <div>
          <label htmlFor="wasteDestination" className="mb-1 block text-sm font-medium text-slate-700">
            Jalur ESG
          </label>
          <select
            id="wasteDestination"
            name="wasteDestination"
            defaultValue="donasi"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="donasi">🤝 Didonasikan (bank pangan)</option>
            <option value="kompos">♻️ Dikomposkan</option>
            <option value="hilang">🗑️ Hilang / busuk</option>
          </select>
        </div>
        <div>
          <label htmlFor="quality" className="mb-1 block text-sm font-medium text-slate-700">
            Kualitas
          </label>
          <select
            id="quality"
            name="quality"
            defaultValue="A"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="A">A — prima</option>
            <option value="B">B — biasa</option>
            <option value="C">C — untuk olahan</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-slate-700">
            Catatan <span className="text-slate-400">(opsional)</span>
          </label>
          <input
            id="note"
            name="note"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mis. panen pagi blok C"
          />
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {submitting ? "Menyimpan..." : "Catat panen"}
      </button>
    </form>
  );
}
