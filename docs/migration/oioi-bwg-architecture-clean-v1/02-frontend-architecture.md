---
title: "Frontend Architecture & Refactoring Rules"
document_id: "02"
version: "1.7"
status: "active"
authority: "architecture"
updated_at: "2026-08-29"
depends_on:
  - "01"
supersedes:
  - "02-v1"
tags:
  - "frontend"
  - "fsd"
  - "react"
  - "tanstack-query"
  - "refactoring"
---

# oioi-bwg Frontend Architecture & Refactoring Rules v1.7

## 1. 목적

이 문서는 oioi-bwg 프론트엔드의 구조, 컴포넌트 책임, hook 구성, 순수 로직 분리, TanStack Query 사용법을 정의한다.

목표는 다음과 같다.

- UI와 application/domain logic을 분리한다.
- React에 불필요하게 결합된 로직을 줄인다.
- 순수함수 테스트 비율을 높인다.
- 라이브러리 wrapper를 만들지 않는다.
- FSD를 과도하게 선설계하지 않는다.

---

## 2. 기본 구조

```text
src/
├─ app/
├─ widgets/
├─ features/
├─ entities/
└─ shared/
```

`src/server`는 별도 서버 boundary이며 이 문서의 FSD 계층에 포함하지 않는다.

---

## 3. Segment 의미

### `ui`

presentation을 담당한다.

기본 계약:

```text
props in
 events out
```

UI 컴포넌트는 가능한 한 다음을 직접 알지 않는다.

- API endpoint
- ky
- TanStack Query cache policy
- DB
- 서버 error contract
- application permission rule

단, UI 자체의 local state는 가질 수 있다.

예:

- Dialog open state
- Accordion state
- focus/hover
- 순수 presentation interaction

`dumb UI`는 `state가 전혀 없는 컴포넌트`를 의미하지 않는다.

---

### `model`

React/application orchestration을 담당한다.

포함 가능한 것:

- custom hook
- React state composition
- TanStack Query 조립
- RHF 조립
- router/nuqs와 application state 연결
- feature state transition orchestration
- feature type

예:

```text
features/lyrics-sync/model/
├─ lyrics-sync.types.ts
└─ use-lyrics-sync.ts
```

custom hook은 실제 application/domain behavior를 표현할 때 만든다.

좋은 예:

```text
useLyricsSync()
useSongEditor()
useYouTubePlayer()
```

피할 예:

```text
useApiQuery()
useSafeMutation()
useRequest()
```

---

### `lib`

순수 계산, 변환, 판정 로직을 담당한다.

```text
features/lyrics-sync/lib/
├─ find-active-line.ts
└─ calculate-progress.ts
```

가능하면 다음 특성을 가진다.

- React import 없음
- TanStack Query import 없음
- 브라우저 API 의존 없음
- side effect 없음
- 입력 -> 출력으로 테스트 가능

로직을 추출할 때 먼저 묻는다.

```text
React lifecycle/state가 필요한가?

NO  -> lib의 순수함수
YES -> model의 hook/state
```

로직이라는 이유만으로 custom hook을 만들지 않는다.

---

### `api`

브라우저/client-side에서 사용하는 API adapter와 Query option을 둔다.

예:

```text
entities/song/api/
├─ api.ts
├─ queries.ts
└─ mutations.ts
```

이곳은 `src/server`를 직접 import하지 않는다.

Client path:

```text
entities/*/api
  -> ky
  -> /api/*
  -> server service
```

---

## 4. Smart logic과 Dumb UI

기본 구조:

```text
pure lib
   ^
   |
model / orchestration hook
   ^
   |
UI
```

예:

```text
features/lyrics-sync/
├─ model/
│  ├─ lyrics-sync.types.ts
│  └─ use-lyrics-sync.ts
├─ ui/
│  └─ lyrics-viewer.tsx
├─ lib/
│  ├─ find-active-line.ts
│  └─ calculate-progress.ts
└─ index.ts
```

`useLyricsSync`는 순수 계산을 직접 품기보다 `lib` 함수를 조합한다.

순수 로직은 hook 밖으로 빼서 독립적으로 테스트한다.

---

## 5. Hook composition 원칙

Smart hook도 SRP를 따른다.

하나의 hook이 모든 것을 소유하는 god hook이 되지 않게 한다.

주의 신호:

```text
useSongEditor()
  - query
  - form
  - permissions
  - player
  - toast
  - router
  - optimistic update
  - validation
  - business rule
```

이 경우 책임을 의미 단위로 분리한다.

단, wrapper를 위한 wrapper는 만들지 않는다.

Hook 분리는 React/application behavior가 실제로 독립적일 때만 수행한다.

