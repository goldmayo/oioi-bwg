---
title: "Console·다중 응원법·파형 편집기 구현 순서"
kind: migration-plan
status: draft
authority: plan
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
created_at: "2026-10-05"
updated_at: "2026-10-29"
revision: 49
---

# 구현 순서와 PR 단위

[설계](DESIGN.md)를 구현하는 **10개 checkpoint**다. 전체 방향 승인 후 runtime/검증 구조 수정 지시를 반영했다.
P01~P06의 완료·검증은 [완료 지도](../COMPLETED-DESIGN-INDEX.md)와 각 RESULT에 둔다.
이 문서는 기능별 범위·의존성·완료 조건을 소유한다. 현재 상태·별도 후속의 유일한 목록은 [WORK](../../../WORK.md)다.

**2026-10-26 결과 반영:** P07 구현·로컬 검증을 완료했다. 운영 적용은 별도이며 P08~P10은 미착수다.
[P06 전체 결과](P06-RESULT.md)와 [P07 결과](P07-RESULT.md)가 각 완료 근거를 소유한다.
G 계정 관리·추가 부하 실험은 독립 후속이며 P07의 선행 조건이 아니다. 현재·보류 상태는 WORK에서 관리한다.

## 1. 코드 의존성과 운영 순서

```text
Console 전환 작업선
P01 앱 이동 → P02 Turbo/config/harness → P03 실제 공통 코드 추출
  → P04 Console 이관 → P05 TOTP → P06 두 앱 배포·Web Admin 종료
  → P06 A~F 전체 종료
       └─ P06-G 계정 관리: 별도 후속 기능 / P07 선행 조건 아님

Console 전환 뒤의 기능 작업선
  ├─ P07 CONCERT/FESTIVAL · 공식/팬덤 · 데이터/조회
  └─ 공통 Console 알림/FCM → P08 Waveform Job / OCI Queue / VM runner
       → P09 JSON 파형·Cue timeline → P10 수동 Grid/Snap/Nudge/Loop
```

**P06은 P07~P10을 기다리지 않는다.** 기존 가사 편집 기능과 MFA만으로 Console 전환을 완료할 수 있다.
위 기능 작업선은 운영상 권장 순서다. P07의 도메인 모델은 기존 Song/공유 코드에 의존하며 MFA 모델에 의존하지 않는다.
관리 API는 공통 Console guard를 재사용한다. P08은 CheerGuide 없이 기존 Song으로 구현할 수 있고,
P09~P10도 기존 가사 JSON을 입력으로 사용한다. BPM/beatOffset은 Song의 편집 설정으로 저장한다.
따라서 타입 추가와 파형 기능을 서로의 출시 선행 조건으로 묶지 않는다.

헌법·영역 architecture·Domain 변경은 해당 checkpoint의 규칙만 함께 반영한다.
기존 Server/FSD/API의 전면 개편이나 Queue/Notification framework를 이 전환의 선행 작업으로 만들지 않는다.

## 2. 실제 PR 단위

| ID / PR 제목                                                | 범위·DB/API/UI 변화                                                                                                                                                               | 코드 선행 / 운영 순서                                 | 완료 조건                                                                                                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 `refactor(workspace): 기존 앱을 웹 워크스페이스로 이동` | 기존 Next 앱을 apps/web로 이동. workspace·경로·단일 앱 Docker/CI 진입점만 보정. DB/API/UI 동일.                                                                                   | 현재 기준                                             | /admin 포함 기존 URL·asset·standalone image·검증 명령 동작 보존.                                                                                                                      |
| P02 `chore(config): 공용 설정과 검증 기반 분리`             | config/typescript·config/eslint, harness/architecture의 공통 primitive·repo 경계, workspace별 정책·독립 FSD root, Turbo/root verify/Husky.                                        | P01                                                   | workspace별 검사 정책이 분리됨. source/shared config/harness/policy/env 변경 시 필요한 검사 재실행, cache hit·전체 verify 확인.                                                       |
| P03 `refactor(workspace): 공통 계약과 서버 코드 추출`       | 실제 contracts/server·migration 경로 추출. React/Next request/session/HTTP adapter는 앱에 유지. 외부 계약 동일.                                                                   | P02                                                   | contracts 순수성·server-only·repository/service 방향·앱 간 의존 금지, 소비 앱 type-check/build 성공.                                                                                  |
| P04 `feat(console): 운영 화면과 API 이관`                   | Console entry·기존 Admin UI/API/업로드 Action 이관. Web 경로 임시 유지.                                                                                                           | P03                                                   | 접근 제한 환경에서 두 경로의 기존 작업 완주. 독립 build, direct import 없음.                                                                                                          |
| P05 `feat(auth): 콘솔에 간단한 TOTP 인증 적용`              | admin_mfa migration·Auth.js+otplib·등록 UI·limiter·Origin/CSRF·CLI reset·관리 guard. Auth/Domain 회수 규칙 반영.                                                                  | P04                                                   | password-only/비ADMIN/미등록/다른 앱 cookie 거절. replay·동시성·version 회수·제한된 재등록 검증.                                                                                      |
| P06 `feat(deploy): 두 앱 배포와 기존 관리 경로 종료`        | 두 image·기존 CD/Compose/Caddy/env/health/rollback 보정, preview Web을 www로 전환. Web 관리 route/API/Action·회원가입 페이지/가입 API 및 기존 Web Worker·staging 경로 종료.       | P04/P05. Audio/Guide 불필요.                          | ARM64 빌드 전 B0 IAM 실증·실제 Web/Console metadata 차단 후 Console 공개. 데이터/파일 보존, 최종 두 hostname·전용 cookie·인가·pool·복구 smoke, www 관리·가입 API 직접 호출 실패.      |
| P07 `feat(guide): 두 공연 모드의 데이터와 조회 기반 추가`   | Guide/Snapshot/Publication·공식/팬덤·수동 이관·기존 writer 호환·공개 조회/선택. 새 관리자 편집은 후속.                                                                            | 모델 P03, 관리 화면 P04의 공통 guard. 운영상 P06 후.  | 0/1/2개·URL/재생·출처·visibility·내용 보존. 이관/LRC/삭제·동시성·불변성·rollback 검증 후 reader 전환.                                                                                 |
| P08 `feat(waveform): 큐 기반 일회성 파형 작업 추가`         | WaveformJob/결과 migration·active Job 재사용·202/status API·OCI Queue/DLQ·Runner Instance Principal/Unix socket·worker·내부 결과 API·FCM·알림 내역. Domain source/lifecycle 반영. | P03/P04 및 관리 guard P05. 운영상 P06 후, P07 불필요. | 동시 생성/재전달·visibility 연장·저장 전 delete 금지·DLQ→FAILED·enqueue/DB 경계·IAM/socket/metadata 제한·FCM 재수신/알림 실패 검증. ARM64/비영속성 및 3개 anchor의 offset/drift 검증. |
| P09 `feat(editor): 파형과 큐 타임라인 편집 제공`            | Peaks.js·YouTube adapter·overview/zoom/playhead·point drag·RHF draft/history.                                                                                                     | P04/P08, 기존 가사 JSON 사용 가능.                    | JSON만으로 표시·재생/seek 동기화·1회 Undo/취소·기존 캡처/LRC/강조 보존. 누적 drift 미해결이면 integration 완료로 처리하지 않음.                                                       |
| P10 `feat(editor): 박자 격자와 이동 반복 도구 추가`         | Song의 BPM/beatOffset 편집 설정 JSON·Grid/Snap·Nudge/Fine Nudge·Cue/A-B Loop·focus/IME 단축키.                                                                                    | P09, P07 불필요.                                      | 120 BPM 수식·Snap ON/OFF·기존 Cue 불변·경계/Undo 검증, 같은 작업의 소요 시간·오차 확인.                                                                                               |

