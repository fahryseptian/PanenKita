import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { user } from "../src/lib/db/schema";

/**
 * Bootstrap superadmin pertama (atau tambahan).
 * Pemakaian: npx tsx scripts/promote-superadmin.ts <email>
 * Akun harus sudah terdaftar via /signup. Role level platform (bukan role KWT).
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Pemakaian: npx tsx scripts/promote-superadmin.ts <email>");
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

  if (existing.role === "superadmin") {
    console.log(`${email} sudah menjadi superadmin.`);
    process.exit(0);
  }

  await db.update(user).set({ role: "superadmin" }).where(eq(user.id, existing.id));
  console.log(`✔ ${email} sekarang menjadi superadmin. Login lalu buka /admin.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
