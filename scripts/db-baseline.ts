/**
 * Baseline migrasi drizzle untuk database yang SUDAH berisi schema.
 *
 * Kenapa perlu: migrasi `0000_*` adalah snapshot penuh (CREATE TABLE semuanya).
 * Kalau dijalankan pada database yang tabelnya sudah ada, migrasi akan gagal.
 * Baseline hanya mencatat migrasi tersebut sebagai "sudah diterapkan" di tabel
 * pembukuan drizzle (`drizzle.__drizzle_migrations`) TANPA menjalankan SQL-nya.
 *
 * Hash diambil dari `readMigrationFiles` — fungsi yang SAMA yang dipakai drizzle
 * saat `migrate`, jadi catatannya dijamin cocok. Script ini juga menghitung ulang
 * sha256 dari file mentah sebagai verifikasi integritas.
 *
 * Pemakaian:
 *   npm run db:baseline              # catat semua migrasi yang ada
 *   npm run db:baseline -- --dry-run # lihat rencananya saja
 *
 * Hanya untuk database LAMA (tabel sudah ada). Database baru cukup
 * `npm run db:migrate`; script ini menolak jalan bila tabel inti belum ada.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const MIGRATIONS_FOLDER = "./drizzle";
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

/** Tabel inti penanda database sudah terisi — kalau tidak ada, jangan baseline. */
const CORE_TABLES = ["kwts", "user", "orders"];

interface Journal {
  entries: Array<{ tag: string; when: number }>;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.NEON_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak ada. Periksa .env / .env.local.");
  const journalPath = `${MIGRATIONS_FOLDER}/meta/_journal.json`;
  if (!existsSync(journalPath)) {
    throw new Error(`Folder ${MIGRATIONS_FOLDER} belum siap — jalankan "npm run db:generate" dulu.`);
  }

  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  if (migrations.length === 0) {
    console.log("Tidak ada file migrasi di folder drizzle/.");
    return;
  }
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const tagByMillis = new Map(journal.entries.map((e) => [e.when, e.tag]));

  const host = url.replace(/^[a-z]+:\/\/[^@]*@/i, "").split(/[/?]/)[0];
  console.log(`Target  : ${host}`);
  console.log(`Migrasi : ${migrations.length} file`);
  console.log(`Mode    : ${dryRun ? "DRY RUN (tidak menulis apa pun)" : "MENULIS pembukuan baseline"}\n`);

  const sql = postgres(url, { max: 1 });
  try {
    // Guard: jangan baseline database kosong — nanti schema tak pernah dibuat.
    const missing: string[] = [];
    for (const table of CORE_TABLES) {
      const [row] = await sql<{ reg: string | null }[]>`
        select to_regclass(${`public.${table}`})::text as reg`;
      if (!row?.reg) missing.push(table);
    }
    if (missing.length > 0) {
      throw new Error(
        `Tabel inti belum ada (${missing.join(", ")}). Database ini masih kosong — ` +
          `jalankan "npm run db:migrate", bukan baseline.`,
      );
    }

    if (!dryRun) {
      await sql`create schema if not exists ${sql(MIGRATIONS_SCHEMA)}`;
      await sql`
        create table if not exists ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} (
          id serial primary key,
          hash text not null,
          created_at bigint
        )`;
    }

    // Semantik sama dengan migrator: hanya migrasi dengan when > created_at terakhir.
    // Dibaca juga saat dry-run supaya laporannya jujur (read-only).
    let lastMillis = 0;
    try {
      const rows = await sql<{ created_at: number | null }[]>`
        select created_at from ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)}
        order by created_at desc limit 1`;
      lastMillis = rows[0]?.created_at != null ? Number(rows[0].created_at) : 0;
    } catch {
      // Tabel pembukuan belum ada (database baru) — anggap belum ada catatan.
      lastMillis = 0;
    }

    let recorded = 0;
    let skipped = 0;
    for (const m of migrations) {
      if (m.folderMillis <= lastMillis) {
        skipped += 1;
        continue;
      }
      const tag = tagByMillis.get(m.folderMillis);
      const raw = tag ? readFileSync(`${MIGRATIONS_FOLDER}/${tag}.sql`, "utf8") : null;
      const digest = raw ? createHash("sha256").update(raw).digest("hex") : null;

      console.log(
        `${dryRun ? "AKAN DICATAT" : "DICATAT"} : ${tag ?? m.folderMillis} ` +
          `(when=${m.folderMillis}, ${m.sql.length} statement)`,
      );
      if (digest !== m.hash) {
        throw new Error(
          `Hash tidak cocok untuk ${tag}: file=${digest?.slice(0, 12) ?? "?"} ` +
            `drizzle=${m.hash.slice(0, 12)}. Migrasi mungkin diubah setelah dibuat — ` +
            `jalankan "npm run db:generate" ulang agar snapshot sinkron.`,
        );
      }
      if (!dryRun) {
        await sql`
          insert into ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} ("hash", "created_at")
          values (${m.hash}, ${m.folderMillis})`;
      }
      recorded += 1;
    }

    console.log(
      `\nSelesai: ${recorded} migrasi ${dryRun ? "akan dicatat" : "dicatat"}, ${skipped} sudah tercatat.`,
    );
    console.log('Verifikasi: "npm run db:migrate" harus melaporkan tidak ada migrasi tertunda.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\nGAGAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
