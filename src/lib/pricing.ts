/**
 * Dynamic Pricing Engine — modul murni (tanpa DB) agar mudah diuji.
 *
 * Harga jual = harga dasar yang disesuaikan aturan, berurutan:
 *   1. Stok menipis  (available <= lowStockThreshold)  -> markup
 *   2. Stok menumpuk (available >= highStockThreshold) -> diskon
 *   3. Lonjakan permintaan (pesanan N jam terakhir >= surgeMinOrders) -> markup
 * Hasil dibatasi min/max relatif terhadap harga dasar, dibulatkan ke ratusan.
 * Setiap keputusan menghasilkan alasan manusiawi untuk jejak audit.
 */

export interface PricingInput {
  basePrice: number;
  currentPrice: number;
  availableStock: number;
  /** Pesanan yang dibuat dalam surgeWindowHours terakhir */
  recentOrders: number;
  lowStockThreshold: number;
  highStockThreshold: number;
  lowStockPercent: number;
  highStockPercent: number;
  surgeWindowHours: number;
  surgeMinOrders: number;
  surgePercent: number;
  minPricePercent: number;
  maxPricePercent: number;
}

export interface PricingResult {
  price: number;
  changed: boolean;
  reasons: string[];
}

const unit = (n: number): string => n.toLocaleString("id-ID");

export function roundToHundreds(n: number): number {
  return Math.max(0, Math.round(n / 100) * 100);
}

export function formatRupiah(n: number): string {
  return `Rp${unit(n)}`;
}

export function computePrice(input: PricingInput): PricingResult {
  const reasons: string[] = [];
  let percent = 0;

  if (input.availableStock <= input.lowStockThreshold) {
    percent += input.lowStockPercent;
    reasons.push(
      `stok menipis (${unit(input.availableStock)} ≤ ${unit(input.lowStockThreshold)}): +${input.lowStockPercent}%`,
    );
  } else if (input.availableStock >= input.highStockThreshold) {
    percent += input.highStockPercent;
    reasons.push(
      `stok menumpuk (${unit(input.availableStock)} ≥ ${unit(input.highStockThreshold)}): ${input.highStockPercent}%`,
    );
  }

  if (input.recentOrders >= input.surgeMinOrders) {
    percent += input.surgePercent;
    reasons.push(
      `permintaan naik (${input.recentOrders} pesanan dalam ${input.surgeWindowHours} jam terakhir): +${input.surgePercent}%`,
    );
  }

  const min = Math.floor((input.basePrice * input.minPricePercent) / 100);
  const max = Math.floor((input.basePrice * input.maxPricePercent) / 100);
  const raw = input.basePrice + Math.floor((input.basePrice * percent) / 100);
  const clamped = Math.min(max, Math.max(min, raw));
  const price = roundToHundreds(clamped);

  if (percent === 0) {
    reasons.push("stok & permintaan normal: harga mengikuti harga dasar");
  }
  if (raw < min) {
    reasons.push(`dibatasi batas bawah ${input.minPricePercent}% dari harga dasar`);
  }
  if (raw > max) {
    reasons.push(`dibatasi batas atas ${input.maxPricePercent}% dari harga dasar`);
  }

  return { price, changed: price !== input.currentPrice, reasons };
}

// ---------------------------------------------------------------------------
// Konversi aturan DB -> PricingInput
// ---------------------------------------------------------------------------

export interface PricingRuleRow {
  lowStockThreshold: string;
  highStockThreshold: string;
  lowStockPercent: number;
  highStockPercent: number;
  surgeWindowHours: number;
  surgeMinOrders: number;
  surgePercent: number;
  minPricePercent: number;
  maxPricePercent: number;
}

export const DEFAULT_RULE: PricingRuleRow = {
  lowStockThreshold: "10",
  highStockThreshold: "100",
  lowStockPercent: 10,
  highStockPercent: -10,
  surgeWindowHours: 24,
  surgeMinOrders: 5,
  surgePercent: 5,
  minPricePercent: 70,
  maxPricePercent: 150,
};

export function ruleToInput(
  rule: PricingRuleRow,
  product: { basePrice: number; currentPrice: number },
  stock: { availableStock: number; recentOrders: number },
): PricingInput {
  return {
    basePrice: product.basePrice,
    currentPrice: product.currentPrice,
    availableStock: stock.availableStock,
    recentOrders: stock.recentOrders,
    lowStockThreshold: Number(rule.lowStockThreshold),
    highStockThreshold: Number(rule.highStockThreshold),
    lowStockPercent: rule.lowStockPercent,
    highStockPercent: rule.highStockPercent,
    surgeWindowHours: rule.surgeWindowHours,
    surgeMinOrders: rule.surgeMinOrders,
    surgePercent: rule.surgePercent,
    minPricePercent: rule.minPricePercent,
    maxPricePercent: rule.maxPricePercent,
  };
}
