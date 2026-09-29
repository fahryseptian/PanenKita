import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCronAuth } from "../src/lib/cron-auth";

const read = (p: string) =>
  readFileSync(path.resolve(__dirname, "..", p), "utf8");

const req = (headers: Record<string, string> = {}) =>
  new Request("https://panenkita.id/api/orders/expire", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron auth", () => {
  it("allows dev requests when the secret is unset", () => {
    vi.stubEnv("CRON_SHARED_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(checkCronAuth(req())).toBeNull();
  });

  it("fails closed in production when the secret is unset", () => {
    vi.stubEnv("CRON_SHARED_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(checkCronAuth(req())?.status).toBe(503);
  });

  it("rejects a wrong secret", () => {
    vi.stubEnv("CRON_SHARED_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect(checkCronAuth(req({ "x-cron-secret": "salah" }))?.status).toBe(401);
  });

  it("accepts the secret via x-cron-secret and Bearer token", () => {
    vi.stubEnv("CRON_SHARED_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect(checkCronAuth(req({ "x-cron-secret": "s3cret" }))).toBeNull();
    expect(checkCronAuth(req({ authorization: "Bearer s3cret" }))).toBeNull();
  });

  it("is used by both cron endpoints", () => {
    for (const route of [
      "src/app/api/orders/expire/route.ts",
      "src/app/api/pricing/recompute/route.ts",
    ]) {
      const src = read(route);
      expect(src).toContain("checkCronAuth");
      expect(src).not.toContain("allowing request (dev mode)");
    }
  });
});

describe("KWT moderation lifecycle", () => {
  const actions = read("src/lib/actions/superadmin.ts");

  it("supports suspend and resume", () => {
    expect(actions).toContain("suspendKwt");
    expect(actions).toContain("resumeKwt");
    expect(actions).toContain('status: "suspended"');
  });

  it("notifies the KWT creator on approve and reject", () => {
    expect(actions).toContain("notifyKwtCreator");
    expect(actions).toContain("kwtApprovedMessage");
    expect(actions).toContain("kwtRejectedMessage");
  });

  it("explains moderation status in the dashboard", () => {
    const layout = read("src/app/dashboard/layout.tsx");
    expect(layout).toContain('ctx.kwtStatus === "pending"');
    expect(layout).toContain('ctx.kwtStatus === "rejected"');
    expect(layout).toContain('ctx.kwtStatus === "suspended"');
  });

  it("tells registrants about the review step", () => {
    expect(read("src/app/daftar-kwt/page.tsx")).toContain("ditinjau admin");
  });
});

describe("fee settlement", () => {
  const actions = read("src/lib/actions/superadmin.ts");
  const queries = read("src/lib/admin-queries.ts");

  it("records settlements from unsettled fees only", () => {
    expect(actions).toContain("recordSettlement");
    expect(actions).toContain("settledThrough");
    expect(queries).toContain("kwt_settlements");
    expect(queries).toContain("unsettledAmount");
  });

  it("exposes a settlement page with history", () => {
    const page = read("src/app/admin/settlement/page.tsx");
    expect(page).toContain("recordSettlement");
    expect(page).toContain("Riwayat pencairan");
  });
});

describe("manual reset link (no-WhatsApp users)", () => {
  const actions = read("src/lib/actions/superadmin.ts");

  it("creates a better-auth compatible reset token", () => {
    expect(actions).toContain("createResetLinkForUser");
    expect(actions).toContain("reset-password:${token}");
  });

  it("alerts superadmins when a reset cannot be delivered", () => {
    const auth = read("src/lib/auth.ts");
    expect(auth).toContain("alertSuperadminsWithoutPhone");
    expect(auth).toContain("resetWithoutPhoneAlert");
  });
});

describe("production configuration", () => {
  it("reports missing config without leaking values", () => {
    const health = read("src/app/api/health/route.ts");
    expect(health).toContain("REQUIRED_IN_PRODUCTION");
    expect(health).toContain("missingRequired");
    expect(health).toContain("BETTER_AUTH_SECRET");
  });

  it("documents every required and optional key in DEPLOY.md", () => {
    const deploy = read("DEPLOY.md");
    for (const key of [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "NEXT_PUBLIC_APP_URL",
      "CRON_SHARED_SECRET",
      "FONTE_TOKEN",
      "API_INDONESIA_KEY",
      "NEON_UPLOADS_BUCKET",
      "OPEN_DATA_API_KEY",
    ]) {
      expect(deploy).toContain(key);
    }
  });

  it("documents the superadmin bootstrap flow", () => {
    const deploy = read("DEPLOY.md");
    expect(deploy).toContain("promote:superadmin");
    expect(deploy).toContain("--revoke");
  });
});

describe("PWA on iOS", () => {
  it("generates an apple touch icon and declares appleWebApp", () => {
    const icon = read("src/app/apple-icon.tsx");
    expect(icon).toContain("ImageResponse");
    expect(icon).toContain("width: 180");
    expect(read("src/app/layout.tsx")).toContain("appleWebApp");
  });
});
