---
title: "Architecture Constitution"
document_id: "01"
version: "2.4"
status: "active"
authority: "constitution"
updated_at: "2026-08-29"
depends_on:
  - "00"
supersedes:
  - "01-v1"
tags:
  - "architecture"
  - "principles"
  - "nextjs"
  - "fsd"
  - "server"

---

# oioi-bwg Architecture Constitution v2.4

## 1. 목적

이 문서는 oioi-bwg 마이그레이션과 이후 개발에서 가장 높은 우선순위를 갖는 아키텍처 기준이다.

현재 Vinext 기반 애플리케이션을 Next.js 16 단일 스택으로 전환한다. 별도의 NestJS 서버를 두지 않으며, OCI Compute Instance 한 대에서 Next.js standalone 애플리케이션과 PostgreSQL을 운영한다.

이 문서의 목적은 세 가지다.

1. 마이그레이션 중 기술 선택이 흔들리지 않게 한다.
2. Next.js 위에 불필요한 자체 프레임워크를 만들지 않게 한다.
3. 코드가 커져도 FSD, 서버 경계, API 경계가 자연스럽게 확장되게 한다.

하위 architecture 문서가 이 문서와 충돌하면 하위 문서를 우선하지 않는다. 먼저 이 Constitution을 개정한 뒤 관련 문서를 함께 갱신한다.

---

## 2. 확정 스택

### Application

- Next.js 16 App Router
- React 19
- TypeScript
- Turbopack
- pnpm

### Frontend

- TanStack Query
- ky
- React Hook Form
- Zod
- nuqs
- shadcn/ui (Base UI 기반)
- Base UI
- Tailwind CSS

### Persistence

- PostgreSQL 17
- Drizzle ORM

### Quality / Observability

- Vitest
- React Testing Library
- Playwright: 핵심 사용자 플로우만
- Sentry
- GA4
- ESLint
- Steiger

### Deployment

- OCI Compute Instance
- 2 OCPU / 12 GB RAM / 100 GB disk
- Next.js `output: 'standalone'`
- Docker Compose
- Caddy
- PostgreSQL
- GHCR 기반 이미지 배포

### Runtime compatibility contract

지원 브라우저와 Node.js 범위는 구현 전에 프로젝트 runtime 문서에 명시한다.
지원 하한에서 파싱되지 않거나 동작이 달라지는 CSS/JS API를 무심코 도입하지 않는다.
새 플랫폼 기능은 최신 데스크톱에서 동작하는지만 보지 않고, 지원 하한 엔진의 실제 build/render
검증을 통과해야 한다. 특정 브라우저 버전이나 CSS 프레임워크 문법은 제품의 표출 기기와
배포 환경이 정해질 때 별도로 확정한다.

---

## 3. 이번 마이그레이션에서 하지 않는 것

다음은 이번 마이그레이션 범위에서 제외한다.

- NestJS 도입
- 별도 API 서버 도입
- Vinext 유지
- Vite 런타임 유지
- shadcn/ui 제거 또는 별도 UI 시스템으로의 전환
- Repository framework / interface hierarchy 도입
- DI container 도입
- Decorator 기반 서버 프레임워크 도입
- Result 패턴을 전체 API 표준으로 도입
- 라이브러리 API를 감싸는 범용 wrapper 양산

스타일링 시스템은 Base UI 기반 shadcn/ui + Tailwind CSS를 프로젝트 표준으로 사용한다.

---

## 4. 시스템 구조

```text
Browser
  |
  |-- RSC ----------------------> server service
  |
  `-- Client Component
        |
        `-- ky -> /api/* Route Handler -> server service
                                           |
                                           `-> Drizzle -> PostgreSQL

