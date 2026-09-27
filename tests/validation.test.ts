import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  isIndonesianMobilePhone,
  orderInputSchema,
  harvestInputSchema,
  productInputSchema,
} from "../src/lib/validation";

describe("normalizePhone", () => {
  it("converts 08xxx to 628xxx", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });

  it("strips +62 and separators", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("keeps 62 prefix", () => {
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });

  it("accepts 8xxx without leading zero", () => {
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });
});

describe("isIndonesianMobilePhone", () => {
  it("validates local formats", () => {
    expect(isIndonesianMobilePhone("081234567890")).toBe(true);
    expect(isIndonesianMobilePhone("0812345")).toBe(false);
    expect(isIndonesianMobilePhone("12345")).toBe(false);
  });
});

describe("orderInputSchema", () => {
  it("accepts a valid order and normalizes phone", () => {
    const res = orderInputSchema.safeParse({
      buyerName: "Budi",
      buyerPhone: "081234567890",
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.buyerPhone).toBe("6281234567890");
  });

  it("rejects empty items", () => {
    const res = orderInputSchema.safeParse({
      buyerName: "Budi",
      buyerPhone: "081234567890",
      items: [],
    });
    expect(res.success).toBe(false);
  });

  it("rejects invalid phone", () => {
    const res = orderInputSchema.safeParse({
      buyerName: "Budi",
      buyerPhone: "12345",
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    });
    expect(res.success).toBe(false);
  });
});

describe("harvestInputSchema", () => {
  it("accepts valid harvest", () => {
    const res = harvestInputSchema.safeParse({
      productId: crypto.randomUUID(),
      quantity: "12.5",
      quality: "A",
    });
    expect(res.success).toBe(true);
  });

  it("rejects zero quantity", () => {
    const res = harvestInputSchema.safeParse({
      productId: crypto.randomUUID(),
      quantity: 0,
    });
    expect(res.success).toBe(false);
  });
});

describe("productInputSchema", () => {
  it("accepts form data style input", () => {
    const res = productInputSchema.safeParse({
      name: "Bayam",
      category: "sayur",
      unit: "kg",
      basePrice: "8000",
    });
    expect(res.success).toBe(true);
  });

  it("rejects too-low price", () => {
    const res = productInputSchema.safeParse({
      name: "Bayam",
      basePrice: 50,
    });
    expect(res.success).toBe(false);
  });
});
