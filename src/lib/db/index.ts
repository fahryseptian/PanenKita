import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePgJs, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy kwt/.env.example to kwt/.env first.",
    );
  }
  return url;
}

function isLocalDatabase(url: string): boolean {
  return /@localhost|@127\.0\.0\.1|@host\.docker\.internal/i.test(url);
}

/**
 * Ditungkatkan ke satu tipe driver agar inferensi query selalu konsisten.
 * Postgres-js lokal memakai query builder yang sama, jadi aman di runtime.
 */
type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

/** Create the real client on first use (and reuse it afterwards). */
function getDb(): Db {
  if (!cached) {
    const url = databaseUrl();
    if (isLocalDatabase(url)) {
      cached = drizzlePgJs(postgres(url, { max: 10 }), {
        schema,
      }) as unknown as Db;
    } else {
      cached = drizzleNeon(neon(url), { schema });
    }
  }
  return cached;
}

/**
 * Lazy proxy: `import { db }` never connects or throws at module load.
 * The first actual query resolves the client, so a missing DATABASE_URL
 * surfaces where it can be acted on instead of breaking builds.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