---

## 6. TanStack Query 사용 규칙

Query 전용 custom hook wrapper를 기본적으로 만들지 않는다.

피한다.

```text
useSongQuery()
useUpdateSongMutation()
usePublishSongMutation()
```

대신 `queryOptions` / `mutationOptions`를 정의하고 TanStack Query API를 직접 사용한다.

예:

```ts
const song = useSuspenseQuery(
  songQueries.detail(songId),
);

const updateSong = useMutation(
  songMutations.update(),
);
```

Entity API는 다음을 제공할 수 있다.

```text
api function
queryOptions
mutationOptions
```

TanStack Query의 `useQuery`, `useSuspenseQuery`, `useMutation` 등의 어휘를 프로젝트 wrapper 뒤로 숨기지 않는다.

---

## 7. Query key와 option 구성

Query key는 option factory를 통해 한 곳에서 파생되게 한다.

예:

```ts
export const songQueries = {
  all: () => ['songs'] as const,

  detail: (id: string) =>
    queryOptions({
      queryKey: ['songs', 'detail', id] as const,
      queryFn: () => getSong(id),
    }),
};
```

단, Next.js 모놀리식 구조에서 다음 두 acquisition path를 의도적으로 분리하고 browser HTTP adapter가
`client-only`인 경우에는 server-safe query key factory를 별도 파일로 둔다.

```text
RSC → Service 직접 호출 → setQueryData
CSC → queryOptions → ky → Route Handler
```

```ts
// api/query-keys.ts
export const songQueryKeys = createQueryKeys("song", {
  detail: (id: string) => [id],
});

// api/queries.ts — client-only acquisition
export const songQueries = {
  detail: (id: string) =>
    queryOptions({
      ...songQueryKeys.detail(id),
      queryFn: () => getSong(id),
    }),
};
```

이 예외에서는 `@lukemorales/query-key-factory`의 `createQueryKeys()`만 slice별로 사용한다. 전역
`createQueryKeyStore()`, `mergeQueryKeys()` 또는 프로젝트 자체 key framework는 만들지 않는다.
동일 queryFn을 server/client에서 안전하게 실행할 수 있다면 기본 `queryOptions()` 단독 패턴을 유지한다.

Mutation도 같은 방식으로 라이브러리 primitive를 그대로 사용한다.

```ts
export const songMutations = {
  update: () =>
    mutationOptions({
      mutationFn: updateSong,
    }),
};
```

---

## 8. Page / Route-local colocation

페이지 전용 코드는 먼저 route 아래 private folder에 둔다.

```text
app/(public)/songs/[slug]/
├─ page.tsx
├─ _ui/
├─ _model/
└─ _lib/
```

처음부터 모든 코드를 `features`나 `entities`로 분류하려 하지 않는다.

실제 독립성과 재사용이 생기면 적절한 FSD layer로 승격한다.

구축 방향은 `shared` 기반을 bottom-up으로 만들고, 실제 product UI를 route에서 구현한 뒤
검증된 책임을 top-down으로 추출하는 것이다.

```text
shared primitive
  -> app route implementation
  -> repeated/stable responsibility discovery
  -> widget / feature / entity extraction
```

`shared`에는 shadcn primitive, 범용 hook, `cn`·date helper, 범용 API client처럼 도메인에
독립적인 코드만 둔다. 특정 도메인을 렌더링하는 UI나 특정 use-case 상태는 route-local 또는
적절한 entity/feature가 소유한다.

도메인 이름과 consumer 수는 판단 자료이지 단독 승격 기준이 아니다. 단일 route 전용 UI는
도메인 데이터를 받더라도 우선 route-local에 둘 수 있으며, 안정된 도메인 contract나 실제
재사용이 확인될 때 entity로 승격한다.

---

## 9. 리팩토링 판단 기준

줄 수는 신호이지 분리 기준이 아니다.

핵심 판단 질문:

- 한 문장으로 설명했을 때 책임이 둘 이상인가?
- 서로 무관한 상태/effect가 한 곳에 섞였는가?
- 로직과 presentation이 결합되어 테스트가 어려운가?
- 분리할 대상에 자연스러운 이름을 붙일 수 있는가?
- 분리 후 응집도가 높아지는가?

자연스러운 이름이 없다면 억지로 쪼개지 않는다.

예:

```text
ProductFilterBar  -> 좋은 경계
TopHalf           -> 의심
PageSection2      -> 의심
```

---

## 10. 로직 먼저, UI 나중

컴포넌트가 복잡할 때 기본 순서:

