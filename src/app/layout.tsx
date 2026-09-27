import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "PanenKita";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${productName} — Katalog panen KWT`,
    template: `%s · ${productName}`,
  },
  description:
    "Platform katalog panen untuk KWT: stok & harga selalu segar, harga dinamis yang transparan, notifikasi WhatsApp instan, pembayaran digital.",
  openGraph: {
    title: `${productName} — Katalog panen KWT`,
    description:
      "Belanja hasil panen langsung dari Kelompok Tani Wanita. Harga jujur, stok segar setiap hari.",
    url: appUrl,
    siteName: productName,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-slate-900">{children}</body>
    </html>
  );
}
