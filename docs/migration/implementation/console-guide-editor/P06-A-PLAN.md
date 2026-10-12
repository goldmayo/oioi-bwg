---
title: "P06-A 두 앱 runtime 이미지 검증 계획"
kind: migration-plan
status: active
authority: plan
source_commit: 699b41a15a84af5adc2c05eda70e1ac0007ea1cd
created_at: "2026-10-12"
updated_at: "2026-10-12"
revision: 1
---

# P06-A 두 앱 이미지

[P06 계획](P06-PLAN.md#4-pr별-구현-순서와-완료-조건)의 A만 구현한다.
기준은 [Runtime §11](../../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md),
[배포 §17](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)이다.

- 최신 merge head에서 분기하고 사용자 env·문서 수정·기존 PostgreSQL 볼륨은 보존한다.
- 같은 builder의 Web `runner`를 유지하고 Console `runner-console`을 추가한다.
- Console public 디렉터리는 현재 없으므로 builder에서 빈 경로를 준비하고 향후 실제 파일도 복사한다.
- 일반 CI는 두 amd64 이미지를 archive/restore하여 각각 native Argon2, DB readiness,
  실제 브라우저·static asset·인가 거절을 검사한다. runtime secret 없이 build한다.
- Console readiness는 loopback origin·전용 서명 키·MFA 키 형식과 `select 1`을 확인한다.
  설정/DB 실패는 no-store 503과 고정 payload로 처리하고 MFA 상태를 변경하지 않는다.
- `.local/`은 build context에서 제외한다. 개발 bind mount 격리는 별도 ENV-2 범위다.

AGENTS 기본 여섯 검사, ops, 두 앱 build와 실제 두 Docker runtime을 검증한다.
DB는 기존 Compose PostgreSQL과 격리 runner만 사용한다. OCI ARM64 게시·IAM 변경·VM 배포,
HTTPS·운영 키·Web 관리 종료는 B0 이후다. ENV-1은 독립 PR, ENV-2는 착수 조건이 아니다.
