/**
 * Midtrans Snap — helper murni (tanpa import DB) agar mudah diuji.
 * Sandbox secara default; MIDTRANS_IS_PRODUCTION=true untuk produksi.
 */

const SNAP_SANDBOX = "https://app.sandbox.midtrans.com/snap/v1/transactions";
const SNAP_PROD = "https://app.midtrans.com/snap/v1/transactions";
const PAY_SANDBOX = "https://app.sandbox.midtrans.com/snap/pay/";
const PAY_PROD = "https://app.midtrans.com/snap/pay/";

export function isMidtransEnabled(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

export function snapApiUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? SNAP_PROD
    : SNAP_SANDBOX;
}

export function snapPayUrl(token: string): string {
  const base =
    process.env.MIDTRANS_IS_PRODUCTION === "true" ? PAY_PROD : PAY_SANDBOX;
  return `${base}${token}`;
}

export interface SnapItem {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface SnapRequest {
  orderId: string;
  grossAmount: number;
  items: SnapItem[];
  customerName?: string;
  customerPhone?: string;
}

export function buildSnapPayload(req: SnapRequest): Record<string, unknown> {
  return {
    transaction_details: {
      order_id: req.orderId,
      gross_amount: req.grossAmount,
    },
    item_details: req.items.map((i) => ({
      id: i.id,
      price: i.price,
      quantity: i.quantity,
      name: i.name.slice(0, 50),
    })),
    customer_details: {
      first_name: req.customerName ?? "Pembeli",
      phone: req.customerPhone,
    },
  };
}

/** Buat Snap token untuk pesanan. Return null jika Midtrans tidak dikonfigurasi. */
export async function createSnapToken(req: SnapRequest): Promise<string | null> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return null;
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(snapApiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSnapPayload(req)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error(
      "[midtrans] snap token failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  const data = (await res.json()) as { token?: string };
  return data.token ?? null;
}

// ---------------------------------------------------------------------------
// Verifikasi signature (Payment Notification webhook)
// signature = sha512(order_id + status_code + gross_amount + serverKey)
// ---------------------------------------------------------------------------

async function subtleSha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface WebhookPayload {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
}

/** True hanya jika signature valid; false jika payload tidak lengkap/tidak cocok. */
export async function verifySignature(
  payload: WebhookPayload,
  serverKeyOverride?: string,
): Promise<boolean> {
  const serverKey = serverKeyOverride ?? process.env.MIDTRANS_SERVER_KEY;
  const { order_id, status_code, gross_amount, signature_key } = payload;
  if (!serverKey || !order_id || !status_code || !gross_amount || !signature_key) {
    return false;
  }
  const expected = await subtleSha512Hex(
    `${order_id}${status_code}${gross_amount}${serverKey}`,
  );
  return expected === signature_key;
}

/** Status webhook -> status pesanan internal. */
export function mapTransactionStatus(
  transactionStatus: string,
  fraudStatus?: string,
): "paid" | "pending" | "cancelled" | null {
  switch (transactionStatus) {
    case "capture":
    case "settlement":
      if (fraudStatus === "challenge") return "pending";
      return "paid";
    case "pending":
      return "pending";
    case "deny":
    case "cancel":
    case "expire":
    case "refund":
      return "cancelled";
    default:
      return null;
  }
}
