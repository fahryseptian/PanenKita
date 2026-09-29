import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { passwordResetMessage, sendWa } from "@/lib/wa";
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
        console.error(
          "[auth] cannot send password reset: user has no WhatsApp number",
          { userId: user.id },
        );
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

export type Session = typeof auth.$Infer.Session;
