import { describe, expect, it } from "vitest";
import {
  buildSnapPayload,
  mapTransactionStatus,
  snapPayUrl,
  verifySignature,
} from "../src/lib/midtrans";

describe("buildSnapPayload", () => {
  it("builds transaction details and items", () => {
    const p = buildSnapPayload({
      orderId: "PK-1",
      grossAmount: 25_000,
      items: [{ id: "i1", price: 5_000, quantity: 5, name: "Bayam Hidroponik" }],
      customerName: "Budi",
      customerPhone: "628123",
    });
    expect(p.transaction_details).toEqual({
      order_id: "PK-1",
      gross_amount: 25_000,
    });
    expect(p.item_details).toHaveLength(1);
    expect(p.customer_details).toEqual({ first_name: "Budi", phone: "628123" });
  });
});

describe("verifySignature", () => {
  const serverKey = "test-server-key";

  it("accepts a valid sha512 signature", async () => {
    const orderId = "PK-1";
    const statusCode = "200";
    const grossAmount = "25000.00";
    const buf = await crypto.subtle.digest(
      "SHA-512",
      new TextEncoder().encode(`${orderId}${statusCode}${grossAmount}${serverKey}`),
    );
    const signature = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ok = await verifySignature(
      {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
      },
      serverKey,
    );
    expect(ok).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const ok = await verifySignature(
      {
        order_id: "PK-1",
        status_code: "200",
        gross_amount: "25000.00",
        signature_key: "deadbeef",
      },
      serverKey,
    );
    expect(ok).toBe(false);
  });

  it("rejects incomplete payloads", async () => {
    expect(await verifySignature({}, serverKey)).toBe(false);
  });
});

describe("mapTransactionStatus", () => {
  it("maps settlement to paid", () => {
    expect(mapTransactionStatus("settlement")).toBe("paid");
    expect(mapTransactionStatus("capture", "accept")).toBe("paid");
  });

  it("holds capture with fraud challenge as pending", () => {
    expect(mapTransactionStatus("capture", "challenge")).toBe("pending");
  });

  it("maps deny/cancel/expire to cancelled", () => {
    expect(mapTransactionStatus("deny")).toBe("cancelled");
    expect(mapTransactionStatus("cancel")).toBe("cancelled");
    expect(mapTransactionStatus("expire")).toBe("cancelled");
  });

  it("maps pending to pending and unknown to null", () => {
    expect(mapTransactionStatus("pending")).toBe("pending");
    expect(mapTransactionStatus("weird")).toBe(null);
  });
});

describe("snapPayUrl", () => {
  it("points to sandbox by default", () => {
    delete process.env.MIDTRANS_IS_PRODUCTION;
    expect(snapPayUrl("abc")).toContain("sandbox");
  });

  it("points to production when configured", () => {
    process.env.MIDTRANS_IS_PRODUCTION = "true";
    expect(snapPayUrl("abc")).toContain("app.midtrans.com");
    delete process.env.MIDTRANS_IS_PRODUCTION;
  });
});
