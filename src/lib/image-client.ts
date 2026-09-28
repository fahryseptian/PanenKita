/**
 * Kompresi & resize gambar di sisi klien (canvas API, tanpa dependensi).
 *
 * Tujuan: foto produk dari HP (sering 3–8 MB) menjadi ~100–300 KB sebelum
 * upload, agar katalog cepat dimuat dan kuat data hemat.
 *
 * Aturan:
 * - Sisi terpanjang di-resize maks MAX_EDGE px (aspect ratio dipertahankan).
 * - JPEG/WebP: dikompres ulang dengan quality JPEG_QUALITY.
 * - PNG dengan transparansi: dipertahankan sebagai PNG (tanpa quality loss
 *   tambahan selain resize); PNG tanpa transparansi dikonversi ke JPEG
 *   karena jauh lebih kecil.
 * - File yang sudah lebih kecil dari target dimensi & ukuran dilewati apa
 *   adanya (tidak ada re-encode yang merusak).
 */

export const MAX_EDGE = 1200;
export const JPEG_QUALITY = 0.82;

export interface ProcessedImage {
  blob: Blob;
  /** MIME hasil akhir (bisa berubah dari asli, mis. PNG -> JPEG). */
  contentType: string;
  /** Nama file dengan ekstensi yang sesuai hasil. */
  filename: string;
  originalBytes: number;
  processedBytes: number;
  resized: boolean;
}

function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4 * 11) {
    // sampling setiap ~11 piksel — cukup cepat dan akurat untuk kasus umum
    if (data[i]! < 250) return true;
  }
  return false;
}

/** Proses satu file gambar menjadi versi terkompresi siap upload. */
export async function processImage(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<ProcessedImage> {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const quality = opts.quality ?? JPEG_QUALITY;

  if (!file.type.startsWith("image/")) {
    throw new Error("bukan-gambar");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const resized = scale < 1;

    // Suduk kecil & ukurannya wajar — jangan re-encode (hindari degradasi).
    const smallEnough = !resized && file.size <= 400 * 1024;
    if (smallEnough) {
      return {
        blob: file,
        contentType: file.type,
        filename: file.name,
        originalBytes: file.size,
        processedBytes: file.size,
        resized: false,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-tak-tersedia");
    ctx.drawImage(bitmap, 0, 0, w, h);

    // PNG transparan dipertahankan; PNG solid & lainnya jadi JPEG (lebih kecil).
    const keepPng = file.type === "image/png" && hasAlpha(ctx, w, h);
    const outType = keepPng ? "image/png" : "image/jpeg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, quality),
    );
    if (!blob) throw new Error("encode-gagal");

    const ext = outType === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";

    return {
      blob,
      contentType: outType,
      filename: `${base}.${ext}`,
      originalBytes: file.size,
      processedBytes: blob.size,
      resized,
    };
  } finally {
    bitmap.close();
  }
}

/** Format ukuran singkat gaya Indonesia: 1,2 MB / 340 kB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.round(bytes / 1024)} kB`;
}
