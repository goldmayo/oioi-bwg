---
title: "프레임워크 활용 감사 후속 개선 결과"
kind: migration-result
status: active
source_commit: fd7a1e9e9dfc82e6ede46dd4cae00b0861cd3b31
created_at: "2026-10-23"
---

# 프레임워크 활용 감사 후속 개선 결과

[계획](FRAMEWORK-IMPROVEMENT-PLAN.md)과 #218의 [감사](FRAMEWORK-STRUCTURE-AUDIT.md)를 따른다.
감사 원문은 발견 시점의 근거로 보존하며 현재 구현 결과는 이 문서가 소유한다.

## 단위 A — FWA-01/02 오류 복구

기준은 #218 squash `b45e97145bd5e86044aa1f53bcdfb056f79d4b33`이며 local/origin과 깨끗한 작업 트리를
확인해 분기했다. 구현·검증 소스는 위 source_commit이다. 최종 문서 commit 뒤 CI 링크·리뷰·squash
결과는 같은 PR 본문에 기록한다.

- AdminError는 Query 오류 reset 후 Next retry를 호출한다. AppProviders의 QueryErrorResetBoundary가
  실제 Query subtree와 같은 reset scope를 제공한다. 두 앱 global-error는 Next retry만 호출한다.
- 새 자체 경계/router wrapper 없이 설치 Next 16.4.1·TanStack Query의 API를 사용한다.
  QueryClient 격리·자동 retry 횟수·mutation 정책과 최초 mount/digest 관측·중복 억제를 보존했다.
- root global-error는 layout/provider가 없는 경우에도 동작한다. Query 실패 조건은 캐시 데이터가
  없는 Suspense 오류이며, 유효한 데이터가 있는 background failure 전체로 확대하지 않는다.

### 실제 검증

| 명령/범위 | 결과 |
| --- | --- |
| Console error-boundary/error-recovery와 Web global-error Vitest 집중 실행 | 3파일·5건 통과. 실제 AppProviders·설치 Next 경계로 Query 실패/렌더 실패 후 성공과 refresh 1회, 기존 관측을 확인 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 17 task 성공·11개 캐시. unit 합계 98파일·697건이며 불변 package 결과는 캐시 재사용. 두 앱 FSD 포함 |
| `pnpm test:harness` | 40건 통과 |
| `pnpm type-check:repo`, `pnpm lint:repo`, `pnpm format:check`, `git diff --check` | 성공 |
| `python3 .local/framework-error-recovery/safe-build.py` | `pnpm build --force --env-mode=loose --concurrency=1`, 두 앱 2 task·캐시 0개 성공 |
| `node .local/framework-error-recovery/rsc-check.mjs` | 격리한 실제 Next production server + Chromium에서 RSC·root layout 실패 2경로 복구 |

build는 APP_ENV=local·빈 DSN·업로드/telemetry OFF·가짜 Console/R2 입력·접속 불가능한 loopback DB를
사용했다. 운영 DB·VM·외부 전송을 사용한 검증이 아니다.

RSC fixture는 제품 AdminError/global-error/AppProviders를 그대로 import하고 관측 전송만 no-op으로
대체했다. 로컬 파일로 서버 실패를 켰다가 해제하고 실제 버튼 클릭으로 새로운 서버 요청과 성공 렌더를
확인했다. 페이지 요청 counter 2→3, root layout 4→5였다. 실제 관리자 인증/DB E2E 검증은 아니다.
fixture의 최초 절대 import 해석 실패는 상대 경로로 수정 후 통과했으며 제품 build 실패로 집계하지 않는다.
fixture·log는 ignored `.local/framework-error-recovery/`에 보존했다.

계획의 변경/이탈은 없다. source 수정 없이 commit 본문 줄 길이 규칙만 보완했다. 모달/관측 공통화는
후속 단위이며 #199 Draft·F/www·운영/Worker 배포·실제 외부 전송·메일/계정·UI-03 보류를 유지한다.
