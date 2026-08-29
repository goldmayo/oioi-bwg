# 02. FSD 구조

> **코드:** `eslint.config.js` (경계 규칙) · `steiger.config.ts` · `src/`

## 결정

| | |
| --- | --- |
| 레이어 | `app → widgets → features → entities → shared` (5개) |
| **`pages` 레이어** | **쓰지 않습니다** |
| 화면 전용 코드 | route 폴더 안에 `-` 접두사로 콜로케이션 |
| 강제 | ESLint `boundaries` (의존 방향·public API) + steiger (구조) |

## `pages`를 뺀 이유

TanStack Router의 route 파일이 이미 **path · loader · validateSearch · 가드 · 화면**을 함께 소유합니다.
여기에 `pages` 슬라이스를 두면 route 파일이 `pages/x`를 한 줄 import하는 1:1 래퍼가 되고,
재사용에 아무것도 기여하지 않으면서 화면 하나당 디렉터리가 하나 늘어납니다.

대신 화면 전용 코드는 route 폴더 안에 둡니다. TanStack Router는 `-` 로 시작하는 디렉터리를
라우트로 취급하지 않으므로 그대로 콜로케이션 폴더가 됩니다.

```
src/app/routes/_admin/work-orders/
  index.tsx          ← 라우트 (path·loader·validateSearch·component)
  new.tsx
  $workOrderId.tsx
  -ui/               ← 이 화면에서만 쓰는 컴포넌트
  -hooks/            ← 이 화면의 로직
  -utils/            ← 순수 함수 (여기 테스트가 붙습니다)
  -model/            ← 스텁 데이터·화면 전용 타입
  -api/              ← 이 화면에서만 부르는 호출 (2화면 이상 쓰면 entities 승격)
```

### 왜 라우트만 `-hooks`/`-utils`인가

체계가 둘이라 헷갈리기 쉬운 자리입니다.

| 층위 | 세그먼트 | 근거 |
| --- | --- | --- |
| `widgets`·`features`·`entities` 슬라이스 | FSD 표준 — `ui` `api` `model` `lib` `config` | FSD는 **목적**으로 나눕니다. `hooks/`처럼 "이게 무엇인가"로 묶은 이름은 파일이 늘수록 정보를 잃어 금지합니다 — 훅은 `model`(상태·규칙)이나 `lib`(보조)에 둡니다 |
| `app/routes/*/-*` | `-ui` `-hooks` `-utils` `-model` `-api` | 여기는 슬라이스가 아니라 **한 화면 전용 콜로케이션**입니다. 개수가 작아(보통 5~10) 본질 이름이 그대로 읽히고, `pages` 레이어를 뺀 대가로 정한 이 저장소 규약입니다 |

둘 다 **`project/segment-placement`**(`eslint-rules/`)가 강제합니다. steiger의
`fsd/segments-by-purpose`는 `app/providers` 때문에 전역 해제되어 있어 그 빈자리를 메웁니다.

**승격 기준은 두 번째 소비자입니다.** 다른 화면이 같은 것을 필요로 하는 순간
`features`/`entities`/`shared`로 올립니다. 미리 올리지 않습니다 —
`features/work-group-table`이 그렇게 올라온 예입니다(P-03과 P-09가 같은 컬럼을 씁니다).

## 레이어별 소유물

```
app/        조립만 — main·router·providers·styles·routes
widgets/    화면 여러 곳에 붙는 큰 UI 덩어리 (app-header · ai-sidebar · access-denied)
features/   재사용되는 "동작" (route-guard · work-group-table · work-group-export)
entities/   도메인 — api/ (호출·queries·mutations) + model/ (schema·types·vocab)
shared/     도메인을 모르는 것 — api · ui · lib · hooks · config
```

`entities`는 슬라이스마다 같은 모양입니다:

```
entities/inventory/
  index.ts           ← public API. 밖에서는 이것만 import
  api/api.ts         ← URL·파라미터·서버 enum 매핑을 아는 유일한 층
  api/queries.ts     ← queryOptions 팩토리
  api/mutations.ts   ← mutationOptions (무효화는 여기 두지 않습니다 → 05)
  model/schema.ts    ← zod 스키마
  model/types.ts     ← z.infer로 유도한 타입
  model/vocab.ts     ← 서버 enum ↔ 클라 어휘 매핑
```

## 기계적 강제

**ESLint `boundaries`** — `eslint.config.js`의 `project/fsd-boundaries`.

- 하향 의존만. `LAYERS.slice(indexOf + 1)`로 정책을 생성하므로 **자기 레이어가 빠집니다**
  = 슬라이스 간 참조 금지가 같은 규칙에서 나옵니다.
- public API 강제 — `shared`를 제외한 슬라이스는 `index.ts`로만 노출.
- ⚠️ `import/resolver`의 typescript 설정이 없으면 `@/` alias를 해석 못 해
  **boundaries가 조용히 아무것도 안 잡습니다.**

**steiger** — 디렉터리 구조. `shared`는 세그먼트 직접 접근을 허용하므로 `fsd/public-api`를 껐고,
`fsd/segments-by-purpose`는 `app/providers` 때문에 전역 해제했습니다(steiger가 "providers"를
이름만으로 걸고 진단 위치가 디렉터리라 글롭으로 좁힐 수 없습니다).

`npm run lint`와 `npm run lint:fsd`는 **다른 것을 봅니다.** 둘 다 돌리세요.

## 예외 하나 — 의존 뒤집기

`shared/api`는 `app`을 모릅니다. 그런데 세션이 만료되면 `/login`으로 보내야 하는데,
그건 라우터(=`app`)의 일입니다. 상향 의존 대신 **콜백 주입**으로 뒤집습니다.

```ts
// app/router.tsx
setSessionExpiredHandler(() => { expireSession(); void router.navigate({ to: "/login" }); });
```

같은 이유로 라우트 가드는 `features/route-guard`에 있습니다 —
`redirect()`를 던지는 라우터 결합 코드라 `entities`에 둘 수 없고, 여러 라우트가 공유하므로
route 폴더에도 둘 수 없습니다(ESLint `project/route-colocation`이 라우트 간 상호 import를 막습니다).

## 함정

| 증상 | 원인 |
| --- | --- |
| boundaries가 위반을 하나도 못 잡음 | `import/resolver` typescript 설정 누락 |
| `lint`는 통과인데 구조가 이상함 | `lint:fsd`를 안 돌렸습니다 |
| "no references" 경고 | 만들어 두고 아직 아무도 안 쓰는 슬라이스. 소비자가 붙으면 사라집니다 |
| 화면 코드를 어디 둘지 모르겠음 | 두 번째 소비자가 없으면 route 폴더 `-ui/` |
