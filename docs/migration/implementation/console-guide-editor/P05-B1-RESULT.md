---
title: "P05-B1 Console MFA 암호화와 TOTP 검증 기반 결과"
kind: migration-result
status: completed
source_commit: f741703f9c351e59798ed46aeeadebf215a2c1e7
created_at: "2026-10-10"
---

# P05-B1 결과

[계획](P05-B1-PLAN.md)의 첫 검증 단위인 암호화/TOTP 기반을 구현했다.
P05-A는 [최신 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38016975845)의 필수 job 성공 후
PR #121을 `7c65c9a`로 squash 병합했다. 위 source는 이를 기준으로 만든 B1 구현 커밋이다.

AES-256-GCM은 canonical Base64 32-byte key, v1 envelope, 무작위 nonce와 Account AAD를 사용한다.
회수 version과 암호화 format version을 분리하며 key는 인자로 받는다.
otplib `13.5.0`은 160-bit secret, 6자리 SHA-1/30초 TOTP, ±1 step 허용과 실제 검증 step을 제공한다.
`afterTimeStep`은 검증 하한일 뿐 DB 소모가 아니다. 잘못된 key/envelope/secret의 오류에 원본 cause를 담지 않는다.

- 신규 두 파일의 Vitest 직접 실행 **11/11 통과**: RFC token, 시간 경계, 재사용 하한,
  Account AAD·키 불일치, nonce/tag/ciphertext 변조, 형식 거절과 민감정보 없는 오류 검증.
- `pnpm type-check`, `pnpm test:harness`(**18건**), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(**417건**), `pnpm format:check` 모두 통과.
- Compose loopback DATABASE_URL과 `SENTRY_SOURCE_MAPS_ENABLED=false`를 명시한
  `pnpm build --env-mode=loose --force`는 Web/Console 두 앱 모두 캐시 없이 통과.
- `pnpm install --frozen-lockfile` 통과. 기존 dependency 해석을 보존하고 otplib 관련 추가만 남겼다.
  중간 lockfile 축소 시 중복 YAML로 실패했으나 수정 후 frozen install과 위 검증을 완료했다.
  실제 Node `22.16.0`에서 실행했으며 신규 crypto 의존성의 Node 최소 조건을 충족한다.
- pre-commit 자동 `eslint --fix` / `prettier --write` 통과. pre-push 자동 실행은 PR에 별도 기록한다.

B1에는 DB 쓰기·migration·env adapter가 없어 PostgreSQL 통합 검증을 실행하지 않았다.
OTP 원자 소모, 등록/confirm/로그인 및 reset·권한 변경 transaction 경합/rollback은 B2의 실제 PostgreSQL 검증 대상이다.
guarded CLI와 운영 절차는 B3, Auth.js/guard·limiter·HTTP/UI는 이후 단계다.
[P05-A의 runtime 직접 SQL 권한 한계](P05-A-RESULT.md#pr-121-리뷰-보완-2026-10-10)를 그대로 유지한다.
Web 전체 Session 회수와 P06 공개 배포/HTTPS/Web Admin 종료도 남는다. P05-B 전체 완료를 의미하지 않는다.
