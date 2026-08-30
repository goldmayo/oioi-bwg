# M5 R2 관리자 이미지 업로드 결과

## 완료 범위

- 앨범 이미지 Server Action을 Supabase Storage에서 R2 S3-compatible `PutObject` 호출로 교체했다.
- 업로드는 browser credential이나 presigned URL 없이 서버에서만 수행한다.
- AVIF, JPEG, PNG, WebP와 최대 5MB만 허용한다.
- 새 object key는 `images/albums/{uuid}.{extension}`이며, 결과 URL은
  `ASSETS_PUBLIC_BASE_URL/{objectKey}` canonical URL이다.
- immutable cache header를 설정해 UUID key의 public asset을 장기 캐시한다.
- Supabase Storage client, `@supabase/supabase-js`, Supabase 환경변수를 제거했다.

## 운영 준비

배포 runtime에 다음 server-only 값을 설정해야 한다.

```text
R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
ASSETS_PUBLIC_BASE_URL=https://assets.oioibawige.com
```

R2 access key와 secret은 browser 또는 저장소에 노출하지 않는다. 기존 Cloudflare API token을
R2 S3 credential으로 재사용하지 않는다.

## 검증과 보류

- R2 SDK 호출은 mock한 unit test로 bucket, key, MIME type, cache policy, canonical URL을 검증했다.
- 실제 R2 network call과 production DB 변경은 수행하지 않았다.
- 운영 또는 staging runtime secret 주입 후 관리자 앨범 이미지 업로드 smoke가 필요하다.
