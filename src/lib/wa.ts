/**
 * Notifikasi WhatsApp via Fonnte.
 * Token device diset di FONTE_TOKEN; jika kosong, pesan tetap dicatat
 * ke tabel notifications dengan sent=false (mudah diaktifkan belakangan).
 */

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatRupiah } from "./pricing";

export type NotificationKind =
  | "harvest"
  | "price_change"
  | "new_order"
  | "order_paid"
  | "test";

export interface WaRecipient {
  /** Nomor internasional tanpa +, mis. 6281234567890 */
  phone: string;
  /** Nama penerima untuk personalisasi pesan */
  name?: string;
}

export async function sendWa(
  kind: NotificationKind,
  kwtId: string,
  recipient: WaRecipient,
  message: string,
): Promise<void> {
  const token = process.env.FONTE_TOKEN;
  let sent = false;
  let error: string | null = null;

  if (!token) {
    error = "FONTE_TOKEN not set";
  } else {
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: recipient.phone,
          message,
          countryCode: "62",
        }),
        // Jangan sampai notifikasi menggantung request halaman
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { status?: boolean | string };
        sent = data.status === true || data.status === "true";
        if (!sent) error = `fonnte rejected: status=${String(data.status)}`;
      } else {
        error = `fonnte http ${res.status}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "fonnte error";
    }
  }

  try {
    await db.insert(notifications).values({
      kwtId,
      kind,
      target: recipient.phone,
      message,
      sent,
      error,
    });
  } catch (err) {
    console.error("[wa] failed to log notification", err);
  }
}

// ---------------------------------------------------------------------------
// Template pesan (Bahasa Indonesia, ramah anggota KWT)
// ---------------------------------------------------------------------------

export function harvestMessage(opts: {
  productName: string;
  memberName: string;
  quantity: string;
  unit: string;
  quality: string;
}): string {
  return [
    `🌾 *Panen baru dicatat*`,
    ``,
    `${opts.productName}: ${opts.quantity} ${opts.unit} (kualitas ${opts.quality})`,
    `Dicatat oleh: ${opts.memberName}`,
    ``,
    `Stok katalog sudah diperbarui otomatis.`,
  ].join("\n");
}

export function priceChangeMessage(opts: {
  productName: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
}): string {
  const up = opts.newPrice > opts.oldPrice;
  return [
    `💰 *Harga ${opts.productName} ${up ? "naik" : "turun"}*`,
    ``,
    `${formatRupiah(opts.oldPrice)} → ${formatRupiah(opts.newPrice)}`,
    `Alasan: ${opts.reason}`,
  ].join("\n");
}

export function newOrderMessage(opts: {
  orderNumber: string;
  buyerName: string;
  buyerPhone: string;
  summary: string;
  total: number;
}): string {
  return [
    `🧺 *Pesanan baru ${opts.orderNumber}*`,
    ``,
    `Pembeli: ${opts.buyerName} (${opts.buyerPhone})`,
    `Rincian:`,
    opts.summary,
    ``,
    `Total: *${formatRupiah(opts.total)}*`,
    ``,
    `Konfirmasi & atur status di dashboard PanenKita.`,
  ].join("\n");
}

export function orderPaidMessage(opts: {
  orderNumber: string;
  buyerName: string;
  total: number;
}): string {
  return [
    `✅ *Pembayaran diterima*`,
    ``,
    `Halo ${opts.buyerName}, pembayaran pesanan ${opts.orderNumber} sudah kami terima (${formatRupiah(opts.total)}).`,
    ``,
    `Pesanan akan segera disiapkan. Terima kasih! 🌾`,
  ].join("\n");
}

export function orderConfirmMessage(opts: {
  orderNumber: string;
  buyerName: string;
  summary: string;
  total: number;
  payUrl?: string | null;
}): string {
  const lines = [
    `🧺 *Pesanan ${opts.orderNumber} diterima*`,
    ``,
    `Halo ${opts.buyerName}, terima kasih! Rincian pesanan Anda:`,
    opts.summary,
    ``,
    `Total: *${formatRupiah(opts.total)}*`,
  ];
  if (opts.payUrl) {
    lines.push(``, `Bayar online: ${opts.payUrl}`);
  } else {
    lines.push(``, `Pembayaran diatur dengan pengurus KWT.`);
  }
  return lines.join("\n");
}

export function testMessage(name: string): string {
  return `👋 Halo ${name}! Ini pesan uji dari PanenKita. Jika Anda menerima ini, notifikasi WhatsApp berfungsi normal. 🌾`;
}
