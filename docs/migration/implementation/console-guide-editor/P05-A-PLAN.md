---
title: "P05-A Console MFA persistence 기반 계획"
kind: migration-plan
status: active
source_commit: 4ba46d54c6f5b3e1a65da0ae880c044ca2e16d77
created_at: "2026-10-10"
---

# P05-A 계획

[P05 설계 §3·5·8](P05-DESIGN.md), [전체 설계 §4](DESIGN.md#4-console--auth),
[ROADMAP](ROADMAP.md)의 첫 단위다. 시작 시 작업 트리는 깨끗했고 fetch한
`origin/migration_main`과 local 기준이 위 커밋으로 같았다. 그 head에서
`feature/p05a-admin-mfa-foundation`을 생성하며 기존 local/remote 동명 브랜치는 없었다.

상위 기준: [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1·29](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Server §6·10·42~43](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing §6·15](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[Domain AUTH-004~006·Account Lifecycle](../../DOMAIN_SPECIFICATION.md).

1. Auth/Domain에 등록·회수·탈퇴의 규범을 먼저 명시한다. Web 전체 Session 회수는 별도 미구현이다.
2. `admin_mfa`만 additive하게 추가한다. Account bigint PK/FK RESTRICT, nullable secret/time/step,
   version 최초 1, 양의 integer와 비음수 integer step, 상태 CHECK를 사용한다. 기존 데이터는 변환하지 않는다.
3. executor 기반 조회·pending UPSERT·조건부 reset·version 증가 repository만 추가한다.
   UPSERT RETURNING으로 실제 저장 snapshot을 반환하며 활성 secret은 덮어쓰지 않는다.
4. migration 생성 후 SQL을 검토하고 기존 guarded 격리 runner의 Compose PostgreSQL 17에 적용한다.
   CHECK/PK/FK, 실제 동시 최초 생성, pending 재사용, reset/version 보존, tx rollback을 검증한다.
5. 기본 여섯 검사와 공통 schema/package 변경을 소비하는 두 앱 build를 실행하고 결과를 기록한다.

암호화/TOTP service·CLI·Auth.js/guard·limiter·API/UI는 P05-B~D, 공개 배포는 P06이다.
정수 overflow는 DB 오류로 실패하며 version을 순환시키지 않는다. DB owner의 임의 DELETE/감소를
trigger로 금지하는 범위는 포함하지 않는다. 양의 CHECK와 승인된 repository 경로의 단조 증가를 구분한다.
완료 조건은 위 실DB 검증·기본 검사, 한글 commit/push, `migration_main` 대상 PR 생성이다.

## PR #121 리뷰 보완 (2026-10-10)

위 실행 전 계획의 DB 강제 장치 제외 범위는 owner/migrator에만 한정되지 않는다.
현재 runtime app role도 `admin_mfa`에 DELETE/UPDATE 권한을 갖기 때문에 직접 SQL의 행 삭제·
재생성·양수 범위 내 version 감소는 단조 증가 보장 대상이 아니다. 승인된 repository 경로의 보장과 구분한다.
DELETE 권한 제한과 version 변경 권한 세분화는 별도 후속 관심사로 남긴다. DELETE 제한만으로 version 감소를 막지는 못한다.
