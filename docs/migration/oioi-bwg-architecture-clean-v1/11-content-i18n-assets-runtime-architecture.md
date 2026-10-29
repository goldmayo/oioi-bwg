---
title: "Content / i18n / Assets / Runtime Architecture"
document_id: "11"
version: "1.14"
status: "active"
authority: "architecture"
updated_at: "2026-10-29"
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

# oioi-bwg Content / i18n / Assets / Runtime Architecture v1.14

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

P04부터 Console은 `apps/console`에 자동 탐색 설정과 `.env*`를 소유한다.
`CONSOLE_ORIGIN`은 로컬 개발·비공개 등록용 HTTP loopback 또는 명시적으로 설정한 Console 전용 HTTPS origin을 허용한다.
공개 HTTP host·사용자 정보·경로·query·fragment가 포함된 값은 거절하며 앱 runtime과 배포 env materializer에서 검증한다.
요청 헤더로 HTTPS 주소나 신뢰 host를 추론하지 않는다. dev/start는 `127.0.0.1:3001`에 바인딩하고,
Docker의 host publish도 loopback을 유지한다. 인증 쿠키와 HTTPS 요청 경계는 04 §4.1을 따른다.
`CONSOLE_AUTH_SECRET`은 최소 32자이고 Web의 `AUTH_SECRET`으로 fallback하지 않는다.
runtime 설정은 요청 시 검증해 build에 secret을 요구하지 않는다. 기존 Web 이미지와 배포 대상은
P06 전까지 유지하고, CI/local에서는 두 앱 standalone을 독립 build한다.

P06-A의 일반 CI/local 검증은 같은 builder에서 Web `runner`와 Console `runner-console` 두
Docker runtime을 생성한다. 각 이미지의 server/static/public 경로와 native dependency를 실제로
검증하며 Console `/readyz`는 인증 설정과 PostgreSQL 기본 가용성을 확인하고 오류 원문을 숨긴다.
이 이미지 검증은 OCI 게시·host 배포·Console HTTPS 공개 완료를 뜻하지 않는다.

Next 자동 탐색 설정과 `public/`, 로컬 `.env*` 파일은 앱 루트인 `apps/web`이 소유한다.
정적 자산의 공개 URL과 환경변수 이름·build/runtime 해석은 앱 이동으로 변경하지 않는다.
OCI container에 주입하는 env 파일과 운영 도구는 기존 저장소 루트 경계를 유지한다.

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

로컬 개인 입력은 앱별 `.env.local` 한 파일로 통일한다. `.env.example`은 모든 값이 빈 공유 템플릿이며
일반 로컬 실행의 필수·선택 입력을 명시하며 CI 전용 입력은 기존 CI·Docker에서 관리한다.
Console의 메일 설정은 주석으로 보관하며 실제 기능 연결·전송과 구분한다.
기존 `.env`를 통합할 때는 실제 적용 값과 보존할 설정을 확인해 이관하고 원본을 ignored 백업에 보관한다.
실제 값을 임의로 삭제하거나 외부 접속 대상을 바꾸지 않는다.
Next의 process 우선순위와 NODE_ENV별 파일 탐색 자체는 바꾸지 않으며 테스트 입력은 개인 파일과 분리한다.
VM·CI의 process/BuildKit/Vault 주입 계약은 로컬 파일 통일과 별개다.

앱은 자신의 환경 입력만 읽는다. Web 설정에 값이 있다는 이유로 Console 설정 완료로 판단하지 않는다.
Console 앨범 업로드에는 `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`ASSETS_PUBLIC_BASE_URL` 다섯 항목이 필요하다. local launcher와 배포 env materializer는 누락을
실행/승격 전에 거절한다. 공개 endpoint/bucket/base URL과 Vault의 쓰기 credential 매핑을 구분한다.
Web은 공개 조회만 제공하며 R2 쓰기 credential을 새 Web의 설정 예제에 요구하지 않는다.
기존 이미지 복구를 위한 host mapping은 해당 이미지 지원 종료까지 별도로 보존한다.

Sentry는 현재 Web/Console이 같은 프로젝트를 사용한다. 앱 내부 변수 이름은
`NEXT_PUBLIC_SENTRY_DSN`을 유지하고 앱별 입력 책임을 명시한다. 프로젝트 분리는 별도 결정과
검증 없이 요구하지 않는다. `local`에서는 DSN 존재 여부와 무관하게 전송하지 않는 기존 정책을 유지한다.

Web/Console의 `NEXT_PUBLIC_APP_ENV` 값 계약은 `local | production`이다. 비용상 별도 staging 환경은
운영하지 않는다. `NODE_ENV`는 Next 실행 모드이며 앱 환경을 대신하지 않는다. 로컬 production build도
앱 환경은 `local`이다. `staging/development/test`는 앱 환경의 별칭으로 허용하지 않는다.
앱의 `shared/config/app-env.ts`가 해석을 소유하며 Next dev/build 진입점은 누락·미지원 값을 거절한다.
local launcher·Docker 기본값·일반 CI/관리자 smoke는 `local`, VM용 Promotion candidate build는
`production`을 명시한다. 공개 build 입력 변경은 새 image가 필요하며 실제 운영 배포는 별도 승인 대상이다.
최종 www URL 전환은 P06-F의 실제 TLS/라우팅·Promotion·데이터 보존 검증을 거쳐 적용한다.
이름에 staging이 있는 버킷·외부 리소스·기존 host 식별자는
이 계약만으로 삭제·이름 변경·접속 대상 변경하지 않는다.

공유 서버의 휴면 메일 provider도 명시적 앱 환경을 검증하고 NODE_ENV로 전송 모드를 추론하지 않는다.
기본 모드는 local의 no-send dev, production의 OCI이며 production에서 dev 모드는 거절한다.
이 값 계약은 메일 기능 재활성화나 실제 전송·OCI 인증/IMDS 정책 변경을 승인하지 않는다.
휴면 provider의 Instance Principal 인증은 metadata 접근을 전제로 하므로 현재 컨테이너 IMDS 차단과
충돌한다. 차단은 유지한다. 메일 재활성화 전에 이를 유지하는 인증·권한·비밀 관리와 전송 실패 계약을
별도 요구와 승인 범위에서 설계·검증한다. legacy host 예제의 메일 키를 실제 발송 가능성의 증거로 삼지 않는다.

Web의 기본 metadata와 곡/앨범 metadata helper·sitemap·robots는 같은 site URL을 사용한다. `local`에서는
`http://localhost:3000`, `production`에서는 최종 `https://www.oioibawige.com`을 사용한다.
이 URL 준비 자체는 DNS/Worker 연결 변경이나 운영 전환 완료를 뜻하지 않는다.
누락·빈 값·미지원 값은 local로 추론하지 않고 최종 공개 URL을 사용하며, Sentry와 browser logging은
비활성화한다. Sentry는 `production`과 비어 있지 않은 DSN이 함께 있을 때만 활성화한다.
Sentry 최종 event와 Slack relay의 environment 허용값도 이 계약을 따르며 이전 staging 값은
전송용 event에서 제거하거나 relay에서 unknown으로 표시한다. 기존 리소스 이름과 구분한다.

