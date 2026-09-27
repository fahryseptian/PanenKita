import { describe, expect, it } from "vitest";
import {
  PREVENTED_EMISSION_KG_CO2E_PER_KG,
  carKmEquivalent,
  co2ePreventedKg,
  formatCo2,
} from "../src/lib/carbon";

describe("co2ePreventedKg", () => {
  it("multiplies waste by the emission factor", () => {
    expect(co2ePreventedKg(10)).toBe(25);
    expect(co2ePreventedKg(1.5)).toBe(3.75);
  });

  it("rounds to 2 decimals", () => {
    expect(co2ePreventedKg(0.333)).toBe(0.83);
  });

  it("returns 0 for non-positive or invalid input", () => {
    expect(co2ePreventedKg(0)).toBe(0);
    expect(co2ePreventedKg(-5)).toBe(0);
    expect(co2ePreventedKg(Number.NaN)).toBe(0);
  });

  it("uses a consistent public factor", () => {
    expect(PREVENTED_EMISSION_KG_CO2E_PER_KG).toBe(2.5);
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
