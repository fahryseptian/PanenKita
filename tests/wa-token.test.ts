import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pickWaToken, waTokenKey, WA_TOKEN_KEY } from "../src/lib/app-settings";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("waTokenKey", () => {
  it("namespaces the KWT token under the global key", () => {
    expect(waTokenKey("abc-123")).toBe("fonte_token:abc-123");
  });

  it("never collides with the global platform key", () => {
    expect(waTokenKey("kwt")).not.toBe(WA_TOKEN_KEY);
  });
});

describe("pickWaToken", () => {
  it("prefers the KWT's own device over platform and env", () => {
    const { token, source } = pickWaToken({
      kwt: "kwt-device",
      platform: "platform-device",
      env: "env-device",
    });
    expect(token).toBe("kwt-device");
    expect(source).toBe("kwt");
  });

  it("falls back to the platform token when the KWT has none", () => {
    const { token, source } = pickWaToken({
      kwt: null,
      platform: "platform-device",
      env: "env-device",
    });
    expect(token).toBe("platform-device");
    expect(source).toBe("database");
  });

  it("falls back to env when neither KWT nor platform is set", () => {
    const { token, source } = pickWaToken({ kwt: null, platform: null, env: "env-device" });
    expect(token).toBe("env-device");
    expect(source).toBe("env");
  });

  it("reports none when nothing is configured", () => {
    const { token, source } = pickWaToken({});
    expect(token).toBeNull();
    expect(source).toBe("none");
  });

  it("ignores blank values instead of treating them as configured", () => {
    const { token, source } = pickWaToken({ kwt: "", platform: "", env: "env-device" });
    expect(token).toBe("env-device");
    expect(source).toBe("env");
  });
});

describe("token wiring", () => {
  it("resolves the effective token per KWT, not globally", () => {
    expect(read("src/lib/wa.ts")).toContain("await getWaToken(kwtId)");
  });

  it("scopes the KWT dashboard token to that KWT", () => {
    const kwt = read("src/lib/actions/kwt.ts");
    expect(kwt).toContain("setSetting(waTokenKey(ctx.kwtId), token)");
    expect(kwt).toContain("deleteSetting(waTokenKey(ctx.kwtId))");
    // Regresi: menulis kunci global dari dashboard KWT membajak device semua kelompok.
    expect(kwt).not.toContain("setSetting(WA_TOKEN_KEY");
    expect(kwt).not.toContain("deleteSetting(WA_TOKEN_KEY");
  });

  it("keeps the superadmin global token as the fallback", () => {
    const superadmin = read("src/lib/actions/superadmin.ts");
    expect(superadmin).toContain("setSetting(WA_TOKEN_KEY, token)");
  });
});
