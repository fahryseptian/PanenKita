/**
 * Kategori produk kanonik PanenKita.
 * Kategori lama berupa teks bebas; helper di sini memetakannya ke daftar
 * resmi agar filter direktori konsisten.
 */

export const PRODUCT_CATEGORIES = [
  "sayur",
  "buah",
  "umbi",
  "rempah",
  "protein",
  "lainnya",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Label tampil: "sayur" -> "Sayur". */
export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Petakan kategori teks bebas ke kategori kanonik; default "lainnya". */
export function canonicalCategory(category: string | null | undefined): ProductCategory {
  const s = (category ?? "").trim().toLowerCase();
  return (PRODUCT_CATEGORIES as readonly string[]).includes(s)
    ? (s as ProductCategory)
    : "lainnya";
}

/** Nilai parameter ?kategori= yang valid; null selain daftar kanonik. */
export function parseCategoryParam(
  value: string | undefined | null,
): ProductCategory | null {
  if (!value) return null;
  const s = value.trim().toLowerCase();
  return (PRODUCT_CATEGORIES as readonly string[]).includes(s)
    ? (s as ProductCategory)
    : null;
}
