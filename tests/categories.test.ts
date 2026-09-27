import { describe, expect, it } from "vitest";
import {
  PRODUCT_CATEGORIES,
  canonicalCategory,
  categoryLabel,
  parseCategoryParam,
} from "../src/lib/categories";

describe("PRODUCT_CATEGORIES", () => {
  it("has a stable canonical list", () => {
    expect(PRODUCT_CATEGORIES).toEqual([
      "sayur",
      "buah",
      "umbi",
      "rempah",
      "protein",
      "lainnya",
    ]);
  });
});

describe("canonicalCategory", () => {
  it("passes through known categories", () => {
    expect(canonicalCategory("sayur")).toBe("sayur");
    expect(canonicalCategory("umbi")).toBe("umbi");
  });

  it("trims and lowercases", () => {
    expect(canonicalCategory("  Buah ")).toBe("buah");
  });

  it("maps free text and empty to lainnya", () => {
    expect(canonicalCategory("olahan")).toBe("lainnya");
    expect(canonicalCategory("")).toBe("lainnya");
    expect(canonicalCategory(null)).toBe("lainnya");
    expect(canonicalCategory(undefined)).toBe("lainnya");
  });
});

describe("categoryLabel", () => {
  it("capitalizes", () => {
    expect(categoryLabel("sayur")).toBe("Sayur");
  });
});

describe("parseCategoryParam", () => {
  it("accepts canonical values", () => {
    expect(parseCategoryParam("rempah")).toBe("rempah");
    expect(parseCategoryParam("PROTEIN")).toBe("protein");
  });

  it("rejects unknown values", () => {
    expect(parseCategoryParam("apel")).toBeNull();
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam(undefined)).toBeNull();
  });
});
