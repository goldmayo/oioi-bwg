# 14. 테스트

> **코드:** `vitest.config.ts` · `src/**/*.test.ts`

## 결정

| | |
| --- | --- |
| 러너 | vitest — **node 환경** (jsdom 없음) |
| 대상 | `src/**/*.test.ts` — **순수 함수만** |
| RTL · MSW | 미도입 |
| Playwright | 설치돼 있으나 e2e 아님 — 목업 실측값 추출용 애드혹 |

## 설정을 분리한 이유

`vite.config.ts`에는 tailwind·router 생성기·devtools 플러그인이 달려 있는데
**단위 테스트에는 하나도 필요 없습니다.** 같이 쓰면 테스트를 돌릴 때마다 라우트 트리를
재생성하고 CSS를 컴파일합니다.

`environment: "node"`인 것도 의도입니다 — 지금 대상은 전부 순수 함수(날짜 계산·페이징 변환·
봉투 처리)라 DOM이 없습니다. 컴포넌트 테스트가 실제로 필요해지면
`environmentMatchGlobs`로 파일 단위로 켭니다.

```ts
env: { TZ: "Asia/Seoul" }
```

날짜 계산이 로컬 자정 기준이라 실행 환경 타임존이 바뀌면 결과가 달라집니다. 고정합니다.

## 무엇을 테스트하나

지금 있는 것(11개)이 기준입니다.

| 대상 | 예 |
| --- | --- |
| 경계 변환 | `envelope.test.ts` · `pagination.test.ts` |
| 도메인 계산 | `remaining-life.test.ts` · `progress.test.ts` · `field-progress.test.ts` |
| 어휘 매핑 | `vocab.test.ts` |
| 화면 순수 로직 | `create-form.test.ts` · `name-list.test.ts` · `image-file.test.ts` |
| 권한 판정 | `can.test.ts` |
| 날짜 | `date.test.ts` |

**규칙:** 로직을 훅과 `-utils/`로 빼면([13](15-conventions.md)) 렌더링 없이 덮을 수 있습니다.
테스트를 위해 렌더링이 필요해졌다면 그건 로직이 컴포넌트에 남아 있다는 신호입니다.

## 언제 RTL을 넣나

한 컴포넌트에 상태 조합이 폭발할 때(loading × empty × error × 권한).
지금은 그 조합을 라우터 경계가 나눠 갖고 있어 해당 없습니다.