```text
1. 순수 계산을 lib로 추출
2. React/application orchestration을 model로 추출
3. 그래도 UI에 독립된 의미 경계가 있으면 하위 UI 컴포넌트 분리
```

UI부터 기계적으로 잘라 props drilling을 증가시키지 않는다.

---

## 11. Page는 composition root다

페이지는 조립 때문에 길어질 수 있다.

다음은 정상적일 수 있다.

```tsx
<Header />
<FilterBar />
<ProductList />
<Pagination />
```

문제는 페이지가 조립뿐 아니라 feature 내부 로직까지 소유하는 경우다.

Page에 자연스럽게 남을 수 있는 책임:

- routing concern
- RSC data acquisition
- high-level composition

Feature 내부 상태, 계산, mutation orchestration은 가능한 한 해당 책임의 위치로 이동한다.

---

## 12. 숫자 기반 규칙은 강제하지 않는다

다음 숫자들은 리뷰 신호로는 사용할 수 있지만 architecture rule이나 CI error로 만들지 않는다.

- component line count
- state 개수
- effect 개수
- props 개수
- JSX depth
- `return` 위 코드 줄 수

`max-lines-per-function`을 핵심 품질 규칙으로 사용하지 않는다.

SRP는 기계적 줄 수보다 사람이 책임을 판단하는 것이 중요하다.

---

## 13. Query / Mutation Key

Query key와 mutation key는 서로 다른 역할을 가진다.

```text
Query Key
= server state identity

Mutation Key
= mutation identity / observability

Invalidation
= mutation 성공 이후 query key를 명시적으로 invalidate
```

Query key는 기본적으로 §7의 `songQueries`가 유일하게 소유한다. RSC direct service와 CSC
`client-only` HTTP acquisition이 갈리는 예외에서는 `songQueryKeys`가 identity를 소유하고
`songQueries`도 같은 factory 결과를 사용한다.

Invalidation key는 `queryOptions()`가 반환한 `.queryKey` 또는 위 예외의 query key factory 결과를
사용한다. 문자열 배열을 호출부에서 다시 작성하지 않는다.

Mutation key는 별도 factory로 관리한다.

```ts
export const songMutationKeys = {
  all: ["song-mutation"] as const,

  create: () =>
    [...songMutationKeys.all, "create"] as const,

  update: (id: string) =>
    [...songMutationKeys.all, "update", id] as const,

  publish: (id: string) =>
    [...songMutationKeys.all, "publish", id] as const,
};
```

Mutation options:

```ts
export const songMutations = {
  update: (id: string) =>
    mutationOptions({
      mutationKey: songMutationKeys.update(id),
      mutationFn: (input: UpdateSongInput) =>
        updateSong(id, input),
    }),
};
```

Invalidation에서는 `queryOptions()`의 `.queryKey` 또는 동일 query key factory 결과를 그대로 사용한다.

```ts
const mutation = useMutation({
  ...songMutations.update(song.id),

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: songQueries.detail(song.id).queryKey,
    });
  },
});
```

`mutationKey`를 query invalidation 규칙으로 사용하지 않는다.

`meta.invalidates`, custom invalidation registry 같은 프로젝트 전용 framework도 만들지 않는다.

TanStack Query의 기본 vocabulary를 그대로 사용한다.

---


## 14. React Hook Form 노출 원칙

React Hook Form은 숨겨야 하는 infrastructure detail로 취급하지 않는다.

다음 vocabulary가 UI 또는 model 코드에 직접 드러나는 것을 허용한다.

```text
useForm
register
control
Controller
FormProvider
formState
handleSubmit
setError
reset
```

Custom hook은 RHF를 숨기기 위해 만들지 않는다.

예:

```tsx
const form = useForm<SongEditorFormValues>({
  resolver: zodResolver(songEditorFormSchema),
  defaultValues,
});
```

shadcn/ui form wiring에서도 RHF vocabulary를 그대로 사용할 수 있다.

```tsx
<Form {...form}>
  <FormField
    control={form.control}
    name="title"
    render={...}
  />
</Form>
```

---

## 15. Side Effect / Mutation 격리 원칙

UI와 application orchestration을 구분하는 기준은
"hook을 사용했는가"가 아니라
"외부 상태를 변경하는가"다.

UI에 남겨도 되는 예:

```text
Dialog open/close
Accordion state
hover/focus
local presentation state
setOpen(true)
form field wiring
```

model로 이동할 후보:

```text
mutation.mutate()
queryClient.invalidateQueries()
router.push()
analytics event
localStorage write
network side effect
API field error → form.setError()
409 conflict handling
autosave
dirty navigation guard
```

Custom hook은 라이브러리를 감추기 위해서가 아니라
application orchestration과 side effect를 UI에서 격리하기 위해 만든다.

