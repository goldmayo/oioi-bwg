---
title: "프레임워크 기능 활용과 구조 중복 감사"
kind: migration-evidence
status: active
source_commit: e14766c976485ebfdc4c5ce90497e6f886fa3ee6
observed_at: "2026-10-23"
created_at: "2026-10-23"
revision: 1
---

# 프레임워크 기능 활용과 구조 중복 감사

## 범위와 근거

사용자 요청에 따라 현재 migration_main의 Console Proxy·인증/인가, 두 앱의 오류 복구,
Web 앨범 오버레이, 공통 기반 정책의 복제를 조사했다. 전체 보안 인증이나 모든 UI의 브라우저 검증을
완료했다는 뜻은 아니다. 이 문서는 구조 감사이며 runtime 구현·운영 설정·배포를 변경하지 않는다.

local/origin 기준은 위 source_commit이며 분기 전 작업 트리는 깨끗했다.
설치된 Next.js 16.4.1·React 19.2.5·Vitest 4.1.2와 실제 앱의 pnpm 의존성을 사용했다.
공식 최신 문서는 Next 16.4.2를 표시하므로, retry 기능은 설치된 16.4.1 타입·구현에서도 별도로 확인했다.

판정은 [헌법 §11](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth](../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Rendering/Query/Cache](../oioi-bwg-architecture-clean-v1/07-rendering-query-cache-architecture.md),
[Observability](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md)를 우선한다.
기존 [M6 공개 데이터 감사](M6-PUBLIC-DATA-RENDERING-AUDIT.md)는 해당 단계의 결과로 보존하며
이번 오류 복구/primitive 재사용 감사로 완료한 기준선을 다시 검증하지 않는다.

## 결론과 우선순위

| ID | 판정 | 문제와 영향 | 후속 단위 |
| --- | --- | --- | --- |
| FWA-01 | P2·기능 결함 확인 | 오류 화면 세 곳이 Next reset만 호출해 서버 데이터 재요청을 하지 않는다. 일시적 RSC 실패 복구가 막힐 수 있다. | 오류 복구 |
| FWA-02 | P2·조건부 결함 재현 | 캐시 데이터 없는 Suspense Query 실패는 React 경계만 reset해도 다시 요청하지 않는다. | FWA-01과 함께 오류 복구 |
| FWA-03 | P2·기능 결함 확인 | Web 앨범 오버레이가 기존 Dialog 기능을 우회해 dialog semantics·Escape 닫기가 없다. | 앨범 모달 primitive 적용 |
| FWA-04 | P3·유지보수 위험 확인 | 두 앱이 같은 관측 정책 751줄을 각각 보유한다. 현재 불일치를 발견한 것은 아니며 수정 누락 위험이다. | 순수 정책 공통화 설계 |
| Console Proxy | 결함 아님 | src/proxy.ts가 존재하고 실제 권한 검사는 데이터 접근 경계에서 수행한다. | 유지 |

## FWA-01 — Next의 retry 대신 reset만 사용하는 오류 화면

대상은 [Console admin error][admin-error], [Console global error][console-global],
[Web global error][web-global]다. 모두 오류 화면의 버튼을 reset에만 연결한다.

설치된 Next의 `ErrorBoundaryHandler`에서 reset은 error state만 지운다.
retry는 React transition 안에서 router refresh 후 reset을 수행한다. 실제 클래스를 생성해
context.refresh와 setState를 계측한 결과는 다음과 같다. 네트워크나 DB는 호출하지 않았다.

| 호출 | 누적 router refresh | 누적 boundary reset |
| --- | ---: | ---: |
| reset() | 0 | 1 |
| 이어서 retry() | 1 | 2 |

