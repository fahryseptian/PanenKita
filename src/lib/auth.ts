import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { passwordResetMessage, resetWithoutPhoneAlert, sendWa } from "@/lib/wa";
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
      if (!row?.phone) {
        // Tanpa nomor WA tautan tak bisa dikirim: beri tahu superadmin agar
        // bisa membantu lewat "Tautan reset" di /admin/pengguna.
        console.warn(
          "[auth] reset requested without WhatsApp number; alerting superadmins",
          { userId: user.id },
        );
        await alertSuperadminsWithoutPhone({
          userName: user.name,
          userEmail: user.email,
        });
        return;
      }
      await sendWa(
        "password_reset",
        null,
        { phone: row.phone, name: user.name },
        passwordResetMessage({ name: user.name, resetUrl: url }),
        undefined,
        user.id,
      );
    },
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

/** Kirim peringatan WA ke semua superadmin yang punya nomor terdaftar. */
async function alertSuperadminsWithoutPhone(opts: {
  userName: string;
  userEmail: string;
}): Promise<void> {
  try {
    const admins = await db
      .select({ name: userTable.name, phone: userTable.phone })
      .from(userTable)
      .where(eq(userTable.role, "superadmin"));
    const message = resetWithoutPhoneAlert(opts);
    for (const admin of admins) {
      if (!admin.phone) continue;
      await sendWa(
        "password_reset",
        null,
        { phone: admin.phone, name: admin.name },
        message,
      );
    }
  } catch (err) {
    console.error("[auth] failed to alert superadmins", err);
  }
}

export type Session = typeof auth.$Infer.Session;
