"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { saveKwtPaymentInfo } from "@/lib/actions/kwt";
import { processImage, formatBytes } from "@/lib/image-client";
import { photoSrc } from "@/lib/photo-url";

export interface PaymentSettingsValues {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  qrisImageUrl: string;
  paymentNote: string;
}

interface Props {
  values: PaymentSettingsValues;
  /** Unggah file aktif hanya bila object storage terkonfigurasi. */
  storageEnabled: boolean;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/**
 * Kanal pembayaran KWT. Pembeli membayar langsung ke KWT, jadi rekening/QRIS
 * di sini yang tampil di halaman pesanan.
 */
export function PaymentSettings({ values, storageEnabled }: Props) {
  const [qris, setQris] = useState(values.qrisImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const preview = photoSrc(qris || null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNote(null);
    setUploading(true);
    try {
      const img = await processImage(file);
      const res = await fetch("/api/uploads/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "qris", contentType: img.contentType }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          res.status === 501
            ? "Unggah file belum aktif di server ini — tempel tautan gambar QRIS saja."
            : (body.error ?? `HTTP ${res.status}`),
        );
      }
      const { uploadUrl, key } = (await res.json()) as {
        uploadUrl: string;
        key: string;
      };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": img.contentType },
        body: img.blob,
      });
      if (!put.ok) throw new Error(`upload-gagal-${put.status}`);
      setQris(key);
      setNote(
        img.processedBytes < img.originalBytes
          ? `Dioptimalkan: ${formatBytes(img.originalBytes)} → ${formatBytes(img.processedBytes)}`
          : "Gambar QRIS terunggah — jangan lupa simpan.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={saveKwtPaymentInfo} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="bankName" className="mb-1 block text-sm font-medium text-slate-700">
            Bank
          </label>
          <input
            id="bankName"
            name="bankName"
            defaultValue={values.bankName}
            placeholder="Mis. BRI"
            className={inputCls}
          />
        </div>
        <div>
          <label
            htmlFor="bankAccountNumber"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Nomor rekening
          </label>
          <input
            id="bankAccountNumber"
            name="bankAccountNumber"
            inputMode="numeric"
            defaultValue={values.bankAccountNumber}
            placeholder="012345678901"
            className={`${inputCls} tabular-nums`}
          />
        </div>
        <div>
          <label
            htmlFor="bankAccountHolder"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Nama pemilik
          </label>
          <input
            id="bankAccountHolder"
            name="bankAccountHolder"
            defaultValue={values.bankAccountHolder}
            placeholder="Mis. Sari Wulandari"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="qrisImageUrl" className="mb-1 block text-sm font-medium text-slate-700">
          Gambar QRIS <span className="text-slate-400">(opsional)</span>
        </label>
        <div className="flex flex-wrap items-start gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Pratinjau QRIS"
              className="h-28 w-28 rounded-lg border border-slate-200 object-contain"
            />
          )}
          <div className="min-w-56 flex-1 space-y-2">
            <input
              id="qrisImageUrl"
              name="qrisImageUrl"
              value={qris}
              onChange={(e) => setQris(e.target.value)}
              placeholder="https://... atau unggah file"
              className={inputCls}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 ${
                  storageEnabled && !uploading ? "" : "cursor-not-allowed opacity-50"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Mengunggah..." : "Unggah QRIS"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileSelected}
                  disabled={!storageEnabled || uploading}
                  className="hidden"
                />
              </label>
              {qris && (
                <button
                  type="button"
                  onClick={() => setQris("")}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Hapus
                </button>
              )}
              {!storageEnabled && (
                <span className="text-xs text-slate-400">
                  Unggah file nonaktif — tempel tautan gambar QRIS.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="paymentNote" className="mb-1 block text-sm font-medium text-slate-700">
          Catatan untuk pembeli <span className="text-slate-400">(opsional)</span>
        </label>
        <input
          id="paymentNote"
          name="paymentNote"
          defaultValue={values.paymentNote}
          placeholder="Mis. ambil di sekretariat tiap Sabtu 07.00–10.00"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {note && !error && <p className="text-xs text-emerald-600">✓ {note}</p>}

      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Simpan kanal pembayaran
      </button>
    </form>
  );
}
