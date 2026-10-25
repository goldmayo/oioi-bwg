---
title: "P06 두 앱 운영 전환 전체 종료 결과"
kind: migration-result
status: complete
authority: evidence
source_commit: 7f16a9d74e526f50a5f17e6821ed980d1057cabd
created_at: "2026-10-25"
verified_at: "2026-10-25"
---

# P06 전체 종료 결과

**2026-10-25 P06 A~F 전체를 완료·종료했다. 다음 checkpoint는 P07이다.**
[P06 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md)과 [로드맵](ROADMAP.md)의 두 앱 배포·Web 관리/인증 종료·www 전환 범위를
닫는다. 이 문서는 전체 종료 판정과 후속 범위를 소유하며, 단계별 구현·실행·검증의 상세 근거는 아래 RESULT에 유지한다.

## 단계별 완료 근거

| 단계  | 종료한 범위                                                                         | 상세 결과                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A     | Web·Console runtime 이미지와 실제 이미지 smoke                                      | [A 결과](P06-A-RESULT.md)                                                                                                                  |
| B0~B2 | IAM 실증·두 ARM64 후보·paired host 배포와 공동 복구·IMDS 차단/재시작 지속성         | [B0 결과](P06-B0-2-RESULT.md), [B1 결과](P06-B1-RESULT.md), [B 운영 종료 결과](P06-B2-3-RESULT.md#2026-10-18-b-운영-실증-완료와-최종-상태) |
| C     | Console HTTPS 지속 공개·Origin/CSRF/IP 경계·전용 쿠키와 최종 hostname 격리          | [C 결과](P06-C-RESULT.md), 후속 실물 확인은 [D 결과](P06-D1-RESULT.md)·[F 결과](P06-F1-RESULT.md#2026-10-25-실제-운영-전환)                |
| D     | 실제 MFA 회수·재등록·옛 세션 거절·동일 키/HTTPS 설정 복구                           | [D 운영 종료 결과](P06-D1-RESULT.md#2026-10-21-실물-mfa-회수재등록과-https-설정-복원)                                                      |
| E     | Web 관리·가입·일반 인증 제거, 공개 조회 유지·과거 이미지에 대한 host 차단           | [E3 배포 결과](P06-E3-RESULT.md#2026-10-22-배포-완료와-실제-서비스-검증)                                                                   |
| F     | 정상 운영 Promotion·www/apex 전환·Console 업로드·옛 Web Worker/staging/preview 종료 | [F 운영 종료 결과](P06-F1-RESULT.md#2026-10-25-실제-운영-전환)                                                                             |

C에서 남았던 새 UI의 로그인·관리 조회·로그아웃은 D와 F의 사용자 확인으로 보완했다.
인증 세션 쿠키 속성은 F의 사용자 확인, 사전 인증 쿠키의 host-only/최종 www 비전달은 F의 실제 요청 검사로
구분한다. preview는 폐기했으며 최종 www/Console의 격리를 확인했다. 이전 C 결과의 미확인 표시는 당시 이력이다.

## 종료 기준과 보존 상태

- 종료 기록의 통합 기준은 [#247](https://github.com/goldmayo/oioi-bwg/pull/247) 병합
  `7f16a9d74e526f50a5f17e6821ed980d1057cabd`다. 실제 운영 코드는
  [Promotion #246](https://github.com/goldmayo/oioi-bwg/pull/246)의 source
  `541f02d5c353424b1bd616030a8e016c8547f8f3`, 배포 squash
  `3727f94517ab3890afabdc72f69d52ee1b27223d`다. 문서 병합과 운영 배포를 구분한다.
- #246의 [Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/40167421715)와
  [Deploy](https://github.com/goldmayo/oioi-bwg/actions/runs/40168460344)가 성공했다.
  검증한 두 immutable digest와 실제 VM/성공 receipt를 대조했고 최종 www 공개/거절 검사도 통과했다.
  상세 digest·콘텐츠 차이·복구 기준은 F 결과가 소유한다.
- 서비스는 www·Console과 apex→www redirect다. Web은 로그인 없는 공개 조회 전용이며 인증·관리는
  Console에서 제공한다. Console 공개에 자동 종료 기한은 없고 MFA enrollment는 닫혀 있다.
- 기존 VM DB·계정·MFA version 4·키·R2/assets·메일·독립 Worker·Hyperdrive를 보존했다.
  원래 26곡·7앨범은 불변이고 사용자 Console 작업으로 추가된 두 앨범을 포함한 최종 기준은 26곡·9앨범이다.
  현재 참조 중인 업로드 이미지도 보존했다.
- 옛 Web Worker 두 개·staging/preview 진입점·옛 배포 workflow와 전용 token 저장은 종료했다.
  정상 OCI Promotion과 squash-only 보호 설정을 유지한다.

## 별도 후속과 검증 한계

이 항목은 P06의 남은 전환 작업으로 재개하지 않는다. 각각 필요한 별도 범위에서 다룬다.

| 항목                    | 남은 범위와 근거                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G 계정 관리             | [G 계획](P06-G-PLAN.md)의 별도 기능 제안. 구현 전 G0 계약 개정이 필요하며 P07 선행 조건이 아니다.                                                                  |
| 추가 자원·부하 관측     | 평상시 읽기 관찰과 기존 재시작 증거만 있다. 사용자 DB 불변 범위에서 추가 동시 CRUD/장기 부하는 미실시다. 운영 전환 종료를 성능 수용량 검증 완료로 해석하지 않는다. |
| IAM/DB 후속 hardening   | B0 게시 최소 권한 재설계의 기존 보류와 DB role hardening을 유지한다. 현재 운영 검증 범위를 확대하지 않는다.                                                        |
| www/apex Origin CA 갱신 | 만료는 2027-10-25 15:04 KST. 자동 갱신 완료를 주장하지 않으며 [운영 안내](../../../../ops/oci/web-cutover.md)의 수동 갱신 절차를 따른다.                           |

기존 단계 결과의 실패·복구·보류 이력은 삭제하지 않는다. 사용자 제외 범위였던 두 회선/한도 소진 실험과
전체 관리자 자동 E2E를 이번 종료를 위해 다시 실행했다고 기록하지 않는다.

## 다음 checkpoint: P07

[로드맵](ROADMAP.md#2-실제-pr-단위) 순서대로 **세 종류 응원법과 선택 화면**을 진행한다.
[기존 CheerGuide 설계](DESIGN.md#5-cheerguide)가 입력이며 P03의 공통 코드와 P04/P05 Console guard를 재사용한다.

1. Domain의 FAN 분리·초기 Revision History 적용 범위를 먼저 명시하고 최소 CheerGuide 계약/저장 구조를 정한다.
2. 기존 가사 JSON과 미분류 데이터를 보존하며 수동 분류·저장·조회·LRC/삭제 경로와 동시 저장 충돌을 검증한다.
3. OFFICIAL/FESTIVAL/CONCERT 선택, 기본 우선순위, URL 선택 보존과 재생 유지 UI를 추가한다.

P07은 review 가능한 계약·저장/쓰기 전환·조회/선택 단위로 나눈다. 이 종료 기록은 P07 구현이나 운영 DB
migration 실행을 포함하지 않는다. P08 파형 작업은 별도 작업선이며 P07이나 G의 완료에 의존하지 않는다.
