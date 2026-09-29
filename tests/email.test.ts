import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailFrom,
  isEmailEnabled,
  newKwtAlertEmail,
  passwordResetEmail,
  sendEmail,
  verifyEmailTemplate,
} from "../src/lib/email";

const read = (p: string) =>
  readFileSync(path.resolve(__dirname, "..", p), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email templates", () => {
  it("renders a reset email with name, link, and 1-hour note", () => {
    const t = passwordResetEmail({
      name: "Bu Ratna",
      url: "https://panenkita.id/reset-password?token=abc",
    });
    expect(t.subject).toContain("Atur ulang kata sandi");
    expect(t.html).toContain("Bu Ratna");
    expect(t.html).toContain("https://panenkita.id/reset-password?token=abc");
    expect(t.html).toContain("1 jam");
    expect(t.text).toContain("https://panenkita.id/reset-password?token=abc");
  });

  it("renders a verification email with a CTA", () => {
    const t = verifyEmailTemplate({
      name: "Bu Ketua",
      url: "https://panenkita.id/api/auth/verify-email?token=xyz",
    });
    expect(t.subject).toContain("Verifikasi email");
    expect(t.html).toContain("Verifikasi email");
    expect(t.html).toContain("verify-email?token=xyz");
  });

  it("renders the new-KWT alert with creator details and admin link", () => {
    const t = newKwtAlertEmail({
      kwtName: "KWT Melati",
      creatorName: "Bu Sari",
      creatorEmail: "sari@example.com",
      region: "Kota Bandung, Jawa Barat",
      adminUrl: "https://panenkita.id/admin/kwt?status=pending",
    });
    expect(t.subject).toContain("KWT Melati");
    expect(t.html).toContain("Bu Sari");
    expect(t.html).toContain("/admin/kwt?status=pending");
    expect(t.html).toContain("Kota Bandung");
  });

  it("never embeds raw secrets in the markup", () => {
    const html = passwordResetEmail({ name: "A", url: "https://x/y" }).html;
    expect(html).toContain("<!doctype html>");
    expect(html).not.toMatch(/re_[A-Za-z0-9]{10,}/);
  });
});

describe("sendEmail", () => {
  it("is disabled without an API key and never throws", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isEmailEnabled()).toBe(false);
    const result = await sendEmail({
      to: "a@b.com",
      subject: "x",
      html: "<p>x</p>",
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it("defaults the sender to the Resend test address", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(emailFrom()).toContain("onboarding@resend.dev");
    vi.stubEnv("EMAIL_FROM", "PanenKita <notifikasi@panenkita.id>");
    expect(emailFrom()).toContain("notifikasi@panenkita.id");
  });
});

describe("email wiring", () => {
  it("sends password reset through email and WhatsApp", () => {
    const auth = read("src/lib/auth.ts");
    expect(auth).toContain("passwordResetEmail");
    expect(auth).toContain("isEmailEnabled()");
    expect(auth).toContain("passwordResetMessage");
  });

  it("sends verification email on signup without blocking login", () => {
    const auth = read("src/lib/auth.ts");
    expect(auth).toContain("sendVerificationEmail");
    expect(auth).toContain("sendOnSignUp: true");
    expect(auth).not.toContain("requireEmailVerification: true");
  });

  it("alerts superadmins by email when a new KWT registers", () => {
    const kwt = read("src/lib/actions/kwt.ts");
    expect(kwt).toContain("alertSuperadminsOfNewKwt");
    expect(kwt).toContain("newKwtAlertEmail");
  });

  it("reports email status in the health probe", () => {
    expect(read("src/app/api/health/route.ts")).toContain('email: "RESEND_API_KEY"');
  });

  it("ships a CLI to validate the key and list domains", () => {
    const script = read("scripts/check-email.ts");
    expect(script).toContain("api.resend.com/domains");
    expect(script).toContain("EMAIL_FROM");
  });

  it("documents the email env vars for production", () => {
    const deploy = read("DEPLOY.md");
    expect(deploy).toContain("RESEND_API_KEY");
    expect(deploy).toContain("EMAIL_FROM");
  });
});
