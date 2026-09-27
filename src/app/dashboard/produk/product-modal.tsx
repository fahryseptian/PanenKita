"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveProduct } from "@/lib/actions/products";
import {
  PRODUCT_CATEGORIES,
  canonicalCategory,
  categoryLabel,
} from "@/lib/categories";

interface ProductProp {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  photoUrl: string | null;
  basePrice: number;
  currentPrice: number;
}

export function ProductModal({ product }: { product?: ProductProp }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    await saveProduct(fd);
    setSubmitting(false);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {product ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {product ? "Edit" : "Tambah produk"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {product ? "Edit produk" : "Produk baru"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              {product && <input type="hidden" name="id" value={product.id} />}

              <div>
                <label htmlFor="p-name" className="mb-1 block text-sm font-medium text-slate-700">
                  Nama produk
                </label>
                <input
                  id="p-name"
                  name="name"
                  required
                  defaultValue={product?.name}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="Mis. Bayam Hidroponik"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-cat" className="mb-1 block text-sm font-medium text-slate-700">
                    Kategori
                  </label>
                  <select
                    id="p-cat"
                    name="category"
                    defaultValue={
                      product && canonicalCategory(product.category) === "lainnya"
                        ? "lainnya"
                        : (product?.category ?? "sayur")
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="p-unit" className="mb-1 block text-sm font-medium text-slate-700">
                    Satuan
                  </label>
                  <select
                    id="p-unit"
                    name="unit"
                    defaultValue={product?.unit ?? "kg"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="kg">kg</option>
                    <option value="ikat">ikat</option>
                    <option value="buah">buah</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="p-price" className="mb-1 block text-sm font-medium text-slate-700">
                  Harga dasar (Rp)
                </label>
                <input
                  id="p-price"
                  name="basePrice"
                  type="number"
                  min={100}
                  step={100}
                  required
                  defaultValue={product?.basePrice}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="8000"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Harga jual otomatis disesuaikan engine (batas bawah/atas di menu Harga).
                </p>
              </div>

              <div>
                <label htmlFor="p-desc" className="mb-1 block text-sm font-medium text-slate-700">
                  Deskripsi <span className="text-slate-400">(opsional)</span>
                </label>
                <textarea
                  id="p-desc"
                  name="description"
                  rows={2}
                  defaultValue={product?.description ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label htmlFor="p-photo" className="mb-1 block text-sm font-medium text-slate-700">
                  URL foto <span className="text-slate-400">(opsional)</span>
                </label>
                <input
                  id="p-photo"
                  name="photoUrl"
                  type="url"
                  defaultValue={product?.photoUrl ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="https://..."
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
