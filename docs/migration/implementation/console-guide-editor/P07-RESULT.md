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


## 2026-10-27 운영 DB 적용과 기존 26곡 이관

2026-10-27 08:09 KST 사용자 승인으로 `migration_main@761b6ed437ae656832df730611c21a7ecc2b5c18`의
`0007_p07_cheer_guide_foundation`부터 `0010_policy_content_drafts`까지 운영 PostgreSQL 17에 적용했다.
위의 최초 종료 기록은 당시 범위를 보존하며, 이 절이 운영 DB 미적용·전체 분류 미완료 상태를 갱신한다.
앱 Promotion·배포는 이번 실행에 포함하지 않았다.

사용자가 전체 기존 데이터를 콘서트로 지정하고 `has_official_cheer=true`는 공식, false는 팬덤으로
확정했다. null 플래그는 없었다. 응원 표시가 없는 8곡도 이관·공개 대상에 포함하며 곡과 앨범의
공개 설정을 함께 따른다. Discord는 공식 응원법을 간소화한 팬덤 버전이므로 false를 유지했다.
공연 영상에 따른 후속 정비는 이관에 포함하지 않았다.

| 검증 항목 | 운영 결과 |
| --- | --- |
| Guide / snapshot / publication | 각각 26건, 콘서트 26·페스티벌 0 |
| 출처 | 공식 5·팬덤 21, Discord 팬덤 |
| 공개 범위 | 25곡, 흰수염고래는 부모 앨범 비공개로 숨김 유지 |
| 원본 보존 | 9개 앨범·26곡 전체 행 fingerprint 일치, snapshot 가사·기준 영상 불일치 0 |
| 공지·업데이트 | 기존 공지 1·업데이트 2건 공개 내용 이전 |
| 안내·약관 | 기존 공개본 5건·비공개 개정안 5건, 초안 발행 없음 |
| migration journal | 기존 0000~0006 hash 일치 확인, 적용 후 11건 |
| 권한·불변성 | 새 5개 테이블 migrator 소유·app 실제 조회 성공, snapshot/publication UPDATE는 SQLSTATE 55000 거부 |
| 기존 서비스 | Web·Console 컨테이너/image/시작 시각 유지, healthz·readyz 네 경로 모두 200, 인증 관련 6개 테이블 행 수 유지 |

공식 출처는 고민중독·내 이름 맑음에 사용자가 제공한
[공식 카페 게시물](https://cafe.naver.com/eggkim/268484?tc=shared_link), 행복해져라에
[공식 공지](https://weverse.io/qwer/notice/33922), 눈물참기에
[공식 Weverse 영상 페이지](https://weverse.io/qwer/media/3-201910799), CEREMONY에
[공식 응원법 영상](https://www.youtube.com/watch?v=vqfSealefyQ)을 연결했다.
기존 대화에 눈물참기와 중복 기재된 영상 ID `vqfSealefyQ`는 CEREMONY임을 확인했으며
눈물참기에 재사용하지 않았다. 원래 재생용 YouTube ID와 가사 타임스탬프는 보존했다.
CEREMONY만 검증한 YouTube 원본을 guide_video_url에도 연결했고 다른 영상 필드는 추정하지 않았다.

### 실행과 복구 근거

- 보호된 운영 호스트 경로 `/home/oioi/p07-migration-20261027/`에 백업·실행 SQL·검증 결과를 보존했다.
  원본 백업을 별도 `p07_restore_20261027` DB에 실제 복원하고 앨범·곡 fingerprint 일치를 확인했다.
- 같은 복원 DB에서 네 migration·26곡 이관 마지막에 강제 오류를 주어 전체 rollback을 확인했다.
  정상 적용 후 재실행은 기존 journal 검사에서 거부되어 중복 행이 생성되지 않았다.
- 리허설의 첫 사후 검증에서 migrator의 `SET ROLE oioi_app`이 거부되었다. 역할 간 membership을
  늘리지 않고 실제 app 역할의 별도 연결로 검증을 수정했다. migration 커밋은 성공한 상태였으므로
  재적용하지 않고 사후 검증만 재개해 통과했다. 운영은 수정한 검증 절차로 한 번 적용했다.
- 운영 실행은 `docker exec ... psql -U oioi_migrator -d oioibawige`로 수행했다.
  DB·역할·PostgreSQL 버전·기존 journal hash·26곡 원본 fingerprint·ACTIVE ADMIN을 검사하고,
  migration advisory lock과 song 쓰기 잠금, lock timeout 5초·statement timeout 30초를 적용했다.
  원본 migration SQL과 journal 기록, 명시적 app DML 권한, 원본 JSON 기반 최초 공개 이관을
  하나의 transaction으로 커밋했다. 기존 song/album·인증 행을 UPDATE/DELETE하지 않았다.
- 직전 백업 `final-before.dump`의 SHA-256은
  `8b7d261077024c07b65fb96c8cc4f8d45565ae83dead633549e8e0b722d290df`이며 서버에 0600으로 보존한다.
  실행 SQL `production-applied.sql`의 SHA-256은
  `3adb5a85d8a80bc9cadfddb4d87b6b444f71a6bf139c2938a0373f094b4246d3`이다.
  `production.json`에 실행 시각·결과·hash를 남겼다. SQL 실행과 사후 검증은 약 456ms였다.
- 로컬 실행 증거는 ignored `.local/p07-production-20261027/`에 있으며 별도 인증값을 출력하지 않았다.
  코드·migration 파일은 수정하지 않았으므로 lint/typecheck/build를 별도로 실행하지 않았다.

최신 Web·Console은 별도 Promotion으로 배포해야 한다. 기존 배포의 편집기가 이관 후 legacy 가사를
수정할 수 있으므로 배포 전 `snapshot.lyrics/reference_youtube_id/source_type`과 기존 song 값을 다시
대조하고 차이가 있으면 덮어쓰지 않고 처리해야 한다. 이번 DB 검증만으로 최신 앱 배포나 새 UI의
운영 수용을 완료로 판정하지 않는다. 약관 개정안은 운영 정보 확인 전까지 비공개로 유지한다.