---


## 12.1. NEXT_PUBLIC과 Image Reuse

`NEXT_PUBLIC_*` 값은 client bundle에 포함되는 build-time configuration으로 취급한다.

동일 Docker/OCIR image를 여러 environment에서 runtime env만 바꿔 재사용해야 하는 값은
가능하면 `NEXT_PUBLIC_*`에 의존하지 않는다.

Secret은 어떤 경우에도 이 메커니즘으로 전달하지 않는다.

Sentry Release와 OCI revision label은 image의 실제 build source에 연결한다. 재사용 이미지에는
새 릴리스 source를 덮어쓰지 않는다. 공개 build 입력 변경은 새 build가 필요하며 선택적 재사용의
검증·baseline·공동 smoke와 배포 전략은 12 §21이 소유한다.

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

OCI runtime secret의 SSOT는 OCI Secret Management다. Application request path가 Vault를
직접 조회하지 않고, deploy process가 Compute Instance Principal로 필요한 secret을
읽어 완전한 temporary env를 검증한 뒤 mode `0600`의 runtime env file을 atomic하게
교체한다. GitHub CI, Terraform configuration/state, container image, Run Command plain-text
payload에 runtime secret을 넣지 않는다.

public env에는 Secret 값을 두지 않으며 앱별 Secret mapping의 허용 이름을 검증한다.
Web에는 `CONSOLE_*`, Console에는 Web `AUTH_SECRET`을 전달하지 않는다. Console의 자체
Auth secret은 최소 32자, MFA key는 canonical Base64 32 bytes이며 두 값이 같으면 거절한다.
중복 키·누락·줄바꿈/NUL·Vault 읽기/형식 오류는 임시 env 승격 전에 실패한다. raw env의 값은
보간하거나 shell로 실행하지 않는다. 앱별 임시 env 생성과 두 앱의 배포/복구 완료는 구분한다.

VM Instance Principal은 process별 권한 분리가 아니다. P06의 새 Console Secret 권한을
추가하기 전에 기존 Web의 `169.254.169.254` 접근 차단을 실제 VM에서 입증한다.
Web/Console은 host network·privileged·추가 capability·host mount를 사용하지 않는 bridge 실행으로
검증한다. host의 pull/Secret 읽기는 유지한다. 직접 IMDSv2 인증 header를 포함한 요청의 body를
버리고 네트워크 차단·host 양성 대조·차단 규칙 counter를 함께 확인한다. 실제 두 앱과 container/
Docker/VM 재시작·복구 후 검증 전에는 공개 gate를 통과한 것으로 기록하지 않는다. 운영 절차는 12가 소유한다.

2026-10-29 P08 개정: Console의 고정 `/run/oioi-waveform/runner.sock`에 한해 host mount 예외를 둔다.
root 소유 부모와 전용 그룹의 socket 디렉터리만 읽기 전용으로 연결한다. 연결 권한은 socket DAC로 제한하며
Docker socket·다른 host 경로·host network·추가 capability는 허용하지 않는다. Web의 mount 없는 경계는 유지한다.
이 예외는 mount 적용 완료를 뜻하지 않는다. 적용 전 [배포 §21](12-deployment-migration-runbook.md#21-cicd)의
별도 승인과 실제 DAC/IMDS·재시작 검증이 필요하다.
생성·Runner flag와 source 허용 목록은 보호된 배포 설정이며 기본 비활성·빈 목록이다.
Runner token은 기존 독립 Secret 공급을 따르고 worker에 token/앱·OCI credential을 전달하지 않는다.

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
13. Runtime secret은 OCI Secret Management에 두고 deploy process가 Instance Principal로
    protected env file을 materialize한다.
