import { describe, expect, it } from "vitest";
import { MAX_EDGE, JPEG_QUALITY, formatBytes } from "../src/lib/image-client";

describe("konstanta kompresi", () => {
  it("memakai target yang masuk akal untuk foto katalog", () => {
    expect(MAX_EDGE).toBe(1200);
    expect(JPEG_QUALITY).toBeGreaterThan(0.7);
    expect(JPEG_QUALITY).toBeLessThanOrEqual(0.9);
  });
});

describe("formatBytes", () => {
  it("formats KB", () => {
    expect(formatBytes(340 * 1024)).toBe("340 kB");
  });

  it("formats MB with one decimal", () => {
    expect(formatBytes(1.2 * 1024 * 1024)).toBe("1,2 MB");
  });

  it("formats small files", () => {
    expect(formatBytes(512)).toBe("1 kB");
  });
});