```ts
function useSongEditor(song: SongDto) {
  const queryClient = useQueryClient();

  const form = useForm<SongEditorFormValues>({
    resolver: zodResolver(songEditorFormSchema),
    defaultValues: toSongEditorFormValues(song),
  });

  const mutation = useMutation({
    ...songMutations.update(song.id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: songQueries.detail(song.id).queryKey,
      });
    },
  });

  const submit = form.handleSubmit((values) => {
    mutation.mutate(
      toUpdateSongInput(song, values),
    );
  });

  return {
    form,
    submit,
    mutation,
  };
}
```

Custom hook을 사용하더라도 가능한 한 RHF/TanStack Query의 공식 객체와 vocabulary를 그대로 노출한다.

다음과 같은 generic project vocabulary는 만들지 않는다.

```text
useSafeForm
useAsyncForm
useFormMutation
useManagedQuery
```

---

## 16. Styling

프로젝트 표준 스타일링 스택은 다음으로 고정한다.

```text
Base UI
  ↓
shadcn/ui
  ↓
Tailwind CSS
```

shadcn/ui의 Base UI 기반 component primitives를 사용하고, 스타일링은 Tailwind CSS utility를 기본으로 한다.

현재 styling stack을 기술부채로 간주하지 않는다.

Custom component가 필요하더라도 먼저 shadcn/ui와 Base UI primitive 조합으로 해결할 수 있는지 확인한다.

프로젝트 전용 wrapper component를 만들더라도 Base UI/shadcn의 공식 interaction vocabulary를 불필요하게 숨기지 않는다.

### UI regression contract

반응형은 JS 화면 크기 감시보다 intrinsic layout과 CSS를 우선한다. 재사용 컴포넌트는 필요할 때
자기 최소 폭과 좁은 폭에서의 동작(줄바꿈·스크롤·축소)을 선언한다. 컨테이너 쿼리와 미디어
쿼리는 배치 맥락이 실제로 달라질 때만 사용하며, 포털된 overlay처럼 컨테이너 트리를 벗어나는
UI는 그 사실을 기준으로 판단한다.

색과 치수는 semantic token을 통해 소비하고, 접근성 대비와 키보드·포커스 동작을 스타일 선택과
동일한 완료 조건으로 본다. 임의의 수치나 프레임워크 버전별 문법은 이 문서에 고정하지 않고
runtime compatibility contract와 실제 렌더 검증을 따른다.

---

## 17. 테스트 전략

### lib

순수함수 unit test를 가장 쉽게 작성할 수 있어야 한다.

### model

복잡한 application behavior가 있는 hook만 선택적으로 테스트한다.

순수 로직을 hook 밖으로 빼 hook test 필요성을 줄이는 것을 우선한다.

### ui

rendering과 interaction contract 중심으로 테스트한다.

### page / RSC

핵심 플로우는 Playwright E2E로 검증한다.

---

## 18. 최종 원칙

1. UI는 presentation을 우선한다.
2. UI local state까지 무조건 밖으로 빼지 않는다.
3. React가 필요 없는 로직은 `lib` 순수함수로 만든다.
4. React/application orchestration은 `model`에 둔다.
5. Custom hook은 실제 behavior를 표현할 때만 만든다.
6. TanStack Query wrapper hook을 기본 패턴으로 만들지 않는다.
7. `queryOptions` / `mutationOptions`를 직접 소비한다.
8. 라이브러리 어휘를 숨기지 않는다.
9. route-local에서 시작하고 실제 근거가 생기면 승격한다.
10. 줄 수보다 책임과 응집도를 기준으로 리팩토링한다.
11. shared 기반은 bottom-up으로 구축하고 product slice는 app의 실제 사용처에서 top-down으로 추출한다.
12. 도메인 이름이나 consumer 수만으로 entity/widget 승격을 결정하지 않는다.
13. `shared/api`는 범용 HTTP infrastructure이며 server persistence를 두지 않는다.
14. Mutation key는 mutation identity와 observability를 위해 사용한다.
15. Query invalidation은 query key를 기준으로 mutation 성공 시 명시적으로 수행한다.
16. RHF vocabulary는 UI/model에 직접 드러날 수 있다.
17. Custom hook은 RHF를 숨기기 위해 만들지 않는다.
18. 외부 상태를 변경하는 mutation과 side effect는 가능한 한 model에 격리한다.
19. 순수 presentation state와 UI event는 UI에 남겨도 된다.
20. Base UI 기반 shadcn/ui + Tailwind CSS를 프로젝트 스타일링 표준으로 사용한다.
