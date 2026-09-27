import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/actions/orders";

export const dynamic = "force-dynamic";

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

  const result = await placeOrder(body.kwtId, {
    buyerName: body.buyerName,
    buyerPhone: body.buyerPhone,
    note: body.note,
    items: body.items,
  });

  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
