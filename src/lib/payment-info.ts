/**
 * Kanal pembayaran KWT (PanenKita tidak memegang uang pembeli).
 *
 * Pembeli membayar langsung ke KWT — tunai, transfer ke rekening KWT, atau
 * scan QRIS milik KWT. Helper di sini murni (tanpa import DB) agar mudah diuji
 * dan dipakai ulang oleh struk WhatsApp maupun halaman pesanan pembeli.
 */

export interface KwtPaymentInfo {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  qrisImageUrl: string | null;
  paymentNote: string | null;
}

/** Rekening transfer lengkap (butuh nama bank + nomor rekening). */
export function hasBankAccount(info: KwtPaymentInfo): boolean {
  return Boolean(info.bankName && info.bankAccountNumber);
}

/** True bila pembeli punya minimal satu kanal bayar yang bisa dipakai. */
export function hasPaymentChannel(info: KwtPaymentInfo): boolean {
  return hasBankAccount(info) || Boolean(info.qrisImageUrl);
}

/** Satu baris rekening untuk ditampilkan/disalin: "BRI 1234567890 a/n Sari". */
export function bankAccountLine(info: KwtPaymentInfo): string | null {
  if (!hasBankAccount(info)) return null;
  return [
    info.bankName,
    info.bankAccountNumber,
    info.bankAccountHolder ? `a/n ${info.bankAccountHolder}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Ringkasan cara bayar untuk struk WhatsApp.
 * Null = KWT belum mengatur kanal bayar (pembeli diarahkan menghubungi pengurus).
 */
export function paymentHintOf(info: KwtPaymentInfo): string | null {
  const bank = bankAccountLine(info);
  if (bank) return `Transfer ke ${bank}`;
  if (info.qrisImageUrl) return "Scan QRIS KWT di halaman pesanan";
  return null;
}
