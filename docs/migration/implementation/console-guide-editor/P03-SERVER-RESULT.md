---
title: "P03 공통 서버 패키지 분리 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "feature/p03-shared-server"
  commit: "76e937c819f7ec7762b6a16ca43df7964271570a"
verified_at: "2026-10-07"
---

# P03 공통 서버 패키지 분리 결과

[P03 계획](P03-PLAN.md)의 두 번째 concern을 구현했다.
계약 선행 PR [#111](https://github.com/goldmayo/oioi-bwg/pull/111)의 `3293d68`을 포함한다.
`migration_main` 기준은 `d2b5e9e`이며 서버 PR은 #111 이후 병합할 draft다.

## 변경 범위

기존 서버 파일 35개와 unit 테스트를 `packages/server/src`로 이동했다. schema와 DB 초기화,
service의 SQL·권한·트랜잭션·DTO 동작은 유지한다. Web consumer와 mock은 명시적인 package
export를 사용해 동일 module/error identity를 유지한다. DB 전용 dependency의 소유권도 실제
consumer package로 옮겼다. Drizzle Kit schema 경로만 바꾸고 root migration 이력은 보존했다.

공통 context type/requireUser를 추출하고 `React.cache`/Auth.js session acquisition은 Web에
유지했다. HTTP response와 Next/Sentry adapter도 앱에 남는다. album service 테스트는 HTTP
assertion 대신 unexpected exception identity를 검사하며, 기존 앱 HTTP 테스트가 500 변환을
검사한다. 실제 ESLint fixture가 app/framework 의존, service→ORM/vendor 및
repository→service/AppError 참조를 거부한다. Web FSD 및 `use client` 파일도 server package
참조를 거부한다. Node subprocess에서 client 조건의 server-only 실패와 server 조건의
DB entry 로딩을 확인했다. DB URL 없이 import만 하므로 DB 연결은 발생하지 않는다.

공통 Node 설정은 상속하되 모듈 해석만 ESNext/Bundler로 override했다. Next가 TS 소스를 직접
소비하므로 emitted ESM의 `.js` 경로 규칙을 적용하지 않는다. 검증 중 발견한 Turbopack의
`.js`→`.ts` 해석 실패를 수정했으며 이후 전체 verify를 통과했다. 별도 library build는 없다.
Next/Docker workspace manifest와 owning architecture, AGENTS 요약 경로를 함께 갱신했다.

## 실행한 검증

사용자 앱 환경 파일이 없는 별도 worktree에서 검증했다. 검증 snapshot과 최종 코드 커밋의
92개 변경 파일이 일치한다. 외부 DB나 운영 credential은 사용하지 않았다.

| 명령/검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 성공 |
| `SENTRY_SOURCE_MAPS_ENABLED=false NEXT_PUBLIC_APP_ENV=staging pnpm verify` (DB/Auth/Sentry token 미설정) | 성공 |
| contracts unit | 1개 파일 / 3개 성공 |
| server unit | 15개 파일 / 77개 성공 |
| Web unit | 41개 파일 / 160개 성공 |
| architecture harness | 17개 성공 |
| ops | 4개 파일 / 51개 성공 |
| workspace/root type-check·ESLint, Web Steiger, format | 성공 |
| Next production build | 성공 |
| 동일 환경 `pnpm exec turbo run type-check lint test` 재실행 | 9/9 cache hit |
| `node tests/ops/web-standalone-smoke.mjs http://127.0.0.1:3103` | health·public asset·admin auth·user URL·브라우저 JS/CSS 성공 |

standalone 앱은 DB URL 없이 로컬 테스트 전용 Auth secret으로 실행하고 smoke 후 종료했다.
공통 mocks/contracts/server source만 바꾸는 격리 fixture에서 Web type-check/lint/test/build의
affected 선택과 hash 변경을 검사한다. 기존 240개 unit의 책임을 contracts 3개, server 77개,
Web 160개로 유지했다.

로컬 Docker가 없어 실제 PostgreSQL integration과 Docker container 실행은 로컬 검증에
포함하지 않았다. 기존 CI gate는 유지했고 서버 PR의 최종 CI 결과는 해당 head의 checks를
기준으로 확인한다. 선행 계약 PR의 CI는 [run 37486285118](https://github.com/goldmayo/oioi-bwg/actions/runs/37486285118)에서
quality/unit/infra/PostgreSQL integration/build/verify가 성공했다. 이 결과는 서버 PR 자체의
PostgreSQL/container 검증을 대신하지 않는다.

## 첫 서버 CI 검토 후 보완

`58244da`의 [run 37487960002](https://github.com/goldmayo/oioi-bwg/actions/runs/37487960002)에서
quality/unit/infra/Docker build와 container smoke는 성공했지만 PostgreSQL integration의 suite
로딩이 `@oioi-bwg/server/auth/ability`를 찾지 못했다. 루트가 직접 실행하는 테스트의 workspace
package 의존성 선언이 빠져 있었다. `76e937c`에서 root devDependencies에 contracts/server를
명시했고 frozen install과 전체 verify를 다시 통과했다. Node boundary harness도 source 절대
경로 대신 실제 package export를 import해 root resolution 및 server-only를 함께 검사한다.
위 검증 표와 source ref는 이 보완 이후의 최종 코드 기준이다. CI의 실제 PostgreSQL 결과는
수정된 PR head의 checks로 확인한다.

## 완료 범위와 보류

P03 계약·서버 추출 구현과 로컬 검증은 완료했다. PR은 #111 → 서버 PR 순서로 병합한다.
Console 앱/인증, MFA, UI 이관과 두 앱 배포는 후속 checkpoint에 남는다. 자동 병합이나
Promotion/OCI 배포는 수행하지 않았다.
