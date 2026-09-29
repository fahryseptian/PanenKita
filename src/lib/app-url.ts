/**
 * URL dasar aplikasi (untuk link di pesan WhatsApp, dsb).
 * Konsisten dengan fallback localhost yang dipakai layout/sitemap.
 */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
