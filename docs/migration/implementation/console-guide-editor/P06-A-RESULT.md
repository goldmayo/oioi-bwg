---
title: "P06-A 두 앱 runtime 이미지 검증 결과"
kind: migration-result
status: complete
source_commit: 434a685e2ad15e924d471491495f68fa5ed88905
verified_at: "2026-10-12"
updated_at: "2026-10-13"
revision: 2
---

# P06-A 결과

[계획](P06-A-PLAN.md)을 [PR #134](https://github.com/goldmayo/oioi-bwg/pull/134)로 구현했다.
기준 코드 commit은 위 source_commit이다. Web runner를 유지하고 Console runner-console,
인증 설정/DB readiness, 두 실제 이미지 CI artifact/smoke를 추가했다. Console public은 현재
빈 경로이며 Web public과 각 앱 static/server 경로를 검증했다. OCI 배포 계약은 변경하지 않았다.

| 검증 | 실제 결과 |
| --- | --- |
| 직접 기본 검사 | type-check, harness 18건, lint, FSD, unit, format 통과. Console 신규 readiness 7건 포함 |
| 직접 ops / build | ops 70건, runtime secret 없는 두 앱 pnpm build 통과 |
| Compose PostgreSQL 17 | 기존 격리 runner 33건 통과, 임시 DB 삭제·잔여 연결/lock 0 |
| 실제 admin 통합 | PNG QR·MFA 등록/로그인/회수·두 앱 CRUD 회귀 통과, 임시 DB 정리 |
| GitHub CI | [Verify 38263561625](https://github.com/goldmayo/oioi-bwg/actions/runs/38263561625) 전체 성공. 동일 run의 두 amd64 image archive/restore 후 native Argon2·DB readiness·브라우저/static smoke 성공 |
| 로컬 Docker | amd64 Console 직접 build와 해당 CI Web image 복원으로 두 non-root runtime의 native·readiness·브라우저 smoke 확인. 설정 없는 Console은 liveness 200/readiness no-store 503 |

첫 host build는 worktree 밖 dependency symlink로 실패하여 frozen offline 독립 설치 후 재검증했다.
첫 Compose 시작은 새 worktree project의 5432 충돌로 실패했다. 생성한 빈 리소스만 정리하고
기존 Compose DB에 격리 runner를 직접 실행했다. Web 첫 smoke는 시작 직후 연결 실패였고
liveness 확인 후 재검증했다. 기존 개인 env·DB 볼륨·MFA 키·사용자 문서 변경은 보존했다.

commit hook의 lint-staged와 push hook의 affected type-check/lint/test·repo 검사·harness/ops/format은
직접 검사와 별도로 실행돼 통과했다. 이 결과는 기록 변경 commit의 새 CI까지 대신하지 않는다.
ENV-1은 독립 PR, ENV-2는 비차단 후속이다. B0 IAM/metadata·ARM64 게시·VM/HTTPS·Web 관리 종료는
미실행이다. 다음 진입점과 운영 실행 gate는 [P06-HANDOFF](P06-HANDOFF.md)에 유지한다.

2026-10-13 상태 재확인: #134는 Open·리뷰 기록 없음이며, 기록 commit
`1c3bff1c3f72cf273de646fabd79b8dcec7baa30`의 [Verify 38265204560](https://github.com/goldmayo/oioi-bwg/actions/runs/38265204560)은
attempt 2에서 전체 성공했다. 이전 세션의 attempt 1 Terraform OCI provider 다운로드 HTTP 500은
실패 job 재실행으로 해소됐으며 코드 결함으로 분류하지 않았다. 위 source_commit의 직접 검증을
이번 세션에 반복한 결과가 아니다. 이 상태 기록 이후 commit의 CI는 PR에서 별도로 확인한다.
