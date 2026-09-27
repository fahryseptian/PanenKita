import { describe, expect, it } from "vitest";
import { provinceSlug, provinceFromSlug } from "../src/lib/provinces";

describe("provinceSlug", () => {
  it("slugifies common province names", () => {
    expect(provinceSlug("Jawa Barat")).toBe("jawa-barat");
    expect(provinceSlug("Daerah Istimewa Yogyakarta")).toBe(
      "daerah-istimewa-yogyakarta",
    );
    expect(provinceSlug("Aceh")).toBe("aceh");
  });

  it("trims separators", () => {
    expect(provinceSlug("  Jawa  Tengah ")).toBe("jawa-tengah");
  });
});

describe("provinceFromSlug", () => {
  const provinces = ["Jawa Barat", "Jawa Tengah", "Kab. Sukabumi, Jawa Barat"];

  it("resolves slug back to the original casing", () => {
    expect(provinceFromSlug("jawa-barat", provinces)).toBe("Jawa Barat");
  });

  it("returns null for unknown slugs", () => {
    expect(provinceFromSlug("papua", provinces)).toBeNull();
    expect(provinceFromSlug("", provinces)).toBeNull();
  });

  it("round-trips every province", () => {
    for (const p of provinces) {
      expect(provinceFromSlug(provinceSlug(p), provinces)).toBe(p);
    }
  });
});
