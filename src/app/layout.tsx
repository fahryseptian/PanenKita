import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegistrar } from "./sw-register";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "PanenKita";

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${productName} — Katalog panen KWT`,
    template: `%s · ${productName}`,
  },
  manifest: "/manifest.webmanifest",
  // iOS: tombol "Tambahkan ke Layar Utama" memakai apple-icon.tsx
  appleWebApp: {
    capable: true,
    title: productName,
    statusBarStyle: "default",
  },
  description:
    "Platform katalog panen untuk KWT: stok & harga selalu segar, harga dinamis yang transparan, notifikasi WhatsApp instan, dan pembayaran langsung ke kelompok.",
  openGraph: {
    title: `${productName} — Katalog panen KWT`,
    description:
      "Belanja hasil panen langsung dari Kelompok Tani Wanita. Harga jujur, stok segar setiap hari, bayar langsung ke kelompok.",
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
      <body className="min-h-screen bg-white text-slate-900">
        {children}
        <ServiceWorkerRegistrar />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
