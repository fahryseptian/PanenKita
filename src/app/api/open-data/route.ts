import { NextResponse } from "next/server";
import {
  isOpenDataEnabled,
  verifyOpenDataKey,
  getRegionalPrices,
  getFoodLoss,
  getPlatformVolume,
} from "@/lib/opendata";

export const dynamic = "force-dynamic";

/**
 * GET /api/open-data?dataset=prices|foodloss|volume&since=YYYY-MM-DD
 * Data agregat anonim untuk lembaga/pemerintah (k-anonymity ≥ 3 KWT/wilayah).
 * Auth: header x-api-key = OPEN_DATA_API_KEY.
 */
export async function GET(req: Request) {
  if (!isOpenDataEnabled()) {
    return NextResponse.json({ error: "open-data-disabled" }, { status: 501 });
  }
  if (!verifyOpenDataKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") ?? "volume";
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;
  const validSince = since && !Number.isNaN(since.getTime()) ? since : undefined;

  switch (dataset) {
    case "prices": {
      const data = await getRegionalPrices(3);
      return NextResponse.json({ dataset, generatedAt: new Date().toISOString(), regions: data });
    }
    case "foodloss": {
      const d = validSince ?? new Date(Date.now() - 180 * 86_400_000);
      const data = await getFoodLoss(d, 3);
      return NextResponse.json({ dataset, since: d.toISOString(), entries: data });
    }
    case "volume": {
      const data = await getPlatformVolume(validSince);
      return NextResponse.json({ dataset, since: validSince?.toISOString() ?? null, ...data });
    }
    default:
      return NextResponse.json(
        { error: "unknown-dataset", available: ["prices", "foodloss", "volume"] },
        { status: 400 },
      );
  }
}
