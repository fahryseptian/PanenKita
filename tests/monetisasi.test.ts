import { describe, expect, it } from "vitest";
import {
  computeCommission,
  DEFAULT_COMMISSION,
} from "../src/lib/komisi";
import {
  wholesaleUnitPrice,
  wholesaleLineTotal,
  activeTier,
} from "../src/lib/wholesale";

describe("computeCommission", () => {
  it("charges rate + handling on normal orders", () => {
    const r = computeCommission(100_000);
    expect(r.effectiveRatePercent).toBe(2);
    expect(r.commissionFee).toBe(2_000);
    expect(r.handlingFee).toBe(500);
    expect(r.totalFee).toBe(2_500);
    expect(r.netToKwt).toBe(97_500);
    expect(r.waived).toBe(false);
  });

  it("waives small orders below minOrderValue", () => {
    const r = computeCommission(9_999);
    expect(r.waived).toBe(true);
    expect(r.totalFee).toBe(0);
    expect(r.netToKwt).toBe(9_999);
  });

  it("applies big-buyer discount above threshold", () => {
    const r = computeCommission(2_000_000);
    expect(r.effectiveRatePercent).toBe(1); // 2% - 1%
    expect(r.commissionFee).toBe(20_000);
    expect(r.totalFee).toBe(20_500);
  });

  it("never rounds against the KWT (floor)", () => {
    // 3% dari 12345 = 370.35 -> 370
    const cfg = { ...DEFAULT_COMMISSION, ratePercent: 3, handlingFee: 0 };
    expect(computeCommission(12_345, cfg).commissionFee).toBe(370);
  });

  it("handles zero and negative totals safely", () => {
    expect(computeCommission(0).totalFee).toBe(0);
    expect(computeCommission(-5).totalFee).toBe(0);
  });

  it("zero config means free platform", () => {
    const free = {
      ratePercent: 0,
      handlingFee: 0,
      minOrderValue: 0,
      discountThreshold: 0,
      discountPercent: 0,
    };
    const r = computeCommission(500_000, free);
    expect(r.totalFee).toBe(0);
    expect(r.netToKwt).toBe(500_000);
  });
});

describe("wholesaleUnitPrice", () => {
  const tiers = [
    { minQty: 10, percentOff: 5 },
    { minQty: 50, percentOff: 10 },
  ];

  it("returns base price below first tier", () => {
    expect(wholesaleUnitPrice(10_000, 5, tiers)).toBe(10_000);
  });

  it("applies the largest qualifying tier", () => {
    expect(wholesaleUnitPrice(10_000, 10, tiers)).toBe(9_500);
    expect(wholesaleUnitPrice(10_000, 49, tiers)).toBe(9_500);
    expect(wholesaleUnitPrice(10_000, 50, tiers)).toBe(9_000);
  });

  it("rounds unit price to whole rupiah", () => {
    expect(wholesaleUnitPrice(7_200, 10, tiers)).toBe(6_840);
  });

  it("ignores invalid tiers", () => {
    expect(wholesaleUnitPrice(10_000, 999, [{ minQty: 0, percentOff: 99 }])).toBe(10_000);
  });

  it("line total multiplies discounted unit", () => {
    expect(wholesaleLineTotal(10_000, 10, tiers)).toBe(95_000);
  });

  it("activeTier reports the current tier", () => {
    expect(activeTier(5, tiers)).toBeNull();
    expect(activeTier(20, tiers)).toEqual({ minQty: 10, percentOff: 5 });
    expect(activeTier(100, tiers)).toEqual({ minQty: 50, percentOff: 10 });
  });
});
