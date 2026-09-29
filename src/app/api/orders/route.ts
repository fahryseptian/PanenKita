import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/actions/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Batas: 10 pesanan/jam per IP dan 5 pesanan/jam per nomor WhatsApp. */
const LIMITS = {
  ip: { max: 10, windowMs: 3_600_000 },
  phone: { max: 5, windowMs: 3_600_000 },
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        kwtId?: string;
        buyerName?: string;
        buyerPhone?: string;
        note?: string;
        items?: Array<{ productId: string; quantity: number }>;
      }
    | null;

  if (!body?.kwtId || !body.buyerName || !body.buyerPhone || !body.items?.length) {
    return NextResponse.json({ ok: false, error: "Data tidak lengkap" }, { status: 400 });
  }

  // Rate limit: hindari spam pesanan (banjir WA ke pengurus, stok terkunci).
  const ipCheck = rateLimit(`orders:ip:${clientIp(req)}`, LIMITS.ip.max, LIMITS.ip.windowMs);
  if (!ipCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak pesanan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } },
    );
  }
  const digits = body.buyerPhone.replace(/\D/g, "");
  const phoneCheck = rateLimit(`orders:phone:${digits}`, LIMITS.phone.max, LIMITS.phone.windowMs);
  if (!phoneCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Nomor ini sudah membuat banyak pesanan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(phoneCheck.retryAfter) } },
    );
  }

  const result = await placeOrder(body.kwtId, {
    buyerName: body.buyerName,
    buyerPhone: body.buyerPhone,
    note: body.note,
    items: body.items,
  });

  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
