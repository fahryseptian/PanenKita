/**
 * Notifikasi WhatsApp via Fonnte.
 * Token device diset di FONTE_TOKEN; jika kosong, pesan tetap dicatat
 * ke tabel notifications dengan sent=false (mudah diaktifkan belakangan).
 */

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatRupiah } from "./pricing";
import { getWaToken } from "./app-settings";

export type NotificationKind =
  | "harvest"
  | "price_change"
  | "new_order"
  | "order_created"
  | "order_paid"
  | "stock_out"
  | "order_expired"
  | "broadcast"
  | "test"
  | "password_reset"
  | "kwt_review";

export interface WaRecipient {
  /** Nomor internasional tanpa +, mis. 6281234567890 */
  phone: string;
  /** Nama penerima untuk personalisasi pesan */
  name?: string;
}

export async function sendWa(
  kind: NotificationKind,
  kwtId: string | null,
  recipient: WaRecipient,
  message: string,
  /** Override target di log notifikasi (mis. productId untuk dedupe stok). */
  logTargetOverride?: string,
  /** Penerima personal untuk notifikasi tanpa KWT (mis. reset password). */
  userId?: string,
): Promise<void> {
  // Token: disimpan admin via UI (app_settings) dulu, fallback env Vercel.
  const token = await getWaToken();
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
      userId: userId ?? null,
      kind,
      target: logTargetOverride ?? recipient.phone,
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
  /** Batas waktu pembayaran (opsional). */
  expiresAt?: Date | null;
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
  if (opts.expiresAt) {
    const sampa = new Date(opts.expiresAt).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(``, `⏳ Selesaikan pembayaran sebelum ${sampa} WIB, ya — setelah itu pesanan otomatis dibatalkan dan stok dilepas.`);
  }
  lines.push(``, `Cek status: ketuk link halaman pesanan yang Anda simpan.`);
  return lines.join("\n");
}

/** Notifikasi ke pengurus: pesanan pending kedaluwarsa otomatis. */
export function orderExpiredMessage(opts: {
  orderNumber: string;
  buyerName: string;
  total: number;
}): string {
  return [
    `⌛ *Pesanan kedaluwarsa*`,
    ``,
    `Pesanan ${opts.orderNumber} dari ${opts.buyerName} (${formatRupiah(opts.total)}) dibatalkan otomatis karena tidak dibayar sebelum batas waktu.`,
    `Stok produk sudah kembali tersedia di katalog.`,
  ].join("\n");
}

/** Notifikasi ke pengurus: stok produk habis. */
export function stockOutMessage(opts: {
  productName: string;
  unit: string;
}): string {
  return [
    `🚨 *Stok habis*`,
    ``,
    `Stok ${opts.productName} sudah 0 ${opts.unit}. Katalog menampilkan "Habis" — catat panen baru agar bisa dipesan lagi.`,
  ].join("\n");
}

/** Notifikasi ke pengurus: panen otomatis dijalankan dari jadwal. */
export function scheduledHarvestMessage(opts: {
  productName: string;
  quantity: string;
  unit: string;
}): string {
  return [
    `🌱 *Panen otomatis dijalankan*`,
    ``,
    `${opts.productName}: +${opts.quantity} ${opts.unit} (dari jadwal panen berulang)`,
    `Stok katalog sudah bertambah dan harga menyesuaikan otomatis.`,
  ].join("\n");
}

/** Pesan broadcast pengumuman ke anggota/pengurus KWT. */
export function broadcastMessage(opts: {
  kwtName: string;
  text: string;
}): string {
  return [
    `📣 *Pengumuman ${opts.kwtName}*,`,
    ``,
    opts.text,
    ``,
    `— dikirim via PanenKita`,
  ].join("\n");
}

export function testMessage(name: string): string {
  return `👋 Halo ${name}! Ini pesan uji dari PanenKita. Jika Anda menerima ini, notifikasi WhatsApp berfungsi normal. 🌾`;
}

/** Kabar moderasi untuk pembuat KWT (disetujui / ditolak). */
export function kwtApprovedMessage(opts: { kwtName: string; slug: string }): string {
  return [
    `✅ *Kelompok ${opts.kwtName} disetujui!*`,
    ``,
    `Katalog Anda sudah tayang di PanenKita:`,
    `/katalog/${opts.slug}`,
    ``,
    `Langkah berikutnya: tambahkan produk, catat panen pertama, dan undang anggota lewat kode undangan di menu Anggota.`,
  ].join("\n");
}

export function kwtRejectedMessage(opts: { kwtName: string; reason?: string }): string {
  return [
    `⛔ *Pendaftaran ${opts.kwtName} belum disetujui*`,
    ``,
    opts.reason ? `Catatan admin: ${opts.reason}` :
      "Data kelompok belum memenuhi syarat katalog publik.",
    ``,
    `Perbaiki data di Pengaturan dashboard lalu hubungi admin PanenKita untuk peninjauan ulang.`,
  ].join("\n");
}

/**
 * Peringatan ke superadmin: permintaan reset tidak bisa dikirim lewat kanal
 * mana pun (tanpa nomor WA dan email gagal/tidak diaktifkan).
 */
export function resetUndeliverableAlert(opts: {
  userName: string;
  userEmail: string;
}): string {
  return [
    `🔑 *Permintaan reset kata sandi*`,
    ``,
    `${opts.userName} (${opts.userEmail}) meminta atur ulang kata sandi,`,
    `tetapi tautan tidak terkirim — akun tanpa nomor WhatsApp dan email tidak aktif/gagal.`,
    ``,
    `Bantu dengan membuat tautan reset dari /admin/pengguna setelah memverifikasi identitasnya.`,
  ].join("\n");
}

/** Tautan atur ulang kata sandi (token kedaluwarsa 1 jam). */
export function passwordResetMessage(opts: { name: string; resetUrl: string }): string {
  return [
    `🔑 *Atur ulang kata sandi PanenKita*,`,
    ``,
    `Halo ${opts.name}, kami menerima permintaan atur ulang kata sandi untuk akun Anda.`,
    ``,
    `Ketuk tautan ini (berlaku 1 jam):`,
    opts.resetUrl,
    ``,
    `Jika Anda tidak meminta ini, abaikan pesan ini — kata sandi Anda tidak berubah.`,
  ].join("\n");
}
