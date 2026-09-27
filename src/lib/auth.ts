import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

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
  },
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
