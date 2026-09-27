/**
 * Slug & lookup provinsi untuk halaman direktori SEO /katalog/provinsi/[slug].
 */

export function provinceSlug(province: string): string {
  return province
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Cari nama provinsi asli (sesuai casing di DB) dari slug; null jika tidak ada. */
export function provinceFromSlug(
  slug: string,
  provinces: readonly string[],
): string | null {
  const target = slug.toLowerCase();
  return provinces.find((p) => provinceSlug(p) === target) ?? null;
}
