import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getSession, assertMembership, ACTIVE_KWT_COOKIE } from "@/lib/session";
import { buildPhotoKey, isAllowedPhotoMime, mimeToExt } from "@/lib/photo-url";
import { presignUpload, isStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface PresignBody {
  productId?: string;
  contentType?: string;
}

/**
 * POST /api/uploads/photo — minta presigned PUT URL untuk foto produk.
 * Body: { productId, contentType } -> { uploadUrl, key }
 * Akses: admin (ketua/bendahara) KWT pemilik produk.
 */
export async function POST(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage-disabled" }, { status: 501 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PresignBody;
  try {
    body = (await req.json()) as PresignBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const productId = body.productId ?? "";
  const contentType = body.contentType ?? "";
  if (!productId || !isAllowedPhotoMime(contentType)) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // Otorisasi: admin KWT tempat produk berada (dari cookie KWT aktif).
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTIVE_KWT_COOKIE}=([^;]+)`),
  );
  const kwtId = match?.[1];
  if (!kwtId) {
    return NextResponse.json({ error: "no-active-kwt" }, { status: 403 });
  }
  const role = await assertMembership(kwtId, session.user.id).catch(() => null);
  if (role !== "ketua" && role !== "bendahara") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Produk harus milik KWT aktif.
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.kwtId, kwtId)))
    .limit(1);
  if (!product) {
    return NextResponse.json({ error: "product-not-found" }, { status: 404 });
  }

  const ext = mimeToExt(contentType);
  const key = ext ? buildPhotoKey(product.id, ext) : null;
  if (!key) {
    return NextResponse.json({ error: "invalid-type" }, { status: 400 });
  }

  const uploadUrl = await presignUpload(key, contentType);
  return NextResponse.json({ uploadUrl, key, publicUrl: `/api/uploads/photo?key=${encodeURIComponent(key)}` });
}

/**
 * GET /api/uploads/photo?key=products/<uuid>.jpg — stream foto dari bucket.
 * Key dibatasi karakter aman; request diteruskan sebagai presigned GET.
 */
export async function GET(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage-disabled" }, { status: 501 });
  }
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  if (!/^products\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(key)) {
    return NextResponse.json({ error: "invalid-key" }, { status: 400 });
  }

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl: presignGet } = await import("@aws-sdk/s3-request-presigner");
  const { s3ObjectClient } = await import("@/lib/storage");
  const client = s3ObjectClient();
  const getUrl = await presignGet(
    client,
    new GetObjectCommand({
      Bucket: process.env.NEON_UPLOADS_BUCKET ?? "uploads",
      Key: key,
    }),
    { expiresIn: 3600 },
  );
  return NextResponse.redirect(getUrl, 302);
}
