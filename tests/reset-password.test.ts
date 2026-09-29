import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { passwordResetMessage } from "../src/lib/wa";

describe("passwordResetMessage", () => {
  it("includes name, reset link, and 1-hour validity", () => {
    const msg = passwordResetMessage({
      name: "Bu Ratna",
      resetUrl: "https://panenkita.id/reset-password?token=abc123",
    });
    expect(msg).toContain("Bu Ratna");
    expect(msg).toContain("https://panenkita.id/reset-password?token=abc123");
    expect(msg).toContain("1 jam");
    expect(msg).toContain("abaikan");
  });
});

describe("auth reset wiring", () => {
  const authSrc = readFileSync(
    path.resolve(__dirname, "../src/lib/auth.ts"),
    "utf8",
  );

  it("sends the reset link via WhatsApp hook", () => {
    expect(authSrc).toContain("sendResetPassword");
    expect(authSrc).toContain('"password_reset"');
    expect(authSrc).toContain("passwordResetMessage");
  });

  it("expires token in 1 hour and revokes sessions on reset", () => {
    expect(authSrc).toContain("resetPasswordTokenExpiresIn: 60 * 60");
    expect(authSrc).toContain("revokeSessionsOnPasswordReset: true");
  });

  it("enables rate limiting on auth endpoints", () => {
    expect(authSrc).toContain("rateLimit: { enabled: true");
  });
});

describe("password reset pages", () => {
  const forgot = readFileSync(
    path.resolve(__dirname, "../src/app/(auth)/lupa-password/page.tsx"),
    "utf8",
  );
  const reset = readFileSync(
    path.resolve(__dirname, "../src/app/(auth)/reset-password/page.tsx"),
    "utf8",
  );

  it("forgot page requests reset with redirectTo /reset-password", () => {
    expect(forgot).toContain("requestPasswordReset");
    expect(forgot).toContain("/reset-password");
  });

  it("forgot page is anti-enumeration (always success message)", () => {
    expect(forgot).toContain("Jika email tersebut terdaftar");
    expect(forgot).toContain("email");
  });

  it("reset page validates token, length, and confirmation", () => {
    expect(reset).toContain("resetPassword");
    expect(reset).toContain("Kata sandi minimal 8 karakter");
    expect(reset).toContain("Konfirmasi kata sandi tidak cocok");
    expect(reset).toContain("Tautan tidak valid");
  });
});
