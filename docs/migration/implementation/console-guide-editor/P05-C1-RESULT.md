---
title: "P05-C1 Console MFA 세션과 guard 결과"
kind: migration-result
status: completed
source_commit: d6fbe510799f326b863e39f188f6a63fbfdac9c1
created_at: "2026-10-10"
---

# P05-C1 결과

[계획](P05-C1-PLAN.md)의 구현·검증 source는 위 커밋이다. PR #124의 최신
[Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38027003664) 성공과 사용자 승인 후
`9829b1b`로 squash 병합하고 최신 `migration_main`에서 분기했다. 사용자 변경은 없었다.

Credentials는 6자리 OTP까지 Zod 검증하고 B2 원자 소모 core의 identity만 반환한다.
runtime key는 Console server adapter에서 읽어 전달하며 auth secret의 재사용을 거절한다.
JWT application claims는 sub/proof/version뿐이다. 후속 callback은 client session.update를 읽지 않고
기존 증명을 보존하며, Session user에 proof/version을 전달한다. Auth.js의 8시간 만료 계약을 유지했다.
guard는 양의 정수 MFA version과 활성 MFA/ACTIVE ADMIN을 Account/MFA 단일 join으로 비교한다.
조회 projection에는 secret이 없고 실패는 guest → 기존 보호 API의 401로 이어진다.
설치 `next-auth@5.0.0-beta.32`/`@auth/core@0.41.3`의 callback/session 소스와
[공식 callback 계약](https://authjs.dev/reference/core#callbacks)을 확인했다.

- `pnpm type-check`, `pnpm test:harness`(**18건**), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(**423건**), `pnpm format:check` 통과. 최초 단위 실행은 전체 cache 없이,
  key 재사용 거절 보완 후 최종 실행은 Console 162건 재실행/나머지 세 workspace cache였다.
  초기 타입 검사는 claims narrowing 및 NodeNext와 fixture의 source import 경계 문제로 실패했고,
  unknown proof의 교차 타입 검증과 기존 CLI처럼 Bundler 검사하는 `.ts` fixture로 보완한 뒤 통과했다.
- fixture 별도 검사: `pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --esModuleInterop --types node tests/ops/console-mfa-fixture.ts` 통과.
- `pnpm test:ops` **54/54**, `pnpm test:integration:postgres:local` **33/33** 통과.
- Compose loopback DATABASE_URL과 `SENTRY_SOURCE_MAPS_ENABLED=false`를 명시한
  `pnpm build --env-mode=loose --force`: 두 앱 모두 cache 없이 통과.
- `pnpm test:integration:admin:local`: 두 standalone 앱/실제 Auth.js/PostgreSQL/브라우저 smoke 통과.
  Console만 B2 setup/confirm fixture와 실제 callback 로그인으로 전환하고 Web password 로그인을 유지했다.
  password-only JWT/OTP 누락/미등록 ADMIN/USER/정지/만료/다른 앱 cookie 거절, 최소 JWT claims와 8시간 만료,
  client update로 identity/version 변경 및 password-only 승격 불가, 실제 OTP replay 세션 미발급을 확인했다.
  CLI 강등·재승격/정지·복귀/reset 각각의 **변경 전 유효 JWT 200 → 회수 후 401**과 새 OTP 재로그인을 검증했다.
  reset 재등록 후에도 옛 JWT는 거절됐고, editor 401의 초안 보존·별도 탭 로그인 후 저장 재개와 두 앱 CRUD도 통과했다.
  두 앱 runtime 로그에 fixture password/OTP/secret/key가 없는지 확인했다. 두 admin smoke 실행 모두 성공했고,
  모든 PostgreSQL runner의 임시 DB/role 정리 및 잔여 connection/advisory lock은 0이었다.
- pre-commit 자동 eslint/prettier 통과. pre-push 결과는 PR에 직접 검사와 분리해 기록한다.

C1은 C 전체 완료가 아니다. **C2 limiter·Origin/CSRF와 실제 Action/직접 callback 제한 계약 검증**은 남는다.
일반 로그인/등록 UI·endpoint·QR은 D이며 현재 password-only 폼으로 Console 로그인할 수 없는 중간 상태다.
loopback 접근 제한을 유지하며 공개하지 않는다. HTTPS/proxy IP·키 복구/교체·image/production smoke·Web Admin 종료는 P06,
Web 전체 Session 회수와 탈퇴 개인정보 제거 service는 기존 보류다. production DB/credential·운영 seed·새 migration은 없다.
