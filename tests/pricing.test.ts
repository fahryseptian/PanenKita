import { describe, expect, it } from "vitest";
import { computePrice, roundToHundreds, ruleToInput, DEFAULT_RULE } from "../src/lib/pricing";

function make(overrides: Partial<Parameters<typeof computePrice>[0]> = {}) {
  return {
    basePrice: 10_000,
    currentPrice: 10_000,
    availableStock: 50,
    recentOrders: 0,
    lowStockThreshold: 10,
    highStockThreshold: 100,
    lowStockPercent: 10,
    highStockPercent: -10,
    surgeWindowHours: 24,
    surgeMinOrders: 5,
    surgePercent: 5,
    minPricePercent: 70,
    maxPricePercent: 150,
    ...overrides,
  };
}

describe("computePrice", () => {
  it("returns base price when stock and demand are normal", () => {
    const r = computePrice(make());
    expect(r.price).toBe(10_000);
    expect(r.changed).toBe(false);
    expect(r.reasons[0]).toMatch(/normal/);
  });

  it("marks up when stock is low", () => {
    const r = computePrice(make({ availableStock: 5 }));
    expect(r.price).toBe(11_000);
    expect(r.reasons.join(" ")).toMatch(/stok menipis/);
  });

  it("discounts when stock is high", () => {
    const r = computePrice(make({ availableStock: 150 }));
    expect(r.price).toBe(9_000);
    expect(r.reasons.join(" ")).toMatch(/stok menumpuk/);
  });

  it("adds surge markup on top of stock adjustment", () => {
    const r = computePrice(make({ availableStock: 5, recentOrders: 6 }));
    expect(r.price).toBe(11_500);
    expect(r.reasons).toHaveLength(2);
  });

  it("does not apply low and high stock rules together", () => {
    const r = computePrice(make({ availableStock: 5, lowStockThreshold: 10, highStockThreshold: 3 }));
    // stok 5 <= low(10) => markup; tidak ikut high(3)
    expect(r.price).toBe(11_000);
  });

  it("clamps to min price floor", () => {
    const r = computePrice(
      make({ availableStock: 500, highStockPercent: -90 }),
    );
    // raw = 1000, floor = 70% * 10000 = 7000
    expect(r.price).toBe(7_000);
    expect(r.reasons.join(" ")).toMatch(/batas bawah/);
  });

  it("clamps to max price ceiling", () => {
    const r = computePrice(
      make({ availableStock: 1, lowStockPercent: 200 }),
    );
    // raw = 30000, ceiling = 150% * 10000 = 15000
    expect(r.price).toBe(15_000);
    expect(r.reasons.join(" ")).toMatch(/batas atas/);
  });

  it("rounds to hundreds", () => {
    // Math.round(104.5) = 105 (pembulatan setengah ke atas)
    expect(roundToHundreds(10_450)).toBe(10_500);
    expect(roundToHundreds(10_550)).toBe(10_600);
    expect(roundToHundreds(10_449)).toBe(10_400);
  });

  it("detects change against current price", () => {
    // stok 5 -> markup 10% -> 11.000, berbeda dari currentPrice 10.000
    expect(computePrice(make({ currentPrice: 10_000, availableStock: 5 })).changed).toBe(true);
    // sudah sama dengan hasil komputasi
    expect(computePrice(make({ currentPrice: 11_000, availableStock: 5 })).changed).toBe(false);
  });
});

describe("ruleToInput", () => {
  it("converts DB rule row (numeric as string) to engine input", () => {
    const input = ruleToInput(
      DEFAULT_RULE,
      { basePrice: 8_000, currentPrice: 8_000 },
      { availableStock: 4, recentOrders: 1 },
    );
    expect(input.lowStockThreshold).toBe(10);
    expect(input.availableStock).toBe(4);
  });
});
