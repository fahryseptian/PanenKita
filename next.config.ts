import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Katalog dan dashboard harus selalu menampilkan stok/harga terbaru.
  // Next 16 menghapus `force-dynamic` global; runtime config diatur per route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Klikjacking: halaman tidak boleh di-frame pihak lain.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
