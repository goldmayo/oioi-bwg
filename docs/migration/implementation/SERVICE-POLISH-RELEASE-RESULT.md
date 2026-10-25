---
title: "서비스 개선 병합과 운영 배포 결과"
kind: migration-result
status: completed
source_commit: d837fd47df0c08d6f1621c221fd522702a8920d7
verified_at: "2026-10-25T19:57:12+09:00"
---

# 서비스 개선 병합과 운영 배포 결과

## 범위와 실행 기준

사용자의 PR 순차 병합·배포 요청에 따라 모노레포/P06 문서와 SEO·Sentry 감사·Console 테이블을
통합하고 Web·Console을 정상 Promotion으로 운영에 반영했다. 계획/절차의 소유자는
[배포 runbook §21](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md#21-cicd)다.
구현 판정은 [SEO 결과](PUBLIC-SEO-RESULT.md),
[Sentry/relay 감사 §13](SENTRY-SLACK-RELAY-RESULT.md#13-2026-10-25-서비스-태그와-relay-환경-감사),
[테이블 수용 결과](CONSOLE-DATA-TABLE-RESULT.md)가 소유한다. 이 문서는 이들의 공동 운영 적용 사실을 소유한다.

저장소 `goldmayo/oioi-bwg`, 검증 source `migration_main` **`d837fd47df0c08d6f1621c221fd522702a8920d7`**,
source/merge tree **`05b471342e9a78b7853f3b0df1bac774451c2552`**를 고정한다. 아래는 명시한 시점의 실제 관측이다.
P07 구현을 시작하거나 완료한 기록은 아니다.

## 병합 순서

| PR                                                    | 관심사                                                    | 병합 commit                                |
| ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| [#244](https://github.com/goldmayo/oioi-bwg/pull/244) | docs(monorepo): 개선 전후 구조와 검증 근거 비교 문서 작성 | `aa43d8c36b89dc9db02c851b02a9092fc41042ab` |
| [#248](https://github.com/goldmayo/oioi-bwg/pull/248) | docs(p06): 전체 종료와 다음 응원법 단계 기록              | `1aa16b925be040649f95488559b782faec6f629b` |
| [#249](https://github.com/goldmayo/oioi-bwg/pull/249) | fix(seo): 공개 메타데이터와 사이트맵 노출 수정            | `0fdefe563d6795d536dcf2759ff0a9ba6e140de4` |
| [#250](https://github.com/goldmayo/oioi-bwg/pull/250) | docs(sentry): 서비스 태그와 릴레이 환경 감사 기록         | `088532cce9a665713f3254792948cf490e33c187` |
| [#251](https://github.com/goldmayo/oioi-bwg/pull/251) | feat(ui): 공용 테이블과 Console 관리 목록 연결            | `64a44b8d096feb205e68ba8177b4b14312ccbfbc` |
| [#252](https://github.com/goldmayo/oioi-bwg/pull/252) | chore(deploy): 서비스 개선 배포선 이력 연결               | `d837fd47df0c08d6f1621c221fd522702a8920d7` |
| [#253](https://github.com/goldmayo/oioi-bwg/pull/253) | chore(deploy): SEO와 Console 테이블 운영 승격             | `010d93a136fe99249e802534ded2f99f03c0853a` |

일반 PR은 앞 PR을 반영한 최신 head의 CI를 통과한 뒤 squash 병합했다. #252는 과거 squash 배포선과
최종 통합본의 충돌을 파일 변경 없이 해결하기 위한 이력 연결이다. head `6d454257afdb12fd759e244ebfdce903a0875ef2`와
기준 통합선 `64a44b8d096feb205e68ba8177b4b14312ccbfbc`의 tree는 위 source tree와 같았다.
이 PR만 일반 merge로 연결한 뒤 저장소 merge flag와 migration_main ruleset을 원래 squash-only 값으로
복원·대조했다. 다른 보호 조건을 바꾸지 않았으며 설정 복원 비교 결과는 true였다.

## 검증 이미지와 실제 배포

- [Promotion Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/40185464960):
  attempt 1, full verify와 ARM64 exact-digest pull/native/readiness/browser/paired smoke 성공.
- [실제 Deploy promotion](https://github.com/goldmayo/oioi-bwg/actions/runs/40186364458):
  attempt 1, OCI Run Command **exit 0**, 성공 receipt 생성 확인.
- candidate artifact `12596382554`와 배포 receipt의 source·release ID·두 digest를 대조했다.
  배포 workflow는 검증한 두 digest를 그대로 사용했으며 candidate를 다시 build하지 않았다.
- release ID: `52fc9405bee85cfeaa86d4d73f05def2898a77a4a4aa842a3208a52734b9ccc0`.
- 직전 정상 기준은 배포 run `40168460344`의 미만료 artifact `12589336062`였다.
  새 candidate의 baseline이 그 성공 receipt와 정확히 일치했다.

| 앱      | 배포 digest                                                               | 실제 build source                          | provenance |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| web     | `sha256:d3eb40c661af42c61e898629f7e524ef45cd1123f15feffcf4c895439e0eac19` | `d837fd47df0c08d6f1621c221fd522702a8920d7` | built      |
| console | `sha256:1b4f6166acddfb77cd72922d62a1bd6577324cc86f4cb75e993591ea9b9d53cd` | `d837fd47df0c08d6f1621c221fd522702a8920d7` | built      |

## 배포 후 공개 HTTP 확인

확인 시각은 위 `verified_at`의 KST다. 공개 요청만 사용하고 응답의 상태·메타데이터를 비교했다.

| 항목                         | 배포 후 결과                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------- |
| CEREMONY canonical           | `https://www.oioibawige.com/songs/ceremony`                                     |
| CEREMONY title               | QWER CEREMONY 응원법 \| 어이어이바위게                                          |
| 기본 OG                      | `https://assets.oioibawige.com/images/og_oioibawige.webp`, assets 원본 HTTP 200 |
| 제보 폼 robots               | `noindex, nofollow`                                                             |
| 미등록 약관                  | 기존 HTTP 200에서 HTTP 404로 변경                                               |
| sitemap                      | 27 → 37개 URL, 숨김 `blue-whale` 제외                                           |
| 숨김 곡 직접 조회            | 브라우저·검사 bot은 HTTP 200 + noindex + not-found, public API HTTP 404         |
| manifest                     | 없는 512px 항목 제외, 기존 192px 유지                                           |
| Web·Console health/readiness | 네 endpoint 모두 HTTP 200                                                       |
| 익명 Console 관리 접근       | admin-login으로 이동, 보호 유지                                                 |

홈·곡·앨범·chants·more·report의 canonical/OG와 가짜 Twitter creator 제거도 검사했다.
`python3 /tmp/oioi-assert-public-release.py`의 조건 검사를 통과했다. 실행 당시 공개 증거와 candidate/receipt는
운영 worktree의 ignored `.local/service-release/`에 보존했다. durable source/digest/Actions 출처는 위에 고정했다.

브라우저의 숨김 곡 HTTP 200은 공개 곡 응답이 아니라 Next not-found stream이다. `NEXT_HTTP_ERROR_FALLBACK;404`와
`noindex`를 확인했다. Googlebot/Twitterbot도 같은 not-found·noindex였으며 public API는 HTTP 404였다. 초기 HTTP-status-only 검증 조건은
[Next not-found의 streaming 계약](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)에
맞게 보완해 상태·noindex·not-found 신호·API 거부를 함께 확인했다. 브라우저도 HTTP 404였다고 기록하지 않는다.

## 실행 중 발견과 관측 한계

#252 첫 CI의 ops 테스트는 임시 디렉터리 삭제 `ENOTEMPTY`로 실패했다. 같은 head의 해당 테스트
단독 실행은 통과했으며 실패 unit·종속 verify 재실행 뒤 전체가 성공했다. 파일 변경 없는 이력 PR에
제품/테스트 수정을 섞지 않았다. 재발하면 임시 디렉터리 정리 안정화를 별도 관심사로 다룬다.

운영 DB migration·키 회전·DNS/Caddy/Worker 설정 변경은 실행하지 않았다. relay 이름 변경은 보류한
기존 판정을 유지한다. 실제 계정 로그인 후 CRUD E2E·Sentry 원격 event/규칙·Search Console 색인/순위는
이 공개 HTTP 관측과 구분한다. 테이블의 Compiler·권한·DTO 갱신 검증은 앞 구현 결과와 CI 증거를 따른다.
