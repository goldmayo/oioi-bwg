---
title: "P04 이관 코드 리뷰 3건 보완 계획"
kind: migration-plan
status: active
source_commit: 3d8fe31aa1007263f299cf431e01dc9ee983f01c
created_at: "2026-10-10"
---

# P04 리뷰 보완

[P04 결과](P04-C-RESULT.md) 이후 받은 세 지적을 검증하고 각각 별도 PR로 수정한다.
기준은 `migration_main`의 위 SHA다. 조회 시 #116은 404였으며 새 리뷰 보완 PR을 생성한다.
[헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Form §5.1](../../oioi-bwg-architecture-clean-v1/08-form-state-architecture.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Error UX §6–7](../../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)을 따른다.

1. 두 앱의 앨범/곡 폼: 저장·취소 후 같은 항목을 다시 열 때 최신 DTO로 새 편집 세션을 만든다.
   열린 dirty form은 background DTO 갱신으로 덮어쓰지 않는다.
2. 두 앱의 영상 감시: player/target 교체 시 길이와 광고 판정을 새로 시작하고 ticker를 정리한다.
   광고 감지는 기존 ID/길이 heuristic을 유지한다. 실제 광고 감지 정확도를 새로 보장하지 않는다.
3. Console의 401: ability를 갱신하고 재인증을 안내한다. 이미 열린 폼/편집기는 마운트를 유지해
   초안을 보존하며 재인증 전에는 저장을 막는다. 새 탭 로그인 후 명시적으로 상태를 확인한다.

각 지적의 수정 전 실패와 수정 후 통과를 기록한다. runtime credential과 사용자 `.env*`가 없는
별도 worktree에서 기본 검증과 두 앱 build를 수행한다. 실제 DB/브라우저 회귀는 기존 guarded
PostgreSQL runner와 CI에 연결하고 외부 YouTube만 결정적 fixture로 격리한다.
DB/HTTP 계약, MFA, 배포, Web 관리 경로 제거는 변경하지 않는다. 작업 요청은 PR 생성까지이며
병합은 포함하지 않는다. 결과와 정확한 검증 source는 별도 `P04-REVIEW-RESULT.md`에 기록한다.
