import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { passwordResetMessage, resetUndeliverableAlert, sendWa } from "@/lib/wa";
import {
  isEmailEnabled,
  passwordResetEmail,
  sendEmail,
  verifyEmailTemplate,
} from "@/lib/email";
import { appUrl } from "@/lib/app-url";

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    // Fallback hanya untuk build/dev; WAJIB diset BETTER_AUTH_SECRET di produksi.
    "panenkita-development-secret-change-me",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    /** Token reset kedaluwarsa 1 jam; semua sesi dicabut setelah reset sukses. */
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    /**
     * Pengirim link reset. Produk ini WA-first: token dititipkan ke Fonnte
     * (tanpa token device, permintaan tetap tercatat di tabel notifications).
     */
    sendResetPassword: async ({ user, url }) => {
      const [row] = await db
        .select({ phone: userTable.phone })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      // Kanal 1 — email (semua akun punya email).
      let delivered = false;
      if (isEmailEnabled()) {
        const template = passwordResetEmail({ name: user.name, url });
        const result = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        delivered = result.ok;
        if (!result.ok) {
          console.error("[auth] reset email failed", result.error);
        }
      }

      // Kanal 2 — WhatsApp, bila nomornya terdaftar.
      if (row?.phone) {
        await sendWa(
          "password_reset",
          null,
          { phone: row.phone, name: user.name },
          passwordResetMessage({ name: user.name, resetUrl: url }),
          undefined,
          user.id,
        );
        delivered = true;
      }

      // Dua kanal gagal → superadmin bisa menolong lewat /admin/pengguna.
      if (!delivered) {
        console.warn(
          "[auth] reset link could not be delivered; alerting superadmins",
          { userId: user.id },
        );
        await alertSuperadminsOfUndeliverableReset({
          userName: user.name,
          userEmail: user.email,
        });
      }
    },
    /** Email verifikasi saat pendaftaran (soft — login tetap bisa tanpa verifikasi). */
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { name: string; email: string };
      url: string;
    }) => {
      if (!isEmailEnabled()) return;
      const template = verifyEmailTemplate({ name: user.name, url });
      const result = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      if (!result.ok) {
        console.error("[auth] verification email failed", result.error);
      }
    },
  },
  /** Kirim email verifikasi otomatis setelah daftar (tanpa memblokir login). */
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
  },
  /** Blokir brute-force endpoint sensitif (login, request reset, reset). */
  rateLimit: { enabled: true, window: 60, max: 20 },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      /** Nomor WhatsApp, format 628xxxxxxxxxx */
      phone: { type: "string", required: false, input: true },
      /**
       * Role level platform. `input: false` — hanya bisa diubah lewat CLI/aksi
       * superadmin, tidak pernah bisa diset sendiri saat signup.
       */
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "user",
      },
      /** Ikut menerima notifikasi perubahan harga via WhatsApp */
      waOptIn: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
});

/** Kirim peringatan ke semua superadmin (WA bila ada nomor, plus email). */
async function alertSuperadminsOfUndeliverableReset(opts: {
  userName: string;
  userEmail: string;
}): Promise<void> {
  try {
    const admins = await db
      .select({ name: userTable.name, phone: userTable.phone, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.role, "superadmin"));
    if (admins.length === 0) return;

    const message = resetUndeliverableAlert(opts);
    for (const admin of admins) {
      if (admin.phone) {
        await sendWa("password_reset", null, { phone: admin.phone, name: admin.name }, message);
      }
    }

    if (isEmailEnabled()) {
      const emails = admins.map((a) => a.email).filter(Boolean);
      if (emails.length > 0) {
        await sendEmail({
          to: emails,
          subject: "Permintaan reset kata sandi tidak terkirim",
          html: `<p>${opts.userName} (${opts.userEmail}) meminta atur ulang kata sandi, tetapi tautan tidak bisa dikirim (tanpa nomor WhatsApp dan email gagal).</p><p>Buat tautan reset manual di /admin/pengguna setelah memverifikasi identitasnya.</p>`,
          text: `${opts.userName} (${opts.userEmail}) gagal menerima tautan reset. Buat tautan manual di /admin/pengguna.`,
        });
      }
    }
  } catch (err) {
    console.error("[auth] failed to alert superadmins", err);
  }
}

export type Session = typeof auth.$Infer.Session;
