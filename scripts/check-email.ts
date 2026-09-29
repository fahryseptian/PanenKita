import "dotenv/config";
import { emailFrom, emailLayout, isEmailEnabled, sendEmail } from "../src/lib/email";

/**
 * Periksa konfigurasi email (Resend) — dan opsional kirim satu email uji.
 * Pemakaian: npx tsx scripts/check-email.ts [--send alamat@tujuan.com]
 *
 * Memanggil endpoint /domains untuk memvalidasi API key — nilai key tidak
 * pernah dicetak, hanya status dan daftar domain terverifikasi. Mode uji
 * Resend hanya mengizinkan pengiriman ke email pemilik akun.
 */
async function main() {
  const args = process.argv.slice(2);
  const sendIndex = args.indexOf("--send");
  const sendTo = sendIndex >= 0 ? args[sendIndex + 1] : null;

  if (!isEmailEnabled()) {
    console.error("✗ RESEND_API_KEY belum diset — email transaksional nonaktif.");
    process.exit(1);
  }

  console.log(`Pengirim aktif: ${emailFrom()}`);

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401 || res.status === 403) {
    console.error(`✗ API key ditolak Resend (HTTP ${res.status}) — periksa/perbarui key.`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`✗ Resend mengembalikan HTTP ${res.status}.`);
    process.exit(1);
  }

  const json = (await res.json()) as {
    data?: Array<{ name: string; status: string }>;
  };
  const domains = json.data ?? [];
  const verified = domains.filter((d) => d.status === "verified");

  console.log(`✓ API key valid — ${domains.length} domain terdaftar, ${verified.length} terverifikasi.`);
  for (const d of domains) {
    console.log(`   - ${d.name} (${d.status})`);
  }
  if (verified.length === 0) {
    console.log(
      "ℹ️  Belum ada domain terverifikasi: pengiriman hanya bisa ke email pemilik akun Resend.",
    );
    console.log("   Verifikasi domain di dashboard Resend lalu set EMAIL_FROM (mis. \"PanenKita <notifikasi@domain.id>\").");
  }

  if (sendTo) {
    const result = await sendEmail({
      to: sendTo,
      subject: "Uji integrasi email PanenKita",
      html: emailLayout({
        title: "Integrasi email berfungsi ✅",
        body: `Email uji dari PanenKita. Bila Anda menerima ini, kanal email (reset sandi, verifikasi, dan peringatan moderasi) siap dipakai.`,
        footer: "Email uji — dikirim dari scripts/check-email.ts",
      }),
      text: "Email uji PanenKita — integrasi email berfungsi.",
    });
    if (result.ok) {
      console.log(`✓ Email uji terkirim (diterima Resend) ke ${sendTo}.`);
    } else {
      console.error(`✗ Email uji gagal: ${result.error}`);
      process.exit(1);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Gagal memeriksa email:", err.message);
  process.exit(1);
});
