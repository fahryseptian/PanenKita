/**
 * Seed data contoh untuk pilot PanenKita.
 * Jalankan: npm run db:seed (butuh "db:seed" di package.json scripts)
 *
 * Akun demo:
 *   admin@panenkita.id      / panenkita123  (superadmin platform, /admin)
 *   ketua@panenkita.id      / panenkita123  (ketua)
 *   bendahara@panenkita.id  / panenkita123  (bendahara)
 *   anggota@panenkita.id    / panenkita123  (anggota)
 */

import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../lib/db";
import {
  account,
  harvests,
  kwtMembers,
  kwts,
  pricingRules,
  products,
  user,
} from "../lib/db/schema";

const DEMO_PASSWORD = "panenkita123";

async function upsertUser(opts: {
  name: string;
  email: string;
  phone: string;
  role: "ketua" | "bendahara" | "anggota";
  kwtId: string;
}): Promise<string> {
  const [existing] = await db.select().from(user).where(eq(user.email, opts.email)).limit(1);
  if (existing) {
    const [m] = await db
      .select()
      .from(kwtMembers)
      .where(
        and(eq(kwtMembers.userId, existing.id), eq(kwtMembers.kwtId, opts.kwtId)),
      )
      .limit(1);
    if (!m) {
      await db
        .insert(kwtMembers)
        .values({ kwtId: opts.kwtId, userId: existing.id, role: opts.role });
    }
    return existing.id;
  }

  const userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    waOptIn: true,
    emailVerified: true,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: await hashPassword(DEMO_PASSWORD),
  });
  await db
    .insert(kwtMembers)
    .values({ kwtId: opts.kwtId, userId, role: opts.role });
  return userId;
}

