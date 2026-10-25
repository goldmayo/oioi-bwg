---
title: "P07 착수 전 문서 관리 감사"
kind: migration-evidence
status: recorded
snapshot_mode: frozen
source:
  repository: goldmayo/oioi-bwg
  branch: migration_main
  commit: e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f
observed_at: "2026-10-25"
---

# 문서 관리 감사

## 판정과 범위

문서 수가 많다는 것보다 현재 기준·작업 상태·결정 이력의 연결이 약한 것이 주요 문제다.
완료 설계를 지우기 전에 보류 작업과 결정 근거를 보존할 소유자를 정해야 한다.
현재는 P06 종료 후·P07 착수 전이다. DB 전환의 미커밋 작업은 별도 브랜치에 보존하고 감사를 위해 변경하지 않았다.

사용자 요청으로 [#256](https://github.com/goldmayo/oioi-bwg/pull/256)을 먼저 squash 병합했다.
병합 head는 위 source commit이며 문서 CI [40202706999](https://github.com/goldmayo/oioi-bwg/actions/runs/40202706999)의 scope·verify가 통과했다.
제품 job은 Markdown-only 정책으로 skipped였으며 제품 검사를 통과했다고 계산하지 않는다.

기존 [DOCUMENTATION-VERIFICATION-RESULT](DOCUMENTATION-VERIFICATION-RESULT.md)는 Markdown-only CI 판정 기능의 결과다.
이번 감사의 역할은 전체 문서의 분류·상태·근거·탐색 가능성·정리 순서로, 해당 결과를 덮어쓰지 않는다.

## 전수 검사 수치

수치는 감사 파일과 아래 정정이 추가되기 전 위 commit의 tracked docs 기준이다.

| 항목                                                     |                                 관찰 |
| -------------------------------------------------------- | -----------------------------------: |
| 전체 파일                                                |                                  256 |
| Markdown / 이미지 등 비 Markdown                         |                             238 / 18 |
| implementation의 Markdown / 그중 Console 작업선          |                             148 / 56 |
| PLAN 또는 DESIGN으로 끝나는 implementation 파일          |                                   36 |
| 역공학 Markdown                                          |                                   27 |
| active architecture 디렉터리 Markdown                    |                                   14 |
| ADR 디렉터리 / devlog 디렉터리 Markdown (목차 포함)      |                                8 / 9 |
| byte 단위 완전 중복                                      |           8쌍, 초과 사본 8개·2,779행 |
| 상대 file/image/anchor 링크 발생 수 (README·AGENTS 포함) |                                  743 |
| 현재 checkout에 없는 파일 링크                           | 3개 문서의 41회, 서로 다른 대상 35개 |
| 개인 환경의 file URI 등 비이식 링크                      |                                 18회 |
| README·AGENTS의 상대 링크로 도달하는 docs                |                             58 / 238 |
| 위 그래프 밖의 문서                                      |                                  180 |
| 다른 docs·README·AGENTS의 상대 유입 링크가 없는 문서     |                                  112 |
| front matter 없음 / status 필드 없음                     |                              61 / 69 |

Prettier Markdown AST로 inline/reference/image 링크를 읽고 코드 블록은 제외했다.
도달성은 파일 선택기를 통한 접근, 검색, 외부 GitHub 링크, 모든 소스 코드의 경로 문자열을 포함하지 않는다.
41개 링크는 현재 checkout에서의 경로 결손이며 역사적 source 자체의 오류 41건이라는 뜻이 아니다.
metadata가 없는 문서나 역사적 문서라는 사실만으로 결함·삭제 대상으로 판정하지 않았다.
전수 수치 검사와 아래의 의미·freshness 표본 검토를 구분한다. 모든 본문의 사실을 재검증한 감사는 아니다.

## 발견 사항

### DOC-01 · P1 · 현재 작업과 보류 작업의 단일 진입점 부재

확인: [P06 결과 §별도 후속](console-guide-editor/P06-RESULT.md#별도-후속과-검증-한계)는 계정 관리 G·추가 부하·IAM/DB hardening·Origin CA 갱신을 가진다.
[관측 정책 공통화 계획](OBSERVABILITY-POLICY-SHARING-PLAN.md)은 proposed·미구현이며,
[프레임워크 결과](FRAMEWORK-IMPROVEMENT-RESULT.md)는 A/B 구현과 C 설계 완료를 구분한다.
반면 [로드맵](console-guide-editor/ROADMAP.md)은 Console/P01~P10 작업선만 소유한다.
조회 시점 gh issue list의 열린 이슈는 0건이었다. 비공개 프로젝트 등 외부 관리판 존재 여부는 확인하지 않았다.

영향: 완료된 checkpoint를 다시 열거나, 별도 후속을 종료 결과 안에 남겨 잊을 수 있다.
필요 조치: 원본 근거에 연결되는 현재 작업 목록 한 곳에서 상태·다음 행동·완료 조건·담당/결정 주체를 관리한다.
Issue를 사용할지 repo 목록을 사용할지는 정리 구현에서 하나를 선택하고 서로 다른 TODO를 병행하지 않는다.

### DOC-02 · P1 · ADR·devlog 목차가 최상위 탐색 경로에 연결되지 않음

확인: #256의 ADR·devlog·완료 설계 목차 세 문서는 상호 참조하지만 README·AGENTS의 상대 링크 그래프에서 도달하지 않는다.
루트 README에도 docs 전체의 역할을 안내하는 단일 문서 진입점이 없다.

영향: 내용을 추가해도 다음 세션이 기존 자료를 못 찾아 같은 조사·계획을 다시 만들 수 있다.
필요 조치: README에서 문서 진입점 한 곳으로 연결하고, 그 안에서 현재 작업·기준 문서·운영 안내·ADR·devlog를 찾게 한다.
이 목차는 상세 사실과 체크리스트를 복제하는 새 SSOT가 되어서는 안 된다.

### DOC-03 · P1 · #256의 M7 검증 순서 오기 — 이번 감사에서 정정

확인: 새 devlog와 완료 설계 지도는 “중간 PASS와 이후 FAIL”로 서술했다.
실제 최초 보고는 [49f33c4](https://github.com/goldmayo/oioi-bwg/commit/49f33c403c894c1562de1453cdabd0472933df3b)의 2026-09-07 01:25 KST FAIL이다.
DATA-008 보완 뒤 [8625ef6](https://github.com/goldmayo/oioi-bwg/commit/8625ef6400e57a222c9fcf3c6fb04583e6568aa7)의 02:27 KST 최종 보고는 PASS다.
9월 9일 FAIL 제목으로 병합된 12526a8a에서도 보고서 본문은 현재 PASS 문서와 byte 단위로 같다.

영향: 커밋 제목·병합 시각으로 실제 실패와 복구 순서를 복원하면 정반대 결론에 도달한다.
조치: 해당 devlog와 지도 두 곳만 정정하고 최초 집필 오류와 두 고정 source를 연결했다.
M7 원본 보고서·finding 상태·승인 이력은 수정하지 않았다.

### DOC-04 · P1 · 현재를 표방하는 오래된 안내가 재작업을 유도

확인: [blueprint](../../blueprint.md#10-인프라-및-배포-cloudflare-native)는 Workers/Vinext/Hyperdrive를 설명하면서 마지막에 실제 구현을 반영한다고 선언한다.
[TODO_TICKETS](../../TODO_TICKETS.md)는 Next Data Cache·revalidate 작업과 Workers 테스트를 지시하며 갱신 기준·후속 결과가 없다.
[구현 시작 안내](../oioi-bwg-architecture-clean-v1/README-IMPLEMENTATION-START.md)는 M0/M1 runtime normalization부터 시작하라고 안내한다.
현재 헌법과 P06 결과는 Node standalone·분리된 Web/Console·P07 진입을 명시한다.

영향: 오래된 실행 지시를 현재 작업으로 재개하거나 이미 폐기한 cache/runtime 방식을 복구할 수 있다.
필요 조치: 현행 운영 사실은 해당 owner로 옮기고, 완료 설계 본문은 ADR·결과로 연결한 뒤 사용자가 요청한 삭제 대상으로 정리한다.
TODO 항목은 완료·폐기·보류·미확인으로 개별 대조해 살아 있는 후속만 현재 목록으로 옮긴다.

### DOC-05 · P2 · 완료 PLAN과 역사적 HANDOFF가 현행처럼 함께 노출

확인: [P01 계획](console-guide-editor/P01-PLAN.md)은 draft,
[P05 설계](console-guide-editor/P05-DESIGN.md)는 draft,
[모노레포 계획](MONOREPO-BOUNDARIES-AND-EXECUTION-PLAN.md)은 active이나 본문에 실행 완료를 명시한다.
[P06 인계](console-guide-editor/P06-HANDOFF.md)는 revision 71이며 맨 위 종료 선언 아래 여러 과거 보류/재개 지시를 보존한다.
완료/보류의 진입점은 존재하지만 파일명·metadata만으로 사용 여부를 판단할 수 없다.

영향: 완료 계획을 활성 TODO로 읽거나 인계 본문의 지난 지시를 최신 지시로 오인한다.
필요 조치: 완료 설계를 파일별 대응 결과·ADR로 연결한 뒤 삭제한다. HANDOFF의 유효 사실은 결과/운영 안내로 연결하고 임시 실행 지시는 제거 후보로 분류한다.
모든 결과 문서를 새 계획처럼 다시 쓰거나 전체 metadata를 한 vocabulary로 강제하지 않는다.

### DOC-06 · P2 · 역공학 문서의 완전 중복과 기준 source 불명

확인: reverse-engineering 루트의 01~08과 migrated-current의 01~08은 각각 byte 단위로 같다.
두 세트는 2026-09-05의 현재 코드 관찰을 표방하지만 source commit을 명시하지 않고 authority: plan을 가진다.
[gap map](../../reverse-engineering/10-main-to-migrated-gap-map.md)은 migrated branch/commit이 unknown임을 명시한다.
legacy-main은 별도로 main의 4b299934846f4a0eed7132f58c5b1c2a481a3739를 고정했다.

영향: 동일 사실의 두 소유자가 생기고, 어느 구현과 비교한 것인지 복원할 수 없다.
필요 조치: 두 사본 중 대표 한 곳과 snapshot 수명을 정하고 원문 출처를 복원한다. unknown을 임의 SHA로 채우지 않는다.
legacy-main은 날짜가 오래됐다는 이유로 현행 코드로 덮어쓰지 않는다.

### DOC-07 · P2 · source 고정 문서의 링크가 현재 checkout에 종속

확인: [환경 증적](ENVIRONMENT-CONFIGURATION-EVIDENCE.md) 3회,
[관측 감사](OBSERVABILITY-AUDIT.md) 10회,
[CURRENT-STATE](console-guide-editor/CURRENT-STATE.md) 28회가 이동 전 src/·Dockerfile·Compose를 가리킨다.
CURRENT-STATE는 frozen source를 명시하고 그 commit을 checkout하라고 안내하므로 내용 자체를 현행 불일치로 판정하지 않는다.

영향: GitHub에서 클릭하면 고정 source 대신 현재 경로를 찾아 근거를 읽지 못한다.
필요 조치: 보존할 역사적 근거는 원래 commit의 permalink로 연결한다. 새로운 경로로 일괄 치환해 과거 관측을 다른 코드에 붙이지 않는다.
개인 file URI 18회도 공개·다른 기기에서 재현되는 링크로 바꾼다.

### DOC-08 · P2 · active 문서의 버전과 시작 설명 불일치

확인: 인덱스의 Runtime 버전은 1.12이나 실제 front matter/제목은 1.13이다.
Rendering은 front matter 1.2 / 제목 1.1, Testing은 1.20 / 제목 1.15다.
API 문서 §1은 단일 Next 애플리케이션이라고 설명하나 헌법은 Web/Console과 독립 relay를 구분한다.

영향: 어떤 개정이 현재 기준인지 확인하기 어렵고 오래된 시작 문장을 구현 제약으로 해석할 수 있다.
필요 조치: 현행 규칙의 의미를 바꾸지 않는 정합성 수정과 실제 결정 변경을 구분해 해당 owner와 인덱스를 함께 갱신한다.

### DOC-09 · P2 · 반복 운영 안내가 migration 결과 폴더에 섞임

확인: [로컬 개발환경](LOCAL-DEVELOPMENT-ENVIRONMENT.md)은 현재 반복해서 사용하는 설정·실행·DB guard 안내이며 README에서 직접 참조한다.
이는 특정 migration의 한 번의 실행 결과가 아니다. 운영 절차는 ops/oci에도 존재한다.

영향: 완료한 migration 문서를 삭제할 때 현행 사용 설명서까지 잃거나, 비슷한 안내를 새로 작성할 수 있다.
필요 조치: developer/operations 문서의 owner를 유지하고 완료 설계 삭제 대상에서 제외한다. 위치 변경은 참조를 함께 이관하는 별도 단위로 수행한다.

### DOC-10 · P2 · ADR/devlog 추가만으로 삭제 전환이 완성되지 않음

확인: 새 완료 설계 지도는 원래 설계를 보존한다고 설명하며 실제 완료 PLAN 삭제·참조 이관은 수행하지 않았다.
ADR 0001의 “구현·검증 기록” 링크도 RESULT가 아니라 M6 계획을 가리킨다.
ADR 7건은 결정 주제별 요약이며 36개 PLAN/DESIGN의 보류 조항·결정·운영 수동 절차가 모두 이관됐다는 증거는 아니다.

영향: 목차를 추가한 뒤 기존 설계를 일괄 삭제하면 새 기록이 삭제 파일에 의존하거나 미완료 작업을 잃는다.
필요 조치: 삭제 파일마다 보존할 결정 → ADR, 실제 실행/실패 → RESULT 또는 고정 Git 근거,
재사용 명령 → 운영 안내, 미완료 항목 → 현재 작업 목록의 대응을 확인한 뒤 파일과 참조를 함께 제거한다.

## 정리 대상과 보존 경계

다음은 삭제 실행 목록이 아니라 근거를 확인한 분류와 정리 순서다.

| 분류                         | 예시                                                                                                 | 정리 방향                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 완료 설계 삭제 우선 후보     | P01/P03/P04 및 리뷰 PLAN, P05 설계·A~D PLAN, P06-A/B0/NEXT-SECURITY PLAN, COMPOSABLE-DATA-TABLE-PLAN | 결과·결정·보류를 대응시킨 뒤 삭제와 링크 이관                              |
| 완료 본문에 후속이 섞인 계획 | P06-PLAN, FRAMEWORK-IMPROVEMENT-PLAN, 환경/모노레포 계획                                             | 후속 owner를 연결하고 완료 부분만 정리; 전체 완료를 이름으로 추정하지 않음 |
| 유지할 미착수 계획           | DESIGN의 P07~P10, ROADMAP, AUDIO-FEASIBILITY, P06-G, OBSERVABILITY-POLICY-SHARING                    | 현재 작업 목록에서 진입; 완료 설계 삭제에 섞지 않음                        |
| 보존할 근거                  | RESULT, M7 finding/최종 보고서, legacy snapshot                                                      | 고정 source·정정 관계를 보존; 현행 작업 목록과 분리                        |
| 현행 규범·사용 안내          | active architecture, Domain, 로컬 개발, ops/oci 안내                                                 | 단일 owner와 탐색 경로 유지                                                |
| 중복/폐기된 안내             | 역공학 8쌍, superseded DEPLOYMENT/feature-flag, blueprint/TODO                                       | 대표 사본·유효 후속·결정 이관 후 제거 범위 확정                            |
| 독립 서술                    | ADR와 devlog                                                                                         | 승인 시각/집필일/검증일 구분, 구체적인 원본 근거 연결                      |

## 잊히기 쉬운 후속 작업 표본

완료된 전체 단계의 모든 후속을 추출한 목록은 아니다. 정리 단계에서 각 원문을 다시 대조한다.

| 항목                         | 감사에서 확인한 상태                                 | 근거 owner                                      |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| P07~P10                      | 미착수; P07/P08 독립, P08→P09→P10                    | ROADMAP / DESIGN                                |
| 관리자 계정 관리 G           | 별도 제안; P07 선행 조건 아님                        | P06-G-PLAN / P06-RESULT                         |
| 관측 순수 정책 공통화 FWA-04 | 설계 산출물 완료, runtime 구현 별도                  | OBSERVABILITY-POLICY-SHARING-PLAN               |
| 추가 부하·자원 관측          | P06 종료 범위에서 미실시                             | P06-RESULT                                      |
| IAM/DB hardening             | 문서에 보류; 이번 감사에서 운영 환경 재확인하지 않음 | P06-RESULT / P06-B0-2-RESULT                    |
| Origin CA 갱신               | 문서상 만료 2027-10-25 15:04 KST, 수동 절차          | P06-RESULT / ops/oci/web-cutover.md             |
| 공지·업데이트 DB 전환        | 사용자 스키마 검토 전; 작업 브랜치에 미커밋 초안     | 사용자 요청 / 별도 feature/service-publications |

## 권고 실행 순서와 완료 기준

1. DOC-03의 서술 오류를 정정한다. 이번 감사에 포함했다.
2. 현재 작업 목록과 문서 진입점의 owner를 정하고 살아 있는 보류 항목을 연결한다.
3. 완료 설계별 결정·결과·후속 대응을 확인한 후 실제 삭제와 참조 이관을 작은 PR로 진행한다.
4. 중복 역공학 사본을 통합하고 snapshot provenance·permalink를 복구한다.
5. 현행 설명·버전·운영 안내의 위치를 정비한다. 코드·DB 기능 변경은 섞지 않는다.

정리 완료는 파일 수 감소만으로 판정하지 않는다. 새 세션이 한 진입점에서 현재 단계·보류 항목·운영 절차를 찾고,
삭제된 설계의 결정과 실행 근거를 ADR/결과로 추적하며, 원래 source의 관측이 최신 규칙으로 오인되지 않아야 한다.
새 작업 종료 시 현재 상태·결정·결과·후속 owner를 갱신하고 임시 HANDOFF를 새로 누적하지 않는 종료 절차가 필요하다.

## 실제 실행과 미실행

실행: Git ref/status/history 대조, tracked 파일 inventory·SHA-256 중복 검사, Markdown AST 상대 링크/도달성 검사,
front matter/인덱스/제목 버전 대조, 핵심 문서 의미 검토, GitHub 열린 이슈 조회, #256 exact-head squash 병합.
통계 raw/CSV는 ignored .local/documentation-audit에 보관한다. 본문에는 위 source에서 재현할 수 있는 범위·수치를 고정했다.

미실행: 문서 삭제/이동/대규모 정규화, 제품 코드 수정·테스트·build, 운영 DB·서비스·DNS·Secret 변경.
새 감사와 자체 서술 정정의 상대 링크·명시적 Prettier·diff 검사는 PR에 결과를 기록한다.
