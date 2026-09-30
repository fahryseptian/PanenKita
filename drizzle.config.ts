import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Presedensi env mengikuti Next.js: .env dulu, lalu .env.local menimpanya.
// Tanpa ini, `db:migrate` bisa menarget database yang berbeda dari aplikasi.
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Drizzle-kit hanya dipakai untuk generate/migrate/studio. DDL lebih andal
    // lewat koneksi langsung Neon (unpooled), bukan PgBouncer. Runtime aplikasi
    // tetap memakai DATABASE_URL yang pooled (lihat src/lib/db/index.ts).
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.NEON_DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
