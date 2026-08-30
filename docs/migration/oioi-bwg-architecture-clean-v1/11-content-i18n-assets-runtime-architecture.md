---
title: "Content / i18n / Assets / Runtime Architecture"
document_id: "11"
version: "1.0"
status: "active"
authority: "architecture"
updated_at: "2026-08-30"
depends_on:
  - "01"
  - "05"
  - "06"
  - "07"
related:
  - "12"
tags:
  - "i18n"
  - "content"
  - "assets"
  - "runtime"
---

# oioi-bwg Content / i18n / Assets / Runtime Architecture v1.0

## 1. 목적

이 문서는 다음의 경계를 정한다.

```text
UI locale
content locale
lyrics/translations
static assets
uploaded assets
environment variables
runtime assumptions
```

---

## 2. UI i18n과 Content Translation 분리

다음은 같은 문제가 아니다.

```text
UI i18n
= 버튼/메뉴/시스템 문구

Content translation
= 가사/독음/번역/콘텐츠 데이터
```

한 schema나 library로 억지로 통합하지 않는다.

---

## 3. Locale Model

지원 locale과 fallback 정책은 명시적으로 관리한다.

정확한 지원 locale 목록은 제품 요구와 현재 DB를 기준으로 확정한다.

---

## 4. URL Locale

URL에 locale을 포함할지는 SEO/shareability/product requirement를 보고 결정한다.

locale state를 무조건 client local state로 두지 않는다.

**URL locale 전략은 12의 M2 구조 이동 전에 확정한다.**

---


## 4.1. UI i18n Implementation Stack

UI i18n library와 message file structure는 11이 소유한다.

선정 기준:

```text
Next App Router/RSC 지원
TypeScript ergonomics
locale routing 호환
client bundle overhead
server/client 사용성
```

구체 library는 URL locale 결정과 함께 확정한다.

---

## 5. Lyrics / Content Data

가사 원문, 독음, 번역, timing data는 domain content로 취급한다.

UI 번역 resource file과 섞지 않는다.

---

## 6. Content Contract

외부로 전달되는 content shape는 05의 Zod DTO contract를 따른다.

DB row를 UI content model로 직접 노출하지 않는다.

---

## 7. Static Assets

build와 함께 배포되는 작은 정적 asset은 Next `public` 또는 module import를 사용한다.

예:

```text
logo
icon
fixed image
small immutable file
```

---

## 8. Uploaded / Mutable Assets

사용자가 바꾸거나 운영 중 변경되는 asset은 application container filesystem에 영구 저장하지 않는다.

현재 public album asset provider:

```text
Cloudflare R2 + assets.oioibawige.com custom domain
```

현재 운영 기준은 다음과 같다.

- 기존 DB `Album.imgUrl`은 `https://assets.oioibawige.com/images/albums/*.webp` canonical URL을 사용한다.
- 앨범 표지는 관리자 런타임 업로드를 지원한다. 업로드는 OCI Compute의 server boundary를 통과해 R2에만
  기록하며, browser에 R2 쓰기 credential을 노출하지 않는다.
- R2 custom domain은 public asset delivery와 cache를 담당한다.
- DB에는 provider-specific temporary URL 대신 stable asset identifier 또는 canonical URL 저장을 우선한다.

OCI Object Storage는 Cloudflare를 완전히 제거하는 별도 제품·운영 결정이 있을 때의 후보다. 이 전환은
R2 object migration, `assets` canonical URL 유지 전략, public delivery/cache 비용을 함께 결정한 뒤에만 수행한다.

Supabase Storage 업로드 경계는 현재 R2 delivery와 별개인 미사용 구현이다. R2 유지 결정을 따를 경우
이 구현과 `@supabase/supabase-js`, Supabase 환경변수를 제거한다.

후보 검토 이력:

```text
Supabase Storage (미사용 구현, 제거 대상)
Cloudflare R2 (현재 public album asset provider 및 관리자 업로드 대상)
OCI Object Storage (Cloudflare 제거 결정 시 재검토)
```

Storage provider 선택은 **11이 소유한다**. 12는 선택된 provider의 credential/env/deploy 검증만 담당한다.

---

## 9. Image Handling

Next Image 사용 여부는 실제 image source와 optimization cost를 보고 결정한다.

단순히 framework 기능이 있다는 이유로 모든 image에 강제하지 않는다.

---

## 10. Asset URL Contract

DB에는 가능하면 provider-specific temporary URL보다 stable asset identifier 또는 canonical URL policy를 사용한다.

provider migration이 domain schema에 과도하게 스며들지 않게 한다.

---

## 11. Runtime Environment

목표 runtime:

```text
Next.js 16
Node.js
standalone output
Docker
OCI Compute Instance
PostgreSQL 17
```

Cloudflare-specific runtime assumption은 migration에서 제거한다.

---

## 12. Environment Variables

환경변수는 다음으로 구분한다.

```text
server-only
client-exposed
build-time
runtime
```

`NEXT_PUBLIC_*`는 실제 client exposure가 필요한 값만 사용한다.

---


## 12.1. NEXT_PUBLIC과 Image Reuse

`NEXT_PUBLIC_*` 값은 client bundle에 포함되는 build-time configuration으로 취급한다.

동일 Docker/GHCR image를 여러 environment에서 runtime env만 바꿔 재사용해야 하는 값은
가능하면 `NEXT_PUBLIC_*`에 의존하지 않는다.

Secret은 어떤 경우에도 이 메커니즘으로 전달하지 않는다.

12의 image build/deploy 전략은 이 원칙을 따른다.

---

## 13. Environment Validation

server startup/build boundary에서 필요한 env validation을 둔다.

누락된 env를 애매한 runtime failure로 남기지 않는다.

정확한 schema/helper 소유 위치는 상세 설계 시 확정한다.

---

## 14. Secret

secret은 client bundle에 포함하지 않는다.

예:

```text
DATABASE_URL
AUTH_SECRET
storage credentials
Sentry server secret
```

---

## 15. Runtime-specific Code

다음 dependency를 application core에 퍼뜨리지 않는다.

```text
cloudflare:workers
Hyperdrive
Supabase-specific global runtime
provider-specific request object
```

adapter boundary에서 격리하거나 migration 시 제거한다.

---

## 16. Filesystem

Docker/standalone environment에서 local filesystem은 ephemeral/runtime-local로 취급한다.

persistent user asset store로 사용하지 않는다.

---

## 17. Content Caching

Content rendering/cache는 07이 소유한다.

11에서 별도 cache vocabulary를 만들지 않는다.

---

## 18. 금지 패턴

```text
UI locale와 content translation 혼합
DB row를 UI contract로 직접 사용
mutable upload를 container filesystem에 영구 저장
secret을 NEXT_PUBLIC로 노출
Cloudflare runtime API가 domain/service에 침투
asset provider detail이 전체 schema에 침투
11에서 별도 cache system 정의
```

---

## 19. 최종 원칙

1. UI i18n과 content translation을 분리한다.
2. Lyrics/translation은 domain content다.
3. Content DTO는 05 contract를 따른다.
4. Static asset과 mutable uploaded asset을 구분한다.
5. Mutable asset을 container filesystem에 영구 저장하지 않는다.
6. Provider detail을 domain 전체에 퍼뜨리지 않는다.
7. Runtime target은 Next standalone + Docker + OCI다.
8. Cloudflare-specific runtime dependency를 제거한다.
9. Environment variable은 exposure/lifecycle 기준으로 구분한다.
10. Secret을 client bundle에 노출하지 않는다.
11. Env validation을 명시적 boundary에서 수행한다.
12. Content cache policy는 07을 따른다.
