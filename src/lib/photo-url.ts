/**
 * Konvensi URL foto produk.
 *
 * Di DB hanya disimpan "key" S3 (mis. "products/<uuid>.jpg") untuk file yang
 * di-upload ke bucket, atau URL http(s) penuh bila admin menempel tautan
 * eksternal. Helper di sini memutuskan bagaimana sebuah nilai ditampilkan.
 */

/** True jika nilai adalah key bucket (bukan URL http(s) penuh). */
export function isStorageKey(value: string | null | undefined): value is string {
  if (!value) return false;
  return !/^https?:\/\//i.test(value) && !value.startsWith("/");
}

/** Key yang aman untuk dipakai sebagai nama objek: products/<uuid>.<ext>. */
export function buildPhotoKey(productId: string, ext: string): string | null {
  const clean = ext.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(clean)) return null;
  return `products/${productId}.${clean}`;
}

/** Validasi MIME type foto yang diizinkan. */
export function isAllowedPhotoMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mime);
}

/** MIME -> ekstensi file. */
export function mimeToExt(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * URL siap render: key bucket -> endpoint proxy foto; URL eksternal -> apa adanya.
 * Null/empty -> null (pemanggil memakai placeholder emoji).
 */
export function photoSrc(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (isStorageKey(value)) {
    return `/api/uploads/photo?key=${encodeURIComponent(value)}`;
  }
  return value;
}
