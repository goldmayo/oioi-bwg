---
title: "P05-B3 Console MFA 운영 CLI 결과"
kind: migration-result
status: completed
source_commit: 9a8c205b448cef726bd44dc1ceda715896ad1f9c
created_at: "2026-10-10"
---

# P05-B3 결과

[계획](P05-B3-PLAN.md)의 CLI 구현·검증 source는 위 커밋이다. PR #123은 최신
[Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38022360536) 성공 후 `0ce3877`로 병합했고,
사용자 변경 없는 최신 `migration_main`에서 분기했다.

`pnpm console:mfa`의 `mfa-reset`/`account-access`는 명시적 대상·기대값·apply를 검사하고
B2 회수 service를 호출한다. operator UID/소유·0600·단일 일반 설정/사유 파일과 loopback URL,
실제 DB명/app role/PG17/시작 epoch/비특권·비owner를 검증한 뒤 변경한다. ambient DATABASE_URL을 쓰지 않는다.
사유는 pnpm echo/argv에 원문이 남지 않도록 `--reason-file`로 받는다. 성공/실패 출력은 대상과
전후 version/role/status 및 고정 실패 코드로 제한한다. [운영 절차](../../../../ops/oci/README.md)에 등록했다.

- `pnpm test:integration:postgres:local` **33/33 통과**(기존 30 + CLI 3).
  실제 두 CLI process의 Account lock 대기를 관찰한 뒤 reset 한 건 성공/한 건 stale 거절,
  행 없음 최초 생성/기대값 거절, 강등·재승격·정지·복귀, 실제 integer overflow의 Account/MFA rollback,
  잘못된 DB fingerprint의 쓰기 전 거절과 출력 비노출을 검증했다. 임시 DB/role 정리와 잔여 connection/advisory lock 0.
  초기 강화 검증은 transactionid lock만 집계해 1건 실패했고, tuple 대기도 집계한 최종 두 실행은 모두 통과했다.
- `pnpm test:ops` **54/54 통과**(신규 입력·파일 권한·대상 URL 정책 3).
- `pnpm type-check`, `pnpm test:harness`(**18건**), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(**417건의 Turbo cache 결과**), `pnpm format:check` 통과.
  CLI 두 파일은 추가로 `pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --esModuleInterop --types node scripts/console-mfa-operator.ts scripts/console-mfa-operator-policy.ts` 통과.
  앱 runtime/build 변경이 없어 build는 실행하지 않았다.
- pre-commit 자동 eslint/prettier 통과. 첫 commit-msg 검사는 본문 100자 제한으로 거절되어 줄을 나눈 뒤 통과했다.
  pre-push 자동 검증 결과는 PR에 직접 실행 검사와 분리해 기록한다.

production DB/credential·운영 seed·schema 변경은 없다. CLI는 **local Compose/격리 검증 전용**이며
production host/Vault 경로의 개방·guard/smoke는 별도 승인과 P06 검증까지 보류한다.
C/D의 Auth.js/JWT 거절·등록 QR 전용 secret 취급·Origin/limiter·HTTP/UI는 아직 구현하지 않았다.
Web 전체 Session 회수와 탈퇴 개인정보 제거 service는 완료하지 않았고, 탈퇴 secret 제거/tombstone 정책과
[runtime 직접 SQL 우회 한계](P05-A-RESULT.md#pr-121-리뷰-보완-2026-10-10)는 유지한다.