한 행은 독립 검증 가능한 concern/checkpoint다. 앱 이동은 rename 비중 때문에 파일 수 기준을 넘을 수 있다.
이 경우 이동→경로 보정→동작 검증 순서를 PR에 적는다. 실제 diff가 20파일/400줄 목표를 크게 넘으면
해당 checkpoint 안에서 준비/계약/구현으로 나누며 빈 패키지나 범용 플랫폼 PR을 선생성하지 않는다.

2026-10-26 사용자 지시로 세 종류 분류를 두 모드와 출처 속성으로 개정했다.
P07의 구현 PR은 [설계 §5.6](DESIGN.md#56-구현-pr-순서와-완료-조건)의 계약/persistence → 이관/기존 writer 호환 → 조회/선택 순서로 나눈다.
새 관리자 편집·초안/공개·복원·검토 기능은 P07 이후의 별도 관심사이며 P08~P10의 선행 조건으로 추가하지 않는다.

### 2.1. P08 착수 계획

**2026-10-29 host socket 연결 준비:** #332의 Docker 실행 뒤 Runner 중복 기동 방지용 host lock·Unix socket의 소유권/권한·stale socket 회수를 구현한다. #333 DLQ 소비와 합친 뒤 상주 실행/종료·설치로 연결한다. 실제 VM 디렉터리/전용 그룹 생성·Console mount·서비스 활성화는 별도 승인 관문이며 이 코드 PR은 VM을 변경하지 않는다.

**2026-10-29 DLQ 복구 구현:** 일반 소비와 같은 슬롯에서 DLQ 한 건을 받아 잔존 컨테이너 부재·Job/source·현재 attempt를 확인한 뒤 기존 terminal API로 회수한다. 로컬 SDK/HTTP 경계 검증을 실제 OCI DLQ 수용으로 간주하지 않는다. 다음은 상주 Runner의 시작/종료·단일 프로세스 잠금·설치 연결이며, VM 변경과 운영 활성화는 별도 승인 관문이다.

**2026-10-29 Docker 실행 연결:** #331 소비 흐름 뒤 고정 이미지 ID·이름/label·명령·자원 한도의 Docker 어댑터를 연결한다. 합성 stdin은 패키지 내부 검사에서만 사용하고 production Run은 승인 videoId의 yt-dlp 경로만 실행한다. 실제 로컬 Docker 분석·취소·정리·자원 옵션과 다른 label의 컨테이너 보호를 CI ARM64에 포함한다. 운영 egress 네트워크 생성·격리 확인과 설치/활성화는 이번 코드 작업에 포함하지 않는다. VM 변경·운영 배포는 이후 별도 승인이 필요하다.

**2026-10-29 소비 흐름 연결:** #330 결과 호출 뒤 수신·잔존 worker 정리·Job/source 대조·시작·실행·terminal 확인·Queue 삭제를 한 실행 범위로 연결한다. 일시 분석 실패는 재전달에 맡기고 정리 불확실은 Consumer 격리로 처리한다. HTTP/SDK fixture와 가짜 worker의 검증이며 실제 Docker 실행·DLQ·재시작 복구·상주 서비스는 후속이다. 다음 PR은 고정 Docker 실행/정리 어댑터다. 로컬 구현에는 VM 변경·운영 배포가 필요 없고, 실제 설치·socket/격리 설정·활성화는 별도 승인 후 수행한다.

**2026-10-29 결과 호출 연결:** #329 뒤 기존 terminal API의 Go client를 연결한다. 전송 본문 전체 4MiB와 ACK의 Job/attempt/상태를 검사하며 응답 유실은 자동 재시도하지 않는다. 이후 소비 흐름과 고정 worker 실행·정리를 동작 단위로 연결한다. 이 호출부 구현에는 VM 변경·운영 배포가 필요 없으며, 실제 설치·격리 설정과 활성화는 별도 승인 관문이다.

**2026-10-29 Runner 시작 호출 분리:** [#324](https://github.com/goldmayo/oioi-bwg/pull/324)의 visibility 감시와 완료/연장 제한 시간 경합 보완을 통합했다.
다음 독립 단위는 기존 `/start`에 대한 Go client와 새 attempt ACK·응답 유실 경계다. terminal/result client → receipt/Job 대조·재전달/DLQ → 고정 worker 실행·정리와 설치 산출물 순서로 연결한다.
시작 ACK 검증만으로 실제 worker 실행·OCI 수용·운영 활성화가 완료되지 않는다. 상세 호출 계약은 DESIGN §6.2, 단일 PR 검증은 PR 본문에 둔다.

**2026-10-29 생성/enqueue 분리:** 사용자 조회로 실제 policy가 해당 Queue의 push/pull과 전용 Secret 읽기 3문장임을 확인했다. VM 권한 사용 실증은 별도다. 첫 구현 PR은 고정 Unix socket 송신부와 strict ACK·전달 불확실성·호출/응답 상한의 로컬 검증으로 분리한다. 다음 PR은 기존 Job 서비스를 재사용하는 기본 비활성 생성 API와 active 재사용·조건부 실패 반영이다. 이후 Runner/Queue 소비·복구 → 통합 수용 → 별도 Promotion 순서를 유지한다. 상세 송신 계약은 [DESIGN §6.2](DESIGN.md#62-oci-queue-연결과-완료-전달-계약)가 소유하며 mount·생성 route·운영 활성화는 이번에 적용하지 않는다.

**2026-10-29 Queue/IAM 생성 결과 확인:** #316은 `88e0f70d3508db7bccc3f00c1d70caf49bf27cac`로 병합됐고, 사용자 Cloud Shell 조회로 후속 Plan의 소스가 이 커밋임을 확인했다. 사용자가 공유한 Apply 로그는 Queue·전용 IAM 생성과 `2 added / 0 changed / 0 destroyed`를 보여준다. Queue output의 retention 86400초·delivery 5회·visibility 180초·poll 30초도 코드와 일치한다. 실제 IAM 문구·VM에서의 권한 사용·Queue 재전달/DLQ·Runner 설치/실행·배포 수용은 후속이다. Apply 로그만으로 저장 Plan 연결 metadata를 확정하지 않으며, 상세 실행 근거와 이 제한은 [#316](https://github.com/goldmayo/oioi-bwg/pull/316)에 둔다. 다음 구현 순서는 생성/socket enqueue → Runner/Queue 소비·복구 → 기존 알림 통합 수용 → 별도 Promotion이다.

**2026-10-29 시간대 검토 후속 완료:** 사용자 VM의 생성 설정은 명시적 time_type 없이 `%N%z`를 유지하며, 사용자가 제공한 기존 OCI 로그 한 건의 숫자 시각·event time·Docker time도 밀리초까지 일치했다. 9시간 오차가 없어 #316의 시간대 보류를 해제한다. 과거 로그 한 건의 확인을 현재 실시간 수집 수용으로 확대하지 않는다. 다음은 수정이 통합된 `migration_main`의 새 Plan에서 Logging 무변경·Queue/IAM 2 create를 확인하고 별도 승인으로 Apply하는 것이다. 실제 변경·계산·검증은 [#316](https://github.com/goldmayo/oioi-bwg/pull/316), 반복 절차는 [infra 안내](../../../../infra/oci/README.md#logging-parser-반복-차이-2026-10-29)에 둔다.

**2026-10-29 시간대 재검토:** 사용자 요청으로 과거 #101의 9시간 차이 수정을 대조했다. `%N%z`는 그대로이며 P08 병합분은 Logging 파일을 변경하지 않았다. #316은 명시적 시간 유형 제거의 실제 OCI 에이전트 동등성을 확인하기 전 Draft로 보류한다. upstream Fluentd의 UTC/KST 합성 비교와 실제 운영 확인을 구분한다. 아래 최초 Plan 대응의 병합 순서에 이 선행 관문을 추가하며, 절차는 [infra 안내](../../../../infra/oci/README.md#logging-parser-반복-차이-2026-10-29), 단일 PR의 상세 검증은 [#316](https://github.com/goldmayo/oioi-bwg/pull/316)이 소유한다.

**2026-10-29 실제 Plan 확인:** 사용자가 공유한 Job 구성소스는 `migration_main@938e52aa8abe34b8f2202b2b70cf40707b2fc4fb`다. Queue/IAM 두 개 생성과 기존 Logging의 `time_type="string"` 추가로 2 add/1 change/0 destroy였으며 Apply는 보류했다. API의 현재 parser는 `time-type=null`이고 UTC time-format은 코드와 같았다. 이 명시값만 제거하는 별도 수정과 합성 provider Plan으로 반복 차이를 검증하며, 실제 재Plan에서 Logging 무변경·2 create 확인 후 별도 Apply 승인이 필요하다. 운영 절차는 [infra 안내](../../../../infra/oci/README.md#logging-parser-반복-차이-2026-10-29)가 소유한다.

**2026-10-28 후속 준비:** #313(`a1f80b24bafb0de00945d1596940081fbf8cb28d`) → #314(`b9722039130a7128941306940967965c7a29e050`)를 최신 head의 CI 통과 후 squash 병합했다. #315에서 두 선행 문서를 보존해 통합한다. 전용 Secret 생성은 사용자 보고이며 값·OCI 상태는 조회하지 않았다. Stack 변수는 Plan 전에 입력하고 실제 Plan/Apply·VM 설치·worker 게시/Promotion 수용은 별도다.

**2026-10-28 acquisition 재설계:** #310→#311→#312는 병합됐다. #313(enqueuedAt/start) → #314(기본 비활성 Queue/IAM) → 공식 yt-dlp acquisition 순서로 통합하고 겹치는 WORK/이력은 보존한다.
사용자 요청으로 입력 계약을 [Domain §20.2](../../DOMAIN_SPECIFICATION.md#202-source-policy)의 조건부 허용으로 개정한다. 구체적 권리·기간·입력 승인과 전용 egress 검증 전에는 외부 영상을 추출하지 않는다.
[DESIGN §6.4](DESIGN.md#64-yt-dlp-acquisition-2026-10-28-개정)의 고정 CLI 이미지·Rust 제한·로컬 합성 검증을 먼저 분리한다. native Rust 추출기 자원 비교·실제 YouTube 성공은 확인하지 않았다.
다음은 생성/socket enqueue → Go Runner/Queue 소비·복구 → 기존 알림 통합 수용 → 별도 Promotion이다. Queue를 수동 생성하지 않고 #314의 Resource Manager Plan에서 생성 여부·IAM diff를 검토한 뒤 별도 승인으로 Apply한다.
Queue 생성만으로 Runner 설치가 끝나지 않는다. 고정 Runner·전용 egress·token/socket 배치와 VM 설치 절차의 후속 구현·별도 승인이 필요하다. 로컬 mock과 실제 OCI/VM/실기기 수용을 구분한다.

**2026-10-28 배포 준비:** #313은 `a1f80b24bafb0de00945d1596940081fbf8cb28d`로 병합됐다. #314 → #315 순서로 최신 base와 검증을 반영한다. 사용자는 아직 OCI 작업 전이며 Secret/Plan/Apply·VM 설치·Promotion 완료로 간주하지 않는다.

**2026-10-28 인프라 준비 분리:** 전달 확인/start [#313](https://github.com/goldmayo/oioi-bwg/pull/313) 뒤
기본 비활성 Queue·제한 IAM·Runner Secret OCID 입력을 별도 PR로 통합한다. runtime 의존은 없으며 WORK 겹침은 최신 base에 맞춘다.
revision 31은 #313의 30 다음 개정이다. 실제 적용 순서·허용 diff와 네트워크 없는 합성 provider Plan 검사는
[기존 인프라 안내](../../../../infra/oci/README.md#p08-queuerunner-인증-준비-2026-10-28)가 소유한다.
운영 Secret 생성·Resource Manager Plan/Apply·VM 설치/배포는 각각 별도 승인 전 실행하지 않는다.

**2026-10-28 선행 통합 후 착수:** #310 → #311 → #312 순서로 squash 병합했다.
다음 독립 단위는 전달 확인 기록과 조건부 start 내부 API다. 최초 전달 확인 불변·null 상태 소비,
동시/지연 start의 expectedAttemptId 비교와 이전 결과 무시를 실제 로컬 PG에서 검증한다.
공개 생성/enqueue·socket/Go Runner·실제 Queue visibility/DLQ 수용과 운영 활성화는 여전히 후속이다.

**2026-10-28 내부 API 구현 분리:** 승인한 [OCI Queue 설계 #311](https://github.com/goldmayo/oioi-bwg/pull/311)에 따라
첫 통신 PR은 Runner 상태 조회·완료 콜백과 최소 DTO/ACK만 추가한다. 기존 저장·알림 transaction을 재사용하며
[Auth §4.2](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md#42-p08-runner의-내부-상태-조회결과-반영)의
기본 비활성·별도 토큰 경계를 따른다. #310 → #311의 squash 병합 결과를 먼저 반영하고 이 구현을 검증한다. WORK/ROADMAP 충돌은 양쪽 근거를 보존해 통합했다.
생성/enqueue·enqueuedAt 기록·start·socket/Go Runner·실제 OCI·운영 활성화는 후속 검증 단위다.
source 정책 확인 전에도 합성 입력 기반 검증은 진행하되 운영 credential·DB·IAM·배포 승인을 확대 해석하지 않는다.

**2026-10-28 실행 분리 추가:** fetch한 `origin/migration_main@f8a59be59cc4e16fdc6719f7f3f6ccac448fa4c1`에서 착수했다.
#302/#303의 Job/결과·요청자 알림 transaction, 조회/결과 화면과 #307의 0011/0012 운영 적용·공통 FCM을 재사용한다.
운영 Chrome OS 수신도 사용자 확인을 마쳤다([후속 기록](../../../devlog/20261027-28-notifications.md)).
아래 2026-10-27의 구현 부재 관찰과 당시 Firebase 준비 항목은 현재 미완료 목록이 아니다.

**2026-10-28 언어 선택 추가:** 로컬 비교 후 사용자 선택으로 분석 worker를 Rust로 전환한다.
근거·현재 실행 경계는 [기술 검토](AUDIO-FEASIBILITY.md#1-필요한-도구만-사용), 계약은 Domain §20.3이 소유한다.
Rust fmt/unit/Clippy·ARM64 실행 검증을 CI 필수 gate에 연결하며 운영 source/Queue/배포 관문은 유지한다.

**2026-10-28 OCI Queue 설계 추가:** 사용자 선택으로 OCI Queue와 제한 Unix socket 경계를 유지한다.
enqueue/consume을 맡는 같은 VM Runner와 Rust 분석기의 책임, 내부 API/완료 전달, Queue 설정 후보는
[설계 §6.2](DESIGN.md#62-oci-queue-연결과-완료-전달-계약)와 [§6.3](DESIGN.md#63-queue-설정-후보와-활성화-관문)이 소유한다.
기준은 fetch한 `origin/migration_main@f8a59be59cc4e16fdc6719f7f3f6ccac448fa4c1`이다.
0011/0012·공통 알림과 Job 저장 기반은 운영 반영됐고 운영 Chrome OS 수신은 사용자 확인 상태다.
아래 2026-10-27의 구현 부재/Firebase 준비 관찰은 당시 기록으로 보존하며 재구현 지시로 사용하지 않는다.

이 설계 단위는 문서만 변경한다. [Rust 분석 도구 #310](https://github.com/goldmayo/oioi-bwg/pull/310)의
합성 입력 실측과 실제 OCI 실증을 구분하며 새 OCI 호출·리소스/IAM·DB·배포는 실행하지 않는다.
후속 병합 순서는 다음과 같으며 각 구현 PR을 20파일/400줄 목표의 독립 검증 단위로 추가 분할할 수 있다.

| 순서 | PR 관심사와 선행 조건 | 완료 근거 |
| --- | --- | --- |
| 1 | #310 분석 도구 → #311 OCI Queue 설계 → #312 내부 상태/완료 API | #310은 squash 병합 완료. #311은 해당 base를 반영하고 WORK/ROADMAP의 Rust 선택·통신 설계를 함께 보존 |
| 2 | source 공급 계약·생성/내부 API·socket enqueue | 허용 근거·재공급 계약, 기존 PG 동시성/terminal 재사용, 응답 불확실성 계약. 운영 생성 진입점은 비활성 유지 |
| 3 | Go 공식 SDK Runner·Queue 소비/복구·고정 Rust 실행 | ARM64 로컬 fault 검증과 비밀 없는 Terraform Plan. 운영 credential·OCI/IAM·host 적용은 별도 승인 |
| 4 | 기존 알림 producer 연결·통합 수용·별도 Promotion | 실제 OCI/허용 입력/offset·drift/실기기 증거와 기존 metadata 차단. P09/P10·badge는 제외 |

source 정책 확인 전에도 합성 입력용 통신/복구 계약과 로컬 구현·검증은 진행할 수 있다.
운영 source·생성 경로 활성화는 이용 범위와 Queue 대기/재시작/재전달 뒤 입력 재공급 경로를 확인한 뒤에만 진행한다.



**2026-10-27 추가:** 사용자의 P08 계획 구체화 요청을 반영한다. 기준은 fetch한
`origin/migration_main@8f371d40d1809165167a524456b990c7b0f319b9`이며, 해당 source의
`apps/console`, `packages`, `scripts`, `infra`에는 WaveformJob·worker·Queue consumer 구현이 없다.
P07은 [운영 적용·배포 결과](P07-RESULT.md#2026-10-27-최신-앱-promotion과-운영-수용-확인)로 종료됐고,
새 관리자 응원법 편집은 별도 후속이다. 위 2026-10-26 기록과 초기 `source_commit`은 당시 근거로 보존한다.
아래는 실행 전 계획이며 ARM64 분석·Queue 실증·migration·배포를 완료했다는 기록이 아니다.

#### 범위와 계약 선행

P08 산출물은 관리자 생성/상태 조회, 정상 파형 JSON, OCI Queue/DLQ, VM-local Runner,
일회성 worker와 Console 알림 내역과 FCM foreground/background 수신이다. lifecycle·권한·실패 규칙은 [설계 §6](DESIGN.md#6-waveform-worker),
도구·JSON·시간축 검증은 [기술 검토](AUDIO-FEASIBILITY.md)가 소유한다.
P09 파형/Cue UI, P10 Grid, 이메일과 공개 Web 인증은 포함하지 않는다.
2026-10-27 사용자 승인으로 이전 인앱 내역·push 제외 범위를 대체한다. 공통 알림을 P08 consumer보다 먼저 구현한다.

현행 [Domain §20.2](../../DOMAIN_SPECIFICATION.md#202-source-policy)는 YouTube를 production 파형 source로
허용하지 않는다. 첫 구현은 실제 사용할 영상의 이용 범위를 확인하고 Domain의 source·Job·결과 생명주기를
개정하는 것부터 시작한다. 이 계획만으로 현행 계약을 대체하지 않는다. 해당 경로를 허용할 수 없으면
YouTube 추출은 진행하지 않고 허용된 source 범위를 다시 결정한다.
Auth(04)·API(03/05)·server/transaction(06)·Query(07)·관측(09)·runtime(11)·배포(12)의
변경되는 계약만 같은 관심사의 구현 PR에서 갱신한다.

#### 구현 PR 순서와 통과 기준

| 관심사                    | 구현·영향 경계                                                                                                                    | 다음 작업 전 확인할 결과                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 입력 계약·ARM64 분석 검증 | Domain source 계약, 고정 버전의 yt-dlp/ffmpeg/audiowaveform 이미지. 허용된 단일 videoId와 pipe/tmpfs 경계                         | 실제 ARM64에서 짧은/긴 입력의 정상 JSON, CPU/RSS/tmpfs/출력 크기·소요 시간, 실패/timeout/강제 종료 뒤 음원·하위 프로세스 잔존 없음. 초반·중간·후반 anchor의 허용 오차와 실측 기록 |
| Job·결과 persistence      | `packages/contracts` DTO/Zod, server schema·repository·service, Drizzle migration. UUIDv7·단수 snake_case 사용                    | local Docker PostgreSQL에서 동시 생성·terminal 이후 재생성·attempt/source 조건부 반영·정상 JSON 보존·결과와 성공 상태의 atomic commit 확인                                        |
| 생성·조회·enqueue         | Console ADMIN/MFA Route Handler·Ky/Query와 좁은 내부 Job API, Runner Unix socket/Queue push. worker·Runner의 앱 DB 직접 접근 금지 | 동시 POST·연속 클릭·응답 유실 재요청이 같은 jobId를 반환. enqueue 확정 실패/성공/불확실 구분, null enqueuedAt 소비, 추가 enqueue 없는 수렴 확인                                   |
| 소비·복구·운영 경계       | `infra/oci` Queue/IAM, 고정 배포 설정의 Runner/worker, 내부 결과 API. 기존 Web/Console metadata 차단 유지                         | 실제 제한된 OCI 환경에서 long poll·visibility 연장/상실·DLQ·Runner/VM 재시작·잔존 container 정리·저장 후 delete 실패를 실증. token/socket/metadata/DB 격리 확인                   |
| 공통 알림 선행            | Notification/기기 등록/발송 대기 persistence·API → Console dispatch/FCM → 알림함·배지·SW/토스트                                   | 중복·rollback·재시도·재시작·회수·권한 거부/미지원·focus 재조회. 실제 foreground/background/닫힌 탭 push와 별도 mock 검증                                                          |
| P08 알림 연결             | Job 요청자 등록·성공/최종 실패 transaction에 요청자별 알림 연결                                                                   | 완료 직전 요청·중복 결과·Queue 재전달·다중 기기, FCM 장애 중 결과/내역 보존                                                                                                       |
| 통합 수용·Promotion       | 실제 ARM64 이미지 digest와 기존 두 앱 배포·관측·복구 경로 연결                                                                    | 아래 수용 검증 완료 후 별도 Promotion. DB migration과 이전 호환 앱·Runner/worker digest의 복구 조합을 검토하고 진행 중 Job 보존 확인                                              |

한 관심사는 기본 한 PR로 검토하되 20파일/400줄 목표를 넘으면 독립 검증 가능한 계약·구현·전환으로
추가 분리한다. P08 내부에 새 단계 번호나 빈 플랫폼 package를 만들지 않는다. 소비·복구 검증 전에는
운영 Console의 생성 진입점을 활성화하지 않는다. 최초 분석 검증용 최소 renderer는 JSON·시간축 확인만
수행하며 P09의 editor 구현으로 확대하지 않는다.

#### 첫 persistence PR에서 고정할 판단

- 동일 `(song_id, video_id)`에서 `QUEUED/RUNNING`만 포함하는 **partial unique index**를 우선안으로 한다.
  충돌한 요청은 기존 active Job을 조회하며, INSERT에 성공한 요청만 enqueue를 소유한다.
  terminal 전환 경합과 transaction rollback은 실제 PostgreSQL 동시성 테스트로 확인한다.
  [PostgreSQL 17 partial index](https://www.postgresql.org/docs/17/indexes-partial.html)를 근거로 하며 최종 SQL은 생성 migration에서 검토한다.
- source가 현재 Song 영상과 일치하고 현재 `attempt_id`를 소유한 실행만 결과를 반영한다.
  Song 영상 변경·삭제와 실행/결과 반영의 경합, FK 삭제 정책과 기존 정상 파형 조회 조건을 DDL 전에 명시한다.
  파형 재생성이나 source 변경이 기존 Cue 시각을 자동 변경하지 않도록 한다.
- SDK retry와 enqueue 호출 소유권을 포함해 응답 유실을 추가 PutMessages로 복구하지 않는지 확인한다.
  stale 판정은 가장 늦은 enqueue 가능 시점 + 실제 최대 retention + 시계/관측 안전 여유로 정한다.
  전달이 확인된 Job의 retention 만료와 중단된 RUNNING 회수도 정리 대상·조건을 명시한다.
- Job·결과의 보관/삭제 기간, 조회 응답의 부재 표현·오류 코드, 내부 API 인증/인가 범위와 응답 유실 시
  재호출의 멱등성을 계약 테스트로 고정한다. 수치·endpoint는 구현 전 해당 DTO/배포 설정에 확정한다.

**2026-10-29 생성 연결 추가:** [#318](https://github.com/goldmayo/oioi-bwg/pull/318)을 CI 통과 후 squash했다.
기본 비활성 생성 API는 기존 request/terminal·FCM을 재사용하고 source 승인 목록·새 Job만 송신·확정 미전달의 조건부 실패를 연결한다.
VM 사용자 점검은 ARM64·Docker/cgroup v2·앱 health와 여유 용량만 확인했다. 실제 Runner/Queue 권한·격리·부하 수용은 아니다.
다음은 Go Runner의 공식 SDK push/pull·복구와 설치 산출물이며, 준비 전 수동 설치 스크립트 실행을 요구하지 않는다.
운영 flag·socket mount·credential 공급·배포는 별도 승인과 실제 수용 뒤 진행한다.

**2026-10-29 Runner 착수:** #319 생성 API를 CI 통과 후 병합했고 사용자 확정은 Go Runner/Rust worker다.
첫 Go PR은 공식 SDK의 고정 Queue 송신·자동 재시도 금지·응답 유실/한도/취소를 ARM64에서 검증한다.
송신부 → socket/Job 대조·enqueuedAt 확인 → Queue 소비/visibility·복구·고정 worker 실행 → 설치 산출물 순서다.
앞의 VM 사전 점검을 실제 권한 사용·상주 자원·운영 수용으로 확대하지 않는다.

**2026-10-29 내부 client 분리:** #320 Queue 송신부는 CI 통과 후 병합했다. 다음 연결을 작은 PR로 나눠
고정 loopback 내부 Job client의 인증·DTO·명확한 404·기록 응답 유실을 먼저 검증하고 socket 접수를 연결한다.
이 구현은 VM 접속 없이 로컬 ARM64에서 진행하며 runtime Secret 주입·설치·실제 OCI 수용은 별도 관문이다.

**2026-10-29 socket 접수 연결:** #321 내부 client는 CI 통과 후 병합했다. Unix 전용 접수·source/Job 대조·
단일 Put와 전달 확인을 연결하고 실제 로컬 socket에서 응답 유실·한도·진행 중 중복을 검증한다.
다음은 Queue 소비/visibility·재전달/DLQ·고정 worker 실행과 시작/정리다. VM 변경은 설치 산출물 검토 후 별도 승인한다.

**2026-10-29 Queue 수신부 분리:** #322는 CI 통과 후 병합했다. 공식 SDK의 한 건 수신·visibility 연장·receipt 삭제와
응답/입력 한도·재시도 금지·취소를 로컬 ARM64에서 검증한다. 아직 consumer 실행 loop나 worker를 활성화하지 않는다.
다음은 heartbeat/소유권 상실 중단 → Job/start·terminal 확인과 재전달/DLQ → 고정 worker·시작/정리·설치 산출물이다.
실제 OCI receipt/시간·권한·자원 검증과 VM 변경은 별도 수용 관문으로 유지한다.

**2026-10-29 visibility 범위 연결:** #323은 CI 통과 후 병합했다. heartbeat와 안전 기한·취소/정리 대기·
미종료 SDK의 Consumer 격리를 연결하고 로컬 ARM64에서 검증한다. Go/Python 대안 검토 뒤 Go 유지 결정을 DESIGN에 구분해 남겼다.
다음은 Job/start·terminal 확인 및 재전달/DLQ → 실제 고정 worker 중단/제거 → 상주 기동·설치 산출물 → 실제 OCI/VM 통합 수용이다.
실행 범위 취소 신호를 실제 container 정리 완료로 계산하지 않으며 운영 변경·배포는 별도 승인 관문을 유지한다.

#### 공통 알림의 선행 구현

[설계 §6.1](DESIGN.md#61-공통-알림과-fcm)과 [Domain §15](../../DOMAIN_SPECIFICATION.md#15-notification)를 따른다.
순서는 계약 개정 → 알림/등록/발송 대기 schema·조회/읽음 API → FCM dispatch → Console 알림함/SW → P08 producer 연결 → 통합 수용이다.
서버 transaction은 결과·Job terminal·요청자별 유일 알림·기기별 발송 대기를 함께 저장한다.
발송은 기존 Console 프로세스가 담당하고 60초 복구 scan·lease/backoff·24시간 TTL을 사용한다.
FCM 실패는 결과와 Queue ack를 실패로 바꾸지 않는다. 수신자·현재 MFA/binding을 발송 직전에 재검사한다.
권한 거부/미지원에는 내역·복귀 재조회를 제공하며 브라우저 주기적 polling은 없다.
첫 producer는 요청한 관리자에게 보내는 WAVEFORM_SUCCEEDED/WAVEFORM_FAILED다.
읽음은 항목 선택/모두 읽음으로만 처리하고 알림 내역은 v1에서 자동 삭제하지 않는다.
Firebase 프로젝트/VAPID/server 권한 준비 후 실제 수신을 검증한다. 운영 DB 변경·배포는 별도 Promotion이다.

#### 공통 알림 PR의 병합 순서

**2026-10-27 구현 제출·병합 조정 추가:** 아래는 승인한 구현 계획의 실행 PR과 의존성이다.
기존 실증 계획을 완료 결과로 소급 변경하지 않는다. 공통 알림 코드를 먼저 만들고,
생성 HTTP 경로와 Runner를 열지 않는 Job/terminal 저장 준비를 앞당겨 atomic commit을 실제 PG에서 검증했다.
source 이용 승인·ARM64 분석·OCI Queue 실증은 여전히 P08 활성화 전 조건이다.

**2026-10-28 UI 후속 제출 추가:** 차콜 표면·표 너비, 대시보드/브랜드 탐색, 알림 시각 개선을 각각 #304/#305/#306으로 분리했다. 알림 전달 계약과 P08 실행 범위는 확장하지 않는다.

**#295 → #296 → #297 → #298 → #299 → #300 → #301 → #302 → #303 → #304 → #305 → #306** 순서로 병합한다.
사용자 우선순위에 따라 앨범/곡 ID 열 제거 [#294](https://github.com/goldmayo/oioi-bwg/pull/294)를 먼저 병합한다. 기술적 의존은 없는 독립 변경이다.
아래 부모는 최초 분기점으로 고정한다. 이후 검토 커밋을 포함해 해당 부모 이후의 고유 변경만 옮긴다.

| 순서 | PR / 관심사                                                                                       | 원래 부모 SHA                              | 고유 구현 커밋                         |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| 1    | [#295](https://github.com/goldmayo/oioi-bwg/pull/295) 계약·계획·병합표                            | `8f371d40d1809165167a524456b990c7b0f319b9` | `87a02f9`, `a14b30e` 및 이 병합표 개정 |
| 2    | [#296](https://github.com/goldmayo/oioi-bwg/pull/296) Notification/기기/발송 대기 schema          | `8f371d40d1809165167a524456b990c7b0f319b9` | `52162b9`, `9c275b2`                   |
| 3    | [#297](https://github.com/goldmayo/oioi-bwg/pull/297) 계정별 알림 조회·읽음 API                   | `9c275b2c87ad7851dad1e6948c24a8a6f7877fb1` | `a5813b3`                              |
| 4    | [#298](https://github.com/goldmayo/oioi-bwg/pull/298) 브라우저 등록·MFA/계정 회수                 | `a5813b3f81733fd77b4396dae5cf31bda9533dee` | `ed4c0ac`                              |
| 5    | [#299](https://github.com/goldmayo/oioi-bwg/pull/299) Console FCM 발송·lease/복구                 | `ed4c0acc12139eab6bccec51d8fe243726f31808` | `b69b645`                              |
| 6    | [#300](https://github.com/goldmayo/oioi-bwg/pull/300) 지연 SDK·SW 로컬 번들·runtime 설정          | `b69b645bc1493f090f02f6734ea0fe1c5cf01d9b` | `d297fed`                              |
| 7    | [#301](https://github.com/goldmayo/oioi-bwg/pull/301) 알림함·배지·foreground 토스트               | `d297fede670a88f08006672c2ecd3116bbcdb20a` | `c8a8efc`                              |
| 8    | [#302](https://github.com/goldmayo/oioi-bwg/pull/302) P08 Job/결과/요청자 알림 atomic commit 준비 | `c8a8efcf72b5ec5628242a2541dbd255b606e36a` | `2157e70`, `e9138f3`                   |
| 9    | [#303](https://github.com/goldmayo/oioi-bwg/pull/303) 결과 조회·Query 갱신·해제 실패 복구         | `e9138f3d9d06cc195ffda638db8f853a98091e41` | `4d2f272`                              |
| 10   | [#304](https://github.com/goldmayo/oioi-bwg/pull/304) 차콜 표면·목록 너비·텍스트 위계             | `7759c784cdd8be021780f802b7c6def4342d96b1` | `2c36968`, `a55a516`                   |
| 11   | [#305](https://github.com/goldmayo/oioi-bwg/pull/305) 대시보드·반응형 탐색·기존 브랜드 로고       | `a55a516fa34d23e225169064970f210183db3615` | `79baaab`, `6bf6e53`                   |
| 12   | [#306](https://github.com/goldmayo/oioi-bwg/pull/306) 반응형 토스트·알림함·작업 결과 UI           | `6bf6e5329acaa2015b16f5fe6538b93919e3b20c` | `9135fc1`                              |

#304의 원래 부모 `7759c784`에는 로컬 통합 화면 확인용 #294 cherry-pick이 들어 있다.
#294와 #295~#303이 squash된 뒤 이 부모 이후의 고유 변경만 옮겨 ID 제거와 알림 기반을 중복 반영하지 않는다.
#304/#305/#306의 고유 범위는 각각 7/5/7파일, 134/301/289줄이며 전체 base diff에는 선행 코드가 포함된다.

모든 구현 PR의 대상은 `migration_main`이다. 후속 코드 PR은 선행분을 포함하며 #297 이후는 draft이므로
선행이 병합되기 전 `migration_main` 전체 diff를 독립 PR 범위로 해석하지 않는다.
검토할 때 `git diff <원래 부모>...<작업 브랜치>`로 고유 변경을 확인한다.

선행 PR을 squash한 뒤 담당자는 다음 순서로 **한 PR씩** 갱신한다. 실제 병합을 자동 수행하는 절차가 아니다.

1. `git fetch origin migration_main` 후 선행 squash가 통합됐는지 확인한다.
2. 깨끗한 작업 트리에서 `git rebase --onto origin/migration_main <표의 원래 부모 SHA> <해당 feature 브랜치>`를 실행한다.
   #295 이후 #296도 같은 방식으로 옮기며 동일한 Domain 개정은 통합본을 보존한다.
3. 고유 diff·commit 보존과 충돌 해결을 검토하고 필수 검증/CI를 다시 통과시킨다.
4. 원격 변경 유무를 확인한 뒤 해당 작업 브랜치만 `git push --force-with-lease`한다.
   제목·본문을 최종 변경/검증에 맞춰 갱신하고 선행이 사라진 PR 하나만 ready로 전환한다.
5. 해당 PR을 squash한 다음 표의 다음 PR로 진행한다. 선행 커밋을 수동으로 합치거나 통째로 재병합하지 않는다.

**코드 병합과 활성화는 별개다.** `CONSOLE_PUSH_ENABLED=false`가 기본이다. 2026-10-27 이 표 작성 시에는
Firebase 프로젝트가 없어 실제 FCM 수용이 미완료였다.
**2026-10-28 수용 추가:** 프로젝트를 연결한 로컬에서 실제 FCM 접수와 Chrome foreground 토스트,
Windows OS 알림, 개수/내역/결과 이동을 사용자와 확인했다([실행 근거 #303](https://github.com/goldmayo/oioi-bwg/pull/303)).
닫힌 탭·OS 클릭·iOS 홈 화면 앱·기기 회수의 실제 수용은 여전히 미확인이다.
#304~#306의 컴포넌트 프리뷰/빌드 검증은 새 실제 FCM·OS 실수용이나 운영 활성화로 계산하지 않는다.
설정/rollback 절차는 [운영 안내 §9.2.2](https://github.com/goldmayo/oioi-bwg/blob/b69b645bc1493f090f02f6734ea0fe1c5cf01d9b/ops/oci/README.md#922-console-fcm-알림-활성화)를 따른다.
실행한 검증·최초 실패와 복구·제약은 각 PR 본문이 소유한다. Job 생성 HTTP/내부 Runner HTTP·OCI Queue/worker·ARM64 실증은
후속 P08 범위이며 이 표의 코드 병합만으로 P08 전체를 완료로 처리하지 않는다.
운영 DB migration/권한 적용·배포는 별도 Promotion과 [현행 runbook](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)을 따른다.

**2026-10-28 통합 실행 추가:** #294를 먼저 병합한 뒤 #295~#306을 위 순서로 각각 최신
`migration_main`에 재배치하고 필수 검증·CI를 통과시켜 squash 병합했다.
통합 source는 `5bed878e03edf05b00ce335059c361f7f46810cb`다.
Vault 읽기 권한·보호된 VM 설정과 승인된 백업/복원 리허설·신규 테이블 6개 적용을 마쳤으며,
정상 [Promotion #307](https://github.com/goldmayo/oioi-bwg/pull/307)으로 검증한 동일 ARM64 두 digest를 배포했다.
source와 실제 squash tree·배포 receipt가 일치하고 exit 0, 기존 런타임/DB 보존과 health/readiness 200을 확인했다.
Console의 FCM을 활성화했으며 Web에는 Firebase 개인키가 없다. 현행 설정·복구는
[운영 안내 §9.2.2](../../../../ops/oci/README.md#922-console-fcm-알림-활성화)를 따른다.
개별 검증·실패/복구와 최종 배포 근거는 각 PR 및 #307이 소유한다.
운영 기기의 실제 등록·전경/백그라운드·닫힌 탭·OS 클릭·iOS/회수 수용은 미확인이다.
생성 API·OCI Queue·Runner는 이번 통합에 포함하지 않았다. 현재 후속은 [WORK](../../../WORK.md)에 유지한다.

#### 실증 전 확정할 값과 최종 수용

worker 이미지·도구 버전/digest, 입력 길이·JSON byte·CPU/RAM/pids/tmpfs 한도·전체 timeout,
Queue retention·visibility·연장 주기·최대 delivery count·stale 여유, 시간축 허용 오차를
ARM64 측정과 실제 Queue 설정으로 고정한다. [OCI Queue 개요](https://docs.oracle.com/en-us/iaas/Content/queue/overview.htm)와
[소비 계약](https://docs.oracle.com/en-us/iaas/Content/queue/consume-messages.htm)의 retention/visibility를
혼동하지 않는다. [Queue IAM](https://docs.oracle.com/en-us/iaas/Content/queue/policy-reference.htm)에 맞춰
Instance Principal의 고정 Queue push/pull 범위를 제한하고, [Docker tmpfs](https://docs.docker.com/engine/storage/tmpfs/)의
swap 가능성과 memory 한도 포함 조건도 확인한다. 이 문서의 공식 문서 재확인은 2026-10-27이며 실제 OCI 실증과 구분한다.

각 구현 PR은 해당 단위/계약/PG/Playwright 검증과 저장소 필수 검사를 기록한다. P08 종료는
§3의 enqueue 응답 유실 시나리오, 실제 Queue 재전달·복구·권한 제한, 음원 비영속성,
3개 이상 anchor의 offset/drift와 JSON만 재조회하는 검증이 모두 근거를 남겼을 때 판정한다.
검증 전에는 배포 성공이나 mock 통과만으로 종료하지 않는다. 실행 상세는 각 PR, 단계 최종 결과는
완료 시점의 최종 결과 소유 문서에 두고 현재 다음 행동은 WORK에서만 갱신한다.

### 2.2. P09 시안 구현과 P08 병행 실행 (2026-10-29)

사용자가 현재 편집기 캡처와 Impeccable 시안을 확인한 뒤 시안 구현을 지시했다.
기존 P08→P09의 통합 수용 순서는 유지하되, 저장된 BBC waveform JSON과 기존 가사 JSON만으로
검증할 수 있는 UI는 P08 Runner 작업과 별도 worktree에서 병행한다. 원래 계획의 완료 조건을
소급 변경하거나 합성 fixture의 성공을 실제 영상 싱크 검증으로 대신하지 않는다.

구현 PR은 RHF draft·저장 중 편집 보존, 현재 곡/영상의 파형 조회, Peaks.js·YouTube adapter,
시안 UI·기존 기능 연결 순서로 나눈다. 파형 조회는 계정별 Query key와 ADMIN/MFA 경계를 사용하며
곡의 현재 youtubeId와 같은 JSON만 노출한다. 영상 변경 시 이전 파형을 숨기고, 저장 성공 뒤 해당
곡의 파형 Query를 무효화한다. 새 DB schema나 분석·Queue·Runner 변경은 포함하지 않는다.

시안은 기존 Console의 색·타이포·관리자 메뉴를 확장한다. 데스크톱은 영상과 가사 표 아래에
전체/확대 파형을, 모바일은 작은 영상→파형→가사 표를 둔다. Cue 이동은 preview만 갱신하다 놓을 때
초안을 한 번 변경하며 Esc/Undo, LRC·강조·추임새·시간 캡처를 보존한다. P10 기능은 포함하지 않는다.

브라우저 fixture의 합성 BBC JSON·IFrame API 대역 검증과 실제 YouTube/worker 수용을 구분한다.
후자의 3개 이상 anchor, 일정 offset/누적 drift, 실제 seek 지연과 재생 상태 확인이 남아 있으면
P09 integration 완료로 처리하지 않는다. 실행·검증·실패 복구의 상세 근거는 [초안 #325](https://github.com/goldmayo/oioi-bwg/pull/325) →
[조회 #326](https://github.com/goldmayo/oioi-bwg/pull/326) → [Peaks #327](https://github.com/goldmayo/oioi-bwg/pull/327) →
[시안 연결 #328](https://github.com/goldmayo/oioi-bwg/pull/328)의 본문에 둔다.

## 3. 검증과 전환 조건

**2026-10-28 OCI Queue 설계의 검증 분리:** 다음 항목은 아직 실행하지 않은 후속 수용 기준이다.
mock·로컬 container의 합격을 실제 Queue/IAM/VM·실기기 합격으로 바꾸어 보고하지 않는다.

| 단계 | 필수 실패 주입/검증 | 실제 OCI·운영에서 추가 확인 |
| --- | --- | --- |
| 요청/접수 | 같은 song/video 동시 요청·연속 클릭·응답 유실 재요청, 요청자별 유일 등록, 새 Job만 Put 호출 | 실제 SDK Put 성공 뒤 socket/내부 기록 응답 유실, null enqueuedAt 상태의 정상 consume |
| 시작/소유권 | start 응답 유실·지연, 이전 컨테이너 정리, 이전 attempt 결과 거절, 단일 Runner 기동 | 실제 receipt/visibility 연장·상실·재전달 및 SDK 인증 갱신. 상실 시 worker 중단 |
| 결과/삭제 | commit 전 실패·commit 응답 유실·중복 terminal·Queue delete 실패, 재생성 실패의 이전 JSON/Cue 보존 | 실제 delete 실패 뒤 terminal 메시지 재전달·정리, FCM 장애 중 결과/내역 보존 |
| 복구/격리 | Runner/worker SIGTERM·SIGKILL·재시작, 고정 payload/이미지·출력 상한, 음원/프로세스 비잔존 | VM/Docker 재시작·잔존 컨테이너 회수, DLQ→최종 실패, 실제 retention과 stale 여유, socket/token/metadata/DB 차단 |
| source/자원 | 합성 입력·전체 timeout·3개 anchor, Runner idle/long poll/실행 중 CPU/RSS | 허용 입력의 재공급·실제 영상 offset/drift, VM에서 Web/Console 자원 경쟁과 분석 동시 1개 |

- P02 전에는 기존 type-check/harness/lint/FSD/unit/format과 필요한 build를 실행한다. 이후 root `pnpm verify`가 workspace별 검사·독립 앱 Steiger·repo 경계 harness·운영 테스트·format·두 앱 build를 실행한다.
- schema 수정 → Drizzle migration 생성 → SQL 검토 → guarded local 적용 → 검증 순서를 지킨다. MFA replay·job 상태/멱등성·동시 저장은 local Docker PostgreSQL에서 확인하고 production 적용은 별도 실행 범위로 둔다.
- P07의 새 reader는 기존 가사/LRC writer 호환과 이관 경합·stale 탭 거절·다른 모드 불변·실패 rollback·공개 중단 후 legacy 재노출 방지를 검증하기 전 활성화하지 않는다.
- UI는 바뀐 selector·로그인·editor/FCM 연결 흐름을 Playwright로 확인한다. root config/harness 변경이 affected 검증에서 빠지거나 다른 workspace 정책을 섞지 않는지도 확인한다.
- P08은 실제 OCI Queue staging에서 long poll·재전달·visibility 연장·DLQ·runner/VM 재시작·결과 commit 후 ack 실패를 확인한다. mock만으로 완료하지 않는다.
- P08에서 연속 클릭·응답 유실 후 재요청·동시 POST가 동일 songId/videoId의 active Job 한 개를 재사용하고 새 message를 추가하지 않는지 검증한다. DB 원자성 수단은 구현 시 선택하고 terminal 이후 재생성은 허용한다.
- P06은 ARM64 빌드 전 동일 Stack의 Plan/Apply·두 repo push/pull·새 secret 읽기·새 Run Command exit 0을 실제 주체로 증명한다. 실패 시 해당 검사에서 중단한다. Web/Console metadata 차단은 Console secret 읽기 권한 추가 전 준비하고 실제 두 앱·재시작/복구 후까지 확인한다.
- P08은 Runner의 Instance Principal과 Queue push/pull 범위, Console의 제한된 Unix socket 호출, worker metadata 차단을 제한된 실제 OCI 환경에서 추가 검증하고 기존 Web/Console 차단을 재검증한다. 같은 VM의 IAM을 process별 권한 분리로 간주하지 않는다.
- Worker의 성공/실패/timeout/강제 종료 후 host/container/volume/log/Sentry에 음원·PCM이 남지 않아야 한다. 같은 videoId의 3개 이상 anchor로 일정 offset과 누적 drift를 구분하며 기준·측정값을 기록한다.
- 공통 알림은 결과와 발송 대기의 atomic commit·기기별 재시도/lease 복구·notificationId 중복 억제를 검증한다. 실제 FCM 수신과 mock을 구분하고, 권한 거부·회수·수신 누락 뒤 DB 재조회로 같은 결과를 보아야 한다.
- 문서 작업은 내용·링크·format만 검사한다. push hook 검증은 hook 실행 결과로 별도 보고한다.

P08의 필수 enqueue 응답 유실 검증은 다음 순서로 수행한다.

1. DB Job 생성에 성공한다.
2. Runner의 OCI Queue PutMessages에 성공한다.
3. Unix socket 성공 응답만 의도적으로 유실시킨다.
4. Console이 socket 실패를 이유로 기존 Job을 즉시 FAILED로 전환하지 않는지 확인한다.
5. Queue message가 Runner에 전달되는지 확인한다.
6. 같은 jobId가 RUNNING → SUCCEEDED로 정상 수렴하는지 확인한다.
7. 전체 시나리오에서 추가 Job/중복 Queue message가 생성되지 않았는지 확인한다.

Runner의 내부 API 기록 후 socket 응답만 유실된 경우와, 기록도 못 해 enqueuedAt이 null인 채 consume되는 경우를 확인한다.
반대로 PutMessages 실패와 message 미생성이 확정된 경우에는 FAILED로 수렴해야 한다.
미확인 QUEUED의 stale 기한은 가장 늦은 enqueue 가능 시점부터 실제 Queue 최대 message retention과 충분한 안전 여유를 포함해 보수적으로 정한다.
기한 이전에는 enqueue 불확실성만으로 FAILED 처리하지 않고 정상 지연 전달을 허용하는지 검증한다.
그 이후에만 기존 stale-job 점검으로 정리하며, 늦은 전달 확인/consume과 경합해 진행된 상태를 역전하지 않아야 한다.
Waveform enqueue에는 Outbox/DB queue/retry scheduler/분산 transaction/범용 reconciliation·broker abstraction을 추가하지 않는다. Notification delivery의 작은 영속 발송 대기는 별도 관심사다.

P06의 공개 유지·Web 인증 종료·F 전환은 [전체 결과](P06-RESULT.md)와 단계별 RESULT로 추적한다.
사전 준비/임시 검증 창의 재개 지시는 현재 절차가 아니다. 반복 작업은 [운영 안내](../../../../ops/oci/README.md)를 따른다.
P06-G는 별도 제안이며 구현 전 Domain/active 계약 개정이 필요하다. P07 선행 조건이 아니다.
Guide writer 전환 뒤 rollback은 새 guide를 읽는 호환 앱으로 제한하고 Song.lyrics의 파괴적 정리는 후속으로 둔다.

각 구현 PR은 `migration_main`을 대상으로 repository template과 한글 Conventional Commit → push → PR 절차를 따른다.
OCI Development 배포는 별도 `migration_main → migration_develop` Promotion PR로 진행하며 active 배포 runbook §21을 따른다.
후속 보류는 새 관리자 편집·초안/공개 UI·복원, Contribution/Discussion·Revision 승인, 현황판·팬 숙지/참여 응답, 공연별 다수 variant, DB role hardening와 공개 Web 회원 알림이다.
자동 BPM/Alignment/GPU/ML, 자체 Queue/Notification framework는 로드맵에 넣지 않는다.
