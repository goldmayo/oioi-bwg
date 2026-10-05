---
title: "P01 웹 워크스페이스 이동 계획"
status: "draft"
authority: "plan"
updated_at: "2026-10-05"
---

# P01 웹 워크스페이스 이동

기준은 `migration_develop`의 `10ebc91df17de95ad69c3c755fb80023ffd12be7`이며, 승인된 DESIGN/ROADMAP의 P01만 구현한다.

- `src`, `public`, `types`, Next 자동 탐색 설정을 `apps/web`으로 그대로 이동한다.
- 최소 workspace와 web package를 만들고 루트의 기존 실행 명령을 연결한다.
- 기존 검증 설정·DB migration·운영 도구는 루트에 두고 경로만 보정한다.
- standalone의 tracing root, container 진입점·자산 복사, CI cache와 개발 Compose 경로를 보정한다.
- 현재 앱의 물리적 소유 위치만 active 헌법·runtime·배포 문서에 반영한다.

완료 기준은 기존 URL과 `/admin`, asset, 환경변수, standalone/container와 검증 명령의 동작 보존이다.
앱 파일의 이동 전후 내용 비교와 기존 표준 검사, standalone 실행 및 CI container smoke로 확인한다.
로컬 Docker 접근이 없어 PostgreSQL integration 및 container 검증은 기존 CI 환경에서 확인한다.

P02의 Turbo, 공용 config와 harness 분리는 수행하지 않는다. console, Admin 분리와 packages 추출도 보류한다.
