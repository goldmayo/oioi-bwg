---
title: "P04 이관 코드 리뷰 3건 보완 결과"
kind: migration-result
status: active
source_commit: 5911455df82e8737ed1a38cf9b7f28e3b93c9da5
verified_source:
  repository: goldmayo/oioi-bwg
  branch: feature/p04-review-auth-draft
  commit: 5911455df82e8737ed1a38cf9b7f28e3b93c9da5
verified_at: "2026-10-10"
---

# P04 리뷰 보완 결과

[계획](P04-REVIEW-PLAN.md)의 세 지적을 `migration_main`의
`3d8fe31aa1007263f299cf431e01dc9ee983f01c`에서 모두 확인하고 수정했다.
기존 P04 이관 결과는 당시 검증 기록으로 유지한다.

| 지적                   | 수정 전 재현                                                        | 수정 및 PR                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 두 앱 앨범/곡 재편집값 | 각 앱에서 최신 DTO 재편집·취소 초안 초기화 4건 실패                 | 명시적인 열기/닫기마다 RHF 편집 세션 생성. 열린 dirty form은 DTO 재조회로 덮어쓰지 않음. [#116](https://github.com/goldmayo/oioi-bwg/pull/116), `1b4e68c11f7ee91e33a7fd60ef125f0a8c6e9592`    |
| 두 앱 영상 교체        | 각 앱에서 120→240초 정상 영상의 광고 판정과 ticker 중복 등 3건 실패 | player/ID별 길이와 상태 초기화, effect 정리에서 해당 ticker 제거. [#117](https://github.com/goldmayo/oioi-bwg/pull/117), `efe740b0123f9a54083c2b2533d27ab07b55b64d`                           |
| Console 401            | ability 재조회 기대 테스트 1건 실패                                 | 즉시 능력 캐시 비우기 및 재조회, 새 탭 재인증 안내, 명시적 권한 재확인. 열린 폼/편집기는 초안을 유지하고 저장 차단. [#118](https://github.com/goldmayo/oioi-bwg/pull/118), 구현 `54ad0b6edfdcf0fa45ccd910f8c0156e95f227b3` 및 검증 fixture 수정 `aa4cc2461bd2b996085519df4d850d7d81ae9baa`, 최종 보완은 위 verified source |

재현 테스트는 실제 RHF/Query 로직을 실행하고 HTTP 또는 YouTube player를 격리했다.
최종 Console의 다섯 관련 테스트 파일은 20건 통과했다. 두 앱 영상 회귀는 각각 4건 통과했다.
`@gsap/react`의 설치 코드와 [공식 설명](https://github.com/greensock/react/blob/main/README.md)을
확인했으며, 애니메이션 context가 필요 없는 ticker 등록은 일반 effect가 수명을 소유한다.

사용자 환경 파일과 runtime credential이 없는 별도 worktree에서 `pnpm verify`가 통과했다.
단위 테스트 합계 406건(Console 156, Web 170, server 77, contracts 3), 구조 harness 18건,
ops 51건 및 type-check·lint·FSD·format과 두 앱 build 결과를 확인했다. 마지막 검증에서는
Web build와 일부 Turbo task가 직전 동일 소스의 캐시를 사용했고 변경된 Console build는
실행했다. 이전 폼·영상 검증에서는 두 앱 build를 실행했다. 최종 검증의 tree
`28b419eeefaf637300ea8c42ac702416cbe07e0b`가 위 최종 code commit의 tree와 일치한다.
각 코드 push hook도 affected type/lint/unit와 root type/lint/harness/ops/format을 실행해 통과했다.
로컬에는 Docker가 없어 PostgreSQL·브라우저 통합 실행은 CI에서 확인했다.

CI의 [폼 수정 전체 검증](https://github.com/goldmayo/oioi-bwg/actions/runs/37963802792)
(source `1b4e68c11f7ee91e33a7fd60ef125f0a8c6e9592`)과
[영상 수정 전체 검증](https://github.com/goldmayo/oioi-bwg/actions/runs/37965784272)
(source `efe740b0123f9a54083c2b2533d27ab07b55b64d`)이 통과했다.
최종 source의 [관리자 브라우저 job](https://github.com/goldmayo/oioi-bwg/actions/runs/37968491626/job/113948786049),
[PostgreSQL job](https://github.com/goldmayo/oioi-bwg/actions/runs/37968491626/job/113948785904),
unit·quality job도 통과했다. Node 22.16.0, pnpm 10.15.1, PostgreSQL 17의 격리 DB와
두 앱 standalone 서버에서 실제 Auth·API·Playwright를 사용했다. 외부 YouTube만 fixture다.

두 앱 앨범/곡 저장 후 같은 항목 재편집, 120→240초 영상 교체 후 00:08.50 SYNC 및 DB 저장,
공개 Web 조회가 통과했다. Console은 역할 회수 → 저장 401 → DB 변경 없음/초안 유지/저장
비활성 → 새 탭에서 실제 재로그인 → 원래 탭의 권한 확인 → 같은 초안 저장까지 통과했다.
기존 전용 secret/cookie 분리, non-admin/inactive 차단, CRUD도 통과했고 DB는 연결 0개·
advisory lock 0개 확인 후 제거했다. [최종 스크린샷 artifact](https://github.com/goldmayo/oioi-bwg/actions/runs/37968491626/artifacts/11633609835)에
두 앱 재편집·편집기 및 `console-reauthentication-required.png`,
`console-reauthenticated-editor.png`가 있다.

첫 재인증 CI의 추가 fixture SQL이 실제 `account`/`password_credential` 대신 잘못된
테이블을 참조해 실패했다. 위 fixture 수정 커밋에서 기존 검증과 같은 lookup으로 고쳤다.
수정 후 `node --check`와 ops 51건, push hook 검증이 통과했다. 이후 실제 새 탭 로그인
검증에서 초기 입력값이 사라지는 hydration 문제를 관찰했다. 최종 보완에서 Console 로그인
입력·제출을 hydration 후 허용하고 SSR/hydrateRoot 회귀 테스트의 실패→통과를 확인했다.
[Playwright 공식 안내](https://playwright.dev/docs/navigations#hydration)를 확인했고 새 탭의
초기 URL 로드도 기다린다. 또한 CI 이미지로 확인한 미리보기 높이 축소는 fieldset의 기존
전체 높이를 복구해 보완했다. Web 로그인 폼은 별도 관심사로 남긴다.

계획과의 동작 차이는 없다. Console auth 수정 자체는 코드 17파일·520줄로 PR 목표 400줄을
넘었으며, 캐시 갱신과 세 화면의 마운트 유지·저장 차단을 함께 바꾸어야 중간 단계에서
초안 유실을 막을 수 있어 같은 관심사로 묶었다. 결과 문서는 별도 커밋으로 기록한다.
세 PR은 #116 → #117 → #118 의존 순서로 쌓았고 모두 migration_main을 대상으로 한다.
후속 PR은 draft이며 선행 PR 병합 후 독립 diff·최신 기준 CI를 확인해야 한다. 이 작업은
PR 생성까지이고 병합·배포는 실행하지 않았다.

DB/HTTP 계약, shared package 추출, Web 인증 처리, MFA(P05)는 변경하지 않았다.
영상 광고 판정은 기존 ID/길이 heuristic을 유지하며 실제 외부 YouTube 광고·R2 업로드 검증은
이번 결정적 provider fixture의 보장 범위에 포함되지 않는다. 초안은 원래 탭의 React/RHF
메모리에 보존하며 새로고침·탭 종료에 대비한 영속 저장을 추가하지 않았다.
