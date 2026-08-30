import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createR2Client() {
  return new S3Client({
    endpoint: requiredEnvironment("R2_ENDPOINT"),
    region: "auto",
    credentials: {
      accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
    },
  });
}

/**
 * R2에 public asset을 저장하고 custom domain 기반 canonical URL을 반환한다.
 */
export async function uploadPublicAsset({
  objectKey,
  body,
  contentType,
}: {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
}) {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: requiredEnvironment("R2_BUCKET"),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const publicBaseUrl = requiredEnvironment("ASSETS_PUBLIC_BASE_URL").replace(/\/$/, "");
  return { url: `${publicBaseUrl}/${objectKey}` };
}
