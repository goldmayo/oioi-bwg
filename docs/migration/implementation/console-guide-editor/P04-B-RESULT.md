---
title: "P04-B Console 앨범과 곡 관리 이관 결과"
kind: migration-result
status: completed
verified_source:
  repository: goldmayo/oioi-bwg
  branch: feature/p04-console-management
  commit: cb042eaa13a3329dfd3b76c5e9a19f1d0fe6fa3b
verified_at: "2026-10-07"
---

# 앨범과 곡 관리 이관

[P04 계획](P04-PLAN.md)의 두 번째 concern이다. [P04-A](P04-A-RESULT.md)를 포함하는
후속 브랜치이며, Web 원본의 앨범/곡 관리 route·API·이미지 업로드 Action·LRC file import와
실제 entity/UI 의존성 및 테스트를 Console에 복사했다. 관리 entry는 `/admin/albums`로 이동한다.

55파일은 기존 import closure의 기계적 복사와 entry redirect다. SQL/DTO/CASL/transaction,
R2 provider와 Web 파일은 변경하지 않았다. 원본 대비 복사 → route·API·Action 연결 →
단위 회귀의 순서로 검토한다. 편집 route와 lyrics API는 P04-C에서 연결한다.

## 실제 검증

사용자 환경변수가 없는 기존 검증 worktree에 B patch를 적용했다.

- `pnpm --filter @oioi-bwg/console type-check`: 통과.
- `pnpm verify`: type/lint/두 Steiger/unit/harness/ops/format/두 build 통과.
  Console 26파일 117테스트, Web 160테스트, server 77테스트, contracts 3테스트,
  harness 18개, ops 51개 통과. 변경이 없는 Web build는 Turbo cache를 사용했다.
- test-only Console standalone에서 기존 Console Playwright smoke 통과.
- `/api/admin/albums`, `/api/admin/songs`의 비로그인 GET이 DB 접근 전에
  `401 UNAUTHENTICATED`로 거절됨을 실제 HTTP로 확인했다.

업로드 Action의 인가·safe failure·URL 전달은 이관된 unit으로 검증했다. 실제 R2 전송은 하지
않았고 P06의 접근 제한 smoke 항목으로 남긴다. 현재 WSL에서 `docker version`은 Docker 사용
불가를 반환했다. 실제 PostgreSQL 로그인·관리·편집 작업 완주는 P04-C CI에서 검증한다.

PR 대상은 `migration_main`이며 선행 #113 미병합 동안 draft로 준비한다. 결과 PR 링크와
자동 pre-push hook 실행 결과는 PR 본문에 기록한다. 공개/MFA/배포 전환은 P05/P06 범위다.
