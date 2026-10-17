---
title: "P04-C Console 편집기와 관리 작업 통합 검증 결과"
kind: migration-result
status: completed
verified_source:
  repository: goldmayo/oioi-bwg
  branch: feature/p04-console-editor
  commit: ece791cebfac02a1c0d93e26e3fca5b63548b6d3
verified_at: "2026-10-07"
---

# Console 편집기와 P04 통합 검증

[P04 계획](P04-PLAN.md)의 마지막 concern이다. [실행 기반](P04-A-RESULT.md),
[관리 화면/API](P04-B-RESULT.md)를 포함하는 브랜치에 기존 편집기와 lyrics API를 연결했다.
Web 구현과 공통 contracts/server, DB schema/migration은 변경하지 않았다.
LRC·행/전체 offset·캡처/녹화·강조/추임새·Undo/Redo·저장 payload와 기존 테스트를 보존했다.

Console에서 가사 변환은 편집기 한 feature만 소비하므로 Web의 entity barrel 전체를 복사하지
않고 `features/manage-lyrics/lib`에 함수와 기존 테스트를 배치했다. DTO type은 공통 contracts를
직접 소비한다. 실제 media consumer를 위한 기존 GSAP dependency resolution만 연결했다.

## 로컬 검증

사용자 `.env*`가 없는 `/tmp/oioi-p04-check`에서 검증했다. 마지막 테스트 코드 보정까지
반영한 staged tree `6bb7b78a3b4a7a3d4d5aa091eca48ab846d98406`이 위 source의 tree와 동일함을 확인했다.

- `pnpm install --frozen-lockfile`, `pnpm verify`: 통과. 최종 전체 로컬 검증은 `143173e`에서
  수행했으며, 이후 `ece791c`는 통합 테스트의 Node fetch 응답 접근 한 줄만 보정했다.
  Console 32파일 140테스트, Web 41파일 160테스트, server 77테스트, contracts 3테스트,
  harness 18개, ops 51개 통과. 두 앱 type/lint/Steiger/production build 성공.
- test-only Console standalone의 Playwright 로그인/cookie/redirect smoke 통과.
- 실제 lyrics PATCH의 비로그인 요청이 DB 접근 전에 `401 UNAUTHENTICATED`로 거절됨을 확인했다.
- `node --check tests/ops/admin-migration-smoke.mjs`: 통과.
- `env -u M7_TEST_POSTGRES_ADMIN_URL pnpm test:integration:admin`: 명시적 test admin URL이
  없으면 DB 접근 전에 exit 1로 거절됨을 확인했다. 실제 통합 테스트 통과 결과는 아니다.
- pre-push 자동 hook: affected type/lint/unit와 root type/lint/harness/ops/format 통과.

로컬 WSL Docker는 사용할 수 없어 실제 PostgreSQL 작업 완주는 아래 CI에서 수행했다.

## 실제 PostgreSQL/브라우저 CI

위 source의 [CI 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/37498828297)에서
전체 `quality`, `unit`, `PostgreSQL integration`, `infra`, `build`, `Admin migration integration`,
필수 `verify`가 모두 통과했다. 두 앱 production build와 Web container/Console standalone smoke도 성공했다. PostgreSQL 17에서 migration 5개 적용 후 재실행 0개를
확인했고, Web과 Console의 각 작업 완주 및 세션/권한 검증이 모두 성공했다.
마지막 cleanup은 연결 0개·advisory lock 0개, 격리 DB 제거를 확인했다.
[화면/실행 로그 artifact](https://github.com/goldmayo/oioi-bwg/actions/runs/37498828297/artifacts/11429500363)의
`web-editor.png`, `console-editor.png`와 두 앱 로그를 내려받아 확인했다.
외부 영상을 fixture로 대체하므로 영상 영역은 비어 있는 캡처다.

초기 CI에서 검증 fixture의 레거시 `"Song"` 식별자 인용 누락을 발견했고 `143173e`로
보정했다. 다음 실행은 Web 저장·reload·DB 내용 검증까지 진행했으나 Node fetch의 `ok` 속성을
Playwright response의 `ok()`처럼 호출하여 실패했다. `ece791c`에서 호출을 보정했다.
두 실패 모두 격리 DB cleanup의 연결/잠금 0과 DB 제거를 확인했다. 앱/DB schema를 바꾸지 않았다.

기존 guarded runner의 localhost PostgreSQL 17 격리 DB 생성·migration·runtime role·cleanup을
재사용하고, 결정적 ADMIN/USER/SUSPENDED fixture를 해당 DB에만 만들었다.
앱/API/Auth.js/PostgreSQL은 실제 실행하며 외부 YouTube만 deterministic provider fixture다.
실제 영상 재생/광고/음성은 이 검증의 대상이 아니다.

두 standalone origin에서 로그인 → 앨범/곡 생성·수정 → LRC file upload → 편집기 LRC import →
offset·Undo/Redo·시간 캡처 → 저장·reload → Web 공개 DTO 조회 → 곡/앨범 삭제를 검증했다.
다른 앱의 session cookie 이름까지 바꿔 보내도 거절되며, Console USER/SUSPENDED 로그인 거절과
DB role 회수의 다음 요청 반영을 확인했다. CI의 필수 `verify`는 이 admin integration job도 요구한다.

## PR과 후속 조건

- [#113 실행 기반](https://github.com/goldmayo/oioi-bwg/pull/113): 코드 `aae4811`,
  결과 `82e5e04`, PR/자동 검증 기록 `c52a06a`, 앱별 Next ESLint root 범위 보정 `1b4db8b`.
  기존 실제 ESLint 설정 회귀 검증에 두 앱의 effective root 확인을 추가했다.
  [보완 후 CI](https://github.com/goldmayo/oioi-bwg/actions/runs/37497212378) 통과.
- [#114 관리 UI/API](https://github.com/goldmayo/oioi-bwg/pull/114): 코드 `cb042ea`, 결과 `b2d7bb5`, 선행 보완 병합 `d806a14`.
  [보완 후 CI](https://github.com/goldmayo/oioi-bwg/actions/runs/37497386479) 통과.
- [#115 편집기/통합 검증](https://github.com/goldmayo/oioi-bwg/pull/115): 편집기/통합 검증 `b73dab8`,
  선행 보완 병합 `c1be5ea`, fixture 보정 `143173e`와 `ece791c`. 검증 source는 위 full SHA다.

병합 순서는 #113 → #114 → #115이며, 선행 PR 병합 후 후속 브랜치의 기준과 concern diff를
갱신해야 한다. 구현 요청으로 PR을 자동 병합하지 않았다.
MFA/회수/limiter/Origin·CSRF 강화는 P05, 두 앱 이미지·공개 hostname·Web 관리 경로 제거는 P06이다.
실제 R2 object 전송과 실제 YouTube media smoke는 P06의 접근 제한 환경에서 확인한다.
