import { describe, expect, it } from "vitest";
import {
  forecastProduct,
  forecastAll,
  weeklySums,
  type HarvestPoint,
} from "../src/lib/forecast";

// Senin, 28 Sep 2026 (minggu berjalan). Poin dibuat relatif terhadap ini.
const NOW = new Date(2026, 8, 28); // month 8 = September
const monday = (weeksAgo: number) =>
  new Date(NOW.getTime() - weeksAgo * 7 * 86_400_000);

const p = (weeksAgo: number, kg: number, productId = "bayam"): HarvestPoint => ({
  productId,
  date: monday(weeksAgo),
  quantityKg: kg,
});

describe("weeklySums", () => {
  it("buckets points into the 4 current weeks", () => {
    const sums = weeklySums([p(0, 10), p(1, 20), p(3, 5), p(5, 999)], NOW);
    expect(sums.map((s) => s.kg)).toEqual([5, 0, 20, 10]);
  });

  it("ignores points older than 4 weeks", () => {
    const sums = weeklySums([p(4, 50), p(10, 70)], NOW);
    expect(sums.map((s) => s.kg)).toEqual([0, 0, 0, 0]);
  });
});

describe("forecastProduct", () => {
  it("moving average of 4 weeks is the forecast", () => {
    const f = forecastProduct("bayam", [p(0, 10), p(1, 10), p(2, 10), p(3, 10)], "kg", NOW);
    expect(f.forecastKg).toBe(10);
    expect(f.trend).toBe("stabil");
    expect(f.activeWeeks).toBe(4);
  });

  it("detects rising trend (>=15%)", () => {
    const f = forecastProduct(
      "bayam",
      [p(0, 30), p(1, 30), p(2, 10), p(3, 10)],
      "kg",
      NOW,
    );
    expect(f.last2TotalKg).toBe(60);
    expect(f.prev2TotalKg).toBe(20);
    expect(f.trend).toBe("naik");
    expect(f.trendPercent).toBe(200);
  });

  it("detects falling trend (<=-15%)", () => {
    const f = forecastProduct(
      "bayam",
      [p(0, 5), p(1, 5), p(2, 20), p(3, 20)],
      "kg",
      NOW,
    );
    expect(f.trend).toBe("turun");
    expect(f.trendPercent).toBe(-75);
  });

  it("requires 3 active weeks for a trend label", () => {
    const f = forecastProduct("bayam", [p(0, 30), p(3, 1)], "kg", NOW);
    expect(f.activeWeeks).toBe(2);
    expect(f.trend).toBe("belum-cukup-data");
  });

  it("zero data everywhere stays belum-cukup-data", () => {
    const f = forecastProduct("bayam", [], "kg", NOW);
    expect(f.trend).toBe("belum-cukup-data");
    expect(f.forecastKg).toBe(0);
  });
});

describe("forecastAll", () => {
  it("groups per product and sorts by forecast desc", () => {
    const points = [
      p(0, 4, "bayam"),
      p(1, 4, "bayam"),
      p(2, 4, "bayam"),
      p(3, 4, "bayam"),
      p(0, 40, "singkong"),
      p(1, 40, "singkong"),
      p(2, 40, "singkong"),
      p(3, 40, "singkong"),
    ];
    const units = new Map([
      ["bayam", "kg"],
      ["singkong", "kg"],
    ]);
    const all = forecastAll(points, units, NOW);
    expect(all.map((f) => f.productId)).toEqual(["singkong", "bayam"]);
    expect(all[0]!.forecastKg).toBe(40);
  });
});
