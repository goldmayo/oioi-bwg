---
title: "P04-A Console 실행과 세션 기반 결과"
kind: migration-result
status: completed
verified_source:
  repository: goldmayo/oioi-bwg
  branch: feature/p04-console-migration
  commit: aae4811eb14d600ea88652ef08d5adaac95362b6
verified_at: "2026-10-07"
---

# Console 실행과 세션 기반

[P04 계획](P04-PLAN.md)의 첫 concern을 구현했다. Console의 로그인·관리 shell과 request/HTTP/
관측 adapter는 앱 내부에 복사했고 공통 contracts/server export를 소비한다. ACTIVE ADMIN만
identity를 발급하며 요청마다 role/status를 재검사한다. 전용 secret/cookie와 loopback 실행 계약을
추가했다. 공개/MFA 인증은 Auth §4.1의 후속 단계다.

Console의 lint/Steiger/type/unit/standalone 설정과 root workspace 검증을 연결했다.
공통 ESLint 검사 primitive를 harness로 옮기고 두 앱의 정책은 각각 유지했다.
상대 경로·package·dynamic 앱 import 거부, 두 cwd의 typed lint와 공통 소스 변경 시 두 앱
Turbo affected/hash 회귀를 검사한다. Docker의 manifest 입력만 추가했으며 배포 대상은 Web이다.

## 실제 검증

사용자 `.env*`를 복사하지 않은 `/tmp/oioi-p04-check`에서 다음을 실행했다.

- `pnpm install --frozen-lockfile`: 통과. 기존 dependency resolution은 유지했다.
- `pnpm verify`: type/lint/두 Steiger/unit/harness/ops/format/두 production build 통과.
  Console 15파일 75테스트, Web 41파일 160테스트, server 15파일 77테스트,
  contracts 1파일 3테스트, harness 18개, ops 4파일 51테스트 통과.
- 추가한 smoke script의 Node ESLint와 최종 format 검사: 통과.
- test-only secret으로 각각 loopback standalone 실행 후
  `node tests/ops/console-standalone-smoke.mjs http://127.0.0.1:3104`,
  `node tests/ops/web-standalone-smoke.mjs http://127.0.0.1:3105`: 통과.
  Console cookie/CSRF·로그인 redirect·폼 hydration, Web 기존 URL/asset/API 401을 확인했다.
- Console 로그인 화면 캡처: `/tmp/p04-console-login.png` (로컬 검증 산출물).

첫 검사에서 Console Steiger의 앱 config 상대 경로가 root 기준이어서 shared public API 오탐이
발생했다. 앱 cwd와 `./src` 기준으로 보정한 뒤 전체 검증을 다시 통과했다.
소스 커밋의 변경 파일과 검증 worktree의 최종 파일 내용이 같음을 비교했다.

## 남은 작업

관리 화면/API는 P04-B, 가사 편집기/두 origin의 실제 PostgreSQL 작업 완주는 P04-C다.
현재 WSL의 Docker daemon을 사용할 수 없어 로컬 Docker/PostgreSQL 통합은 실행하지 않았다.
Console 공개 배포·MFA·Web 관리 경로 제거는 P05/P06의 범위다.
PR: [#113](https://github.com/goldmayo/oioi-bwg/pull/113). 최초 push의 자동 hook이
affected type/lint/unit와 root type/lint/harness/ops/format을 실행했고 모두 통과했다.
