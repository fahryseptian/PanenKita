import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { user } from "../src/lib/db/schema";

/**
 * Bootstrap superadmin pertama (atau tambahan).
 * Pemakaian: npx tsx scripts/promote-superadmin.ts <email> [--revoke]
 * Akun harus sudah terdaftar via /signup. Role level platform (bukan role KWT).
 * --revoke : turunkan kembali menjadi user biasa (pembatalan darurat).
 */
async function main() {
  const [rawEmail, ...flags] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const revoke = flags.includes("--revoke");
  const target: "user" | "superadmin" = revoke ? "user" : "superadmin";

  if (!email) {
    console.error(
      "Pemakaian: npx tsx scripts/promote-superadmin.ts <email> [--revoke]",
    );
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!existing) {
    console.error(`User dengan email ${email} tidak ditemukan. Daftar dulu via /signup.`);
    process.exit(1);
  }

  if (existing.role === target) {
    console.log(
      `${email} sudah berrole ${target}.`,
    );
    process.exit(0);
  }

  await db.update(user).set({ role: target }).where(eq(user.id, existing.id));
  console.log(
    revoke
      ? `✔ ${email} diturunkan menjadi user biasa (akses /admin dicabut).`
      : `✔ ${email} sekarang menjadi superadmin. Login lalu buka /admin.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