Infrastructure
Caddy -> Next standalone -> PostgreSQL
```

Next.js는 화면 렌더링과 HTTP delivery를 담당한다.

서버 application logic은 Next.js Route Handler 자체에 작성하지 않고 `src/server`에 격리한다.

RSC는 같은 프로세스 안의 service를 직접 호출한다. 서버 내부에서 자신의 `/api/*` endpoint를 HTTP로 다시 호출하지 않는다.

---

## 5. 최상위 디렉터리

```text
src/
├─ app/
├─ widgets/
├─ features/
├─ entities/
├─ shared/
└─ server/
```

### `app`

Next App Router이자 FSD의 App + Pages 역할을 맡는다.

별도의 `src/pages` FSD 레이어를 만들지 않는다.

### `widgets / features / entities / shared`

표준 FSD 계층으로 사용한다.

### `server`

FSD 레이어가 아니다.

서버 application/persistence boundary를 표현하는 별도의 축이다.

`server`를 FSD slice 내부로 분산시키지 않는다.

---

## 6. App Router를 FSD Pages로 사용한다

Next.js의 파일 기반 라우팅을 FSD Pages 레이어의 물리적 구현으로 간주한다.

하지 않는다.

```text
app/songs/[slug]/page.tsx
  -> pages/song/ui/page.tsx
```

이런 proxy layer는 Next와 FSD의 동일한 개념을 중복 표현한다.

대신 페이지 전용 코드는 route 아래 private folder에 코로케이션한다.

```text
app/(public)/songs/[slug]/
├─ page.tsx
├─ loading.tsx
├─ error.tsx
├─ _ui/
├─ _model/
└─ _lib/
```

---

## 7. Route-local first, promotion by reuse

기본 전략은 먼저 페이지 가까이에 둔 뒤 실제 재사용이나 독립된 책임이 확인되면 하위 FSD 레이어로 승격하는 것이다.

```text
route-local
   |
   | reuse / independent responsibility appears
   v
meaning-based promotion
```

승격 기준:

- 완성된 큰 UI block -> `widgets`
- 사용자 use-case / interaction -> `features`
- 도메인 개념 -> `entities`
- 도메인 독립 기반 코드 -> `shared`

두 군데에서 쓴다는 이유만으로 무조건 `shared`로 이동하지 않는다.

예:

- `AlbumCover` -> `entities/album/ui`
- `EditSongForm` -> `features/edit-song/ui`
- `Button` -> `shared/ui`

---

## 8. 표준 FSD segment vocabulary

slice 내부에서는 가능한 한 표준 segment 이름만 사용한다.

```text
ui/
model/
api/
lib/
config/
```

route private folder에서는 동일한 의미를 `_` prefix로 표현한다.

```text
_ui/
_model/
_lib/
_config/
```

임의의 동의어를 만들지 않는다.

예:

```text
_components/
_hooks/
_utils/
_helpers/
_shared/
```

이런 이름을 습관적으로 추가하지 않는다.

실제 필요한 segment만 만든다. 빈 디렉터리를 아키텍처 의식처럼 미리 생성하지 않는다.

---

## 9. Public API 규칙

승격된 FSD slice는 `index.ts`를 public API로 사용한다.

```ts
import { SongCard } from '@/entities/song';
```

slice 외부에서 내부 segment를 우회해서 import하지 않는다.

반면 route-local private folder에는 public API를 강제하지 않는다.

```ts
import { LyricsViewer } from './_ui/lyrics-viewer';
```

route-local 코드는 해당 route의 implementation detail이다.

---

## 10. Server boundary

초기 서버 구조는 작게 유지한다.

```text
src/server/
├─ db/
├─ repositories/
├─ services/
├─ auth/
├─ authz/
├─ errors/
└─ http/
```

기본 책임:

- `db`: Drizzle client와 schema
- `repositories`: 도메인 단위 plain-function persistence API
- `services`: application/domain use-case 함수와 transaction ownership
- `auth`: identity/request context
- `authz`: CASL ability/rule 구성
- `errors`: application error vocabulary
- `http`: HTTP boundary에서 필요한 작은 변환/helper

Repository는 허용하지만 Repository framework는 만들지 않는다. 구체 규칙은 `06-server-data-access-architecture.md`를 따른다.

`services`는 다음을 import하지 않는다.

- `src/app`
- Next.js `Request`, `Response`
- cookies/headers
- client component
- `server/http`

서비스 함수는 plain TypeScript 함수로 작성한다.

클래스, DI, Repository interface/base class/generic CRUD framework를 기본 구조로 만들지 않는다. Repository는 plain function module로 둔다.

---

## 11. 추상화 원칙

### 라이브러리 어휘를 유지한다

좋은 추상화는 도메인 어휘를 추가한다.

```text
songQueries.detail()
songMutations.update()
useLyricsSync()
SongEditor
```

나쁜 추상화는 라이브러리를 다시 감싼다.

```text
useApiQuery()
useSafeMutation()
useRequest()
ApiResponseMapper
AsyncHandler
```

TanStack Query, React Hook Form, Zod, ky 등의 공식 API와 어휘를 숨기지 않는다.

### 반복이 생기기 전에 framework를 만들지 않는다

평범한 helper는 허용한다.

```text
toErrorResponse()
withApiHandler()
requireUser()
```

하지만 metadata, decorator, lifecycle, configuration DSL이 필요한 순간 과도한 추상화인지 재검토한다.

---

## 12. 설계 원칙

### SRP

분리 기준은 줄 수가 아니라 책임이다.

### KISS

동일한 결과를 평범한 함수로 표현할 수 있다면 framework abstraction을 만들지 않는다.

### YAGNI

미래의 모바일 앱, 다중 프로세스, 대규모 조직을 가정해 현재 구조를 복잡하게 만들지 않는다.

### Explicit over magical

실행 흐름이 코드에서 보이는 구조를 우선한다.

### Colocation first

사용처와 책임이 가까운 코드를 먼저 가까이 둔다.

### Promotion by evidence

재사용과 독립성이 실제로 나타난 후 적절한 레이어로 승격한다.

---

## 13. 재분리 기준

현재는 Next 단일 서버가 기본이다.

다음과 같은 실재 요구가 생기면 별도 서버 분리를 재검토한다.

- 모바일 등 두 번째 독립 API 소비자 등장
- 독립적인 scale-out 필요
- background workload가 web process와 명확히 분리되어야 함
- 서버 배포 수명주기가 web과 달라짐

그때 `src/server/services`를 분리 후보로 삼는다.

현재부터 NestJS 형태를 흉내 내며 준비하지 않는다.

---

## 14. 도구의 책임

### Steiger

FSD 구조와 계층 위반 검사.

### ESLint

TypeScript, React, Next.js, import rule, unused code 등 일반 코드 품질과 프로젝트 추가 경계 검사.

Steiger와 ESLint에 동일한 FSD 규칙을 중복 구현하지 않는다.

---

## 15. 최종 판단 질문

새 구조나 추상화를 만들기 전에 다음 순서로 묻는다.

```text
실제 문제가 있는가?
  -> 실제 반복이 있는가?
    -> 책임이 같은가?
      -> 평범한 함수/코로케이션으로 해결 가능한가?
        -> 호출부와 구조가 더 읽기 좋아지는가?
```

답이 불명확하면 현재 구조를 유지한다.
