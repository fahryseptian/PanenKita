import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) =>
  readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("platform role (superadmin)", () => {
  const schema = read("src/lib/db/schema.ts");

  it("adds user_role enum and role column on user table", () => {
    expect(schema).toMatch(/pgEnum\("user_role", \["user", "superadmin"\]\)/);
    expect(schema).toMatch(/role: userRoleEnum\("role"\)\.notNull\(\)\.default\("user"\)/);
  });

  it("adds kwt_status enum for moderation (incl. suspend)", () => {
    expect(schema).toContain('pgEnum("kwt_status"');
    for (const status of ["pending", "approved", "rejected", "suspended"]) {
      expect(schema).toContain(`"${status}"`);
    }
  });

  const session = read("src/lib/session.ts");

  it("provides superadmin guards separate from KWT roles", () => {
    expect(session).toContain("getPlatformRole");
    expect(session).toContain("isSuperadmin");
    expect(session).toContain("requireSuperadmin");
    expect(session).toContain("requireSuperadminPage");
    expect(session).toContain('"Hanya superadmin yang dapat melakukan aksi ini"');
  });

  it("exposes kwtStatus in the dashboard context", () => {
    expect(session).toContain("kwtStatus:");
  });
});

describe("superadmin bootstrap CLI", () => {
  const script = read("scripts/promote-superadmin.ts");

  it("promotes an existing user by email", () => {
    expect(script).toContain("promote-superadmin.ts <email>");
    expect(script).toContain('const target: "user" | "superadmin"');
    expect(script).toContain("set({ role: target })");
  });

  it("supports --revoke to undo a promotion", () => {
    expect(script).toContain('flags.includes("--revoke")');
    expect(script).toContain('revoke ? "user" : "superadmin"');
  });

  it("is wired as a package script", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["promote:superadmin"]).toContain("promote-superadmin.ts");
  });
});

describe("superadmin entry points to /admin", () => {
  const noKwt = read("src/app/no-kwt/page.tsx");

  it("offers a panel link for superadmins without a KWT", () => {
    expect(noKwt).toContain("getPlatformRole");
    expect(noKwt).toContain("Buka Panel Admin");
    expect(noKwt).toContain('href="/admin"');
  });

  it("adds a sidebar entry in the dashboard for superadmins", () => {
    const layout = read("src/app/dashboard/layout.tsx");
    expect(layout).toContain("getPlatformRole(ctx.userId)");
    expect(layout).toContain('=== "superadmin"');
    expect(layout).toContain("Panel Admin");
    expect(layout).toContain("isSuperadmin={isSuperadmin}");
  });

  it("adds the same entry in the mobile menu", () => {
    const menu = read("src/app/dashboard/mobile-menu.tsx");
    expect(menu).toContain("isSuperadmin: boolean");
    expect(menu).toContain("Panel Admin");
  });
});

describe("admin area", () => {
  const layout = read("src/app/admin/layout.tsx");

  it("guards the whole /admin area", () => {
    expect(layout).toContain("requireSuperadminPage");
  });

  const actions = read("src/lib/actions/superadmin.ts");

  it("guards every mutation with requireSuperadmin", () => {
    const guards = actions.match(/await requireSuperadmin\(\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(7);
  });

  it("supports approve, reject, reset, and role changes", () => {
    expect(actions).toContain("approveKwt");
    expect(actions).toContain("rejectKwt");
    expect(actions).toContain("resetKwtToPending");
    expect(actions).toContain("setUserRole");
  });
});

describe("kwt moderation gates the public catalog", () => {
  const directory = read("src/lib/queries-directory.ts");
  const queries = read("src/lib/queries.ts");

  it("directory lists only approved KWT", () => {
    expect(directory).toMatch(/conds\.push\(eq\(kwts\.status, "approved"\)\)/);
  });

  it("facets and platform stats count approved KWT only", () => {
    expect(directory).toMatch(/eq\(kwts\.status, "approved"\)/g);
  });

  it("public KWT pages resolve approved KWT only", () => {
    expect(queries).toMatch(/eq\(kwts\.slug, slug\), eq\(kwts\.status, "approved"\)/);
  });

  it("recent-products strip excludes unapproved KWT", () => {
    expect(queries).toMatch(/eq\(kwts\.status, "approved"\)/);
  });
});

describe("seed superadmin account", () => {
  const seed = read("src/db/seed.ts");

  it("creates a demo superadmin and approves demo KWT", () => {
    expect(seed).toContain("admin@panenkita.id");
    expect(seed).toContain('role: "superadmin"');
    expect(seed).toMatch(/status: "approved"/);
  });
});
