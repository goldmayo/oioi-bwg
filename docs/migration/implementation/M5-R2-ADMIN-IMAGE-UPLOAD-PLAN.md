---
title: "M5 R2 관리자 이미지 업로드 계획"
document_id: "M5-R2-ADMIN-IMAGE-UPLOAD-PLAN"
version: "1.0"
status: "completed"
authority: "implementation"
updated_at: "2026-08-30"
depends_on:
  - "11"
  - "M5-SUPABASE-AUTH-CUTOVER-RESULT"
---

# M5 R2 관리자 이미지 업로드 계획

## 목적

현재 관리자 앨범 이미지 업로드가 사용하는 Supabase Storage 구현을 Cloudflare R2로 교체한다.
운영 album asset은 이미 Cloudflare R2 custom domain으로 제공되며, 관리자 런타임 업로드도 같은
bucket과 canonical URL 정책을 사용한다.

## 현재 관찰값

- `Album.imgUrl`은 `https://assets.oioibawige.com/images/albums/*.webp` canonical URL을 저장한다.
- 해당 파일은 Cloudflare R2 bucket에서 public custom domain으로 제공된다.
- `AlbumFormDialog`의 파일 업로드 UI는 운영 기능으로 지원한다.
- 해당 action은 R2가 아니라 Supabase Storage `images` bucket으로 업로드하므로 현재 canonical asset
  delivery와 일치하지 않는다.

## 선택지와 권고

| 선택지 | 장점 | 비용/위험 | 권고 |
|---|---|---|---|
| R2 업로드 구현 | 기존 DB URL·custom domain·CDN 유지, migration 없음 | OCI Compute에 R2 server credential 주입 필요 | **현재 선택** |
| OCI Object Storage 전환 | OCI Compute의 Instance Principal로 서버 업로드 가능 | object migration, public delivery/cache와 URL cutover 설계 필요 | Cloudflare 제거 결정 시 |
| container 정적 자산 | provider/credential 없음 | 이미지 추가마다 build·deploy 필요, runtime upload 불가 | 부적합 |

R2는 이미 object storage이며 `assets.oioibawige.com` custom domain을 통해 제공된다. 관리자 업로드가
필요해도 OCI 단일 Compute라는 사실만으로 asset delivery를 같은 provider로 옮길 필요는 없다.

## 범위

- R2 S3-compatible upload를 담당하는 작은 server infrastructure 함수
- `uploadAlbumImageAction()`의 R2 전환
- canonical asset URL과 object key 정책
- Supabase upload client, 패키지, 환경변수 제거
- 실제 R2 network call 없는 unit test

## 비범위

- production DB 연결 또는 schema 변경
- 범용 storage provider/adapter framework
- SMTP 또는 별도 credential 기반 OCI 인증
- 기존 이미지 일괄 migration
- waveform 등 대용량 asset upload protocol

## 환경변수

운영값은 저장소에 커밋하지 않는다.

```text
R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
ASSETS_PUBLIC_BASE_URL=https://assets.oioibawige.com
```

R2 access key와 secret은 server-only runtime secret이며 `NEXT_PUBLIC_*`로 노출하지 않는다.

## 업로드 계약

- Browser는 기존 Server Action으로 파일만 전달하고 R2 credential 또는 presigned URL을 받지 않는다.
- Server는 MIME type과 최대 크기를 검증한 뒤 R2 `PutObject`를 호출한다.
- object key는 `images/albums/{uuid}.{extension}` 형식을 사용한다. 기존 수동 등록 asset의
  `images/albums/{slug}.webp` key와 충돌하지 않는다.
- 성공 응답은 `{ url }`만 반환하며, URL은 `ASSETS_PUBLIC_BASE_URL/{objectKey}`로 조합한다.
- 업로드는 앨범 DB mutation과 분리한다. 업로드 성공 후 앨범 저장이 실패해 생기는 orphan object의
  정리 정책은 별도 lifecycle 요구가 생길 때 추가한다.

## 전환 순서

1. R2 S3-compatible client와 object key/canonical URL 함수를 추가한다.
2. 앨범 이미지 action을 R2 client로 교체한다.
3. 기존 파일 검증과 `imgUrl` 저장 흐름을 보존한다.
4. SDK 호출 실패, 잘못된 파일, URL projection을 unit test한다.
5. 관리자 앨범 이미지 업로드 smoke를 확인한다.
6. Supabase Storage 코드·환경변수·`@supabase/supabase-js`를 제거한다.

각 단계는 reviewable concern 단위의 작은 PR로 분리한다. production DB와 운영 object storage에는
명시적인 배포 승인 전 연결하지 않는다.
