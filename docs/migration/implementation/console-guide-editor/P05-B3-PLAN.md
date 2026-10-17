---
title: "P05-B3 Console MFA 운영 CLI 계획"
kind: migration-plan
status: active
source_commit: 0ce3877c74f8cffc0820e8329b78796c2be6faa7
created_at: "2026-10-10"
---

# P05-B3 계획

PR #123의 최신 Verify 성공 후 위 squash head를 fetch했다. 사용자 변경과 기존 동명 브랜치 없이
최신 `migration_main`에서 `feature/p05b3-console-mfa-operator`를 만들었다.
[P05 §7](P05-DESIGN.md), [Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Domain AUTH-009](../../DOMAIN_SPECIFICATION.md), [Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md), [B2 결과](P05-B2-RESULT.md)를 따른다.

`mfa-reset`/`account-access`는 accountId·기대 version(없음은 none)·사유·명시적 apply를 받으며,
access는 기대/변경 role/status도 받는다. B2 core를 호출하고 secret/사유/원본 오류는 출력하지 않는다.
사유는 pnpm 명령 echo/argv 노출을 피하도록 operator 소유·0600의 `--reason-file`로 받는다.
호출 권한은 POSIX operator UID와 그 소유의 0600 일반 설정 파일로 제한한다. symlink/hardlink를 거절한다.
대상은 loopback:5432의 local Compose DB/기존 격리 DB와 app role뿐이다. 설정에 고정한 DB 시작 시점,
실제 DB명/role/PG17/비특권을 연결 후 검사한다. ambient env·Web dotenv·production 허용 flag는 사용하지 않는다.
production host/Vault 실행 경로는 별도 승인·P06 환경 검증 전까지 닫아 둔다.

운영 절차는 기존 `ops/oci/README.md`에 기록한다. OS 파일/입력 guard와 실제 CLI process의
경합·rollback·출력 비노출을 기존 격리 PostgreSQL runner에서 검증하고 기본 여섯 검사/ops를 실행한다.
앱 runtime/build 변화는 없어 build는 추가하지 않는다. commit/push/PR까지 진행하며 새 PR은 병합하지 않는다.
