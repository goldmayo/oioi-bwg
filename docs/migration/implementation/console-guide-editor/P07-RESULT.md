---
title: "P07 두 모드·출처 데이터와 공개 조회 결과"
kind: migration-result
status: complete
authority: evidence
source_commit: 0f37fd57b52814e8d8709782637f3cd638defd28
created_at: "2026-10-26"
verified_at: "2026-10-26"
---

# P07 구현·로컬 검증 종료

CONCERT/FESTIVAL과 공식/팬덤의 데이터 기반, 기존 편집기 저장 호환, 수동 이관 도구,
현재 공개본 조회·모드 선택을 `migration_main`에 병합했다. 운영 DB 적용·콘텐츠 분류·배포 완료를 뜻하지 않는다.
현행 계약은 [Domain §8.0](../../DOMAIN_SPECIFICATION.md#80-p07-데이터와-공개-조회),
범위와 선택 근거는 [설계 §5](DESIGN.md#5-cheerguide)가 소유한다.

## 병합 근거

| 범위                                           | PR·검증                                                                                                                              | 병합 커밋                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Guide·불변 snapshot·공개 이력 기반             | [#272](https://github.com/goldmayo/oioi-bwg/pull/272) · [Verify #588](https://github.com/goldmayo/oioi-bwg/actions/runs/40289392041) | `7405b76a0e42eab287192216a38945414093aad1` |
| Song/Album 삭제 시 이력 보호                   | [#273](https://github.com/goldmayo/oioi-bwg/pull/273) · [Verify #589](https://github.com/goldmayo/oioi-bwg/actions/runs/40292108703) | `e232737957301be6767d932e9b24b3d3bbbe66c4` |
| 기존 저장의 잠금 버전·원자적 이력·UI 충돌 보존 | [#274](https://github.com/goldmayo/oioi-bwg/pull/274) · [Verify #591](https://github.com/goldmayo/oioi-bwg/actions/runs/40295872451) | `149f67101af664a198d5aeb899ddac321654f853` |
| 검토 대응표 기반 수동 이관 CLI                 | [#275](https://github.com/goldmayo/oioi-bwg/pull/275) · [Verify #592](https://github.com/goldmayo/oioi-bwg/actions/runs/40298438331) | `628e49a0a53a410e1b32dbdc10d059902dbf5c6b` |
| 현재 공개 snapshot과 출처 조회                 | [#276](https://github.com/goldmayo/oioi-bwg/pull/276) · [Verify #593](https://github.com/goldmayo/oioi-bwg/actions/runs/40301210927) | `f53cd5fbd9399a3234201b36b14d82e084e6ee9d` |
| 모드·URL 선택·출처/영상·링크 복사              | [#277](https://github.com/goldmayo/oioi-bwg/pull/277) · [Verify #594](https://github.com/goldmayo/oioi-bwg/actions/runs/40307483844) | `0f37fd57b52814e8d8709782637f3cd638defd28` |

각 PR의 최종 head CI 전체가 통과했다. 세부 실행 기록과 구현 커밋은 해당 PR 본문에 유지한다.

## 최종 검증과 실패·복구

- Node 22.23.4 `NEXT_PUBLIC_APP_ENV=local pnpm verify`: 제품 테스트 767개, harness 46개,
  ops 298개와 Web/Console 빌드 통과.
- Docker/WSL2 장애 동안 실제 로컬 DB 검증을 보류하고 CI PostgreSQL 17로 검증했다.
  사용자 복구 뒤 같은 로컬 Compose에서 55개 통과·선택적 dump 1개 제외를 확인했다.
  승인된 기존 dump를 지정한 추가 리허설은 56개 모두 통과했다. 두 실행 모두 임시 연결·advisory lock 0개,
  임시 DB 삭제를 확인했다.
- 불변 이력, 같은 Guide의 동시 저장 하나만 성공, 실패 시 전체 rollback, 이관/기존 편집의 경합,
  이관 재실행 무변경·개정 후 중단, 공개 모드 2→1→0과 legacy 재노출 방지,
  기준 영상 및 공개 가시성 검증을 포함한다.
- Chromium에서 키보드 모드 선택, URL 정규화와 공유, 같은 player/time·seek 0회, 복사 실패 보존,
  1440/390/320px 및 긴 제목·설명을 확인했다. YouTube/Clipboard는 검증용 stub이다.
  테스트 어댑터의 초기 URL 큐 reset과 화면 전환 대기를 바로잡은 뒤 통과했다.
  임시 preview·Next dev 생성 파일은 제거했다. 스크린샷은 로컬 ignored 파일이며 PR 업로드는 하지 않았다.
- 실제 로컬 DB는 native backup 후 P07 migration 1개와 추적 테이블 권한을 적용했다.
  사용자가 제공한 공식 출처의 ‘행복해져라’ 한 곡을 수동 분류해 이관하고 재실행 `unchanged`를 확인했다.
  전체 Album 8개·Song 26개의 JSON 내용·slug·관계를 전후 비교해 보존했다. snapshot은 원래 JSON 그대로이며
  미상 작성자는 null이다. 실제 `/songs/be-happy` 응답 200과 원본 링크 렌더를 확인했다.

## 독립된 후속과 적용 한계

기존 곡 전체의 출처·모드 분류는 완료하지 않았다. false/null 공식 플래그를 팬덤으로 추정하지 않고,
미이관 곡은 기존 읽기를 유지한다. [로컬 이관 절차](../LOCAL-DEVELOPMENT-ENVIRONMENT.md#p07-기존-응원법-수동-이관)를 따른다.
운영 DB migration·이관·Promotion은 별도 실행 범위이며 이번 작업에서 수행하지 않았다.

새 관리자 편집·초안/미리보기/공개·복원, 기여/토론/검수, 히트맵·숙지 응답·실시간 공동 편집은
P07 완료 범위가 아니다. UI/설명 i18n은 P10 이후이며 가사 번역·독음·영구 Cue 식별자를 선행 도입하지 않았다.
현재·보류 후속은 [WORK](../../../WORK.md)가 소유한다.
