import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

function requiredHttpsUrl(name: string) {
  const value = requiredEnvironment(name);
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash)
      return value;
  } catch {
    // URL parser 오류에는 입력이 포함될 수 있으므로 설정 이름만 노출한다.
  }
  throw new Error(`${name} must be an HTTPS URL without credentials, query or fragment`);
}

/** readiness와 업로드가 같은 입력을 검사하며 외부 요청이나 SDK client를 만들지 않는다. */
export function getPublicAssetConfig() {
  return {
    endpoint: requiredHttpsUrl("R2_ENDPOINT"),
    bucket: requiredEnvironment("R2_BUCKET"),
    accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: requiredHttpsUrl("ASSETS_PUBLIC_BASE_URL").replace(/\/$/, ""),
  };
}

/** R2에 public asset을 저장하고 custom domain 기반 canonical URL을 반환한다. */
export async function uploadPublicAsset({
  objectKey,
  body,
  contentType,
}: {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
}) {
  const config = getPublicAssetConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { url: `${config.publicBaseUrl}/${objectKey}` };
}
