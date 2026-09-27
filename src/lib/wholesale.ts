/**
 * Harga grosir bertingkat (volume discount) — murni, tanpa DB.
 *
 * Tier diurut dari terkecil; harga berlaku untuk kuantitas >= ambang tier
 * terbesar yang terpenuhi. Tier pertama (qty 0) = harga normal.
 */

export interface WholesaleTier {
  /** Kuantitas minimum untuk tier ini. */
  minQty: number;
  /** Diskon persen dari harga saat ini. */
  percentOff: number;
}

/** Harga efektif per satuan untuk kuantitas tertentu (dibulatkan ke rupiah). */
export function wholesaleUnitPrice(
  basePrice: number,
  quantity: number,
  tiers: WholesaleTier[],
): number {
  const sorted = [...tiers]
    .filter((t) => t.minQty > 0 && t.percentOff > 0)
    .sort((a, b) => a.minQty - b.minQty);

  let percent = 0;
  for (const t of sorted) {
    if (quantity >= t.minQty) percent = t.percentOff;
  }
  if (percent <= 0) return basePrice;
  return Math.max(1, Math.round(basePrice * (1 - percent / 100)));
}

/** Total baris dengan harga grosir. */
export function wholesaleLineTotal(
  basePrice: number,
  quantity: number,
  tiers: WholesaleTier[],
): number {
  return wholesaleUnitPrice(basePrice, quantity, tiers) * quantity;
}

/** Tier aktif untuk kuantitas (untuk UI "harga grosir ≥10 kg −5%"). */
export function activeTier(
  quantity: number,
  tiers: WholesaleTier[],
): WholesaleTier | null {
  const sorted = [...tiers]
    .filter((t) => t.minQty > 0 && t.percentOff > 0)
    .sort((a, b) => a.minQty - b.minQty);
  let active: WholesaleTier | null = null;
  for (const t of sorted) {
    if (quantity >= t.minQty) active = t;
  }
  return active;
}
