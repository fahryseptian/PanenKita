import type { MetadataRoute } from "next";

/**
 * PWA manifest — aplikasi bisa di-install ke home screen HP.
 * Ikon SVG tanpa file eksternal agar tidak perlu aset tambahan.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "PanenKita",
    short_name: "PanenKita",
    description:
      "Katalog panen KWT: stok segar, harga dinamis transparan, pesanan via WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
