import { describe, expect, it } from "vitest";
import {
  bankAccountLine,
  hasBankAccount,
  hasPaymentChannel,
  paymentHintOf,
  type KwtPaymentInfo,
} from "../src/lib/payment-info";

const empty: KwtPaymentInfo = {
  bankName: null,
  bankAccountNumber: null,
  bankAccountHolder: null,
  qrisImageUrl: null,
  paymentNote: null,
};

describe("kanal pembayaran KWT", () => {
  it("menganggap rekening hanya lengkap bila nama bank & nomor ada", () => {
    expect(hasBankAccount({ ...empty, bankName: "BRI" })).toBe(false);
    expect(hasBankAccount({ ...empty, bankAccountNumber: "123" })).toBe(false);
    expect(
      hasBankAccount({ ...empty, bankName: "BRI", bankAccountNumber: "123" }),
    ).toBe(true);
  });

  it("mengenali kanal bayar dari rekening atau QRIS", () => {
    expect(hasPaymentChannel(empty)).toBe(false);
    expect(hasPaymentChannel({ ...empty, qrisImageUrl: "https://x/q.png" })).toBe(
      true,
    );
    expect(
      hasPaymentChannel({ ...empty, bankName: "BRI", bankAccountNumber: "1" }),
    ).toBe(true);
  });

  it("merangkai satu baris rekening untuk ditampilkan", () => {
    expect(
      bankAccountLine({
        ...empty,
        bankName: "BRI",
        bankAccountNumber: "1234567890",
        bankAccountHolder: "Sari",
      }),
    ).toBe("BRI 1234567890 a/n Sari");
    expect(bankAccountLine({ ...empty, bankName: "BRI" })).toBeNull();
  });

  it("mengutamakan transfer, lalu QRIS, lalu null", () => {
    expect(
      paymentHintOf({
        ...empty,
        bankName: "BRI",
        bankAccountNumber: "1",
        qrisImageUrl: "https://x/q.png",
      }),
    ).toBe("Transfer ke BRI 1");
    expect(paymentHintOf({ ...empty, qrisImageUrl: "https://x/q.png" })).toBe(
      "Scan QRIS KWT di halaman pesanan",
    );
    expect(paymentHintOf(empty)).toBeNull();
  });
});
