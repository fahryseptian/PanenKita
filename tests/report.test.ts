import { describe, expect, it } from "vitest";
import { toCsv, csvFilename } from "../src/lib/csv";
import {
  parseYmdParam,
  formatYmd,
  resolveReportRange,
} from "../src/lib/report-period";

describe("toCsv", () => {
  it("uses semicolon delimiter and CRLF", () => {
    const csv = toCsv(["Nama", "Total"], [["Bayam", 8000]]);
    expect(csv).toContain("Nama;Total\r\n");
    expect(csv).toContain("Bayam;8000\r\n");
  });

  it("escapes quotes and embedded delimiters", () => {
    const csv = toCsv(["Catatan"], [['beliau bilang "halo"']]);
    expect(csv).toContain('"beliau bilang ""halo"""');
    const csv2 = toCsv(["A;B"], [["x"]]);
    expect(csv2).toContain('"A;B"');
  });

  it("renders empty cells for null/undefined", () => {
    const csv = toCsv(["a", "b", "c"], [[null, undefined, "x"]]);
    expect(csv).toContain(";;x");
  });

  it("formats decimals with comma for Indonesian Excel", () => {
    const csv = toCsv(["Qty"], [[12.5]]);
    expect(csv).toContain("12,5");
  });

  it("escapes newlines inside cells", () => {
    const csv = toCsv(["Note"], [["baris1\nbaris2"]]);
    expect(csv).toContain('"baris1\nbaris2"');
  });
});

describe("csvFilename", () => {
  it("slugifies labels", () => {
    expect(csvFilename(["laporan", "KWT Mekar Sari", "2026-09"])).toBe(
      "laporan-kwt-mekar-sari-2026-09.csv",
    );
  });

  it("falls back to laporan when empty", () => {
    expect(csvFilename([""])).toBe("laporan.csv");
  });
});

describe("parseYmdParam", () => {
  it("accepts valid dates", () => {
    const d = parseYmdParam("2026-09-01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(1);
  });

  it("rejects garbage and impossible dates", () => {
    expect(parseYmdParam("abc")).toBeNull();
    expect(parseYmdParam("2026-13-01")).toBeNull();
    expect(parseYmdParam("2026-02-30")).toBeNull();
    expect(parseYmdParam("2026-2-1")).toBeNull();
    expect(parseYmdParam(undefined)).toBeNull();
  });
});

describe("formatYmd", () => {
  it("round-trips with parseYmdParam", () => {
    const d = parseYmdParam("2026-09-05")!;
    expect(formatYmd(d)).toBe("2026-09-05");
  });
});

describe("resolveReportRange", () => {
  it("defaults to last 30 days including today", () => {
    const { from, to, preset } = resolveReportRange();
    expect(preset).toBe("30d");
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(30); // to = startOfToday, from = 29 hari sebelumnya
  });

  it("custom range is inclusive of the end day", () => {
    const { from, to, preset } = resolveReportRange("2026-09-01", "2026-09-07");
    expect(preset).toBe("custom");
    expect(to.getDate()).toBe(8); // eksklusif: 08-09 00:00
    expect(to.getTime() - from.getTime()).toBe(7 * 86_400_000);
  });

  it("swaps reversed ranges", () => {
    const { from, to } = resolveReportRange("2026-09-07", "2026-09-01");
    expect(from.getDate()).toBe(1);
    expect(to.getDate()).toBe(8);
  });

  it("supports month presets", () => {
    const now = new Date();
    const bi = resolveReportRange(null, null, "bulan-ini");
    expect(bi.preset).toBe("bulan-ini");
    expect(bi.from.getDate()).toBe(1);
    expect(bi.from.getMonth()).toBe(now.getMonth());

    const bl = resolveReportRange(null, null, "bulan-lalu");
    expect(bl.preset).toBe("bulan-lalu");
    expect(bl.from.getDate()).toBe(1);
    expect(bl.from.getMonth()).toBe((now.getMonth() + 11) % 12);
    // to bulan-lalu = tanggal 1 bulan ini
    expect(bl.to.getDate()).toBe(1);
    expect(bl.to.getMonth()).toBe(now.getMonth());
  });
});
