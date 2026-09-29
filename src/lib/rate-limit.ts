/**
 * Rate limiter in-memory sederhana (fixed window) untuk endpoint publik.
 * Cukup untuk satu instance serverless Vercel — tanpa dependensi eksternal.
 * CATATAN: di multi-region/multi-instance, window tidak dibagi antar instance;
 * cukup untuk memperlambat spam, bukan pembatasan kepatuhan ketat.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Bersihkan bucket kedaluwarsa secara berkala agar Map tidak tumbuh tanpa batas. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Detik sampai window direset (untuk header Retry-After). */
  retryAfter: number;
}

/**
 * Konsumsi satu "token" untuk kunci tertentu.
 * @param key    kunci unik, mis. `orders:1.2.3.4` atau `snap:628123...`
 * @param limit  jumlah request maksimum per window
 * @param windowMs durasi window (default 1 jam)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 3_600_000,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** IP klien dari header standar proxy (Vercel mengirim x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
