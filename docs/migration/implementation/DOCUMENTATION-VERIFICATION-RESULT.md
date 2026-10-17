---
title: "문서 변경의 CI 및 push 검증 생략 결과"
kind: migration-result
status: active
source_commit: 296e463bdcf917717b60e490918717223f484751
verified_at: "2026-10-17"
---

# 문서 변경 검증

사용자 요청으로 일반 문서 변경의 검증 비용을 줄인다. 기준은 active Testing §17과 배포 §21이다.
`feature/docs-only-verification`은 최신 main `296e463`에서 분기했다. P06 운영 적용과 별도 concern이다.

`verification-scope.mjs`가 전체 merge-base raw diff를 검사한다. 일반 파일 `.md`만 허용하며 rename은
삭제/추가 양쪽, 파일 mode와 Git hook 환경도 처리한다. 코드 혼합·MDX·symlink·실행 mode·빈/오류 diff는 전체 검증이다.
일반 migration_main PR은 scope/verify만 실행하고, feature push hook은 검증을 생략한다.
Promotion과 main/develop push는 기존 검증을 유지한다. `.md`를 runtime 입력으로 도입하면 이 분류도 먼저 재검토한다.

필수 verify는 scope 성공과 정확한 전체 성공/전체 skipped 상태를 검사한다. workflow path filter나 commit skip은
required check를 Pending으로 남길 수 있어 사용하지 않는다([GitHub 공식 문서](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)).
이 변경 자체는 코드/CI 변경이므로 전체 검증 대상이다. 실제 검증 ref·명령·결과는 PR 본문에서 추적한다.
기본 여섯 검사·ops 206건(신규 12건)과 actionlint 1.7.12(-shellcheck=)·hook/Node 구문 검사가 성공했다.
실제 Git 이력과 pre-push의 문서 생략/혼합 검사 진입을 검증했다. harness 18건·unit 459건이며 harness/lint는 순차 실행했다.
기존 Python fixture timeout 보완·운영 설치·DB/Secret 변경·Promotion 병합은 포함하지 않는다.
