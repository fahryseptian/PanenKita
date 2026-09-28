import { describe, expect, it } from "vitest";
import {
  PREVENTED_EMISSION_KG_CO2E_PER_KG,
  COMPOST_EMISSION_KG_CO2E_PER_KG,
  PATHWAY_FACTORS,
  co2ePreventedKg,
  co2eFromPathways,
  carKmEquivalent,
  formatCo2,
} from "../src/lib/carbon";

describe("pathway factors", () => {
  it("consumption pathways outweigh composting", () => {
    expect(PREVENTED_EMISSION_KG_CO2E_PER_KG).toBe(2.5);
    expect(COMPOST_EMISSION_KG_CO2E_PER_KG).toBe(0.5);
    expect(PATHWAY_FACTORS.donasi).toBe(PATHWAY_FACTORS.salur);
    expect(PATHWAY_FACTORS.kompos).toBeLessThan(PATHWAY_FACTORS.salur);
  });
});

describe("co2ePreventedKg", () => {
  it("uses pathway-specific factors", () => {
    expect(co2ePreventedKg(10, "salur")).toBe(25);
    expect(co2ePreventedKg(10, "donasi")).toBe(25);
    expect(co2ePreventedKg(10, "kompos")).toBe(5);
  });

  it("rounds to 2 decimals", () => {
    expect(co2ePreventedKg(0.333, "salur")).toBe(0.83);
  });

  it("returns 0 for non-positive or invalid input", () => {
    expect(co2ePreventedKg(0)).toBe(0);
    expect(co2ePreventedKg(-5)).toBe(0);
    expect(co2ePreventedKg(Number.NaN)).toBe(0);
  });
});

describe("co2eFromPathways", () => {
  it("sums all three pathways with their factors", () => {
    expect(co2eFromPathways({ salur: 10, donasi: 4, kompos: 6 })).toBe(
      10 * 2.5 + 4 * 2.5 + 6 * 0.5,
    ); // 25 + 10 + 3 = 38
  });

  it("handles all-zero breakdown", () => {
    expect(co2eFromPathways({ salur: 0, donasi: 0, kompos: 0 })).toBe(0);
  });

  it("compost-only adds less than consumption", () => {
    expect(co2eFromPathways({ salur: 0, donasi: 0, kompos: 10 })).toBe(5);
  });
});

describe("carKmEquivalent", () => {
  it("divides by the per-km factor", () => {
    expect(carKmEquivalent(17)).toBe(100);
  });

  it("returns 0 for non-positive input", () => {
    expect(carKmEquivalent(0)).toBe(0);
    expect(carKmEquivalent(-1)).toBe(0);
  });
});

describe("formatCo2", () => {
  it("formats Indonesian style", () => {
    expect(formatCo2(12.5)).toBe("12,5 kg CO₂e");
  });
});
