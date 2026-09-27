import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Klien Neon Object Storage (kompatibel S3, wajib path-style).
 * Kredensial di-inject Neon via env AWS_* — tanpa itu, upload foto
 * dinonaktifkan dengan aman (form tetap menerima URL eksternal).
 */

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_REGION,
  );
}

function s3(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true, // Neon Object Storage: path-style wajib
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.NEON_UPLOADS_BUCKET ?? "uploads";

/** Presigned PUT URL untuk upload langsung dari browser. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3(), cmd, { expiresIn });
}

/** Klien S3 untuk presign GET (menyajikan foto lewat redirect). */
export function s3ObjectClient(): S3Client {
  return s3();
}
