---
title: "P04 Console 관리 기능 이관 계획"
kind: migration-plan
status: active
source_commit: af801d62da89310912d393f4e69c0763f81c7958
created_at: "2026-10-07"
---

# P04 Console 관리 기능 이관

[ROADMAP P04](ROADMAP.md)의 Console entry와 기존 Admin UI/API/업로드 Action을 이관한다.
기준은 P03이 병합된 `migration_main`의 `af801d62da89310912d393f4e69c0763f81c7958`이다.
[헌법 §5](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Frontend](../../oioi-bwg-architecture-clean-v1/02-frontend-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[Runtime](../../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md)이 상위 기준이다.

## 실제 소스와 분리 단위

기준 코드의 `apps/web/src/app/(admin)/admin`, `app/api/admin`, `features/manage-*`,
`entities/album`, `entities/song`, `entities/cheer-guide`와 해당 import closure를 조사했다.
공통 service/storage/contracts는 P03 package export를 그대로 소비한다.

1. 실행 기반: Console Next 설정·로그인·별도 세션·request/HTTP/관측 adapter와 실제 UI 의존성을
   복사한다. loopback dev/start, 별도 secret/cookie, ACTIVE ADMIN 검증, app 간 import 및
   Turbo 양쪽 consumer 회귀를 함께 연결한다. 자동 탐색 설정은 앱 루트에 둔다.
2. 관리 기능: 앨범/곡 관리 화면·API·이미지 업로드 Action·LRC import·관련 entity/API를 복사한다.
   Web 경로와 기존 SQL/DTO/권한/transaction은 보존한다.
3. 편집기: 기존 가사 표·시간 캡처·강조/추가 행·offset·Undo/Redo와 route를 복사한다.
   두 origin의 standalone/PostgreSQL/Playwright 작업 완주와 세션 격리를 검증한다.

복사 이관은 앱 간 직접 의존 없이 Web 경로를 P06까지 유지하기 위한 준비다. 공용 UI/domain/
api-client package는 추가하지 않는다. 필요한 기존 파일과 그 테스트만 이관하며 UI 기반 교체는 섞지 않는다.
파일/라인 목표를 넘는 기계적 복사 단위는 의존성을 함께 유지해야 type/build 검증이 가능하다.
PR 본문에는 원본 대비 복사, 실제 변경, 회귀 검증의 리뷰 순서를 설명한다.

선행 PR이 미병합이면 후속 브랜치가 해당 변경을 포함하고 `migration_main` 대상 draft PR로
준비한다. 선행 병합 후 기준을 갱신해 다음 concern diff를 검토한다. 이번 요청에 새 PR 자동 병합은 포함하지 않는다.

## 보존 범위와 검증

- Web 관리 URL/API/Action은 P06 전까지 동작한다. Console도 기존 `/admin` 경로를 사용한다.
- runtime secret 및 기존 `.env*`를 복사하지 않는 별도 worktree에서 `pnpm verify`를 실행한다.
- Console 단독 build, 두 FSD root, 앱 alias/typed lint, 서버 package 경계, 공통 소스 변경 시
  두 앱 task hash/affected 선택과 독립 unit include를 검사한다.
- 기존 관리자 테스트를 이관하고 ACTIVE ADMIN 발급/회수와 Web cookie 거절을 추가한다.
- 실제 PostgreSQL/브라우저 회귀는 격리된 test DB fixture를 사용한다. 로컬 Docker가 불가하면
  그 제한과 CI 실행 결과를 구분하며 mock 통과만으로 실제 작업 완주를 보고하지 않는다.
- R2 업로드 credential은 사용하지 않는다. Action의 service 인가와 오류/URL 계약은 unit으로
  확인하고 실제 R2 전송은 P06 제한 환경 smoke에서 확인할 항목으로 남긴다.

MFA·등록/회수·rate limit·Origin/CSRF 강화는 P05, 공개 hostname·두 이미지 배포·Web Admin 제거는
P06에서 수행한다. CheerGuide 타입/파형/새 편집 기능/DB schema 변경은 이번 범위가 아니다.