서버가 만든 실패 payload를 다시 렌더링하기만 하면 같은 실패가 다시 드러날 수 있다.
이를 자체 재시도 상태/라우터 wrapper로 보완하기 전에 프레임워크가 제공하는 retry를 사용해야 한다.
[Next 공식 error 문서](https://nextjs.org/docs/app/api-reference/file-conventions/error)는
retry의 재조회+재렌더와 reset의 상태 초기화를 구분하며 retry는 16.3부터 안정 API다.
설치된 파일은 `next/dist/client/components/error-boundary.{js,d.ts}`에서 직접 대조했다.
이 재현은 실제 RSC 서버 장애를 발생시킨 E2E 실행은 아니다.

## FWA-02 — Query 오류 경계 reset의 연결 누락

[Admin error][admin-error]와 [AppProviders][providers]에 Query 오류 reset 연결이 없으며
현재 추적 소스에는 QueryErrorResetBoundary/useQueryErrorResetBoundary 사용이 없다.
Console은 관리자 Ability와 Album/Song 목록에서 useSuspenseQuery를 사용한다.

로컬 jsdom fixture는 실제 AdminError를 React 오류 경계의 fallback으로 렌더했다.
동일한 설치 QueryClient·useSuspenseQuery와 가짜 queryFn을 사용하고, 첫 호출은 실패·두 번째는 성공하게 했다.
외부 HTTP·DB·Sentry 전송은 없으며 retry:false로 자동 retry만 배제했다.

| 조건 | 실제 다시 시도 버튼 클릭 뒤 queryFn 호출 수 | 결과 |
| --- | ---: | --- |
| 현재 reset 연결 | 1 | 성공하도록 바뀐 queryFn을 재호출하지 않고 오류 유지 |
| 대조군: Query reset + 같은 React reset | 2 | recovered 렌더 |

[TanStack의 공식 Suspense 문서](https://tanstack.com/query/latest/docs/framework/react/guides/suspense#resetting-error-boundaries)는
QueryErrorResetBoundary 또는 useQueryErrorResetBoundary를 오류 경계 reset과 연결하도록 설명한다.

**발생 조건을 제한한다.** 현재 관리자 RSC는 query 데이터를 seed한다. 캐시에 유효한 데이터가 있는
background refetch 오류가 모두 이 경계로 throw되는 것은 아니다. 데이터가 없는 Query 오류가 경계로
전파된 경우를 재현했으며 정상 seed 경로에서 매번 재현된다고 주장하지 않는다.
후속 수정은 Next retry와 Query reset을 함께 설계하되 두 앱의 서버 QueryClient를 전역으로 공유하지 않는다.

## FWA-03 — 설치된 Dialog를 우회하는 앨범 오버레이

[AlbumDetailModal][album-modal]은 fixed div·backdrop click·GSAP timeline으로 modal을 직접 구현한다.
role=dialog, dialog naming, Escape 처리나 focus trap 구현이 없다.
같은 앱에 이미 [shared/ui/dialog.tsx][dialog]가 존재한다.

로컬 jsdom fixture에서 실제 AlbumDetailModal과 현재 shared Dialog를 각각 렌더했다.
Next navigation/image/link와 analytics·GSAP 진입 애니메이션만 mock해 외부 요청/라우터 의존성을 격리했다.

| 대상 | dialog role | Escape 결과 |
| --- | --- | --- |
| 현재 앨범 오버레이 | 없음 | onClose/router 호출 없음 |
| 현재 shared Dialog 대조군 | 있음 | onOpenChange(false) 호출 |

[Radix Dialog 공식 문서](https://www.radix-ui.com/primitives/docs/components/dialog)가 제공하는
키보드/포커스/접근성 동작을 활용하고, 진입·퇴장 애니메이션은 그 생명주기에 결합하는 편이 맞다.
포커스 trap·복원·scroll lock·실제 키보드 흐름은 수정 후 Playwright로 검증해야 한다.
이번 재현은 native browser의 Tab 순서나 GSAP 애니메이션까지 검증한 것이 아니다.

닫기는 현재 router.push('/')다. [User layout][user-layout]의 optional modal prop과 달리
현재 @modal/intercepting route 파일은 없다. Next의 parallel/intercepting routes는 배경 화면·뒤로 가기
동작을 보존하는 선택지지만, 직접 URL 진입과 close history의 제품 동작을 먼저 정해야 한다.
Dialog 적용 자체와 URL routing 재설계는 같은 요구로 취급하지 않는다.

## FWA-04 — 순수 관측 정책의 복제

| 파일 | 각 앱의 줄 수 | Web→Console 차이 |
| --- | ---: | --- |
| server/observability/safe-server-event.ts | 394 | correlation import 경로, app 태그 |
| shared/lib/client-sentry-policy.ts | 357 | correlation import 경로, app 태그 |

[Web server 정책][web-policy], [Console server 정책][console-policy],
[Web client 정책][web-client-policy], [Console client 정책][console-client-policy]를 비교했다.
두 차이를 정규화한 뒤 각 쌍이 완전히 같음을 assertion으로 확인했다.
공통 정책 본문 합계는 751줄이며 두 앱에 각각 존재한다.

이 정책을 Sentry의 기본 PII 옵션 하나로 대체할 수 있다는 뜻은 아니다.
저장소의 allowlist·원문 비노출·도메인 실패 분류는 명시적 계약이다.
앱별 route metadata/SDK/Next adapter를 보존하고, 같은 정제 규칙과 build metadata 같은
순수 부분만 공통화할 범위를 설계한다. 새로운 자체 관측 framework나 UI package 추출은 제안하지 않는다.

## Console Proxy와 유지할 구조

[Console src/proxy.ts][proxy]는 src/app과 같은 높이에 존재한다.
역할은 요청 ID 재발급·내부 route template 전달이며 로그인 guard를 구현하지 않는다.
[Next Proxy 위치 규칙](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)과 맞다.

인증/인가는 다음 경계가 담당한다.

- [request-context][request-context]: Auth.js identity와 MFA 증명, DB의 ACTIVE ADMIN·MFA 활성/version을 확인한다.
- [admin-page-context][admin-context]: layout뿐 아니라 각 보호 페이지에서도 service 호출 전에 검사한다.
- [관리 API][admin-api]가 context를 전달하고 [공통 service][album-service]가 requireUser/CASL을 검사한다.

[Next 인증 안내](https://nextjs.org/docs/app/guides/authentication)는 Proxy의 낙관적 검사를 선택 사항으로 두고
데이터 접근 경계의 검사를 권장한다. [Auth.js 안내](https://authjs.dev/getting-started/session-management/protecting)도
Proxy만으로 인가를 끝내지 않도록 설명한다. 따라서 auth를 Proxy로 옮겨 DB 검사를 없애는 방향은 부적절하다.
새 NextAuth wrapper로 현재 모듈을 단순 re-export하면 부하·관측 header·API 응답/로그·회수 계약까지 함께 검토해야 한다.

이미 framework/library를 올바르게 사용하는 다음 구조도 유지한다.

- Song/Album metadata와 page의 service 조회는 이미 React.cache()로 dedupe한다.
- 관리자 RSC의 독립 Album/Song 조회는 이미 Promise.all로 실행한다.
- 요청별 auth/QueryClient 격리, TanStack queryOptions/mutationOptions, React Hook Form의 폼 draft를 사용한다.
- Next Data Cache 미사용은 active 결정이다. 이 감사만으로 use cache/revalidatePath를 도입하지 않는다.
- 제한된 HTTP/error helper와 MFA/version 도메인 규칙은 framework 재발명으로 일괄 판정하지 않는다.

## 실제 검증과 다음 단위

재현 fixture/config는 현재 checkout의 ignored `.local/framework-audit/`에 보관했다.
설치된 앱 dependency 경로·browser preset globals를 사용하는 fixture 설정을 맞춘 뒤 최종 실행했다.
fixture 설정의 초기 해석 실패를 제품 결함으로 판정하지 않았다.

- `pnpm exec vitest run --config .local/framework-audit/vitest.console.config.mts`: 1파일·2건 통과.
- `pnpm exec vitest run --config .local/framework-audit/vitest.web.config.mts`: 1파일·2건 통과.
- 설치된 Next ErrorBoundaryHandler의 reset/retry 계측: 위 0→1 refresh 차이 확인.
- 정책 두 쌍 정규화 assertion 통과. Proxy 관련 기존 회귀 테스트는 source를 읽었으며 재실행하지 않았다.

후속 구현 순서는 **FWA-01/02 오류 복구 한 단위 → FWA-03 Dialog 한 단위 → FWA-04 순수 정책 설계**다.
이번 PR은 감사 Markdown만 포함한다. 제품 수정·전체 baseline 반복·운영 호출·UI-03 추출은 수행하지 않는다.
PR 문서 CI와 리뷰/병합 결과는 PR 본문에 기록한다. #199는 기존 head의 Draft로 보존한다.

[admin-error]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/app/(admin)/admin/error.tsx#L32
[console-global]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/app/global-error.tsx#L35
[web-global]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/app/global-error.tsx#L35
[providers]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/app/app-providers.tsx#L13
[album-modal]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/app/(user)/albums/[slug]/_ui/album-detail-modal.tsx#L76
[dialog]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/shared/ui/dialog.tsx#L10
[user-layout]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/app/(user)/layout.tsx#L14
[web-policy]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/server/observability/safe-server-event.ts#L1
[console-policy]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/server/observability/safe-server-event.ts#L1
[web-client-policy]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/web/src/shared/lib/client-sentry-policy.ts#L1
[console-client-policy]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/shared/lib/client-sentry-policy.ts#L1
[proxy]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/proxy.ts#L12
[request-context]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/server/auth/request-context.ts#L62
[admin-context]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/server/auth/admin-page-context.ts#L12
[admin-api]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/apps/console/src/app/api/admin/albums/route.ts#L15
[album-service]: https://github.com/goldmayo/oioi-bwg/blob/e14766c976485ebfdc4c5ce90497e6f886fa3ee6/packages/server/src/services/album-service.ts#L85