async function main() {
  console.log("Seeding PanenKita...");

  // 0. Akun superadmin platform (tanpa keanggotaan KWT — mengelola via /admin)
  {
    const email = "admin@panenkita.id";
    const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!existing) {
      const adminId = crypto.randomUUID();
      await db.insert(user).values({
        id: adminId,
        name: "Admin PanenKita",
        email,
        phone: "6281234567899",
        waOptIn: false,
        emailVerified: true,
        role: "superadmin",
      });
      await db.insert(account).values({
        id: crypto.randomUUID(),
        userId: adminId,
        accountId: adminId,
        providerId: "credential",
        password: await hashPassword(DEMO_PASSWORD),
      });
      console.log(`Superadmin: ${email} / ${DEMO_PASSWORD} → /admin`);
    }
  }

  // 1. Dua KWT (demo multi-kelompok untuk skala nasional)
  let [kwt] = await db.select().from(kwts).where(eq(kwts.slug, "mekar-sari")).limit(1);
  if (!kwt) {
    [kwt] = await db
      .insert(kwts)
      .values({
        name: "KWT Mekar Sari",
        slug: "mekar-sari",
        address: "Desa Sukamaju, Kec. Sukamaju",
        regency: "Kab. Bandung",
        province: "Jawa Barat",
        inviteCode: "MEKAR2026",
      })
      .returning();
  }
  if (!kwt) throw new Error("Gagal membuat KWT");
  // Data demo selalu disetujui superadmin agar langsung tampil di katalog.
  await db
    .update(kwts)
    .set({ status: "approved", approvedAt: kwt.approvedAt ?? new Date() })
    .where(eq(kwts.id, kwt.id));
  console.log(`KWT 1: ${kwt.name} (${kwt.slug}) — kode: ${kwt.inviteCode}`);

  let [kwt2] = await db.select().from(kwts).where(eq(kwts.slug, "srikandi-makmur")).limit(1);
  if (!kwt2) {
    [kwt2] = await db
      .insert(kwts)
      .values({
        name: "KWT Srikandi Makmur",
        slug: "srikandi-makmur",
        address: "Kel. Cibangkong, Kec. Batununggal",
        regency: "Kota Bandung",
        province: "Jawa Barat",
        inviteCode: "SRIKANDI26",
      })
      .returning();
  }
  if (!kwt2) throw new Error("Gagal membuat KWT kedua");
  await db
    .update(kwts)
    .set({ status: "approved", approvedAt: kwt2.approvedAt ?? new Date() })
    .where(eq(kwts.id, kwt2.id));
  console.log(`KWT 2: ${kwt2.name} (${kwt2.slug}) — kode: ${kwt2.inviteCode}`);

  // 2. Pengguna
  const ketuaId = await upsertUser({
    name: "Ibu Ketua",
    email: "ketua@panenkita.id",
    phone: "6281234567890",
    role: "ketua",
    kwtId: kwt.id,
  });
  await upsertUser({
    name: "Ibu Bendahara",
    email: "bendahara@panenkita.id",
    phone: "6281234567891",
    role: "bendahara",
    kwtId: kwt.id,
  });
  const anggotaId = await upsertUser({
    name: "Ibu Anggota",
    email: "anggota@panenkita.id",
    phone: "6281234567892",
    role: "anggota",
    kwtId: kwt.id,
  });
  // Ketua KWT 2; Ibu Ketua juga ikut sebagai anggota di KWT 2 (demo multi-kelompok)
  const ratnaId = await upsertUser({
    name: "Ibu Ratna",
    email: "ratna@panenkita.id",
    phone: "6281234567893",
    role: "ketua",
    kwtId: kwt2.id,
  });
  await upsertUser({
    name: "Ibu Ketua",
    email: "ketua@panenkita.id",
    phone: "6281234567890",
    role: "anggota",
    kwtId: kwt2.id,
  });

  // 3. Produk + aturan harga default
  const catalog = [
    { name: "Bayam Hidroponik", category: "sayur", unit: "kg", basePrice: 8_000, description: "Bayam segar hasil hidroponik, dipanen pagi hari." },
    { name: "Kangkung Segar", category: "sayur", unit: "ikat", basePrice: 3_000, description: "Kangkung renyah, cocok untuk tumis." },
    { name: "Tomat Merah", category: "sayur", unit: "kg", basePrice: 12_000, description: "Tomat matang pohon, cocok untuk sambal & jus." },
    { name: "Cabai Rawit Merah", category: "rempah", unit: "kg", basePrice: 45_000, description: "Cabai rawit pedas nendang." },
    { name: "Telur Ayam Kampung", category: "protein", unit: "pack", basePrice: 28_000, description: "Isi 10 telur ayam kampung." },
  ];

  const productIds: string[] = [];
  for (const c of catalog) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let [p] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
    if (!p) {
      [p] = await db
        .insert(products)
        .values({
          kwtId: kwt.id,
          name: c.name,
          slug,
          category: c.category,
          unit: c.unit,
          description: c.description,
          basePrice: c.basePrice,
          currentPrice: c.basePrice,
        })
        .returning();
    }
    if (!p) throw new Error(`Gagal membuat produk ${c.name}`);
    productIds.push(p.id);
    await db.insert(pricingRules).values({ productId: p.id }).onConflictDoNothing();
  }

  // 4. Panen 7 hari terakhir untuk KWT 1 (sekali saja)
  const existingHarvests = await db.select({ id: harvests.id }).from(harvests).limit(1);
  if (existingHarvests.length === 0) {
    const rows: (typeof harvests.$inferInsert)[] = [];
    for (let day = 0; day < 7; day++) {
      for (const pid of productIds) {
        if (Math.random() < 0.4) continue;
        rows.push({
          productId: pid,
          memberId: day % 2 === 0 ? anggotaId : ketuaId,
          quantity: (5 + Math.random() * 25).toFixed(2),
          quality: Math.random() < 0.8 ? "A" : "B",
          harvestedAt: new Date(Date.now() - day * 86_400_000 - Math.random() * 6 * 3_600_000),
        });
      }
    }
    if (rows.length > 0) await db.insert(harvests).values(rows);
    console.log(`Panen KWT 1: ${rows.length} catatan`);
  }

  // 5. Produk & panen KWT 2
  const catalog2 = [
    { name: "Pakcoy Hidroponik", category: "sayur", unit: "kg", basePrice: 9_000, description: "Pakcoy segar dari greenhouse anggota." },
    { name: "Selada Hijau", category: "sayur", unit: "kg", basePrice: 10_000, description: "Selada keriting untuk salad." },
    { name: "Brokoli Segar", category: "sayur", unit: "kg", basePrice: 25_000, description: "Brokoli ungu dan hijau pilihan." },
  ];
  const productIds2: string[] = [];
  for (const c of catalog2) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let [p] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
    if (!p) {
      [p] = await db
        .insert(products)
        .values({
          kwtId: kwt2.id,
          name: c.name,
          slug,
          category: c.category,
          unit: c.unit,
          description: c.description,
          basePrice: c.basePrice,
          currentPrice: c.basePrice,
        })
        .returning();
    }
    if (!p) throw new Error(`Gagal membuat produk ${c.name}`);
    productIds2.push(p.id);
    await db.insert(pricingRules).values({ productId: p.id }).onConflictDoNothing();
  }
  const existingH2 = await db
    .select({ id: harvests.id })
    .from(harvests)
    .where(inArray(harvests.productId, productIds2))
    .limit(1);
  if (existingH2.length === 0) {
    const rows2: (typeof harvests.$inferInsert)[] = [];
    for (let day = 0; day < 5; day++) {
      for (const pid of productIds2) {
        if (Math.random() < 0.35) continue;
        rows2.push({
          productId: pid,
          memberId: ratnaId,
          quantity: (8 + Math.random() * 20).toFixed(2),
          quality: "A",
          harvestedAt: new Date(Date.now() - day * 86_400_000 - Math.random() * 5 * 3_600_000),
        });
      }
    }
    if (rows2.length > 0) await db.insert(harvests).values(rows2);
    console.log(`Panen KWT 2: ${rows2.length} catatan`);
  }

  console.log("Selesai ✔  Login: admin@panenkita.id (superadmin), ketua@panenkita.id / panenkita123 (KWT 1) atau ratna@panenkita.id / panenkita123 (KWT 2)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
