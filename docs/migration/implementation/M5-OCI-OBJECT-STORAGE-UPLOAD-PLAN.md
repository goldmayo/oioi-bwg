---
title: "M5 OCI Object Storage 업로드 전환 계획"
document_id: "M5-OCI-OBJECT-STORAGE-UPLOAD-PLAN"
version: "1.0"
status: "planned"
authority: "implementation"
updated_at: "2026-08-30"
depends_on:
  - "11"
  - "M5-SUPABASE-AUTH-CUTOVER-RESULT"
---

# M5 OCI Object Storage 업로드 전환 계획

## 목적

현재 관리자 앨범 이미지 업로드가 사용하는 Supabase Storage를 OCI Object Storage로 전환한다.
운영 runtime은 OCI Compute이며, OCI API private key는 사용하지 않고 Instance Principal 인증을 사용한다.

## 범위

- `uploadAlbumImageAction()`의 업로드 대상 교체
- OCI Object Storage SDK 호출을 담당하는 작은 server infrastructure 함수
- bucket/namespace/region 환경변수 계약
- object key와 canonical asset URL 정책
- 업로드 실패 및 잘못된 파일 입력 처리
- 실제 OCI network call 없는 unit test
- 전환 완료 후 Supabase Storage client, 패키지, 환경변수 제거

## 비범위

- production DB 연결 또는 schema 변경
- 범용 storage provider/adapter framework
- SMTP 또는 별도 credential 기반 OCI 인증
- 기존 이미지 일괄 migration
- waveform 등 대용량 asset upload protocol

## 예정 환경변수

운영값은 저장소에 커밋하지 않는다.

```text
OCI_OBJECT_STORAGE_REGION=
OCI_OBJECT_STORAGE_NAMESPACE=
OCI_OBJECT_STORAGE_BUCKET=
OCI_OBJECT_STORAGE_PUBLIC_BASE_URL=
```

애플리케이션은 Instance Principal로 인증하며 private key 환경변수는 추가하지 않는다.

## 전환 순서

1. OCI Object Storage client와 object key/canonical URL 함수를 추가한다.
2. 앨범 이미지 action을 OCI client로 교체한다.
3. 기존 파일 검증과 `imgUrl` 저장 흐름을 보존한다.
4. SDK 호출 실패, 잘못된 파일, URL projection을 unit test한다.
5. 관리자 앨범 이미지 업로드 smoke를 확인한다.
6. Supabase Storage 코드·환경변수·`@supabase/supabase-js`를 제거한다.

각 단계는 reviewable concern 단위의 작은 PR로 분리한다. production DB와 운영 object storage에는
명시적인 배포 승인 전 연결하지 않는다.
