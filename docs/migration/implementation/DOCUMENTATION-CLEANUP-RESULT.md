---
title: "P07 착수 전 문서 부채 정리 결과"
kind: migration-result
status: recorded
source_commit: e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f
recorded_at: "2026-10-26"
---

# 문서 부채 정리 결과

P06 종료 후·P07 착수 전 문서 정리를 수행했다. 기존 경로에서 작업했으며 P10 이후 폴더 재편은 보류했다.
실행 기준은 위 통합 SHA와 OPEN인 [감사 #257](https://github.com/goldmayo/oioi-bwg/pull/257)의
[고정 보고서](https://github.com/goldmayo/oioi-bwg/blob/6a3c714795f511e8f673b54f13020b9138ded49d/docs/migration/implementation/DOCUMENTATION-GOVERNANCE-AUDIT.md)다.
시작 시 local/origin migration_main은 같고 작업 폴더는 깨끗했다. 새 PR 병합·운영 조회·배포는 수행하지 않았다.

## 실제 변경과 보존

- 문서 입구는 [docs/README](../../README.md), 현재·보류 목록은 [WORK](../../WORK.md)로 통합하고 루트 README에서 연결했다.
  기존 TODO는 완료/폐기/보류/미확인으로 대조했으며 상세 설계·명령·검증은 각 원문 owner에 남겼다.
- 완료 PLAN/DESIGN **29개**, P06 HANDOFF **1개**, 폐기된 blueprint/TODO/배포/Feature Flag/렌더링 안내 **5개**를 삭제했다.
  [파일별 대응 지도](COMPLETED-DESIGN-INDEX.md#2026-10-26-파일별-삭제대응-기록)가 삭제 목록·ADR·RESULT·절차·후속과 고정 원문을 연결한다.
  삭제 설계의 상대 유입 링크 92개는 당시 Git 원문으로 이관했다.
- root 역공학 01~08과 migrated-current의 **8쌍·2,779행**이 byte 단위로 같음을 확인해 초과 사본 **8개**를 삭제했다.
  [대표 snapshot 안내](../../reverse-engineering/README.md)에 소유자·수명·source 한계를 명시했다. 대표 8개 분석 본문과 legacy-main 10개 파일을 보존했다.
- 혼합 DESIGN에서 완료된 구조/MFA 상세를 결과로 연결하고 **P07~P10 본문은 URL 이관 외 동등함을 확인**했다.
  ROADMAP은 기능 범위/의존성/완료 조건을 소유하며 현재 상태는 WORK에 연결한다.
- RESULT·M7 finding/최종 검증 보고서·고유 승인/실패를 가진 중간 기록·P06-PREPARATION·현행 개발/운영 안내는 보존했다.
  미완료 M1/M2·ENV-2·관측 운영 수용·FWA-04·G와 초기 승인/완료 미확인 설계도 남겼다.
- [ADR 0008](../../adr/0008-documentation-lifecycle.md)과 [시간순 devlog](../../devlog/20261026-documentation.md)를 추가하고 기존 ADR의 근거를 보완했다.
  AGENTS/문서 스킬에 WORK·결정·결과·후속을 갱신하는 최소 종료 규칙을 반영했다. 반복 인계 파일은 새로 만들지 않았다.

## 출처·현재 계약의 정합성

환경 증적·관측 감사·CURRENT-STATE의 코드/설정 링크는 각 문서가 선언한 SHA의 permalink로 고정했다.
옛 devlog는 작성 commit `c773929a70750547271eab61bb3e4462ff4bb7bf`의 코드 참고 링크로 바꾸고,
각 실패 실험의 미커밋 상태까지 재현하는 source는 미확인이라고 명시했다. 비추적 `.env` 4개 링크는
코드 표기로 바꾸었다. 합계 70개 source 링크를 고정했으며 최신 경로로 역사적 관찰을 치환하지 않았다.

M7은 #257의 정정과 동일하게 2026-09-07 01:25 KST 최초 FAIL → DATA-008 보완 → 02:27 KST 최종 PASS다.
9월 9일 FAIL 제목 병합과 실제 검증 사건 순서를 구분하며 [정정 devlog](../../devlog/202608-0909-boundaries.md#2026-10-25-감사-정정)에 원문을 유지했다.
원본 M7 판정/승인 기록은 수정하지 않았다. #257은 병합하지 않았으며 이후 통합 시 동일 정정을 중복 추가하지 않는다.

API 소개는 헌법의 독립 Web/Console·공통 core 구조와 일치시켰다. API 1.6/index 1.56을 함께 갱신했고,
Rendering 1.2·Testing 1.20의 제목과 Runtime 1.13의 index 표기를 맞췄다. 보안·데이터 불변성 규칙은 변경하지 않았다.
M0/M1부터 다시 시작하던 안내는 WORK·active 계약·기존 결과를 확인하는 진입점으로 정정했다.

## 검사 범위와 수치

파일 수는 같은 Git tracked docs 범위와 이번 신규 docs 파일을 비교했다. Markdown 링크는 저장소의 추적 Markdown
전체(README·AGENTS·ops·infra·스킬 포함)의 AST에서 inline/reference/image 링크를 읽고 코드 블록을 제외했다.
따라서 감사 #257의 docs+README+AGENTS 링크 집계 743회와 아래 전수 Markdown 집계는 범위가 다르다.
도달성의 시작점은 README·AGENTS이며 외부 Git 링크는 탐색 edge로 계산하지 않았다.

| 항목                                     | 정리 전 e93ae610 | 정리 후 |
| ---------------------------------------- | ---------------: | ------: |
| docs 전체 파일                           |              256 |     219 |
| docs Markdown                            |              238 |     201 |
| implementation Markdown                  |              148 |     119 |
| implementation의 PLAN/DESIGN             |               36 |       7 |
| 완전 중복 초과 사본                      |                8 |       0 |
| 상대 파일 결손 발생 수                   |               41 |       0 |
| 상대 anchor 결손 발생 수                 |                3 |       0 |
| 개인 file URI                            |               18 |       0 |
| README·AGENTS에서 도달하는 docs Markdown |           58/238 | 201/201 |

삭제 총계는 **43개**, 신규 docs는 입구·WORK·ADR·devlog·snapshot 안내·이 결과의 **6개**다.
상대 링크의 최종 발생 수와 고정 Git blob/anchor 검증 수는 최종 PR의 확인 방법에 기록한다.
본문을 수정한 문서는 명시적 Prettier check, 전체 상대 링크/anchor·고정 source blob·삭제 대상 참조·
목차·version 정합성과 `git diff --check`를 검사했다. 링크만 이관한 역사 문서의 전체 포맷은 재작성하지 않았다.
문서 전용 scope와 push hook 결과는 각 PR에 실제 결과대로 기록한다.
제품 lint/typecheck/test/build, DB·서비스·DNS·Secret 조회/변경은 실행하지 않았다.

## 회수한 후속과 남은 미확인

모든 현재·보류 항목의 상태·다음 행동·완료 조건·근거는 [WORK](../../WORK.md)에 있다.
P07~P10·G·FWA-04 runtime·부하·IAM/DB·Origin CA·공지 DB 전환 외에도 ENV-2·휴면 메일·추가 UI·
관측 운영 수용·의존성 보안 잔여·타입 순환·비용 관측·옛 UX/Recap/공식 출처·장기 도메인 제안을 회수했다.
이 결과는 미완료 항목의 별도 목록을 운영하지 않는다.

M1의 수동 product smoke, M2 전체 종료, migrated-current 코드 source, 초기 MVP/renewal 승인·완료 및
원본 analytics 검증은 미확인이다. M0~M9 전체 완료를 주장하지 않는다. 초기 결과의 옛 미배포·미병합 표시는
그 시점의 이력으로 남겼고, 이후 배포만으로 원래의 모든 수용 검증이 통과했다고 추정하지 않았다.
보류된 `feature/service-publications`와 recovery-f-cutover의 미커밋 초안은 수정·초기화·정리하지 않았다.

## 검토·통합 단위

1. [#258](https://github.com/goldmayo/oioi-bwg/pull/258): 진입점·WORK·종료 규칙, `df0539e947ea936acc4449b81c14a8076583db48`.
2. [#259](https://github.com/goldmayo/oioi-bwg/pull/259): 완료 설계 삭제와 근거 이관, `41f170bdd7f6252b4b9ba6a60ea361de1a37f22d`.
3. snapshot/provenance·현행 설명·이 결과: 이 결과를 포함한 Draft PR의 exact head와 확인 방법이 최종 문서 검사 단위를 고정한다.

모든 PR 대상은 migration_main이다. 후속 Draft는 선행 문서 commit을 포함하므로 선행 통합 뒤 최신 기준을 반영해
독립 concern diff를 다시 확인한다. 삭제와 그 참조 이관은 같은 변경에서 검토해야 하므로 파일/행 목표를 넘는
결합 이유·리뷰 순서를 PR에 명시했다. 자동 병합이나 Promotion은 실행하지 않는다.
