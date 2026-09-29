/**
 * Smoke test bucket uploads Neon: presign PUT -> upload -> presign GET -> fetch.
 * Jalankan: npx tsx scripts/upload-smoke.ts  (butuh env AWS_* di .env)
 */
import "dotenv/config";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isStorageConfigured, presignUpload, s3ObjectClient } from "../src/lib/storage";

async function main() {
  if (!isStorageConfigured()) {
    console.error("FAIL: env AWS_* tidak lengkap");
    process.exit(1);
  }
  const key = `products/smoke-${Date.now()}.txt`;
  console.log("1) presign PUT…");
  const uploadUrl = await presignUpload(key, "text/plain");
  console.log("   OK:", uploadUrl.slice(0, 90) + "…");

  console.log("2) PUT object…");
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: `TaniKita smoke test ${new Date().toISOString()}`,
  });
  console.log("   status:", put.status);
  if (!put.ok) {
    console.error("FAIL: PUT gagal", await put.text());
    process.exit(1);
  }

  console.log("3) presign GET + fetch balik…");
  const client = s3ObjectClient();
  const getUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.NEON_UPLOADS_BUCKET ?? "uploads", Key: key }),
    { expiresIn: 600 },
  );
  const get = await fetch(getUrl);
  const body = await get.text();
  console.log("   status:", get.status, "| isi:", body.slice(0, 60));
  if (get.status !== 200 || !body.includes("TaniKita smoke test")) {
    console.error("FAIL: isi tidak cocok");
    process.exit(1);
  }
  console.log("SUCCESS ✓ bucket uploads Neon berfungsi end-to-end");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
