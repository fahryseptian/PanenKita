import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Katalog dan dashboard harus selalu menampilkan stok/harga terbaru.
  // Next 16 menghapus `force-dynamic` global; runtime config diatur per route.
};

export default nextConfig;
