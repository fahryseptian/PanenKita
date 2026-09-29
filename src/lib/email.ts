/**
 * Email transaksional via Resend (API langsung, satu panggilan — tanpa SMTP).
 *
 * Mengaktifkan: set RESEND_API_KEY. Kirim dari `onboarding@resend.dev` hanya
 * bisa ke email pemilik akun Resend (mode uji) — untuk produksi verifikasi
 * domain lalu set EMAIL_FROM, mis. "PanenKita <notifikasi@panenkita.id>".
 *
 * Pengiriman tidak pernah melempar error: kegagalan dikembalikan sebagai
 * { ok: false, error } agar alur pemanggil (reset sandi, signup) tetap jalan.
 */

import { Resend } from "resend";

export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "PanenKita <onboarding@resend.dev>";
}

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  /** true bila email tidak dikirim karena RESEND_API_KEY belum diset. */
  skipped?: boolean;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };

  try {
    const { error } = await resend.emails.send({
      from: emailFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "resend error" };
  }
}

// ---------------------------------------------------------------------------
// Kerangka HTML bermerek (hijau PanenKita)
// ---------------------------------------------------------------------------

export function emailLayout(opts: { title: string; body: string; cta?: { label: string; url: string }; footer?: string }): string {
  return `<!doctype html>
<html lang="id"><body style="margin:0;padding:24px;background:#f0fdf4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14532d">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #dcfce7">
    <p style="margin:0 0 20px;font-size:15px;font-weight:700;color:#16a34a">🌾 PanenKita</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#14532d">${opts.title}</h1>
    <div style="font-size:14px;line-height:1.65;color:#334155">${opts.body}</div>
    ${
      opts.cta
        ? `<p style="margin:24px 0 0"><a href="${opts.cta.url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${opts.cta.label}</a></p>
           <p style="margin:14px 0 0;font-size:12px;color:#64748b;word-break:break-all">${opts.cta.url}</p>`
        : ""
    }
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
      ${opts.footer ?? "Email otomatis dari PanenKita — katalog panen untuk KWT."}
    </p>
  </div>
</body></html>`;
}

/** Email atur ulang kata sandi (tautan berlaku 1 jam). */
export function passwordResetEmail(opts: { name: string; url: string }) {
  return {
    subject: "Atur ulang kata sandi PanenKita",
    html: emailLayout({
      title: "Atur ulang kata sandi",
      body: `Halo <b>${opts.name}</b>, kami menerima permintaan atur ulang kata sandi untuk akun Anda. Tautan ini berlaku <b>1 jam</b>.<br><br>Jika Anda tidak meminta ini, abaikan email ini — kata sandi Anda tidak berubah.`,
      cta: { label: "Atur ulang kata sandi", url: opts.url },
    }),
    text: `Halo ${opts.name}, atur ulang kata sandi PanenKita Anda (berlaku 1 jam): ${opts.url}`,
  };
}

/** Email verifikasi alamat email saat mendaftar. */
export function verifyEmailTemplate(opts: { name: string; url: string }) {
  return {
    subject: "Verifikasi email PanenKita Anda",
    html: emailLayout({
      title: "Verifikasi email",
      body: `Selamat datang, <b>${opts.name}</b>! Konfirmasi alamat email ini agar notifikasi penting (pesanan, perubahan harga, reset sandi) bisa dikirim ke Anda.`,
      cta: { label: "Verifikasi email", url: opts.url },
      footer: "Abaikan email ini bila Anda tidak merasa mendaftar di PanenKita.",
    }),
    text: `Halo ${opts.name}, verifikasi email PanenKita Anda: ${opts.url}`,
  };
}

/** Peringatan ke superadmin: ada KWT baru yang perlu ditinjau. */
export function newKwtAlertEmail(opts: {
  kwtName: string;
  creatorName: string;
  creatorEmail: string;
  region?: string;
  adminUrl: string;
}) {
  return {
    subject: `KWT baru menunggu persetujuan: ${opts.kwtName}`,
    html: emailLayout({
      title: "Kelompok KWT baru menunggu persetujuan",
      body: `<b>${opts.kwtName}</b> baru mendaftar${opts.region ? ` dari <b>${opts.region}</b>` : ""}.<br><br>Pembuat: ${opts.creatorName} (${opts.creatorEmail})<br>Kelompok ini belum tampil di katalog publik sampai Anda menyetujuinya.`,
      cta: { label: "Tinjau di Panel Admin", url: opts.adminUrl },
      footer: "Email otomatis dari PanenKita — moderasi kelompok baru.",
    }),
    text: `KWT baru: ${opts.kwtName} (${opts.creatorName} / ${opts.creatorEmail}). Tinjau: ${opts.adminUrl}`,
  };
}
