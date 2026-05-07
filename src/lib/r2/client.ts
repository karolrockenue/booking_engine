// Cloudflare R2 client (S3-compatible). One bucket holds all hotel photos;
// objects are keyed by property: `properties/<propertyId>/<uuid>.<ext>`.
//
// Public reads come from the R2.dev URL configured in R2_PUBLIC_URL.
// Writes come from this Node-side client using the API token credentials.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

let cached: S3Client | null = null;

export function getR2(): S3Client {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
    );
  }

  cached = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cached;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET not configured.");
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL not configured.");
  return url.replace(/\/+$/, "");
}

export async function uploadToR2(opts: {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  const bucket = getBucket();
  await getR2().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
    })
  );
  return {
    key: opts.key,
    url: `${getPublicUrl()}/${opts.key}`,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  await getR2().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
}
