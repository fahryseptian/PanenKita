"use client";

import { useEffect } from "react";

/**
 * Registrasi service worker di sisi client.
 * Hanya aktif di build produksi (dev server Turbopack tidak menyajikan /sw.js).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Jika ada SW baru yang menunggu, aktifkan segera.
      registration.waiting?.postMessage("SKIP_WAITING");
    }).catch(() => {
      // Gagal register (mis. tanpa HTTPS) tidak boleh mengganggu aplikasi.
    });
  }, []);

  return null;
}
